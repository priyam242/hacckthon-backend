# AI Agent Operational Guide — Backend Arsenal

This guide instructs future AI coding agents on how to leverage the Backend Arsenal during a hackathon to deliver an end-to-end backend in minutes.

---

## 1. Requirement & Problem Analysis
1. Extract:
   - Domain (FinTech, E-Commerce, EdTech, Healthcare, AI Chat, Booking, Civic, Logistics)
   - Roles (Admin, Manager, User, Guest)
   - Core Entity (e.g., `Patient`, `Listing`, `Course`, `Vehicle`)
   - Critical "Hero Flow" (e.g., User registers -> books slot -> receives notification)
2. Determine Stack Preference:
   - If Python/AI/ML is central: **Stack 02 (FastAPI)**
   - If Web/Realtime/JavaScript is central: **Stack 01 (Express)** or **04 (NestJS)**
   - If Enterprise/Microservices: **Stack 03 (Spring Boot)** or **04 (.NET)**

---

## 2. Domain to Feature Mapping

| Domain | Key Feature Modules |
|---|---|
| E-Commerce / Marketplace | F01 (Auth), F02 (RBAC), F03 (Items), F06 (Upload), F11 (Payments), F21 (Orders/Cart) |
| Healthcare / Appointments | F01 (Auth), F02 (RBAC), F03 (Patients), F22 (Booking), F08 (Notifications), F10 (SMS) |
| EdTech / LMS | F01 (Auth), F03 (Courses), F06 (Files), F15 (AI Tutor), F20 (Reviews), F23 (Chat) |
| AI Assistant / Chatbot | F01 (Auth), F03 (Prompts), F15 (AI Engine), F07 (Realtime SSE/WS), F14 (Search) |
| Logistics / Fleet | F01 (Auth), F03 (Vehicles), F07 (Realtime), F12 (Jobs), F19 (Geo Proximity) |
| Civic / Grievance Redressal | F01 (Auth), F03 (Complaints), F06 (Images), F08 (Alerts), F19 (Geo) |
| FinTech / Digital Wallet | F01 (Auth), F02 (RBAC), F11 (Payments), F16 (Audit Logs), F19 (PDF Invoices) |

---

## 3. Scaffolding & Customization Command
Run the project scripter:
```powershell
./scripts/new-project.ps1 -StackFolder "01-nodejs-express" -NewProjectName "care-connect-api" -EntityName "Appointment"
```

---

## 4. Final Review & Delivery Checklist
- [ ] Dev server running cleanly on port 5000.
- [ ] Run `node shared/smoke-test/smoke.mjs http://localhost:5000` to verify zero regression.
- [ ] Prepare judges' pitch deck referencing Swagger `/api/docs` and live demo frontend `shared/frontend-demo/index.html`.
