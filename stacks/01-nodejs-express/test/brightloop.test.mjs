import assert from "node:assert";
import http from "node:http";
import app from "../src/server.js";

const server = http.createServer(app);

server.listen(5099, async () => {
  const baseUrl = "http://127.0.0.1:5099";
  console.log(`Test runner bound to ${baseUrl}`);

  try {
    // 1. Health
    const resHealth = await fetch(`${baseUrl}/api/health`).then((r) => r.json());
    assert.strictEqual(resHealth.data.status, "healthy");
    console.log("✓ Health Check Passed");

    // 2. Auth: Weak Password Rejected
    const weakReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bad Pass", email: "bad@test.com", password: "simple" }),
    });
    assert.strictEqual(weakReg.status, 422);
    console.log("✓ Password Policy: Weak Password Rejected (422)");

    // 3. Auth: Strong Password Accepted
    const uniqueEmail = `client_${Date.now()}@brightloop.test`;
    const strongReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Valid Client", email: uniqueEmail, password: "Secure@Password123!" }),
    });
    const regData = await strongReg.json();
    assert.strictEqual(strongReg.status, 201);
    assert.ok(regData.data.accessToken);
    console.log("✓ Password Policy: Compliant Password Accepted (201)");

    // 4. Admin Login
    const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@brightloop.com", password: "Brightloop@2026" }),
    }).then((r) => r.json());
    const adminToken = adminLogin.data.accessToken;
    assert.strictEqual(adminLogin.data.user.role, "admin");
    console.log("✓ Admin Login Passed");

    // 5. Products & Variants (e.g. Odoo brand adds 560)
    const prods = await fetch(`${baseUrl}/api/products`).then((r) => r.json());
    const erp = prods.data.find((p) => p.name === "Brightloop Core ERP");
    assert.ok(erp);
    assert.ok(erp.variants.some((v) => v.name.includes("Odoo") && v.extra_price === 560));
    console.log("✓ Products & Odoo Variant Verified (+560 extra price)");

    // 6. Plans
    const plans = await fetch(`${baseUrl}/api/plans`).then((r) => r.json());
    assert.ok(plans.data.some((p) => p.billing_frequency === "monthly"));
    assert.ok(plans.data.some((p) => p.billing_frequency === "yearly"));
    console.log("✓ Multi-Frequency Billing Plans Verified");

    // 7. Quotation to Subscription conversion
    const templates = await fetch(`${baseUrl}/api/quotations/templates`).then((r) => r.json());
    assert.ok(templates.data.length > 0);

    const createQuote = await fetch(`${baseUrl}/api/quotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        customer_id: "usr_cust_shop",
        plan_id: "plan_monthly",
        template_id: templates.data[0].id,
      }),
    }).then((r) => r.json());
    assert.ok(createQuote.data.quote_number);

    const convertRes = await fetch(`${baseUrl}/api/quotations/${createQuote.data.id}/convert`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert.strictEqual(convertRes.data.status, "Confirmed");
    console.log("✓ Quotation Created from Template and Converted to Subscription");

    // 8. Billing Day Batch Run (Idempotency and Auto-Invoicing)
    const billingRun = await fetch(`${baseUrl}/api/billing/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert.strictEqual(billingRun.success, true);
    console.log(`✓ Automated Billing Day Run: ${billingRun.data.invoices_generated} invoices generated`);

    // Run again to verify idempotency (nothing billed twice)
    const secondRun = await fetch(`${baseUrl}/api/billing/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert.strictEqual(secondRun.data.invoices_generated, 0);
    console.log("✓ Billing Idempotency Verified: 0 duplicate invoices on subsequent run");

    // 9. Invoice State Machine & Printable View
    const invList = await fetch(`${baseUrl}/api/invoices`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    const draftInv = invList.data.find((i) => i.status === "Draft");
    if (draftInv) {
      const confirmInv = await fetch(`${baseUrl}/api/invoices/${draftInv.id}/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((r) => r.json());
      assert.strictEqual(confirmInv.data.status, "Confirmed");
      console.log("✓ Invoice Status: Draft -> Confirmed Verified");
    }

    const printHtml = await fetch(`${baseUrl}/api/invoices/${invList.data[0].id}/print`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.text());
    assert.ok(printHtml.includes("Brightloop Software"));
    console.log("✓ Printable Invoice HTML Endpoint Verified");

    // 10. Record Payment
    const unpaidInv = invList.data.find((i) => i.status === "Confirmed");
    if (unpaidInv) {
      const payRes = await fetch(`${baseUrl}/api/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          invoice_id: unpaidInv.id,
          method: "Bank Transfer",
          amount: unpaidInv.total_amount,
          note: "Invoice settled via RTGS",
        }),
      }).then((r) => r.json());
      assert.strictEqual(payRes.data.invoice_status, "Paid");
      console.log("✓ Payment Recorded: Invoice Auto-Transitioned to Paid");
    }

    // 11. Finance Lead Analytics (< 2 second SLA)
    const financeRes = await fetch(`${baseUrl}/api/finance/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert.ok(financeRes.data.active_subscriptions > 0);
    assert.ok(financeRes.data.total_revenue_collected > 0);
    assert.ok(financeRes.data.response_time_ms < 2000);
    console.log(`✓ Finance Lead Analytics Verified (Response time: ${financeRes.data.response_time_ms}ms < 2000ms SLA)`);

    console.log("\n=========================================");
    console.log("🎉 ALL 11 BRIGHTLOOP SUITE TESTS PASSED!");
    console.log("=========================================\n");

    server.close();
    process.exit(0);
  } catch (err) {
    console.error("Test failure:", err);
    server.close();
    process.exit(1);
  }
});
