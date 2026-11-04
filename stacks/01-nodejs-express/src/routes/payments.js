import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { db } from "../db.js";
import { authenticateJwt } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const paymentsRouter = Router();

const paymentSchema = z.object({
  invoice_id: z.string().min(1),
  method: z.enum(["Credit Card", "Bank Transfer", "UPI", "Cash"]),
  amount: z.number().positive(),
  payment_date: z.string().optional(),
  note: z.string().optional(),
});

paymentsRouter.get("/", authenticateJwt, (req, res) => {
  let rows;
  if (req.user.role === "customer") {
    rows = db.prepare(`
      SELECT p.*, i.invoice_number, i.total_amount as invoice_total
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      WHERE i.customer_id = ?
      ORDER BY p.payment_date DESC
    `).all(req.user.sub);
  } else {
    rows = db.prepare(`
      SELECT p.*, i.invoice_number, i.total_amount as invoice_total, u.name as customer_name
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN users u ON i.customer_id = u.id
      ORDER BY p.payment_date DESC
    `).all();
  }
  return sendSuccess(res, rows);
});

// Record Payment
paymentsRouter.post("/", authenticateJwt, (req, res, next) => {
  try {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message, [], 422);
    }

    const { invoice_id, method, amount, payment_date, note } = parsed.data;
    const inv = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoice_id);
    if (!inv) return sendError(res, "NOT_FOUND", "Invoice not found", [], 404);

    if (inv.status === "Paid") {
      return sendError(res, "CONFLICT", "This invoice has already been fully paid.", [], 409);
    }

    const id = "pay_" + crypto.randomUUID().substring(0, 8);
    const payDate = payment_date || new Date().toISOString().split("T")[0];

    db.prepare(`
      INSERT INTO payments (id, invoice_id, method, amount, payment_date, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, invoice_id, method, amount, payDate, note || null, new Date().toISOString());

    // Calculate total payments recorded for this invoice
    const totalPaidRow = db.prepare("SELECT SUM(amount) as total FROM payments WHERE invoice_id = ?").get(invoice_id);
    const totalPaid = Number(totalPaidRow.total) || 0;

    // Auto mark as Paid if fully covered
    let newStatus = inv.status;
    if (totalPaid >= Number(inv.total_amount)) {
      newStatus = "Paid";
      db.prepare("UPDATE invoices SET status = 'Paid' WHERE id = ?").run(invoice_id);
    }

    return sendSuccess(res, {
      payment_id: id,
      invoice_id,
      amount_paid: amount,
      total_paid: totalPaid,
      invoice_status: newStatus,
    }, `Payment of $${amount} recorded successfully. Invoice status: ${newStatus}`, null, 201);
  } catch (err) {
    return next(err);
  }
});

