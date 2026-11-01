# Backend Arsenal — Universal Environment Variables Specification

All 10 stacks accept this uniform set of environment variables. Missing keys fall back gracefully to local embedded defaults without halting boot.

| Variable | Default Value | Description |
|---|---|---|
| `APP_ENV` | `development` | Runtime environment (`development`, `production`, `test`) |
| `PORT` | `5000` | HTTP port the server listens on |
| `APP_NAME` | `backend-arsenal` | Application identifier |
| `DEMO_MODE` | `true` | When true, returns tokens in responses for easy local testing |
| `LOG_LEVEL` | `info` | Minimum log severity level (`debug`, `info`, `warn`, `error`) |
| `LOG_FILE` | `logs/app.log` | Rotating log file destination |
| `DATABASE_URL` | `""` (Empty -> SQLite file) | Database connection string (PostgreSQL/MySQL supported) |
| `JWT_SECRET` | `change-me-min-32-chars` | HS256 secret key for signing JWT tokens |
| `JWT_EXPIRES_IN` | `15m` | Lifetime of access tokens |
| `REFRESH_EXPIRES_IN` | `7d` | Lifetime of refresh tokens |
| `FRONTEND_URL` | `http://localhost:3000` | Primary frontend web client origin |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Comma-separated allowed CORS origins |
| `RATE_LIMIT_WINDOW_MIN` | `15` | Sliding window in minutes for rate limiting |
| `RATE_LIMIT_MAX` | `300` | Max requests allowed within window per IP |
| `AUTH_RATE_LIMIT_MAX` | `10` | Max login/signup requests allowed within window |
| `AI_RATE_LIMIT_MAX` | `20` | Max AI generation requests allowed within window |
| `BODY_LIMIT_MB` | `10` | Maximum HTTP JSON request body size in MB |
| `UPLOAD_MAX_MB` | `5` | Maximum single file upload size in MB |
| `STORAGE_DRIVER` | `local` | Upload storage backend (`local`, `s3`, `cloudinary`) |
| `EMAIL_DRIVER` | `console` | Email provider (`console`, `smtp`) |
| `SMS_DRIVER` | `console` | SMS provider (`console`, `twilio`, `msg91`) |
| `PAYMENT_PROVIDER` | `mock` | Payment processor (`mock`, `razorpay`, `stripe`) |
| `MOCK_WEBHOOK_SECRET` | `mock-webhook-secret` | HMAC secret for verifying mock payment webhooks |
| `AI_PROVIDER` | `mock` | AI engine (`mock`, `openai`, `anthropic`, `gemini`, `ollama`) |
| `CACHE_DRIVER` | `memory` | Caching backend (`memory`, `redis`) |
| `QUEUE_DRIVER` | `inprocess` | Job queue backend (`inprocess`, `redis`) |
| `FEATURE_*` | `true` | Modular feature flags (`FEATURE_AUTH_OTP`, `FEATURE_COMMERCE`, etc.) |
