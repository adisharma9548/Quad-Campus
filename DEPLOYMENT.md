# Deployment guide

## 1. Backend (Node 22.5+; tested on 22 and 24)

```bash
cd backend
npm ci
cp .env.example .env
```

Edit `.env`:

| Setting | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `AUTH_SECRET` | 64 random hex characters (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `FRONTEND_ORIGIN` | your exact `https://` frontend origin |
| `MOCK_ADMIN_EMAIL`, `MOCK_ADMIN_USERNAME` | the first administrator's login |
| `SEED_ADMIN_PASSWORD` | a strong password (12+ characters). Used once, on first start with an empty database |
| `INSTITUTION_PRESET` / `INSTITUTION_CONFIG_PATH` | your school profile (see `institution.example.json`) |
| `EMAIL_POLICY` / `ALLOWED_EMAIL_DOMAINS` | who may register |

Start with `npm start`. Run it under a process manager (systemd, pm2, or Docker) and back up `data/quad.db` regularly (copy it while the server is stopped, or use `sqlite3 quad.db ".backup file"`).

After the first start, remove `SEED_ADMIN_PASSWORD` from `.env`.

## 2. Frontend

```bash
cd frontend
npm ci
cp .env.example .env     # VITE_AUTH_MODE=real, VITE_API_BASE_URL=/api/v1
npm run build            # output in frontend/dist
```

Serve `frontend/dist` from the same domain as the API and proxy `/api` to the backend, so the browser sees one origin.

## 3. Reverse proxy with HTTPS (Caddy example)

```
campus.example.com {
  encode gzip
  handle /api/* { reverse_proxy 127.0.0.1:4000 }
  handle {
    root * /var/www/quad
    try_files {path} /index.html
    file_server
  }
  header {
    Content-Security-Policy "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"
    X-Content-Type-Options nosniff
    Referrer-Policy no-referrer
  }
}
```

## 4. Sales demo

For a demo environment only: set `SEED_DEMO_DATA=true` on the backend and build the frontend with `VITE_SHOW_DEMO_CREDENTIALS=true`. Never use this for a customer's live instance.

## 5. Checks before going live

```bash
cd backend  && npm run typecheck && npm test
cd frontend && npm run typecheck && npm run lint && npm run build
```
