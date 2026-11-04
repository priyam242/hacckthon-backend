import { Router } from "express";
import { db } from "../db.js";
import { authenticateJwt } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const financeRouter = Router();

financeRouter.get("/dashboard", authenticateJwt, (req, res) => {
  const startTime = Date.now();
  if (req.user.role === "customer") {
    return sendError(res, "FORBIDDEN", "Finance intelligence is restricted to internal staff and admin.", [], 403);
  }

  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Active Subscriptions Count
  const activeSubsRow = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'Active'").get();
  const totalSubsRow = db.prepare("SELECT COUNT(*) as count FROM subscriptions").get();

  // 2. Total Revenue Collected (from all payments)
  const revRow = db.prepare("SELECT SUM(amount) as total FROM payments").get();
  const totalRevenueCollected = Number(revRow.total) || 0;

  // 3. Outstanding Revenue & Overdue Invoices
  // Overdue = status != 'Paid' AND status != 'Cancelled' AND due_date < today
  const overdueInvoices = db.prepare(`
    SELECT i.*, u.name as customer_name, u.email as customer_email, u.company_name
    FROM invoices i
    JOIN users u ON i.customer_id = u.id
    WHERE i.status NOT IN ('Paid', 'Cancelled')
      AND i.due_date < ?
    ORDER BY i.due_date ASC
  `).all(todayStr);

  const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);

  // Outstanding (not yet overdue, but unpaid)
  const outstandingInvoices = db.prepare(`
    SELECT i.*, u.name as customer_name, u.email as customer_email
    FROM invoices i
    JOIN users u ON i.customer_id = u.id
    WHERE i.status NOT IN ('Paid', 'Cancelled')
      AND i.due_date >= ?
    ORDER BY i.due_date ASC
  `).all(todayStr);

  const outstandingAmount = outstandingInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);

  // 4. MRR Estimation (Monthly Recurring Revenue)
  const activeSubs = db.prepare(`
    SELECT s.*, p.billing_frequency, p.cost as plan_cost
    FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id
    WHERE s.status = 'Active'
  `).all();

  let estimatedMRR = 0;
  for (const sub of activeSubs) {
    const lines = JSON.parse(sub.lines_json || "[]");
    const subTotal = lines.reduce((acc, l) => acc + (Number(l.amount) || Number(l.unit_price) * Number(l.quantity) || 0), 0);
    const amount = subTotal > 0 ? subTotal : Number(sub.plan_cost) || 0;

    if (sub.billing_frequency === "monthly") estimatedMRR += amount;
    else if (sub.billing_frequency === "yearly") estimatedMRR += amount / 12;
    else if (sub.billing_frequency === "weekly") estimatedMRR += amount * 4.33;
    else if (sub.billing_frequency === "daily") estimatedMRR += amount * 30;
  }

  // Plan Breakdown
  const planBreakdown = db.prepare(`
    SELECT p.name, p.billing_frequency, COUNT(s.id) as count
    FROM plans p
    LEFT JOIN subscriptions s ON p.id = s.plan_id AND s.status = 'Active'
    GROUP BY p.id
  `).all();

  const responseTimeMs = Date.now() - startTime;

  return sendSuccess(res, {
    active_subscriptions: activeSubsRow.count,
    total_subscriptions: totalSubsRow.count,
    total_revenue_collected: totalRevenueCollected,
    total_outstanding_revenue: outstandingAmount,
    total_overdue_revenue: overdueAmount,
    overdue_invoices_count: overdueInvoices.length,
    overdue_invoices: overdueInvoices.map((inv) => ({
      ...inv,
      lines: JSON.parse(inv.lines_json || "[]"),
    })),
    outstanding_invoices: outstandingInvoices.map((inv) => ({
      ...inv,
      lines: JSON.parse(inv.lines_json || "[]"),
    })),
    estimated_mrr: Math.round(estimatedMRR * 100) / 100,
    plan_breakdown: planBreakdown,
    as_of: todayStr,
    benchmark_sla: "< 2 seconds",
    response_time_ms: responseTimeMs,
  });
});

