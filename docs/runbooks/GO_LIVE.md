# Go Live Runbook (Cloudflare Pages)

## Purpose

Repeatable deployment checklist for Preview and Production with Cloudflare Pages + Pages Functions + D1.

## Prerequisites

1. Cloudflare account with access to Pages and D1.
2. Project connected to this repository.
3. `pnpm install` completed locally.
4. `wrangler login` completed for operator account.

## Build Settings (Pages)

Use the following settings in Cloudflare Pages:

- Framework preset: `None` (custom build).
- Build command: `pnpm run build:web`
- Build output directory: `apps/web/dist`
- Root directory: repository root.
- Package manager: `pnpm` (from `packageManager` in `package.json`).
- Node version: `22` (set `NODE_VERSION=22` in Pages Environment Variables).

## A) Preview Setup

### 1. Create Preview D1

```bash
pnpm exec wrangler d1 create seminar-leads-preview
```

Copy resulting preview database ID.

### 2. Configure `wrangler.toml`

Set `preview_database_id` in [wrangler.toml](../../wrangler.toml) to the created Preview D1 ID.
Keep binding name `DB`.

### 3. Set Preview Environment Variables (Pages Dashboard)

Set in **Preview** environment:

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `ADMIN_SECRET`
- `NODE_VERSION=22`

Do not set mock flags in Preview:

- `TURNSTILE_MODE` must be absent (default real verification).
- `ALLOW_TURNSTILE_MOCK` must be absent/`0`.

### 4. Apply Preview Migrations

```bash
pnpm run d1:migrate:preview
```

### 5. Deploy Preview and Verify

1. Open Preview URL.
2. Verify `/` renders and Lead form is visible.
3. Verify `/admin`:
   - no secret / wrong secret -> `401 admin_unauthorized`
   - valid secret -> list loads.
4. Verify `/api/leads` via UI form submit (real Turnstile).
5. Preview smoke:
   - run manual sanity checklist table below against Preview URL.

## B) Production Setup

### 1. Create Production D1

```bash
pnpm exec wrangler d1 create seminar-leads-prod
```

Copy resulting production database ID.

### 2. Configure `wrangler.toml`

Set `database_id` in [wrangler.toml](../../wrangler.toml) to Production D1 ID.
`preview_database_id` must remain pointing to Preview D1.

### 3. Apply Production Migrations

```bash
pnpm run d1:migrate:production
```

### 4. Set Production Environment Variables (Pages Dashboard)

Set in **Production** environment:

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `ADMIN_SECRET`
- `NODE_VERSION=22`

Do not set `TURNSTILE_MODE` / `ALLOW_TURNSTILE_MOCK` in Production.

### 5. Domain and TLS

1. Check custom domain is attached to Pages project.
2. Confirm SSL/TLS status is active and certificate is issued.
3. Verify HTTPS redirect behavior.

### 6. Production Functional Checks

1. `/` opens without JS/runtime errors.
2. `/admin`:
   - wrong secret -> unauthorized error
   - correct secret -> leads table renders.
3. Lead insert:
   - submit one valid lead through UI (Turnstile solved) -> success message.
4. Duplicate check:
   - submit same phone again within 24h -> blocked with duplicate message (`409 duplicate_lead`).
5. Rate limit check:
   - submit 6 leads from same client IP within 10 minutes -> 6th blocked (`429 rate_limited`).

## C) Sanity Checklist

| Check | Expected | Preview | Production |
| --- | --- | --- | --- |
| Landing loads | `/` responds 200 and renders content | ☐ | ☐ |
| Tabs work | Role tabs switch content | ☐ | ☐ |
| Theme works | Light/dark toggle applies and persists | ☐ | ☐ |
| RU/EN works | Language toggle switches text without reload | ☐ | ☐ |
| Turnstile visible | Widget is rendered in Lead form | ☐ | ☐ |
| Lead saved | Valid submit returns success and appears in D1 | ☐ | ☐ |
| Admin list works | `/admin` with valid secret lists leads | ☐ | ☐ |
| Duplicate blocked | Second same phone in 24h blocked (`409`) | ☐ | ☐ |
| Rate limit works | 6th request in 10m blocked (`429`) | ☐ | ☐ |

## Config Audit Notes

1. D1 binding is `DB` in [wrangler.toml](../../wrangler.toml).
2. `database_id` (prod) and `preview_database_id` (preview) must be different.
3. `.dev.vars` is only for `wrangler pages dev --local`; it is not used by deployed Preview/Production.
4. Mock Turnstile cannot be enabled in deployed environments because server code enables mock only when all conditions are true:
   - `TURNSTILE_MODE=mock`
   - `CF_PAGES_BRANCH=local`
   - `ALLOW_TURNSTILE_MOCK=1`
