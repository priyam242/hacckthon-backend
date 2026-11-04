import { Router } from "express";
import { db } from "../db.js";
import { authenticateJwt } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const invoicesRouter = Router();

invoicesRouter.get("/", authenticateJwt, (req, res) => {
  let rows;
  if (req.user.role === "customer") {
    rows = db.prepare(`
      SELECT i.*, u.name as customer_name, u.email as customer_email, s.sub_number
      FROM invoices i
      JOIN users u ON i.customer_id = u.id
      LEFT JOIN subscriptions s ON i.subscription_id = s.id
      WHERE i.customer_id = ?
      ORDER BY i.created_at DESC
    `).all(req.user.sub);
  } else {
    rows = db.prepare(`
      SELECT i.*, u.name as customer_name, u.email as customer_email, s.sub_number
      FROM invoices i
      JOIN users u ON i.customer_id = u.id
      LEFT JOIN subscriptions s ON i.subscription_id = s.id
      ORDER BY i.created_at DESC
    `).all();
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const invoices = rows.map((inv) => ({
    ...inv,
    lines: JSON.parse(inv.lines_json || "[]"),
    is_overdue: inv.status !== "Paid" && inv.status !== "Cancelled" && inv.due_date < todayStr,
  }));

  return sendSuccess(res, invoices);
});

invoicesRouter.get("/:id", authenticateJwt, (req, res) => {
  const inv = db.prepare(`
    SELECT i.*, u.name as customer_name, u.email as customer_email, u.company_name, s.sub_number
    FROM invoices i
    JOIN users u ON i.customer_id = u.id
    LEFT JOIN subscriptions s ON i.subscription_id = s.id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!inv) return sendError(res, "NOT_FOUND", "Invoice not found", [], 404);

  if (req.user.role === "customer" && inv.customer_id !== req.user.sub) {
    return sendError(res, "FORBIDDEN", "You can only view your own invoices.", [], 403);
  }

  const payments = db.prepare("SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC").all(inv.id);
  const paidTotal = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return sendSuccess(res, {
    ...inv,
    lines: JSON.parse(inv.lines_json || "[]"),
    payments,
    amount_paid: paidTotal,
    amount_due: Math.max(0, Number(inv.total_amount) - paidTotal),
  });
});

// Confirm invoice (Draft -> Confirmed)
invoicesRouter.post("/:id/confirm", authenticateJwt, (req, res) => {
  const inv = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
  if (!inv) return sendError(res, "NOT_FOUND", "Invoice not found", [], 404);

  if (inv.status !== "Draft") {
    return sendError(res, "BAD_REQUEST", `Cannot confirm invoice with status '${inv.status}'`, [], 400);
  }

  db.prepare("UPDATE invoices SET status = 'Confirmed' WHERE id = ?").run(req.params.id);
  return sendSuccess(res, { id: req.params.id, status: "Confirmed" }, "Invoice confirmed successfully");
});

// Cancel invoice
invoicesRouter.post("/:id/cancel", authenticateJwt, (req, res) => {
  if (req.user.role === "customer") return sendError(res, "FORBIDDEN", "Only staff or admin can cancel invoices", [], 403);

  const inv = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
  if (!inv) return sendError(res, "NOT_FOUND", "Invoice not found", [], 404);

  db.prepare("UPDATE invoices SET status = 'Cancelled' WHERE id = ?").run(req.params.id);
  return sendSuccess(res, { id: req.params.id, status: "Cancelled" }, "Invoice cancelled");
});

// Send invoice
invoicesRouter.post("/:id/send", authenticateJwt, (req, res) => {
  const inv = db.prepare(`
    SELECT i.*, u.email as customer_email, u.name as customer_name
    FROM invoices i
    JOIN users u ON i.customer_id = u.id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!inv) return sendError(res, "NOT_FOUND", "Invoice not found", [], 404);

  const sentAt = new Date().toISOString();
  db.prepare("UPDATE invoices SET sent_at = ? WHERE id = ?").run(sentAt, req.params.id);

  return sendSuccess(res, {
    id: req.params.id,
    sent_to: inv.customer_email,
    sent_at: sentAt,
  }, `Invoice dispatched to ${inv.customer_email}`);
});

// Printable HTML invoice
invoicesRouter.get("/:id/print", authenticateJwt, (req, res) => {
  const inv = db.prepare(`
    SELECT i.*, u.name as customer_name, u.email as customer_email, u.company_name
    FROM invoices i
    JOIN users u ON i.customer_id = u.id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!inv) return res.status(404).send("Invoice Not Found");

  const lines = JSON.parse(inv.lines_json || "[]");
  const linesHtml = lines.map((l) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${l.product_name} ${l.variant_name ? `<br><small style="color:#64748b;">Variant: ${l.variant_name}</small>` : ""}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:center;">${l.quantity}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:right;">$${Number(l.unit_price).toFixed(2)}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:right;">${l.tax_rate}%</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">$${Number(l.total).toFixed(2)}</td>
    </tr>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${inv.invoice_number} - Brightloop Software</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 40px auto; max-width: 800px; padding: 20px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
        .logo { font-size: 28px; font-weight: 800; color: #0f172a; }
        .badge { display: inline-block; padding: 4px 10px; font-size: 12px; font-weight: 700; border-radius: 4px; text-transform: uppercase; }
        .badge-paid { background: #dcfce7; color: #166534; }
        .badge-confirmed { background: #e0e7ff; color: #3730a3; }
        .badge-draft { background: #f1f5f9; color: #475569; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; margin: 30px 0; gap: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f8fafc; padding: 12px 10px; text-align: left; font-size: 13px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
        .totals { margin-top: 20px; width: 300px; margin-left: auto; }
        .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
        .grand-total { font-size: 18px; font-weight: 800; border-top: 2px solid #0f172a; padding-top: 10px; }
        .print-btn { background: #0f172a; color: white; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 600; margin-bottom: 20px; }
        @media print { .print-btn { display: none; } }
      </style>
    </head>
    <body>
      <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
      <div class="header">
        <div>
          <div class="logo">Brightloop Software</div>
          <div style="color: #64748b; font-size: 14px; margin-top: 4px;">Subscription Management & Recurring Billing</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 20px; font-weight: 700;">INVOICE</div>
          <div style="font-weight: 600; margin-top: 4px;">${inv.invoice_number}</div>
          <div style="margin-top: 6px;"><span class="badge badge-${inv.status.toLowerCase()}">${inv.status}</span></div>
        </div>
      </div>

      <div class="details-grid">
        <div>
          <strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">Billed To:</strong>
          <div style="font-weight: 700; font-size: 16px; margin-top: 4px;">${inv.customer_name}</div>
          ${inv.company_name ? `<div>${inv.company_name}</div>` : ""}
          <div style="color: #64748b;">${inv.customer_email}</div>
        </div>
        <div style="text-align: right;">
          <div><strong>Issue Date:</strong> ${inv.issue_date}</div>
          <div style="margin-top: 4px;"><strong>Due Date:</strong> ${inv.due_date}</div>
          ${inv.subscription_id ? `<div style="margin-top: 4px; color:#64748b;">Subscription ID: ${inv.subscription_id}</div>` : ""}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Unit Price</th>
            <th style="text-align:right;">Tax</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${linesHtml}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>$${Number(inv.subtotal).toFixed(2)}</span>
        </div>
        ${inv.discount_amount > 0 ? `
          <div class="totals-row" style="color: #16a34a;">
            <span>Discount:</span>
            <span>-$${Number(inv.discount_amount).toFixed(2)}</span>
          </div>
        ` : ""}
        <div class="totals-row">
          <span>Taxes:</span>
          <span>$${Number(inv.tax_amount).toFixed(2)}</span>
        </div>
        <div class="totals-row grand-total">
          <span>Total Amount:</span>
          <span>$${Number(inv.total_amount).toFixed(2)}</span>
        </div>
      </div>
    </body>
    </html>
  `;

  res.setHeader("Content-Type", "text/html");
  return res.send(html);
});

