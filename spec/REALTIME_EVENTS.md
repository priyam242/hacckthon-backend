# Backend Arsenal — Real-Time Event Catalogue

Authenticated WebSockets receive events across these channels:

| Event Name | Direction | Payload Example | Description |
|---|---|---|---|
| `connection` | Client -> Server | Handshake with `token` query / header | Establishes authenticated socket session |
| `item:created` | Server -> Client | `{ "id": "uuid", "title": "...", "price": 4999 }` | Dispatched when a new item is published |
| `item:updated` | Server -> Client | `{ "id": "uuid", "status": "active" }` | Dispatched on item state mutation |
| `order:status_changed` | Server -> Client | `{ "orderId": "uuid", "status": "paid" }` | Pushed to order owner on status update |
| `notification:new` | Server -> Client | `{ "id": "uuid", "title": "...", "type": "info" }` | Real-time user alert |
| `chat:message` | Bidirectional | `{ "roomId": "uuid", "body": "Hello", "sender": "..." }` | Live message delivery |
| `presence:update` | Server -> Client | `{ "onlineUsers": ["uuid1", "uuid2"] }` | Active user list updates |
