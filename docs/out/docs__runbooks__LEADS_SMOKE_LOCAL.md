# Leads Smoke: Local Run (Node + SQLite)

## Prerequisites

1. Install dependencies:

```bash
pnpm install
```

2. Build frontend:

```bash
pnpm run build:web
```

3. Set local env (PowerShell example):

```powershell
$env:PORT="8787"
$env:HOST="127.0.0.1"
$env:ADMIN_SECRET="local-admin-secret"
# Optional:
# $env:TURNSTILE_SECRET_KEY="<real-secret>"
# $env:TURNSTILE_MODE="mock"
# $env:ALLOW_TURNSTILE_MOCK="1"
```

## Run Order

1. Start app:

```bash
pnpm run start:vps
```

2. In another terminal run checks.

## Expected Result

Health check:

```bash
curl -i http://127.0.0.1:8787/api/healthz
```

Expected: `200` and `{ "ok": true }`.

Lead insert:

```bash
curl -i -X POST http://127.0.0.1:8787/api/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke User","phone":"+14155552671","locale":"en","source":"landing","turnstile_token":"captcha-disabled"}'
```

Expected: `200` and `{ "ok": true, "lead_id": "..." }`.

Duplicate protection:

```bash
curl -i -X POST http://127.0.0.1:8787/api/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke User","phone":"+14155552671","locale":"en","source":"landing","turnstile_token":"captcha-disabled"}'
```

Expected: `409` and `code: "duplicate_lead"`.

Admin access:

```bash
curl -i http://127.0.0.1:8787/api/admin/leads?limit=10 \
  -H "X-Admin-Secret: local-admin-secret"
```

Expected: `200` and `{ "ok": true, "items": [...] }`.

Wrong/missing admin secret:

Expected: `401` and `code: "admin_unauthorized"`.

## Diagnostics Tips

1. Server logs:

```bash
pnpm run start:vps
```

2. Verify DB file exists and grows:

```bash
ls -la data/
```

3. Common config errors:
   - missing `ADMIN_SECRET` -> `/api/admin/leads` returns `500` with config message
   - invalid JSON body -> `400 invalid_input`
