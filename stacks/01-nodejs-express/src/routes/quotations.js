import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { db } from "../db.js";
import { authenticateJwt } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const quotationsRouter = Router();

// Templates
quotationsRouter.get("/templates", (req, res) => {
  const templates = db.prepare("SELECT * FROM quotation_templates ORDER BY created_at DESC").all();
  return sendSuccess(res, templates.map((t) => ({ ...t, lines: JSON.parse(t.lines_json || "[]") })));
});

quotationsRouter.post("/templates", authenticateJwt, (req, res, next) => {
  try {
    if (req.user.role === "customer") return sendError(res, "FORBIDDEN", "Internal team only", [], 403);
    const { name, plan_id, validity_days = 30, lines = [] } = req.body;
    if (!name) return sendError(res, "VALIDATION_ERROR", "Template name is required", [], 422);

    const id = "tpl_" + crypto.randomUUID().substring(0, 8);
    db.prepare(`
      INSERT INTO quotation_templates (id, name, plan_id, validity_days, lines_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, plan_id || null, validity_days, JSON.stringify(lines), new Date().toISOString());

    return sendSuccess(res, { id, name, plan_id, validity_days, lines }, "Template created", null, 201);
  } catch (err) {
    return next(err);
  }
});

// Quotations list
quotationsRouter.get("/", authenticateJwt, (req, res) => {
  let rows;
  if (req.user.role === "customer") {
    rows = db.prepare("SELECT * FROM quotations WHERE customer_id = ? ORDER BY created_at DESC").all(req.user.sub);
  } else {
    rows = db.prepare("SELECT * FROM quotations ORDER BY created_at DESC").all();
  }
  return sendSuccess(res, rows.map((q) => ({ ...q, lines: JSON.parse(q.lines_json || "[]") })));
});

// Create Quotation (from template or scratch)
quotationsRouter.post("/", authenticateJwt, (req, res, next) => {
  try {
    if (req.user.role === "customer") return sendError(res, "FORBIDDEN", "Customers cannot author quotations", [], 403);

    const { customer_id, plan_id, template_id, lines, payment_terms = "net_30", validity_days = 30 } = req.body;

    if (!customer_id || !plan_id) {
      return sendError(res, "VALIDATION_ERROR", "customer_id and plan_id are required", [], 422);
    }

    let finalLines = lines || [];
    if (template_id && (!lines || lines.length === 0)) {
      const tpl = db.prepare("SELECT * FROM quotation_templates WHERE id = ?").get(template_id);
      if (tpl) {
        finalLines = JSON.parse(tpl.lines_json || "[]");
      }
    }

    let subtotal = 0;
    let tax_amount = 0;
    finalLines = finalLines.map((line) => {
      const lineSub = (Number(line.unit_price) || 0) * (Number(line.quantity) || 1);
      const taxRate = Number(line.tax_rate) || 18.0;
      const lineTax = (lineSub * taxRate) / 100;
      subtotal += lineSub;
      tax_amount += lineTax;
      return {
        ...line,
        amount: lineSub + lineTax,
      };
    });

    const total_amount = subtotal + tax_amount;
    const count = db.prepare("SELECT COUNT(*) as count FROM quotations").get().count;
    const quote_number = `QUO-2026-${String(count + 1).padStart(4, "0")}`;
    const id = "quo_" + crypto.randomUUID().substring(0, 8);
    const validUntil = new Date(Date.now() + validity_days * 86400000).toISOString().split("T")[0];

    db.prepare(`
      INSERT INTO quotations (id, quote_number, customer_id, plan_id, status, valid_until, lines_json, payment_terms, subtotal, tax_amount, total_amount, created_at)
      VALUES (?, ?, ?, ?, 'Draft', ?, ?, ?, ?, ?, ?, ?)
    `).run(id, quote_number, customer_id, plan_id, validUntil, JSON.stringify(finalLines), payment_terms, subtotal, tax_amount, total_amount, new Date().toISOString());

    return sendSuccess(res, { id, quote_number, customer_id, plan_id, subtotal, tax_amount, total_amount, validUntil, lines: finalLines }, "Quotation created", null, 201);
  } catch (err) {
    return next(err);
  }
});

// Convert Quote to Subscription
quotationsRouter.post("/:id/convert", authenticateJwt, (req, res, next) => {
  try {
    const quote = db.prepare("SELECT * FROM quotations WHERE id = ?").get(req.params.id);
    if (!quote) return sendError(res, "NOT_FOUND", "Quotation not found", [], 404);

    const subCount = db.prepare("SELECT COUNT(*) as count FROM subscriptions").get().count;
    const sub_number = `SUB-2026-${String(subCount + 1).padStart(4, "0")}`;
    const subId = "sub_" + crypto.randomUUID().substring(0, 8);
    const today = new Date().toISOString().split("T")[0];
    const expiry = new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];

    db.prepare(`
      INSERT INTO subscriptions (id, sub_number, customer_id, plan_id, status, start_date, expiry_date, payment_terms, lines_json, next_billing_date, created_at)
      VALUES (?, ?, ?, ?, 'Confirmed', ?, ?, ?, ?, ?, ?)
    `).run(subId, sub_number, quote.customer_id, quote.plan_id, today, expiry, quote.payment_terms, quote.lines_json, today, new Date().toISOString());

    db.prepare("UPDATE quotations SET status = 'Confirmed' WHERE id = ?").run(req.params.id);

    return sendSuccess(res, { subscription_id: subId, sub_number, status: "Confirmed" }, "Quotation successfully converted to Subscription!");
  } catch (err) {
    return next(err);
  }
});

