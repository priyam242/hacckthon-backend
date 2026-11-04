# ⚡ Backend Arsenal

> **One Monorepo. Top 10 Backend Stacks. One Universal API Contract. Hackathon Ready.**

Backend Arsenal provides complete, production-grade, zero-dependency-needed backend templates implementing the **exact same HTTP API contract** across the top 10 backend frameworks.

---

## 📊 Stack Status & Verification Matrix

| # | Stack | Directory | Data Layer | Status | Smoke Test |
|---|---|---|---|---|---|
| **01** | **Node.js + Express** | `stacks/01-nodejs-express` | Prisma / SQLite | 🟢 VERIFIED | ✅ PASSED |
| **02** | **Python + FastAPI** | `stacks/02-python-fastapi` | SQLAlchemy 2.0 Async | 🟢 VERIFIED | ✅ PASSED |
| **03** | **Java + Spring Boot** | `stacks/03-java-spring-boot` | Spring Data JPA / H2 | 🟢 VERIFIED | ✅ PASSED |
| **04** | **C# + ASP.NET Core** | `stacks/04-csharp-dotnet` | EF Core / SQLite | 🟢 VERIFIED | ✅ PASSED |
| **05** | **PHP + Laravel** | `stacks/05-php-laravel` | Native API / SQLite | 🟢 VERIFIED | ✅ PASSED |
| **06** | **Go + Gin** | `stacks/06-go-gin` | Pure-Go SQLite | 🟢 VERIFIED | ✅ PASSED |
| **07** | **Ruby + Rails** | `stacks/07-ruby-rails` | ActiveRecord / SQLite | 🟢 VERIFIED | ✅ PASSED |
| **08** | **Rust + Axum** | `stacks/08-rust-axum` | Tokio Async | 🟢 VERIFIED | ✅ PASSED |
| **09** | **Kotlin + Ktor** | `stacks/09-kotlin-ktor` | Exposed / SQLite | 🟢 VERIFIED | ✅ PASSED |
| **10** | **Elixir + Phoenix** | `stacks/10-elixir-phoenix` | Ecto / SQLite | 🟢 VERIFIED | ✅ PASSED |

### 🏆 Master Production Engine (Brightloop Odoo Core)
- **Engine File**: `main.py` (FastAPI Async Architecture)
- **Automated Test Suite**: `test_master_suite.py` — **13/13 PASSED**
- **Continuous Integration**: GitHub Actions CI (`.github/workflows/ci.yml`) — **100% GREEN**
- **Universal REST Contract**: RFC 7807 problem details, JWT auth, RBAC (portal, portal_hq, internal_user, internal_admin), product variants, quotation-to-subscription pipeline, automated billing day idempotent run, lead intelligence.

---

## 🚀 Quick Start (5 Commands)

### 1. Run Reference Node.js Stack
```bash
cd stacks/01-nodejs-express
npm install
npm run dev
```

### 2. Run Smoke Test Suite
```bash
node shared/smoke-test/smoke.mjs http://localhost:5000
```

### 3. Open Interactive Web Test Console
Open `shared/frontend-demo/index.html` in any web browser.

---

## 🛠️ Scaffolding a New Hackathon Project

Use the automated generator to copy and rename the sample entity in seconds:

```powershell
# Windows PowerShell
./scripts/new-project.ps1 -StackFolder "01-nodejs-express" -NewProjectName "my-hackathon-api" -EntityName "Listing"

# Linux / macOS
./scripts/new-project.sh 01-nodejs-express my-hackathon-api Listing
```

---

## 📑 Documentation
- [Agent Operational Guide](docs/AGENT_GUIDE.md) — How AI coding agents turn prompts into backends
- [Team Playbook](docs/TEAM_PLAYBOOK.md) — 24-hour hackathon execution matrix
- [Stack Comparison](docs/STACK_COMPARISON.md) — Which stack to choose and when
- [Universal API Contract](spec/API_CONTRACT.md) — Endpoints and request/response specifications
