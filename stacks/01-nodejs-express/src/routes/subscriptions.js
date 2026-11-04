import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { db } from "../db.js";
import { authenticateJwt } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const subscriptionsRouter = Router();

// List subscriptions (filtered by customer role)
subscriptionsRouter.get("/", authenticateJwt, (req, res) => {
  let rows;
  if (req.user.role === "customer") {
    rows = db.prepare(`
      SELECT s.*, u.name as customer_name, u.email as customer_email, p.name as plan_name, p.billing_frequency, p.cost as plan_cost
      FROM subscriptions s
      JOIN users u ON s.customer_id = u.id
      JOIN plans p ON s.plan_id = p.id
      WHERE s.customer_id = ?
      ORDER BY s.created_at DESC
    `).all(req.user.sub);
  } else {
    rows = db.prepare(`
      SELECT s.*, u.name as customer_name, u.email as customer_email, p.name as plan_name, p.billing_frequency, p.cost as plan_cost
      FROM subscriptions s
      JOIN users u ON s.customer_id = u.id
      JOIN plans p ON s.plan_id = p.id
      ORDER BY s.created_at DESC
    `).all();
  }

  const subscriptions = rows.map((s) => ({
    ...s,
    lines: JSON.parse(s.lines_json || "[]"),
  }));
  return sendSuccess(res, subscriptions);
});

subscriptionsRouter.get("/:id", authenticateJwt, (req, res) => {
  const s = db.prepare(`
    SELECT s.*, u.name as customer_name, u.email as customer_email, p.name as plan_name, p.billing_frequency
    FROM subscriptions s
    JOIN users u ON s.customer_id = u.id
    JOIN plans p ON s.plan_id = p.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!s) return sendError(res, "NOT_FOUND", "Subscription not found", [], 404);

  if (req.user.role === "customer" && s.customer_id !== req.user.sub) {
    return sendError(res, "FORBIDDEN", "You can only view your own subscriptions.", [], 403);
  }

  return sendSuccess(res, { ...s, lines: JSON.parse(s.lines_json || "[]") });
});

// Create subscription
subscriptionsRouter.post("/", authenticateJwt, (req, res, next) => {
  try {
    const { customer_id, plan_id, start_date, expiry_date, payment_terms = "net_30", lines = [], discount_id } = req.body;
    const finalCustomerId = req.user.role === "customer" ? req.user.sub : (customer_id || req.user.sub);

    const count = db.prepare("SELECT COUNT(*) as count FROM subscriptions").get().count;
    const sub_number = `SUB-2026-${String(count + 1).padStart(4, "0")}`;
    const id = "sub_" + crypto.randomUUID().substring(0, 8);
    const startDate = start_date || new Date().toISOString().split("T")[0];

    db.prepare(`
      INSERT INTO subscriptions (id, sub_number, customer_id, plan_id, status, start_date, expiry_date, payment_terms, lines_json, discount_id, next_billing_date, created_at)
      VALUES (?, ?, ?, ?, 'Draft', ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sub_number, finalCustomerId, plan_id, startDate, expiry_date || null, payment_terms, JSON.stringify(lines), discount_id || null, startDate, new Date().toISOString());

    return sendSuccess(res, { id, sub_number, status: "Draft" }, "Subscription created in Draft status", null, 201);
  } catch (err) {
    return next(err);
  }
});

// State machine updates: Draft -> Quotation -> Confirmed -> Active -> Closed / Paused
subscriptionsRouter.put("/:id/status", authenticateJwt, (req, res) => {
  const { status } = req.body;
  const validStatuses = ["Draft", "Quotation", "Confirmed", "Active", "Paused", "Closed"];
  if (!validStatuses.includes(status)) {
    return sendError(res, "VALIDATION_ERROR", `Invalid status. Must be one of: ${validStatuses.join(", ")}`, [], 422);
  }

  const sub = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(req.params.id);
  if (!sub) return sendError(res, "NOT_FOUND", "Subscription not found", [], 404);

  if (req.user.role === "customer" && !["Paused", "Closed"].includes(status)) {
    return sendError(res, "FORBIDDEN", "Customers can only pause or cancel their own subscriptions.", [], 403);
  }

  db.prepare("UPDATE subscriptions SET status = ? WHERE id = ?").run(status, req.params.id);
  return sendSuccess(res, { id: req.params.id, status }, `Subscription status changed to ${status}`);
});

// Pause / Resume
subscriptionsRouter.post("/:id/pause", authenticateJwt, (req, res) => {
  const sub = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(req.params.id);
  if (!sub) return sendError(res, "NOT_FOUND", "Subscription not found", [], 404);

  const newStatus = sub.status === "Paused" ? "Active" : "Paused";
  db.prepare("UPDATE subscriptions SET status = ? WHERE id = ?").run(newStatus, req.params.id);
  return sendSuccess(res, { id: req.params.id, status: newStatus }, `Subscription ${newStatus.toLowerCase()} successfully`);
});

// Close early
subscriptionsRouter.post("/:id/close", authenticateJwt, (req, res) => {
  const sub = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(req.params.id);
  if (!sub) return sendError(res, "NOT_FOUND", "Subscription not found", [], 404);

  db.prepare("UPDATE subscriptions SET status = 'Closed' WHERE id = ?").run(req.params.id);
  return sendSuccess(res, { id: req.params.id, status: "Closed" }, "Subscription closed early");
});

// Renew
subscriptionsRouter.post("/:id/renew", authenticateJwt, (req, res) => {
  const sub = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(req.params.id);
  if (!sub) return sendError(res, "NOT_FOUND", "Subscription not found", [], 404);

  const currentExpiry = sub.expiry_date ? new Date(sub.expiry_date) : new Date();
  const newExpiry = new Date(currentExpiry.getTime() + 365 * 86400000).toISOString().split("T")[0];

  db.prepare("UPDATE subscriptions SET status = 'Active', expiry_date = ? WHERE id = ?").run(newExpiry, req.params.id);
  return sendSuccess(res, { id: req.params.id, status: "Active", expiry_date: newExpiry }, "Subscription renewed for 1 year");
});

