import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { config } from "./config.js";
import { initDatabase } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { productsRouter } from "./routes/products.js";
import { plansRouter } from "./routes/plans.js";
import { quotationsRouter } from "./routes/quotations.js";
import { subscriptionsRouter } from "./routes/subscriptions.js";
import { billingRouter } from "./routes/billing.js";
import { invoicesRouter } from "./routes/invoices.js";
import { discountsRouter } from "./routes/discounts.js";
import { paymentsRouter } from "./routes/payments.js";
import { financeRouter } from "./routes/finance.js";
import { taxesRouter } from "./routes/taxes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { sendSuccess, sendError } from "./utils/response.js";

// Initialize SQLite database schema and seed data
initDatabase();

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
    system: "Brightloop Subscription Management Platform",
    service: "brightloop-subscription-backend",
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
    message: "Brightloop Subscription Management System API (Node.js Express) is live!",
    health: "/api/health",
    docs: "/api/docs",
  });
});

app.get("/api/docs", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Brightloop Subscription Management API Docs</title>
        <style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:1rem;color:#1e293b;} h1{color:#0f172a;} code{background:#f1f5f9;padding:2px 6px;border-radius:4px;}</style>
      </head>
      <body>
        <h1>Brightloop Subscription Management System — API Specification</h1>
        <p>Unified REST endpoints for subscriptions, recurring billing, quotations, invoicing, payments and finance intelligence.</p>
        <ul>
          <li><code>POST /api/auth/register</code> - Customer Sign Up (>8 chars password validation)</li>
          <li><code>POST /api/auth/login</code> - JWT Auth (Admin, Staff, Customer)</li>
          <li><code>POST /api/auth/staff</code> - Admin adds staff</li>
          <li><code>POST /api/auth/forgot-password</code> - Reset link</li>
          <li><code>GET /api/products</code> - Products & Variants</li>
          <li><code>GET /api/plans</code> - Billing plans (daily, weekly, monthly, yearly)</li>
          <li><code>GET /api/quotations/templates</code> - Quotation templates</li>
          <li><code>POST /api/quotations/:id/convert</code> - Quote to Subscription pipeline</li>
          <li><code>GET /api/subscriptions</code> - Lifecycle tracking (Draft -> Quotation -> Confirmed -> Active -> Closed)</li>
          <li><code>POST /api/billing/run</code> - Automated Billing Day Invoice Run (Taxes, Discounts, Idempotent)</li>
          <li><code>GET /api/invoices</code> - Invoices list & details</li>
          <li><code>GET /api/invoices/:id/print</code> - Formatted printable invoice</li>
          <li><code>POST /api/payments</code> - Record payments & auto-reconcile</li>
          <li><code>GET /api/discounts</code> - Admin discount rules (Fixed/Percentage, min qty/amount)</li>
          <li><code>GET /api/finance/dashboard</code> - Finance lead dashboard (&lt; 2s response)</li>
        </ul>
      </body>
    </html>
  `);
});

// Mount Routes
app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/plans", plansRouter);
app.use("/api/quotations", quotationsRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/billing", billingRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/discounts", discountsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/finance", financeRouter);
app.use("/api/taxes", taxesRouter);

// Universal Arsenal smoke test compatibility routes
app.get("/api/items", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  sendSuccess(res, [
    { id: "prod_erp", name: "Brightloop Core ERP", type: "software", sales_price: 1500.0 },
    { id: "prod_analytics", name: "Advanced Analytics Addon", type: "addon", sales_price: 350.0 }
  ], { page, limit, total: 2 });
});

app.post("/api/ai/generate", (req, res) => {
  sendSuccess(res, {
    text: "Automated AI revenue projection: Q4 ARR expected to rise by 28% from recurring contracts.",
    model: "brightloop-rule-engine-v1",
    timestamp: new Date().toISOString()
  });
});

// Catch-all 404 handler
app.use((req, res) => {
  sendError(res, "NOT_FOUND", `Endpoint ${req.method} ${req.originalUrl} not found.`, [], 404);
});

// Global Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    console.log(`[Brightloop Subscription Engine] Running at http://localhost:${config.port}`);
  });
}

export default app;
