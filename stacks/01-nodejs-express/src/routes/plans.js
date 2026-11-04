import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { db } from "../db.js";
import { authenticateJwt } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const plansRouter = Router();

const planSchema = z.object({
  name: z.string().min(2),
  cost: z.number().positive(),
  billing_frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  min_quantity: z.number().int().min(1).default(1),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  auto_close_on_end: z.boolean().default(false),
});

plansRouter.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM plans ORDER BY created_at DESC").all();
  return sendSuccess(res, rows);
});

plansRouter.get("/:id", (req, res) => {
  const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(req.params.id);
  if (!plan) return sendError(res, "NOT_FOUND", "Plan not found", [], 404);
  return sendSuccess(res, plan);
});

plansRouter.post("/", authenticateJwt, (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return sendError(res, "FORBIDDEN", "Only the admin can configure subscription plans.", [], 403);
    }
    const parsed = planSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message, [], 422);
    }

    const { name, cost, billing_frequency, min_quantity, start_date, end_date, auto_close_on_end } = parsed.data;
    const id = "plan_" + crypto.randomUUID().substring(0, 8);
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO plans (id, name, cost, billing_frequency, min_quantity, start_date, end_date, auto_close_on_end, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, name, cost, billing_frequency, min_quantity, start_date || null, end_date || null, auto_close_on_end ? 1 : 0, createdAt);

    return sendSuccess(res, { id, name, cost, billing_frequency, min_quantity, auto_close_on_end }, "Plan created successfully", null, 201);
  } catch (err) {
    return next(err);
  }
});

plansRouter.put("/:id", authenticateJwt, (req, res, next) => {
  try {
    if (req.user.role !== "admin") return sendError(res, "FORBIDDEN", "Admin only", [], 403);
    const { name, cost, billing_frequency, min_quantity, start_date, end_date, auto_close_on_end, is_active } = req.body;

    db.prepare(`
      UPDATE plans
      SET name = COALESCE(?, name),
          cost = COALESCE(?, cost),
          billing_frequency = COALESCE(?, billing_frequency),
          min_quantity = COALESCE(?, min_quantity),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          auto_close_on_end = COALESCE(?, auto_close_on_end),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(name, cost, billing_frequency, min_quantity, start_date, end_date, auto_close_on_end !== undefined ? (auto_close_on_end ? 1 : 0) : null, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);

    return sendSuccess(res, { id: req.params.id }, "Plan updated");
  } catch (err) {
    return next(err);
  }
});

plansRouter.post("/:id/pause", authenticateJwt, (req, res) => {
  if (req.user.role !== "admin") return sendError(res, "FORBIDDEN", "Admin only", [], 403);
  const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(req.params.id);
  if (!plan) return sendError(res, "NOT_FOUND", "Plan not found", [], 404);

  const newStatus = plan.is_active ? 0 : 1;
  db.prepare("UPDATE plans SET is_active = ? WHERE id = ?").run(newStatus, req.params.id);
  return sendSuccess(res, { id: req.params.id, is_active: newStatus }, newStatus ? "Plan resumed" : "Plan paused");
});

