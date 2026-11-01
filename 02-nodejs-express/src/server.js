import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { itemsRouter } from "./routes/items.js";
import { aiRouter } from "./routes/ai.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

// Middlewares
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// In-Memory Rate Limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.setHeader("Content-Type", "application/problem+json");
    res.status(429).json({
      type: "about:blank",
      title: "Too Many Requests",
      status: 429,
      detail: "Rate limit exceeded. Please try again later.",
      instance: req.originalUrl,
    });
  },
});
app.use(limiter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "hackathon-nodejs-express-backend",
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Hackathon Express.js Backend is running!",
    health: "/health",
    auth: "/api/auth",
    items: "/api/items",
    ai: "/api/ai",
  });
});

// Mount Routes
app.use("/api/auth", authRouter);
app.use("/api/items", itemsRouter);
app.use("/api/ai", aiRouter);

// Catch-all 404 handler in RFC 7807 format
app.use((req, res) => {
  res.setHeader("Content-Type", "application/problem+json");
  res.status(404).json({
    type: "about:blank",
    title: "Not Found",
    status: 404,
    detail: `The endpoint ${req.method} ${req.originalUrl} does not exist.`,
    instance: req.originalUrl,
  });
});

// Global Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    console.log(`[Express Backend] Listening at http://localhost:${config.port}`);
  });
}

export default app;
