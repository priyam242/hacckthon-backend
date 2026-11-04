import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { config } from "../config.js";
import { db } from "../db.js";
import { authenticateJwt } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const authRouter = Router();

// Password rule: >8 chars, uppercase, lowercase, special character
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{9,}$/;

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  company_name: z.string().optional(),
  password: z.string().refine(
    (val) => passwordRegex.test(val),
    "Password must be more than 8 characters and include at least one uppercase letter, one lowercase letter, and one special character"
  ),
});

const staffCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().refine((val) => passwordRegex.test(val), "Password does not meet complexity requirements"),
  role: z.enum(["staff", "admin"]).default("staff"),
});

const loginSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().optional(),
  usernameOrEmail: z.string().optional(),
  password: z.string().min(1),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(
        res,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message || "Validation failed",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        422
      );
    }

    const { email, password, name, company_name } = parsed.data;
    const existing = db.prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?)").get(email);
    if (existing) {
      return sendError(res, "CONFLICT", "Each email can belong to only one account.", [], 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = "usr_" + crypto.randomUUID().substring(0, 8);
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, company_name, created_at)
      VALUES (?, ?, ?, ?, 'customer', ?, ?)
    `).run(userId, name, email.toLowerCase(), hashedPassword, company_name || null, createdAt);

    const accessToken = jwt.sign(
      { sub: userId, email: email.toLowerCase(), role: "customer", name },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    return sendSuccess(
      res,
      {
        user: { id: userId, name, email: email.toLowerCase(), role: "customer", company_name },
        accessToken,
        access_token: accessToken,
      },
      "Customer account created successfully",
      null,
      201
    );
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "VALIDATION_ERROR", "Invalid login format", [], 422);
    }

    const identifier = req.body.email || req.body.username || req.body.usernameOrEmail;
    const password = req.body.password;

    if (!identifier || !password) {
      return sendError(res, "VALIDATION_ERROR", "Email and password are required.", [], 422);
    }

    const user = db.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)").get(identifier);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return sendError(res, "UNAUTHORIZED", "Invalid email or password.", [], 401);
    }

    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, name: user.name },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    return sendSuccess(res, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company_name: user.company_name,
      },
      accessToken,
      access_token: accessToken,
    }, "Authentication successful");
  } catch (error) {
    return next(error);
  }
});

authRouter.get("/me", authenticateJwt, (req, res) => {
  const user = db.prepare("SELECT id, name, email, role, company_name, created_at FROM users WHERE id = ?").get(req.user.sub);
  if (!user) {
    return sendError(res, "NOT_FOUND", "User record not found.", [], 404);
  }
  return sendSuccess(res, user);
});

// Admin-only: add new staff member
authRouter.post("/staff", authenticateJwt, async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return sendError(res, "FORBIDDEN", "Only the admin can add a new member of staff.", [], 403);
    }

    const parsed = staffCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message, [], 422);
    }

    const { email, password, name, role } = parsed.data;
    const existing = db.prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?)").get(email);
    if (existing) {
      return sendError(res, "CONFLICT", "Account with this email already exists.", [], 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = "usr_" + crypto.randomUUID().substring(0, 8);
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, company_name, created_at)
      VALUES (?, ?, ?, ?, ?, 'Brightloop Internal', ?)
    `).run(userId, name, email.toLowerCase(), hashedPassword, role, new Date().toISOString());

    return sendSuccess(res, { id: userId, name, email: email.toLowerCase(), role }, "Staff member added successfully", null, 201);
  } catch (err) {
    return next(err);
  }
});

// Forgot Password Flow
authRouter.post("/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email) return sendError(res, "VALIDATION_ERROR", "Email is required.", [], 422);

  const user = db.prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?)").get(email);
  if (!user) {
    // Return success to avoid email enumeration
    return sendSuccess(res, { message: "If registered, a reset link has been dispatched." });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

  db.prepare(`
    INSERT INTO password_resets (id, email, token, expires_at, used)
    VALUES (?, ?, ?, ?, 0)
  `).run("rst_" + crypto.randomUUID().substring(0, 8), email.toLowerCase(), resetToken, expiresAt);

  return sendSuccess(res, {
    message: "Password reset link sent to your registered email.",
    mockResetLink: `/reset-password?token=${resetToken}`,
  });
});

// Reset Password
authRouter.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return sendError(res, "VALIDATION_ERROR", "Token and new password required.", [], 422);
  }

  if (!passwordRegex.test(newPassword)) {
    return sendError(res, "VALIDATION_ERROR", "Password must be >8 characters with uppercase, lowercase and special character.", [], 422);
  }

  const reset = db.prepare("SELECT * FROM password_resets WHERE token = ? AND used = 0").get(token);
  if (!reset || new Date(reset.expires_at) < new Date()) {
    return sendError(res, "INVALID_TOKEN", "Reset token is invalid or has expired.", [], 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE LOWER(email) = LOWER(?)").run(hashedPassword, reset.email);
  db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(reset.id);

  return sendSuccess(res, null, "Password reset successfully. You may now log in.");
});
