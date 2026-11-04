import { Router } from "express";
import crypto from "crypto";
import { db } from "../db.js";
import { authenticateJwt } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const billingRouter = Router();

// Run Billing Day batch
billingRouter.post("/run", authenticateJwt, (req, res, next) => {
  try {
    if (req.user.role === "customer") {
      return sendError(res, "FORBIDDEN", "Only staff or admin can execute the billing day run.", [], 403);
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // Find all Active subscriptions where next_billing_date is null or <= todayStr
    const dueSubscriptions = db.prepare(`
      SELECT s.*, p.billing_frequency, p.auto_close_on_end, p.end_date as plan_end_date, u.name as customer_name, u.email as customer_email
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      JOIN users u ON s.customer_id = u.id
      WHERE s.status = 'Active'
        AND (s.next_billing_date IS NULL OR s.next_billing_date <= ?)
    `).all(todayStr);

    const generatedInvoices = [];
    const skippedAlreadyBilled = [];

    // Default tax rate
    const defaultTax = db.prepare("SELECT rate_percentage FROM tax_rules WHERE is_default = 1").get();
    const defaultTaxRate = defaultTax ? Number(defaultTax.rate_percentage) : 18.0;

    for (const sub of dueSubscriptions) {
      // Auto-close check: if plan or sub has ended and auto_close is enabled
      if (sub.auto_close_on_end && sub.expiry_date && sub.expiry_date < todayStr) {
        db.prepare("UPDATE subscriptions SET status = 'Closed' WHERE id = ?").run(sub.id);
        continue;
      }

      // Idempotency check: ensure an invoice has not already been generated for this subscription today
      const alreadyBilled = db.prepare(`
        SELECT id, invoice_number FROM invoices
        WHERE subscription_id = ? AND issue_date = ?
      `).get(sub.id, todayStr);

      if (alreadyBilled) {
        skippedAlreadyBilled.push({ sub_number: sub.sub_number, invoice_number: alreadyBilled.invoice_number });
        continue;
      }

      const lines = JSON.parse(sub.lines_json || "[]");
      let subtotal = 0;
      let tax_amount = 0;

      const invoiceLines = lines.map((line) => {
        const qty = Number(line.quantity) || 1;
        const unitPrice = Number(line.unit_price) || 0;
        const lineSub = qty * unitPrice;
        const lineTaxRate = Number(line.tax_rate) || defaultTaxRate;
        const lineTax = (lineSub * lineTaxRate) / 100;
        subtotal += lineSub;
        tax_amount += lineTax;
        return {
          product_name: line.product_name || "Subscription Item",
          variant_name: line.variant_name || null,
          quantity: qty,
          unit_price: unitPrice,
          tax_rate: lineTaxRate,
          tax_amount: lineTax,
          total: lineSub + lineTax,
        };
      });

      // Apply discount if attached to subscription
      let discountAmount = 0;
      if (sub.discount_id) {
        const discount = db.prepare("SELECT * FROM discounts WHERE id = ? AND is_active = 1").get(sub.discount_id);
        if (discount && (!discount.end_date || discount.end_date >= todayStr) && discount.current_uses < discount.max_uses) {
          if (discount.type === "percentage") {
            discountAmount = (subtotal * discount.value) / 100;
          } else {
            discountAmount = Math.min(discount.value, subtotal);
          }
          // Increment discount usage
          db.prepare("UPDATE discounts SET current_uses = current_uses + 1 WHERE id = ?").run(discount.id);
        }
      }

      const totalAmount = Math.max(0, subtotal - discountAmount + tax_amount);

      const invCount = db.prepare("SELECT COUNT(*) as count FROM invoices").get().count;
      const invoiceNumber = `INV-2026-${String(invCount + 1).padStart(4, "0")}`;
      const invId = "inv_" + crypto.randomUUID().substring(0, 8);

      // Determine due date based on payment terms
      let daysToAdd = 30;
      if (sub.payment_terms === "immediate") daysToAdd = 0;
      else if (sub.payment_terms === "net_15") daysToAdd = 15;
      else if (sub.payment_terms === "net_30") daysToAdd = 30;
      const dueDate = new Date(Date.now() + daysToAdd * 86400000).toISOString().split("T")[0];

      db.prepare(`
        INSERT INTO invoices (id, invoice_number, subscription_id, customer_id, status, issue_date, due_date, subtotal, discount_amount, tax_amount, total_amount, lines_json, created_at)
        VALUES (?, ?, ?, ?, 'Draft', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(invId, invoiceNumber, sub.id, sub.customer_id, todayStr, dueDate, subtotal, discountAmount, tax_amount, totalAmount, JSON.stringify(invoiceLines), new Date().toISOString());

      // Advance next_billing_date
      let intervalDays = 30;
      if (sub.billing_frequency === "daily") intervalDays = 1;
      else if (sub.billing_frequency === "weekly") intervalDays = 7;
      else if (sub.billing_frequency === "monthly") intervalDays = 30;
      else if (sub.billing_frequency === "yearly") intervalDays = 365;

      const nextDate = new Date(Date.now() + intervalDays * 86400000).toISOString().split("T")[0];

      db.prepare(`
        UPDATE subscriptions
        SET last_billed_date = ?, next_billing_date = ?
        WHERE id = ?
      `).run(todayStr, nextDate, sub.id);

      generatedInvoices.push({
        id: invId,
        invoice_number: invoiceNumber,
        customer_name: sub.customer_name,
        sub_number: sub.sub_number,
        total_amount: totalAmount,
        due_date: dueDate,
      });
    }

    return sendSuccess(res, {
      total_due_subscriptions: dueSubscriptions.length,
      invoices_generated: generatedInvoices.length,
      invoices: generatedInvoices,
      skipped_already_billed: skippedAlreadyBilled,
      billing_run_date: todayStr,
    }, `Billing day completed. ${generatedInvoices.length} invoices generated successfully.`);
  } catch (err) {
    return next(err);
  }
});

