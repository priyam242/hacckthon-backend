import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { db } from "../db.js";
import { authenticateJwt } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const taxesRouter = Router();

taxesRouter.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM tax_rules WHERE is_active = 1").all();
  return sendSuccess(res, rows);
});

taxesRouter.post("/", authenticateJwt, (req, res) => {
  if (req.user.role !== "admin") return sendError(res, "FORBIDDEN", "Admin only", [], 403);
  const { name, rate_percentage, is_default = 0 } = req.body;
  if (!name || rate_percentage === undefined) {
    return sendError(res, "VALIDATION_ERROR", "Name and rate_percentage are required", [], 422);
  }

  const id = "tax_" + crypto.randomUUID().substring(0, 8);
  if (is_default) {
    db.prepare("UPDATE tax_rules SET is_default = 0").run();
  }

  db.prepare(`
    INSERT INTO tax_rules (id, name, rate_percentage, is_default, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run(id, name, Number(rate_percentage), is_default ? 1 : 0);

  return sendSuccess(res, { id, name, rate_percentage }, "Tax rule created", null, 201);
});

