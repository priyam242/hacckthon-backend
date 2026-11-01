import { Router } from "express";
import { z } from "zod";
import { authenticateJwt } from "../middleware/auth.js";

export const itemsRouter = Router();

const items = [];

const itemSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
});

itemsRouter.get("/", (req, res) => {
  return res.json(items);
});

itemsRouter.post("/", authenticateJwt, (req, res, next) => {
  try {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        type: "https://tools.ietf.org/html/rfc7807#section-3",
        title: "Validation Error",
        status: 422,
        detail: "Validation failed for item creation.",
        instance: req.originalUrl,
        invalid_params: parsed.error.issues.map((i) => ({
          name: i.path.join("."),
          reason: i.message,
        })),
      });
    }

    const newItem = {
      id: "itm_" + Math.random().toString(36).substring(2, 11),
      title: parsed.data.title,
      description: parsed.data.description || null,
      ownerId: req.user.sub,
      createdAt: new Date().toISOString(),
    };

    items.push(newItem);
    return res.status(201).json(newItem);
  } catch (error) {
    return next(error);
  }
});
