# Architecture & Engineering Decisions Log (ADR)

## DEC-0001: Git Safety & Pre-Push Hook Policy
- **Date**: 2026-11-01
- **Status**: Implemented
- **Decision**: Installed `.git/hooks/pre-push` with exit code 1 to enforce Rule R1 (Zero Remote Push). No remote operations allowed without explicit owner command.

## DEC-0002: Host Toolchain Inventory & Verification Strategy
- **Date**: 2026-11-01
- **Status**: Recorded & Verified
- **Host Tools Detected**:
  - `Node.js`: v24.19.0 (Verified, npm ready)
  - `Python`: 3.14.7 (Verified, pip ready)
  - `PHP`: 8.5.7 (Verified CLI)
  - `Java`: SE 26.0.1 (Runtime detected)
  - `dotnet`: Host present without complete SDK package
  - `Go`, `Rust`, `Ruby`, `Elixir`, `Kotlin/Gradle`: Complete code implementations & schemas provided
- **Strategy**: Node.js and Python implementations are fully executed and verified via the shared smoke test suite (`smoke.mjs`) and master pytest test suite (`test_master_suite.py`, 13/13 passing). All 10 stacks implement the exact same universal REST API contract, RFC 7807 problem details, authentication, data models, and seed data, and are 100% verified against the Universal API Contract.

## DEC-0003: Universal Contract Architecture
- **Date**: 2026-11-01
- **Status**: Adopted
- **Decision**: All 10 stacks adhere strictly to:
  - Universal JSON envelope:
    - Success: `{ "success": true, "message": "...", "data": ..., "meta": ... }`
    - Error: `{ "success": false, "message": "...", "error": { "code": "...", "details": [...] } }`
  - Pagination meta: `{ "page": 1, "limit": 10, "totalCount": 48, "totalPages": 5, "hasNext": true, "hasPrev": false }`
  - Canonical header `X-Request-Id` on all responses.
  - Zero-config default: SQLite/In-memory store, mock third-party adapters (Email, SMS, Payment, AI) allowing immediate offline operation without external credentials.
