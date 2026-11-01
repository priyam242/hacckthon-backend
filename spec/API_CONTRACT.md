# Backend Arsenal — Universal API Contract

All endpoints follow the base URL `/api` and return standardized JSON responses.

## Universal Response Format

### Success Envelope
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 10,
    "totalCount": 40,
    "totalPages": 4,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Error Envelope (RFC 7807 aligned)
```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "email",
        "message": "Invalid email address format"
      }
    ]
  }
}
```

---

## Endpoint Directory

| Category | Method | Path | Role | Description |
|---|---|---|---|---|
| **System** | GET | `/api/health` | Public | System status, uptime, database/cache/queue state |
| | GET | `/api/health/live` | Public | Liveness probe (200 OK) |
| | GET | `/api/health/ready` | Public | Readiness probe (503 if DB disconnected) |
| | GET | `/api/version` | Public | API and repository version details |
| | GET | `/api/metrics` | Admin | Request counter, error rates, active sockets |
| | GET | `/api/docs` | Public | Interactive Swagger API documentation |
| | GET | `/api/openapi.json` | Public | Raw OpenAPI 3.1 schema specification |
| **Auth** | POST | `/api/auth/register` | Public | Register new user account |
| | POST | `/api/auth/login` | Public | Authenticate user and issue JWT pair |
| | POST | `/api/auth/refresh` | Public | Rotate refresh token for new access token |
| | POST | `/api/auth/logout` | User | Revoke refresh token and invalidate session |
| | GET | `/api/auth/me` | User | Fetch current authenticated user profile |
| | PUT | `/api/auth/profile` | User | Update profile details (name, avatar, bio) |
| | PUT | `/api/auth/change-password` | User | Update password with old password verification |
| | POST | `/api/auth/forgot-password`| Public | Initiate password reset email/token |
| | POST | `/api/auth/reset-password` | Public | Complete password reset using token |
| | POST | `/api/auth/verify-email` | Public | Verify email address via verification token |
| | POST | `/api/auth/otp/request` | Public | Request SMS/Email one-time passcode |
| | POST | `/api/auth/otp/verify` | Public | Exchange OTP for authentication tokens |
| | POST | `/api/auth/2fa/setup` | User | Generate TOTP secret and QR code |
| | POST | `/api/auth/2fa/enable` | User | Confirm and enable 2FA |
| | POST | `/api/auth/2fa/disable` | User | Disable 2FA with current passcode |
| | POST | `/api/auth/api-keys` | User | Create a new developer API key |
| | GET | `/api/auth/api-keys` | User | List all active API keys |
| | DELETE| `/api/auth/api-keys/:id` | User | Revoke an API key |
| | GET | `/api/auth/oauth/:provider/url` | Public | Get OAuth authorization URL |
| | POST | `/api/auth/oauth/:provider/callback` | Public | Exchange OAuth authorization code for tokens |
| **Users & RBAC** | GET | `/api/users` | Admin | Paginated user search and filtering |
| | GET | `/api/users/:id` | Admin | Fetch single user details |
| | PATCH | `/api/users/:id/role` | Admin | Update user role (`user`, `manager`, `admin`) |
| | PATCH | `/api/users/:id/status` | Admin | Activate or deactivate user account |
| | DELETE| `/api/users/:id` | Admin | Delete a user account |
| | GET | `/api/roles` | Admin | List available roles and permissions |
| **Categories** | GET | `/api/categories` | Public | List all categories |
| | POST | `/api/categories` | Manager/Admin| Create a new category |
| | PUT | `/api/categories/:id` | Manager/Admin| Update category details |
| | DELETE| `/api/categories/:id` | Admin | Remove a category |
| **Items** | GET | `/api/items` | Public | List items with search, filter, sort, pagination |
| | GET | `/api/items/:id` | Public | Fetch item details (increments viewCount) |
| | POST | `/api/items` | Manager/Admin| Create new item |
| | PUT | `/api/items/:id` | Owner/Mgr/Admin| Replace item details |
| | PATCH | `/api/items/:id` | Owner/Mgr/Admin| Partial item update |
| | DELETE| `/api/items/:id` | Owner/Admin | Soft delete an item |
| | POST | `/api/items/:id/restore`| Admin | Restore a soft-deleted item |
| | POST | `/api/items/bulk-delete` | Admin | Delete multiple items by ID list |
| | GET | `/api/items/export` | Manager/Admin| Export items dataset as CSV |
| | POST | `/api/items/import` | Manager/Admin| Import items via CSV upload |
| | GET | `/api/items/autocomplete`| Public | Instant autocomplete suggestions |
| | GET | `/api/items/nearby` | Public | Haversine geo-distance proximity query |
| **Social** | GET | `/api/items/:id/reviews`| Public | List reviews for item |
| | POST | `/api/items/:id/reviews`| User | Post review (1-5 stars); recomputes rating |
| | DELETE| `/api/reviews/:id` | Owner/Admin | Delete a review |
| | GET | `/api/items/:id/comments`| Public | List nested comments |
| | POST | `/api/items/:id/comments`| User | Post top-level or reply comment |
| | POST | `/api/items/:id/like` | User | Toggle like on item |
| | POST | `/api/items/:id/bookmark`| User | Toggle bookmark on item |
| | GET | `/api/me/bookmarks` | User | List bookmarked items |
| | POST | `/api/users/:id/follow` | User | Follow or unfollow a user |
| **Cart & Commerce** | GET | `/api/cart` | User | View current shopping cart |
| | POST | `/api/cart/items` | User | Add item to cart with stock validation |
| | PATCH | `/api/cart/items/:itemId`| User | Update quantity in cart |
| | DELETE| `/api/cart/items/:itemId`| User | Remove item from cart |
| | DELETE| `/api/cart` | User | Empty cart |
| | POST | `/api/cart/apply-coupon`| User | Apply coupon code |
| | CRUD | `/api/coupons` | Admin | Manage discount coupons |
| | POST | `/api/orders` | User | Create transactional order from cart |
| | GET | `/api/orders` | User (own) / Admin (all) | List orders |
| | GET | `/api/orders/:id` | Owner/Admin | Fetch order details |
| | PATCH | `/api/orders/:id/status`| Admin | Transition order state |
| | GET | `/api/orders/:id/invoice.pdf` | Owner/Admin | Download PDF invoice |
| **Payments** | POST | `/api/payments/checkout` | User | Create payment session |
| | POST | `/api/payments/verify` | User | Verify payment completion |
| | POST | `/api/payments/webhook/:provider` | Public | Process provider webhook |
| | POST | `/api/payments/:id/refund`| Admin | Process refund |
| **Bookings** | GET | `/api/slots` | Public | Query available appointment slots |
| | POST | `/api/bookings` | User | Reserve booking slot (conflict check) |
| | GET | `/api/bookings` | User (own) / Admin (all) | List bookings |
| | PATCH | `/api/bookings/:id/cancel`| Owner/Admin | Cancel a booking |
| **Files** | POST | `/api/upload/image` | User | Upload single verified image |
| | POST | `/api/upload/multiple` | User | Upload up to 5 verified images |
| | POST | `/api/upload/document` | User | Upload document (PDF/CSV/DOCX) |
| | GET | `/api/files/:id` | Owner/Admin | Retrieve file metadata |
| | GET | `/uploads/:filename` | Public | Static asset delivery |
| **Notifications** | GET | `/api/notifications` | User | Paginated notifications |
| | GET | `/api/notifications/unread-count` | User | Count unread notifications |
| | PATCH | `/api/notifications/:id/read` | User | Mark single notification as read |
| | PATCH | `/api/notifications/read-all` | User | Mark all notifications read |
| | POST | `/api/notifications/broadcast` | Admin | Send broadcast notification |
| **Chat** | GET/POST| `/api/chat/rooms` | User | List and create chat rooms |
| | GET | `/api/chat/rooms/:id/messages` | User | Fetch message history |
| | POST | `/api/chat/rooms/:id/messages` | User | Send message |
| **AI Integration** | POST | `/api/ai/summary` | User | Generate text summary |
| | POST | `/api/ai/recommend` | User | Recommend items from DB matching prompt |
| | POST | `/api/ai/chat` | User | Conversational AI (supports SSE stream) |
| | POST | `/api/ai/sentiment` | User | Sentiment analysis (label & score) |
| | POST | `/api/ai/generate` | User | Creative content generation |
| | POST | `/api/ai/ocr` | User | Extract text from uploaded image |
| **Admin & Analytics** | GET | `/api/admin/stats` | Admin | Aggregated dashboard stats |
| | GET | `/api/admin/audit-logs` | Admin | Paginated security audit trail |
| | GET | `/api/admin/jobs` | Admin | Background job statuses |
| | POST | `/api/admin/jobs/:name/run` | Admin | Trigger background job immediately |
| | GET | `/api/admin/feature-flags` | Admin | Inspect enabled runtime feature flags |
| **Utilities** | GET | `/api/utils/qr` | Public | Render PNG QR code |
| | GET | `/api/utils/geo/distance` | Public | Calculate distance between lat/lng |
| | GET | `/api/utils/time` | Public | Query timezone time and offsets |
| | GET | `/api/utils/i18n/:lang` | Public | Retrieve localization bundle |
