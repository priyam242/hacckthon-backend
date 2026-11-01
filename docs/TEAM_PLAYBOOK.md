# Team Playbook — Hackathon Execution Matrix

How a 3–5 member team splits responsibilities using Backend Arsenal.

---

## 1. Role Cards

### Role A: Backend Lead
- **Primary Goal**: Pick stack from Arsenal, run `./scripts/new-project`, enable feature modules.
- **Deliverables**: Live working API with seeded database and verified OpenAPI docs.
- **Handoff**: Provide Postman collection and live API URL to Frontend Dev by Hour 3.

### Role B: Frontend Developer
- **Primary Goal**: Connect UI components to live endpoints.
- **Deliverables**: Working user journey (Signup -> Browse -> Action -> Result).
- **Tooling**: Reference `shared/frontend-demo/index.html` for ready-made request patterns.

### Role C: AI & "Hero Feature" Engineer
- **Primary Goal**: Focus on the core competitive differentiator (AI model, computer vision, recommendation engine).
- **Deliverables**: Integrated `/api/ai/*` workflows with prompt templates.

### Role D: Pitch & Demo Lead
- **Primary Goal**: 5-slide deck, 60-second screen-recording walkthrough, demo script.
- **Deliverables**: Polished slide deck and backup video.

---

## 2. 24-Hour Hackathon Schedule

```
Hour 00 - 02: Ideation, scope lock (1 Hero Feature), stack selection from Arsenal.
Hour 02 - 04: Backend scaffolded & seeded; Swagger /docs shared with frontend.
Hour 04 - 14: Core feature build & UI component binding.
Hour 14 - 18: AI integration & end-to-end integration testing.
Hour 18 - 21: Polish, edge cases, DEMO_MODE fallback verification.
Hour 21 - 22: HARD CODE FREEZE. Zero new features.
Hour 22 - 24: 60-second Loom recording, pitch deck rehearsals.
```
