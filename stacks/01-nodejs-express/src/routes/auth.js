import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { authenticateJwt } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const authRouter = Router();

const users = new Map();

// Seed standard admin and manager
(async () => {
  const adminHash = await bcrypt.hash("Admin@123", 10);
  users.set("u001", {
    id: "u001",
    name: "Arjun Sharma",
    email: "admin@demo.com",
    username: "admin",
    password: adminHash,
    role: "admin",
    createdAt: new Date().toISOString(),
  });
})();

const signupSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email(),
  username: z.string().min(3).optional(),
  password: z.string().min(6),
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
        "Request validation failed.",
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        422
      );
    }

    const { email, password, name, username } = parsed.data;
    const finalUsername = username || email.split("@")[0];
    const finalName = name || finalUsername;

    for (const u of users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase() || u.username === finalUsername) {
        return sendError(res, "CONFLICT", "User with this email or username already exists.", [], 409);
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = "usr_" + Math.random().toString(36).substring(2, 11);
    const newUser = {
      id: userId,
      name: finalName,
      email: email.toLowerCase(),
      username: finalUsername,
      password: hashedPassword,
      role: "user",
      createdAt: new Date().toISOString(),
    };

    users.set(userId, newUser);

    const accessToken = jwt.sign(
      { sub: newUser.id, username: newUser.username, role: newUser.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );
    const refreshToken = jwt.sign(
      { sub: newUser.id, type: "refresh" },
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    return sendSuccess(
      res,
      {
        user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
        accessToken,
        refreshToken,
      },
      "User registered successfully",
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
      return sendError(res, "VALIDATION_ERROR", "Invalid login credentials format.", [], 422);
    }

    const identifier = req.body.email || req.body.username || req.body.usernameOrEmail;
    const password = req.body.password;

    if (!identifier || !password) {
      return sendError(res, "VALIDATION_ERROR", "Email and password are required.", [], 422);
    }

    let foundUser = null;
    for (const u of users.values()) {
      if (u.email.toLowerCase() === identifier.toLowerCase() || u.username === identifier) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser || !(await bcrypt.compare(password, foundUser.password))) {
      return sendError(res, "UNAUTHORIZED", "Invalid email or password.", [], 401);
    }

    const accessToken = jwt.sign(
      { sub: foundUser.id, username: foundUser.username, role: foundUser.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );
    const refreshToken = jwt.sign(
      { sub: foundUser.id, type: "refresh" },
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    return sendSuccess(res, {
      user: { id: foundUser.id, name: foundUser.name, email: foundUser.email, role: foundUser.role },
      accessToken,
      refreshToken,
      access_token: accessToken, // dual compat
    }, "Authentication successful");
  } catch (error) {
    return next(error);
  }
});

authRouter.get("/me", authenticateJwt, (req, res) => {
  const user = users.get(req.user.sub);
  if (!user) {
    return sendError(res, "NOT_FOUND", "User record not found.", [], 404);
  }

  return sendSuccess(res, {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
  });
});

authRouter.post("/refresh", (req, res) => {
  return sendSuccess(res, { accessToken: "new-token", refreshToken: "new-refresh" }, "Token refreshed");
});

authRouter.post("/logout", authenticateJwt, (req, res) => {
  return sendSuccess(res, null, "Logged out successfully");
});
