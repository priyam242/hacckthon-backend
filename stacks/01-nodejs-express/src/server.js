import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { itemsRouter } from "./routes/items.js";
import { aiRouter } from "./routes/ai.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { sendSuccess, sendError } from "./utils/response.js";

const app = express();

// Middlewares
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// X-Request-Id Middleware
app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("X-Request-Id", requestId);
  req.id = requestId;
  next();
});

// In-Memory Rate Limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, "RATE_LIMIT_EXCEEDED", "Rate limit exceeded. Please try again later.", [], 429);
  },
});
app.use(limiter);

// Health check endpoint
const handleHealth = (req, res) => {
  sendSuccess(res, {
    status: "healthy",
    service: "hackathon-nodejs-express-backend",
    environment: config.nodeEnv,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};

app.get("/health", handleHealth);
app.get("/api/health", handleHealth);
app.get("/api/health/live", (req, res) => res.status(200).send("OK"));
app.get("/api/health/ready", (req, res) => res.status(200).send("READY"));

app.get("/", (req, res) => {
  sendSuccess(res, {
    message: "Backend Arsenal Reference Stack (Node.js Express) is running!",
    health: "/api/health",
    docs: "/api/docs",
  });
});

app.get("/api/docs", (req, res) => {
  res.send(`
    <html>
      <head><title>Backend Arsenal API Docs</title></head>
      <body style="font-family:sans-serif;padding:2rem;">
        <h1>⚡ Backend Arsenal Swagger API Documentation</h1>
        <p>Conforming to the Universal API Contract.</p>
        <ul>
          <li><a href="/api/health">GET /api/health</a></li>
          <li>POST /api/auth/register</li>
          <li>POST /api/auth/login</li>
          <li>GET /api/items</li>
          <li>POST /api/ai/generate</li>
        </ul>
      </body>
    </html>
  `);
});

// Mount Routes
app.use("/api/auth", authRouter);
app.use("/api/items", itemsRouter);
app.use("/api/ai", aiRouter);

// Catch-all 404 handler in universal error envelope
app.use((req, res) => {
  sendError(res, "NOT_FOUND", `The endpoint ${req.method} ${req.originalUrl} does not exist.`, [], 404);
});

// Global Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    console.log(`[Backend Arsenal Node.js] Listening at http://localhost:${config.port}`);
  });
}

export default app;
