# Leads Smoke: Local Run

## Prerequisites

1. Install dependencies:

```bash
pnpm install
```

2. Create `.dev.vars` from `.dev.vars.example` and set:
   - `TURNSTILE_MODE=mock`
   - `ALLOW_TURNSTILE_MOCK=1`
   - `TURNSTILE_SECRET_KEY=<any non-empty value>`
   - `ADMIN_SECRET=<your local admin secret>`
   - `CF_PAGES_BRANCH=local`

3. Apply local D1 migrations:

```bash
pnpm run d1:migrate:local
```

## Run Order

1. Start Pages + Functions:

```bash
pnpm run dev:pages
```

2. In another terminal run smoke:

```bash
pnpm run test:smoke:leads
```

## Expected Result

- `dev-ok` token path returns `200` with `{ ok: true, lead_id }`
- Smoke script runs `SELECT COUNT(*) AS c FROM leads WHERE id = ...` and expects `c=1`
- `dev-fail` token path returns `4xx` with `code: "turnstile_failed"`

If any step fails, the script exits with code `1`.

## Diagnostics Tips

1. In local mode `/api/leads` logs env presence flags (without secret values):
   - `TURNSTILE_MODE`
   - `ALLOW_TURNSTILE_MOCK`
   - `TURNSTILE_SECRET_KEY`
   - `DB` binding
2. Config issues now return `code: "config_missing"` with explicit message.

## Admin Access

1. Start Pages Functions with `.dev.vars` containing `ADMIN_SECRET`.
2. Open `http://127.0.0.1:8788/admin`, enter the same secret and click `Load leads`.
3. Expected behavior:
   - missing/invalid secret -> `401` with `code: "admin_unauthorized"`
   - valid secret -> `{ ok: true, items: [...] }` with newest leads first (`created_at DESC`, limit `<= 50`)
4. Cloudflare Pages setup:
   - add `ADMIN_SECRET` in project Environment Variables for both Preview and Production.
