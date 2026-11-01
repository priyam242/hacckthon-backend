# Backend Arsenal — Error Codes Catalogue

Every stack translates system exceptions and business rule violations into these standard error codes, mapped to appropriate HTTP status codes.

| Error Code | HTTP Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Request body or query parameters failed schema validation |
| `UNAUTHORIZED` | 401 | Missing, invalid, or expired authentication token |
| `FORBIDDEN` | 403 | Authenticated user lacks permission or does not own resource |
| `NOT_FOUND` | 404 | Requested endpoint or resource does not exist |
| `CONFLICT` | 409 | Duplicate unique key, booking overlap, or review conflict |
| `PAYLOAD_TOO_LARGE` | 413 | Request payload or uploaded file exceeds size limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Uploaded file MIME type or magic bytes are not whitelisted |
| `RATE_LIMIT_EXCEEDED` | 429 | Request threshold exceeded for client IP or user account |
| `INTERNAL_ERROR` | 500 | Unhandled server error (stack trace sanitized from client) |
| `SERVICE_UNAVAILABLE` | 503 | Readiness check failed or critical dependency offline |
| `BAD_REQUEST` | 400 | Malformed JSON or syntactically invalid input |
