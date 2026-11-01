# Security Hardening Checklist

Audit items to execute before deploying a hackathon prototype to production:

- [ ] **Rotate JWT Secret**: Replace default secret in `.env` with a 64-character random string (`openssl rand -hex 32`).
- [ ] **Disable DEMO_MODE**: Set `DEMO_MODE=false` so tokens and OTPs are not returned in HTTP responses.
- [ ] **Restrict CORS**: Replace `*` in `CORS_ORIGINS` with exact frontend domains.
- [ ] **Enforce HTTPS**: Ensure all endpoints redirect to TLS.
- [ ] **Sanitize Error Responses**: Confirm global error handler returns RFC 7807 problem details and does not leak database errors or internal stack traces.
- [ ] **Rate Limiting**: Verify rate limit thresholds match expected production load.
- [ ] **File Upload Validation**: Ensure file magic bytes verification is enabled.
