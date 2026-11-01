# Backend Arsenal — Feature Catalogue (F01 – F28)

Every stack in the Backend Arsenal implements this standardized feature matrix. Modules are individually toggleable via `FEATURE_<NAME>=true|false` environment variables without application failure.

---

### F01: Authentication & Identity Management
- **Registration & Login**: Email/password registration with lowercase normalization, password validation (min 8 chars, mixed case/numbers/symbols), Argon2id or BCrypt hashing.
- **JWT Architecture**:
  - Access Token (15-minute validity, HS256)
  - Refresh Token (7-day validity, rotating on each refresh, database-tracked and revokable)
  - Token revocation and blacklist checking.
- **Password Lifecycle**: Forgot password flow, reset tokens, change password authenticated endpoint.
- **OTP & Passwordless**: Phone/email one-time passcode generation with 5-minute expiry and attempt throttling.
- **Two-Factor Authentication (2FA)**: TOTP setup generating secret, otpauth URI, and QR image; enable/disable verification.
- **API Keys**: User-generated API keys with prefixing, SHA256 storage, and usage tracking.
- **OAuth Providers**: Google and GitHub OAuth flow with graceful mock provider for offline hackathon development.
- **Brute-Force Protection**: Account lockout after consecutive failed attempts with automatic unlock cooldown.

### F02: Authorization & Role-Based Access Control (RBAC)
- **Roles**: `admin`, `manager`, `user`.
- **Permissions**: Granular strings (e.g., `item:create`, `item:delete`, `user:manage`).
- **Resource Ownership**: Users can edit/delete only their own entities unless carrying `manager` or `admin` roles.
- **Deny-by-Default**: Routes without explicit public tags require authenticated tokens.

### F03: Generic Entity CRUD & Relations
- Sample core entity: `Item` (with `Category` 1-N relation and `Tag` N-M relation).
- Universal features:
  - Pagination (`page`, `limit` 1..100)
  - Full-text search on title and description
  - Multi-attribute filtering (category, tags, minPrice, maxPrice, status)
  - Field selection and sorting (`sortBy`, `sortOrder`)
  - Soft deletion and administrator restoration
  - Bulk operations (batch delete)
  - CSV export and multipart CSV import with per-row validation reporting
  - Instant autocomplete search endpoint
  - Geo-proximity query with Haversine distance calculation (`/nearby`)

### F04: Universal Input Validation
- Schema validation across all inputs using idiomatic tools (Zod, Pydantic, Bean Validation, FluentValidation, etc.).
- Strict unknown parameter stripping.
- RFC 7807 problem details formatted 422 responses containing field-level error arrays.

### F05: Security Hardening & Middleware
- Environment-configured CORS (`CORS_ORIGINS`, `FRONTEND_URL`).
- HTTP security headers (equivalent to Helmet).
- Payload size limitation (default 10MB body, 5MB file upload).
- Tiered in-memory rate limiting:
  - Global API: 300 requests / 15 minutes
  - Auth endpoints: 10 requests / 15 minutes
  - AI endpoints: 20 requests / 15 minutes
- SQL/NoSQL injection prevention using strictly parameterized queries.
- Constant-time string comparisons for tokens and webhook signatures.
- Canonical `X-Request-Id` tracing on every request/response cycle.

### F06: File Management & Upload
- Multipart file handling with size validation and MIME whitelist verification.
- File magic-bytes inspection to prevent spoofed extensions.
- Storage drivers: `local`, `s3`, `cloudinary` (graceful fallback to local driver).
- Safe generated filenames preventing directory traversal.

### F07: Real-Time Communication
- Authenticated WebSocket handshake using JWT.
- Event broadcasting, room subscriptions, user presence tracking, and typing indicators.
- Server-to-client push for notifications, domain events, and chat.

### F08: Notification Engine
- In-app notification persistence in database.
- Mark as read, mark all read, unread count queries.
- Real-time notification dispatch and administrator broadcast system.

### F09: Email Delivery Service
- Multi-driver: `console` (default mock) and `smtp`.
- Standard transactional templates: Welcome, Email Verification, Password Reset, Order Confirmation, Invoice.
- Async queue processing preventing HTTP request blocking on mail server latency.

### F10: SMS & Mobile OTP
- Multi-driver: `console` (default mock), `twilio`, `msg91`.
- Hashed OTP storage with attempt limits.

### F11: Payments & Checkout
- Multi-provider adapter: `mock` (instant offline success), `razorpay`, `stripe`.
- Canonical state machine: `created` -> `pending` -> `succeeded` -> `failed` -> `refunded`.
- Idempotent webhook processing with raw body HMAC SHA-256 signature verification.
- Full and partial refund processing.
- Minor currency units (paise/cents) to prevent floating-point rounding issues.

### F12: Background Jobs & Cron Scheduling
- In-process job runner with optional Redis queue backend.
- Automatic retry with exponential backoff and dead-letter log.
- Scheduled jobs: Token cleanup, abandoned cart alerts, daily analytical digests.
- Admin dashboard inspectable via `/api/admin/jobs`.

### F13: In-Memory Caching & Performance
- In-memory cache abstraction with optional Redis driver.
- Read cache with automatic invalidation on entity mutation.
- ETag and Cache-Control headers on cacheable endpoints.

### F14: Search & Auto-complete
- Substring search, tag filtering, and fast autocomplete index.

### F15: AI Integration Hub
- Provider adapter: `mock`, `openai`, `anthropic`, `gemini`, `ollama`.
- Capabilities: Text summarization, contextual database recommendation, streaming chat (SSE), sentiment analysis, OCR extraction.
- Automatic fallback to high-fidelity mock responses when credentials are not configured.

### F16: Admin Intelligence & Auditing
- Aggregated metrics: signups, revenues, order distributions.
- Immutable audit trail recording actor, action, entity, IP, and user-agent.
- Runtime feature flag configuration status endpoint.

### F17: Observability & Health
- Endpoints: `/api/health`, `/api/health/live`, `/api/health/ready`, `/api/metrics`.
- Structured JSON logging with level, timestamp, requestId, route, and latency.
- Graceful shutdown handling (`SIGTERM` / `SIGINT`).

### F18: API Documentation & Client Tooling
- Embedded OpenAPI 3.1 schema served at `/api/openapi.json`.
- Interactive Swagger documentation UI at `/api/docs`.
- Postman collection and environment definitions.

### F19: Utility Toolkit
- Dynamic QR code generation.
- Haversine geographic distance calculator.
- Timezone lookup and converter.
- Internationalization translation bundles (`en`, `hi`).

### F20: Social Interactions
- User reviews with 1-5 star ratings and automatic item score recomputation.
- Nested discussion comments.
- Like counters, bookmarking, and user following.

### F21: E-Commerce & Transactions
- Persistent cart, coupon validation (percentage and fixed amounts).
- ACID transactional order creation with inventory decrement.
- Dynamic PDF invoice generation.

### F22: Booking & Scheduling
- Working-hour time-slot generator.
- Overlapping conflict detection with 409 status code.
- Booking cancellation workflow.

### F23: Real-Time Persistent Chat
- Chat room creation, membership management, persisted message history.

### F24: Multi-Language & Localization
- Automatic language selection from `Accept-Language` header.

### F25: Feature Flagging
- Modular runtime toggling using `FEATURE_<NAME>` flags.

### F26: Data Integrity & Migrations
- Foreign key cascading, unique constraints, and database auto-creation on boot.
- Database reset and backup capabilities.

### F27: Developer Experience
- Hot-reload development servers, one-step seeding, zero external dependencies required for initial run.

### F28: Automated Verification
- Framework unit tests, integration test suites, and cross-stack black-box smoke testing.
