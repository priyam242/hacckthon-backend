import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { authenticateJwt } from "../middleware/auth.js";

export const authRouter = Router();

// In-memory user store for instant hackathon zero-config operation
const users = new Map();

const signupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(6),
});

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/signup", async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        type: "https://tools.ietf.org/html/rfc7807#section-3",
        title: "Validation Error",
        status: 422,
        detail: "Request validation failed.",
        instance: req.originalUrl,
        invalid_params: parsed.error.issues.map((i) => ({
          name: i.path.join("."),
          reason: i.message,
        })),
      });
    }

    const { email, username, password } = parsed.data;

    for (const u of users.values()) {
      if (u.email === email || u.username === username) {
        return res.status(409).json({
          type: "about:blank",
          title: "Conflict",
          status: 409,
          detail: "User with this email or username already exists.",
          instance: req.originalUrl,
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = "usr_" + Math.random().toString(36).substring(2, 11);
    const newUser = {
      id: userId,
      email,
      username,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    users.set(userId, newUser);

    return res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      createdAt: newUser.createdAt,
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        type: "about:blank",
        title: "Validation Error",
        status: 422,
        detail: "Invalid login credentials format.",
        instance: req.originalUrl,
      });
    }

    const { usernameOrEmail, password } = parsed.data;
    let foundUser = null;

    for (const u of users.values()) {
      if (u.email === usernameOrEmail || u.username === usernameOrEmail) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser || !(await bcrypt.compare(password, foundUser.password))) {
      return res.status(401).json({
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        detail: "Invalid username/email or password.",
        instance: req.originalUrl,
      });
    }

    const token = jwt.sign(
      { sub: foundUser.id, username: foundUser.username },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    return res.json({
      access_token: token,
      token_type: "bearer",
      user: {
        id: foundUser.id,
        email: foundUser.email,
        username: foundUser.username,
      },
    });
  } catch (error) {
    return next(error);
  }
});

authRouter.get("/me", authenticateJwt, (req, res) => {
  const user = users.get(req.user.sub);
  if (!user) {
    return res.status(404).json({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: "User record no longer exists.",
      instance: req.originalUrl,
    });
  }

  return res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    createdAt: user.createdAt,
  });
});
