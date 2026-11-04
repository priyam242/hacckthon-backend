import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { db } from "../db.js";
import { authenticateJwt } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const discountsRouter = Router();

const discountSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  type: z.enum(["fixed", "percentage"]),
  value: z.number().positive(),
  min_purchase: z.number().nonnegative().default(0),
  min_quantity: z.number().int().min(1).default(1),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  max_uses: z.number().int().positive().default(100),
  scope: z.enum(["whole_subscription", "specific_product"]),
  target_product_id: z.string().optional().nullable(),
});

discountsRouter.get("/", authenticateJwt, (req, res) => {
  const rows = db.prepare("SELECT * FROM discounts ORDER BY created_at DESC").all();
  return sendSuccess(res, rows);
});

discountsRouter.post("/", authenticateJwt, (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return sendError(res, "FORBIDDEN", "Only the admin can create discount rules.", [], 403);
    }

    const parsed = discountSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message, [], 422);
    }

    const { name, code, type, value, min_purchase, min_quantity, start_date, end_date, max_uses, scope, target_product_id } = parsed.data;

    const existing = db.prepare("SELECT id FROM discounts WHERE UPPER(code) = UPPER(?)").get(code);
    if (existing) {
      return sendError(res, "CONFLICT", "A discount rule with this coupon code already exists.", [], 409);
    }

    const id = "disc_" + crypto.randomUUID().substring(0, 8);
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO discounts (id, name, code, type, value, min_purchase, min_quantity, start_date, end_date, max_uses, current_uses, scope, target_product_id, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?)
    `).run(id, name, code.toUpperCase(), type, value, min_purchase, min_quantity, start_date || null, end_date || null, max_uses, scope, target_product_id || null, createdAt);

    return sendSuccess(res, { id, code: code.toUpperCase(), value, type, scope }, "Discount rule created", null, 201);
  } catch (err) {
    return next(err);
  }
});

// Validate discount code for a purchase / quote
discountsRouter.post("/validate", authenticateJwt, (req, res) => {
  const { code, amount = 0, quantity = 1, product_ids = [] } = req.body;
  if (!code) return sendError(res, "VALIDATION_ERROR", "Discount code is required", [], 422);

  const discount = db.prepare("SELECT * FROM discounts WHERE UPPER(code) = UPPER(?) AND is_active = 1").get(code);
  if (!discount) {
    return sendError(res, "NOT_FOUND", "Discount code does not exist or is inactive.", [], 404);
  }

  const today = new Date().toISOString().split("T")[0];
  if (discount.start_date && discount.start_date > today) {
    return sendError(res, "INVALID_DISCOUNT", "Discount is not yet active.", [], 400);
  }
  if (discount.end_date && discount.end_date < today) {
    return sendError(res, "INVALID_DISCOUNT", "Discount has expired.", [], 400);
  }
  if (discount.current_uses >= discount.max_uses) {
    return sendError(res, "INVALID_DISCOUNT", "Discount usage limit has been exhausted.", [], 400);
  }
  if (amount < discount.min_purchase) {
    return sendError(res, "INVALID_DISCOUNT", `Minimum purchase amount of $${discount.min_purchase} required.`, [], 400);
  }
  if (quantity < discount.min_quantity) {
    return sendError(res, "INVALID_DISCOUNT", `Minimum quantity of ${discount.min_quantity} seats/units required.`, [], 400);
  }
  if (discount.scope === "specific_product" && !product_ids.includes(discount.target_product_id)) {
    return sendError(res, "INVALID_DISCOUNT", "Discount is only valid for a specific product not in this order.", [], 400);
  }

  let calculatedDiscount = 0;
  if (discount.type === "percentage") {
    calculatedDiscount = (amount * discount.value) / 100;
  } else {
    calculatedDiscount = Math.min(amount, discount.value);
  }

  return sendSuccess(res, {
    valid: true,
    discount_id: discount.id,
    code: discount.code,
    name: discount.name,
    type: discount.type,
    value: discount.value,
    discount_amount: calculatedDiscount,
  }, "Discount code is valid");
});

