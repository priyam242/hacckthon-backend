# Deployment Guide — Cloud Host Recipes

Production deployment strategies for Backend Arsenal templates.

---

## 1. Universal Docker Containerization
Every stack includes an optimized multi-stage `Dockerfile`.

### Build & Run Locally
```bash
docker build -t hackathon-backend:latest .
docker run -p 5000:5000 --env-file .env.example hackathon-backend:latest
```

---

## 2. Render / Railway Deployment
1. Connect your GitHub repository to Render or Railway.
2. Set Environment Variables:
   - `APP_ENV=production`
   - `PORT=5000`
   - `JWT_SECRET=<generated-secret>`
   - `DEMO_MODE=false`
3. Set Build Command:
   - Node: `npm install && npm run build`
   - Python: `pip install -r requirements.txt`
   - Go: `go build -o server main.go`
4. Set Start Command:
   - Node: `node src/server.js`
   - Python: `uvicorn app.main:app --host 0.0.0.0 --port 5000`
   - Go: `./server`
