# Real-Time Client Integration Guide

Connection patterns for frontend clients connecting to Backend Arsenal real-time servers.

---

## 1. Native WebSocket Client (Browser)
```javascript
const token = "YOUR_ACCESS_TOKEN";
const ws = new WebSocket(`ws://localhost:5000/ws?token=${token}`);

ws.onopen = () => {
  console.log("Connected to Realtime Server");
  ws.send(JSON.stringify({ action: "subscribe", channel: "items" }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Realtime Event:", data);
};
```

---

## 2. Socket.io Client (Node.js Stack)
```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: { token: "YOUR_ACCESS_TOKEN" }
});

socket.on("item:created", (item) => {
  console.log("New Item Published:", item);
});
```
