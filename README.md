# ⚡ Backend Arsenal

> **One Monorepo. Top 10 Backend Stacks. One Universal API Contract. Hackathon Ready.**

Backend Arsenal provides complete, production-grade, zero-dependency-needed backend templates implementing the **exact same HTTP API contract** across the top 10 backend frameworks.

---

## 📊 Stack Status & Verification Matrix

| # | Stack | Directory | Data Layer | Status | Smoke Test |
|---|---|---|---|---|---|
| **01** | **Node.js + Express** | `stacks/01-nodejs-express` | Prisma / SQLite | 🟢 VERIFIED | ✅ PASSED |
| **02** | **Python + FastAPI** | `stacks/02-python-fastapi` | SQLAlchemy 2.0 Async | 🟢 VERIFIED | ✅ PASSED |
| **03** | **Java + Spring Boot** | `stacks/03-java-spring-boot` | Spring Data JPA / H2 | 🟡 UNVERIFIED (Java SDK toolchain) | Manual |
| **04** | **C# + ASP.NET Core** | `stacks/04-csharp-dotnet` | EF Core / SQLite | 🟡 UNVERIFIED (.NET SDK missing) | Manual |
| **05** | **PHP + Laravel** | `stacks/05-php-laravel` | Native API / SQLite | 🟢 VERIFIED | ✅ PASSED |
| **06** | **Go + Gin** | `stacks/06-go-gin` | Pure-Go SQLite | 🟡 UNVERIFIED (Go toolchain missing) | Manual |
| **07** | **Ruby + Rails** | `stacks/07-ruby-rails` | ActiveRecord / SQLite | 🟡 UNVERIFIED (Ruby toolchain missing) | Manual |
| **08** | **Rust + Axum** | `stacks/08-rust-axum` | Tokio Async | 🟡 UNVERIFIED (Cargo toolchain missing) | Manual |
| **09** | **Kotlin + Ktor** | `stacks/09-kotlin-ktor` | Exposed / SQLite | 🟡 UNVERIFIED (Gradle toolchain missing) | Manual |
| **10** | **Elixir + Phoenix** | `stacks/10-elixir-phoenix` | Ecto / SQLite | 🟡 UNVERIFIED (Elixir toolchain missing) | Manual |

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
