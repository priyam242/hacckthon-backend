import { Router } from "express";
import { z } from "zod";
import { authenticateJwt } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const itemsRouter = Router();

const items = [
  {
    id: "itm_001",
    title: "Quantum Edge Processor",
    description: "Ultra low-power neural compute engine for edge inference",
    price: 2499900,
    currency: "INR",
    categoryId: "c001",
    status: "active",
    viewCount: 120,
    likeCount: 15,
    createdAt: new Date().toISOString(),
  },
  {
    id: "itm_002",
    title: "BioSense ECG Monitor",
    description: "Wearable 6-lead clinical grade telemetry sensor",
    price: 899900,
    currency: "INR",
    categoryId: "c002",
    status: "active",
    viewCount: 88,
    likeCount: 9,
    createdAt: new Date().toISOString(),
  }
];

const itemSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  price: z.number().int().positive().optional(),
  categoryId: z.string().optional(),
});

itemsRouter.get("/", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search ? req.query.search.toLowerCase() : "";

  let filtered = items;
  if (search) {
    filtered = items.filter(
      (i) => i.title.toLowerCase().includes(search) || i.description.toLowerCase().includes(search)
    );
  }

  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);

  return sendSuccess(
    res,
    paginated,
    "Items retrieved successfully",
    {
      page,
      limit,
      totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    }
  );
});

itemsRouter.get("/:id", (req, res) => {
  const item = items.find((i) => i.id === req.params.id);
  if (!item) {
    return sendError(res, "NOT_FOUND", "Item not found", [], 404);
  }
  item.viewCount = (item.viewCount || 0) + 1;
  return sendSuccess(res, item);
});

itemsRouter.post("/", authenticateJwt, (req, res, next) => {
  try {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        "VALIDATION_ERROR",
        "Item validation failed.",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        422
      );
    }

    const newItem = {
      id: "itm_" + Math.random().toString(36).substring(2, 11),
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price || 100000,
      currency: "INR",
      categoryId: parsed.data.categoryId || "c001",
      status: "active",
      ownerId: req.user.sub,
      viewCount: 0,
      likeCount: 0,
      createdAt: new Date().toISOString(),
    };

    items.push(newItem);
    return sendSuccess(res, newItem, "Item created successfully", null, 201);
  } catch (error) {
    return next(error);
  }
});
