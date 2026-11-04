import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { db } from "../db.js";
import { authenticateJwt } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const productsRouter = Router();

const productSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["software", "addon", "service", "physical"]),
  sales_price: z.number().positive(),
  cost_price: z.number().nonnegative(),
  notes: z.string().optional(),
  variants: z.array(z.object({
    name: z.string(),
    extra_price: z.number().default(0),
  })).optional().default([]),
});

productsRouter.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
  const products = rows.map((p) => ({
    ...p,
    variants: JSON.parse(p.variants_json || "[]"),
  }));
  return sendSuccess(res, products);
});

productsRouter.get("/:id", (req, res) => {
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!p) return sendError(res, "NOT_FOUND", "Product not found", [], 404);
  return sendSuccess(res, { ...p, variants: JSON.parse(p.variants_json || "[]") });
});

productsRouter.post("/", authenticateJwt, (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return sendError(res, "FORBIDDEN", "Only admin can create products.", [], 403);
    }
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message, [], 422);
    }

    const { name, type, sales_price, cost_price, notes, variants } = parsed.data;
    const id = "prod_" + crypto.randomUUID().substring(0, 8);
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO products (id, name, type, sales_price, cost_price, notes, variants_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, type, sales_price, cost_price, notes || null, JSON.stringify(variants), createdAt);

    return sendSuccess(res, { id, name, type, sales_price, cost_price, notes, variants, created_at: createdAt }, "Product created", null, 201);
  } catch (err) {
    return next(err);
  }
});

productsRouter.put("/:id", authenticateJwt, (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return sendError(res, "FORBIDDEN", "Only admin can update products.", [], 403);
    }
    const { name, type, sales_price, cost_price, notes, variants } = req.body;
    db.prepare(`
      UPDATE products
      SET name = COALESCE(?, name),
          type = COALESCE(?, type),
          sales_price = COALESCE(?, sales_price),
          cost_price = COALESCE(?, cost_price),
          notes = COALESCE(?, notes),
          variants_json = COALESCE(?, variants_json)
      WHERE id = ?
    `).run(name, type, sales_price, cost_price, notes, variants ? JSON.stringify(variants) : null, req.params.id);

    return sendSuccess(res, { id: req.params.id }, "Product updated");
  } catch (err) {
    return next(err);
  }
});

productsRouter.delete("/:id", authenticateJwt, (req, res) => {
  if (req.user.role !== "admin") return sendError(res, "FORBIDDEN", "Admin only", [], 403);
  db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  return sendSuccess(res, null, "Product deleted");
});

