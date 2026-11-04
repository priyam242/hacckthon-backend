import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "brightloop.db");

export const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode
db.exec(`
  PRAGMA foreign_keys = ON;
`);

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'staff', 'customer')),
      company_name TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('software', 'addon', 'service', 'physical')),
      sales_price REAL NOT NULL,
      cost_price REAL NOT NULL,
      notes TEXT,
      variants_json TEXT DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cost REAL NOT NULL,
      billing_frequency TEXT NOT NULL CHECK(billing_frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
      min_quantity INTEGER DEFAULT 1,
      start_date TEXT,
      end_date TEXT,
      auto_close_on_end INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quotation_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      plan_id TEXT,
      validity_days INTEGER DEFAULT 30,
      lines_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quotations (
      id TEXT PRIMARY KEY,
      quote_number TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Draft',
      valid_until TEXT NOT NULL,
      lines_json TEXT NOT NULL DEFAULT '[]',
      payment_terms TEXT DEFAULT 'net_30',
      subtotal REAL NOT NULL,
      tax_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES users(id),
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      sub_number TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Draft', 'Quotation', 'Confirmed', 'Active', 'Paused', 'Closed')),
      start_date TEXT NOT NULL,
      expiry_date TEXT,
      payment_terms TEXT DEFAULT 'net_30',
      lines_json TEXT NOT NULL DEFAULT '[]',
      discount_id TEXT,
      last_billed_date TEXT,
      next_billing_date TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES users(id),
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

    CREATE TABLE IF NOT EXISTS tax_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rate_percentage REAL NOT NULL,
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS discounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('fixed', 'percentage')),
      value REAL NOT NULL,
      min_purchase REAL DEFAULT 0,
      min_quantity INTEGER DEFAULT 1,
      start_date TEXT,
      end_date TEXT,
      max_uses INTEGER DEFAULT 100,
      current_uses INTEGER DEFAULT 0,
      scope TEXT NOT NULL CHECK(scope IN ('whole_subscription', 'specific_product')),
      target_product_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      subscription_id TEXT,
      customer_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Draft', 'Confirmed', 'Paid', 'Cancelled')),
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      tax_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      lines_json TEXT NOT NULL DEFAULT '[]',
      sent_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('Credit Card', 'Bank Transfer', 'UPI', 'Cash')),
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );
  `);

  seedInitialData();
}

function seedInitialData() {
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  if (userCount > 0) return; // already seeded

  const adminHash = bcrypt.hashSync("Brightloop@2026", 10);
  const staffHash = bcrypt.hashSync("Staff@2026", 10);
  const shopHash = bcrypt.hashSync("Customer@2026", 10);
  const acmeHash = bcrypt.hashSync("Acme@2026", 10);

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, company_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run("usr_admin", "Admin Lead", "admin@brightloop.com", adminHash, "admin", "Brightloop HQ", new Date().toISOString());
  insertUser.run("usr_staff", "Sara Sales Rep", "staff@brightloop.com", staffHash, "staff", "Brightloop Sales", new Date().toISOString());
  insertUser.run("usr_cust_shop", "Corner Bakery", "shop@customer.com", shopHash, "customer", "Corner Bakery Ltd", new Date().toISOString());
  insertUser.run("usr_cust_acme", "Acme Global Tech", "enterprise@acme.com", acmeHash, "customer", "Acme Global Corporation", new Date().toISOString());

  // Tax rules
  const insertTax = db.prepare(`
    INSERT INTO tax_rules (id, name, rate_percentage, is_default, is_active)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertTax.run("tax_std", "Standard VAT / GST (18%)", 18.0, 1, 1);
  insertTax.run("tax_reduced", "Reduced Software Tax (5%)", 5.0, 0, 1);

  // Products
  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, type, sales_price, cost_price, notes, variants_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertProduct.run(
    "prod_erp",
    "Brightloop Core ERP",
    "software",
    1500.0,
    400.0,
    "Comprehensive enterprise resource planning core module",
    JSON.stringify([
      { name: "Standard Community", extra_price: 0 },
      { name: "Odoo Brand Edition", extra_price: 560 }
    ]),
    new Date().toISOString()
  );

  insertProduct.run(
    "prod_analytics",
    "Advanced Analytics Addon",
    "addon",
    350.0,
    50.0,
    "Real-time pipeline analytics, forecasting and charts",
    JSON.stringify([
      { name: "Standard Analytics", extra_price: 0 },
      { name: "Enterprise AI Insights", extra_price: 200 }
    ]),
    new Date().toISOString()
  );

  insertProduct.run(
    "prod_billing",
    "Automated Recurring Billing Engine",
    "software",
    450.0,
    90.0,
    "Zero-touch invoice generation and bank reconciliation",
    JSON.stringify([]),
    new Date().toISOString()
  );

  insertProduct.run(
    "prod_sla",
    "24/7 Dedicated Support SLA",
    "service",
    250.0,
    50.0,
    "15-minute response SLA with dedicated account manager",
    JSON.stringify([]),
    new Date().toISOString()
  );

  // Plans
  const insertPlan = db.prepare(`
    INSERT INTO plans (id, name, cost, billing_frequency, min_quantity, start_date, end_date, auto_close_on_end, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPlan.run("plan_monthly", "Brightloop Professional (Monthly)", 99.0, "monthly", 1, "2026-01-01", "2027-12-31", 0, 1, new Date().toISOString());
  insertPlan.run("plan_yearly", "Brightloop Enterprise (Yearly Contract)", 999.0, "yearly", 5, "2026-01-01", "2028-12-31", 0, 1, new Date().toISOString());
  insertPlan.run("plan_weekly", "Rapid Growth Sprint (Weekly)", 35.0, "weekly", 1, "2026-01-01", "2026-12-31", 1, 1, new Date().toISOString());
  insertPlan.run("plan_daily", "Sandbox Pilot Pass (Daily)", 10.0, "daily", 1, "2026-01-01", "2026-12-31", 1, 1, new Date().toISOString());

  // Discounts
  const insertDiscount = db.prepare(`
    INSERT INTO discounts (id, name, code, type, value, min_purchase, min_quantity, start_date, end_date, max_uses, current_uses, scope, target_product_id, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertDiscount.run(
    "disc_seats",
    "Multi-Seat High Volume (15% Off)",
    "SEATS15",
    "percentage",
    15.0,
    0,
    5,
    "2026-01-01",
    "2026-12-31",
    50,
    3,
    "whole_subscription",
    null,
    1,
    new Date().toISOString()
  );

  insertDiscount.run(
    "disc_fixed",
    "Early Adopter Welcome Voucher ($50 Off)",
    "WELCOME50",
    "fixed",
    50.0,
    200.0,
    1,
    "2026-01-01",
    "2026-12-31",
    100,
    12,
    "whole_subscription",
    null,
    1,
    new Date().toISOString()
  );

  // Quotation Templates
  const insertTemplate = db.prepare(`
    INSERT INTO quotation_templates (id, name, plan_id, validity_days, lines_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertTemplate.run(
    "tpl_enterprise",
    "Enterprise Software Bundle Template",
    "plan_yearly",
    30,
    JSON.stringify([
      { product_id: "prod_erp", variant_name: "Odoo Brand Edition", quantity: 5, unit_price: 2060.0, tax_rate: 18.0 },
      { product_id: "prod_analytics", variant_name: "Enterprise AI Insights", quantity: 5, unit_price: 550.0, tax_rate: 18.0 }
    ]),
    new Date().toISOString()
  );

  insertTemplate.run(
    "tpl_shop",
    "Small Business Quick-Start Template",
    "plan_monthly",
    14,
    JSON.stringify([
      { product_id: "prod_erp", variant_name: "Standard Community", quantity: 1, unit_price: 1500.0, tax_rate: 18.0 },
      { product_id: "prod_billing", variant_name: null, quantity: 1, unit_price: 450.0, tax_rate: 18.0 }
    ]),
    new Date().toISOString()
  );

  // Subscriptions
  const insertSub = db.prepare(`
    INSERT INTO subscriptions (id, sub_number, customer_id, plan_id, status, start_date, expiry_date, payment_terms, lines_json, discount_id, last_billed_date, next_billing_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const today = new Date().toISOString().split("T")[0];
  const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const pastMonth = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  insertSub.run(
    "sub_001",
    "SUB-2026-0001",
    "usr_cust_acme",
    "plan_yearly",
    "Active",
    "2026-01-01",
    "2027-01-01",
    "net_30",
    JSON.stringify([
      { product_id: "prod_erp", product_name: "Brightloop Core ERP", variant_name: "Odoo Brand Edition", quantity: 5, unit_price: 2060.0, tax_rate: 18.0, amount: 10300.0 },
      { product_id: "prod_analytics", product_name: "Advanced Analytics Addon", variant_name: "Enterprise AI Insights", quantity: 5, unit_price: 550.0, tax_rate: 18.0, amount: 2750.0 }
    ]),
    "disc_seats",
    pastMonth,
    today, // due for billing today!
    new Date().toISOString()
  );

  insertSub.run(
    "sub_002",
    "SUB-2026-0002",
    "usr_cust_shop",
    "plan_monthly",
    "Active",
    "2026-02-01",
    "2027-02-01",
    "net_15",
    JSON.stringify([
      { product_id: "prod_erp", product_name: "Brightloop Core ERP", variant_name: "Standard Community", quantity: 1, unit_price: 1500.0, tax_rate: 18.0, amount: 1500.0 }
    ]),
    null,
    pastMonth,
    today,
    new Date().toISOString()
  );

  insertSub.run(
    "sub_003",
    "SUB-2026-0003",
    "usr_cust_shop",
    "plan_monthly",
    "Quotation",
    today,
    nextMonth,
    "net_15",
    JSON.stringify([
      { product_id: "prod_billing", product_name: "Automated Recurring Billing Engine", variant_name: null, quantity: 1, unit_price: 450.0, tax_rate: 18.0, amount: 450.0 }
    ]),
    null,
    null,
    null,
    new Date().toISOString()
  );

  // Invoices
  const insertInvoice = db.prepare(`
    INSERT INTO invoices (id, invoice_number, subscription_id, customer_id, status, issue_date, due_date, subtotal, discount_amount, tax_amount, total_amount, lines_json, sent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertInvoice.run(
    "inv_001",
    "INV-2026-0001",
    "sub_001",
    "usr_cust_acme",
    "Paid",
    pastMonth,
    today,
    13050.0,
    1957.5,
    1996.65,
    13089.15,
    JSON.stringify([
      { product_name: "Brightloop Core ERP (Odoo Brand Edition)", quantity: 5, unit_price: 2060.0, total: 10300.0 },
      { product_name: "Advanced Analytics Addon", quantity: 5, unit_price: 550.0, total: 2750.0 }
    ]),
    pastMonth,
    new Date().toISOString()
  );

  insertInvoice.run(
    "inv_002",
    "INV-2026-0002",
    "sub_002",
    "usr_cust_shop",
    "Confirmed",
    "2026-10-15",
    "2026-10-30", // OVERDUE invoice for finance lead tracking!
    1500.0,
    0,
    270.0,
    1770.0,
    JSON.stringify([
      { product_name: "Brightloop Core ERP", quantity: 1, unit_price: 1500.0, total: 1500.0 }
    ]),
    "2026-10-15",
    new Date().toISOString()
  );

  insertInvoice.run(
    "inv_003",
    "INV-2026-0003",
    null,
    "usr_cust_shop",
    "Draft",
    today,
    nextMonth,
    450.0,
    0,
    81.0,
    531.0,
    JSON.stringify([
      { product_name: "Automated Recurring Billing Engine", quantity: 1, unit_price: 450.0, total: 450.0 }
    ]),
    null,
    new Date().toISOString()
  );

  // Payments
  const insertPayment = db.prepare(`
    INSERT INTO payments (id, invoice_id, method, amount, payment_date, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertPayment.run(
    "pay_001",
    "inv_001",
    "Bank Transfer",
    13089.15,
    pastMonth,
    "Annual enterprise subscription wire transfer ref: WIRE-9921",
    new Date().toISOString()
  );
}

