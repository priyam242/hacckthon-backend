import sys
import os
import pytest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app, init_and_seed_db
import asyncio

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c

def test_01_health_check(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["data"]["status"] == "healthy"

def test_02_auth_login_admin(client):
    res = client.post("/api/auth/login", json={
        "email": "admin@brightloop.com",
        "password": "Brightloop@2026"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "accessToken" in data["data"]
    assert data["data"]["user"]["role"] == "admin"

def test_03_auth_login_customer(client):
    res = client.post("/api/auth/login", json={
        "email": "enterprise@acme.com",
        "password": "Acme@2026"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["data"]["user"]["role"] == "customer"
    assert data["data"]["user"]["name"] == "Acme Global Tech"

def test_04_auth_register_strict_password(client):
    import uuid
    # Weak password test (no uppercase or special)
    res_weak = client.post("/api/auth/register", json={
        "name": "Weak User",
        "email": f"weak_{uuid.uuid4().hex[:6]}@example.com",
        "password": "weakpassword"
    })
    assert res_weak.status_code == 422

    # Strong valid password
    unique_email = f"strong_{uuid.uuid4().hex[:6]}@example.com"
    res_good = client.post("/api/auth/register", json={
        "name": "Strong User",
        "email": unique_email,
        "password": "StrongPassword@2026",
        "company_name": "Secure Corp"
    })
    assert res_good.status_code == 201
    assert res_good.json()["success"] is True

def test_05_forgot_and_reset_password(client):
    import uuid
    res_forgot = client.post("/api/auth/forgot-password", json={
        "email": "admin@brightloop.com"
    })
    assert res_forgot.status_code == 200
    assert "reset_token" in res_forgot.json()["data"]

    # Register temp user to reset password
    temp_email = f"reset_{uuid.uuid4().hex[:6]}@example.com"
    client.post("/api/auth/register", json={
        "name": "Reset Tester", "email": temp_email, "password": "OriginalPass@2026"
    })

    res_reset = client.post("/api/auth/reset-password", json={
        "email": temp_email,
        "token": "simulated_token",
        "new_password": "NewStrongPass#2026"
    })
    assert res_reset.status_code == 200

def test_06_products_with_odoo_variant(client):
    res = client.get("/api/products")
    assert res.status_code == 200
    products = res.json()["data"]
    assert len(products) >= 3
    erp = next((p for p in products if p["name"] == "Brightloop Core ERP"), None)
    assert erp is not None
    assert any(v["name"] == "Odoo Brand Edition" and v["extra_price"] == 560 for v in erp["variants"])

def test_07_plans_cadences(client):
    res = client.get("/api/plans")
    assert res.status_code == 200
    plans = res.json()["data"]
    cadences = {p["billing_frequency"] for p in plans}
    assert {"daily", "weekly", "monthly", "yearly"}.issubset(cadences)

def test_08_quotations_and_convert(client):
    admin_login = client.post("/api/auth/login", json={"email": "admin@brightloop.com", "password": "Brightloop@2026"}).json()
    token = admin_login["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch templates
    tpl_res = client.get("/api/quotations/templates")
    assert tpl_res.status_code == 200
    assert len(tpl_res.json()["data"]) >= 1

    # Create quote
    q_res = client.post("/api/quotations", headers=headers, json={
        "customer_id": "usr_cust_acme",
        "plan_id": "plan_yearly",
        "lines": [{"product_name": "Brightloop Core ERP", "quantity": 2, "unit_price": 2060.0}],
        "validity_days": 30
    })
    assert q_res.status_code == 201
    quote_id = q_res.json()["data"]["id"]

    # Convert to subscription
    conv_res = client.post(f"/api/quotations/{quote_id}/convert", headers=headers)
    assert conv_res.status_code == 200
    sub_data = conv_res.json()["data"]
    assert sub_data["status"] == "Confirmed"
    assert sub_data["sub_number"].startswith("SUB-2026-")

def test_09_billing_day_batch_run(client):
    staff_login = client.post("/api/auth/login", json={"email": "staff@brightloop.com", "password": "Staff@2026"}).json()
    token = staff_login["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/billing/run", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True

def test_10_invoices_customer_isolation(client):
    # Customer Acme token
    acme_login = client.post("/api/auth/login", json={"email": "enterprise@acme.com", "password": "Acme@2026"}).json()
    acme_token = acme_login["data"]["accessToken"]

    res_acme = client.get("/api/invoices", headers={"Authorization": f"Bearer {acme_token}"})
    assert res_acme.status_code == 200
    acme_invoices = res_acme.json()["data"]
    # All returned invoices must belong to usr_cust_acme
    assert len(acme_invoices) >= 1
    assert all(inv["customer_id"] == "usr_cust_acme" for inv in acme_invoices)

def test_11_payment_recording(client):
    admin_login = client.post("/api/auth/login", json={"email": "admin@brightloop.com", "password": "Brightloop@2026"}).json()
    token = admin_login["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    pay_res = client.post("/api/payments", headers=headers, json={
        "invoice_id": "inv_002",
        "method": "UPI",
        "amount": 1770.0,
        "note": "Complete settlement via UPI"
    })
    assert pay_res.status_code == 201
    assert pay_res.json()["data"]["invoice_status"] == "Paid"

def test_12_finance_dashboard(client):
    admin_login = client.post("/api/auth/login", json={"email": "admin@brightloop.com", "password": "Brightloop@2026"}).json()
    token = admin_login["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    dash_res = client.get("/api/finance/dashboard", headers=headers)
    assert dash_res.status_code == 200
    metrics = dash_res.json()["data"]
    assert "estimated_mrr" in metrics
    assert "total_revenue_collected" in metrics
    assert metrics["response_time_ms"] < 2000  # <2s SLA

def test_13_staff_management_rbac(client):
    import uuid
    # Customer trying to create staff -> 403 Forbidden
    cust_login = client.post("/api/auth/login", json={"email": "enterprise@acme.com", "password": "Acme@2026"}).json()
    cust_token = cust_login["data"]["accessToken"]
    res_forbidden = client.post("/api/team/staff", headers={"Authorization": f"Bearer {cust_token}"}, json={
        "name": "Rogue Staff", "email": f"rogue_{uuid.uuid4().hex[:6]}@brightloop.com", "password": "RoguePassword@1"
    })
    assert res_forbidden.status_code == 403

    # Admin creating staff -> 201 Created
    admin_login = client.post("/api/auth/login", json={"email": "admin@brightloop.com", "password": "Brightloop@2026"}).json()
    admin_token = admin_login["data"]["accessToken"]
    staff_email = f"alex_{uuid.uuid4().hex[:6]}@brightloop.com"
    res_allowed = client.post("/api/team/staff", headers={"Authorization": f"Bearer {admin_token}"}, json={
        "name": "Alex Operations", "email": staff_email, "password": "AlexStaff@2026"
    })
    assert res_allowed.status_code == 201
    assert res_allowed.json()["data"]["role"] == "staff"

