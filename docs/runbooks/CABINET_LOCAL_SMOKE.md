---
id: RUNBOOK.cabinet.local-smoke
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
  - docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md
  - docs/runbooks/ENV_MATRIX.md
tags:
  - runbook
  - cabinet
  - auth
  - local
---

# Cabinet Local Smoke

## Purpose / Scope
Локальный runbook для минимальной проверки cabinet v1: bootstrap первого admin, login/logout flow, protected materials library, lecturer reading flow для markdown и отсутствие регрессии у legacy `/admin`.

## Context
Cabinet v1 использует:
1. app-native login;
2. SQLite-backed `users`, `sessions`, `materials`;
3. env-assisted bootstrap admin flow;
4. optional DeepSeek-backed simplify flow for markdown reader materials.

Runtime truth for this runbook:
1. This document is for local `node server/index.mjs` flow only.
2. Canonical production contour is Docker + Traefik.
3. Legacy `systemd + nginx` is rollback-only and not the target path for cabinet verification.

Bootstrap env должен использоваться осознанно:
1. включить;
2. создать первого admin;
3. если нужен намеренный reset существующего admin, добавить `CABINET_BOOTSTRAP_ALLOW_RESET=1` только на один старт;
4. затем выключить.

## Main Section
### 1. Required Local Env
PowerShell example:

```powershell
$env:ADMIN_SECRET="local-admin-secret"
$env:CABINET_BOOTSTRAP_ADMIN="1"
$env:CABINET_BOOTSTRAP_USERNAME="local-admin"
$env:CABINET_BOOTSTRAP_EMAIL="local-admin@example.com"
$env:CABINET_BOOTSTRAP_PASSWORD="local-admin-pass"
```

Optional:

```powershell
$env:CABINET_BOOTSTRAP_ALLOW_RESET="1" # only for an intentional one-time reset
$env:CABINET_SESSION_TTL_HOURS="168"
$env:CABINET_LOGIN_WINDOW_MINUTES="10"
$env:CABINET_LOGIN_MAX_ATTEMPTS="10"
$env:DEEPSEEK_API_KEY="local-deepseek-key"
# $env:DEEPSEEK_BASE_URL="https://api.deepseek.com"
# $env:LLM_SIMPLIFY_TIMEOUT_MS="45000"
# $env:LLM_SIMPLIFY_MAX_SOURCE_CHARS="20000"
```

### 2. Start App
```powershell
pnpm run build:web
pnpm run start:vps
```

### 3. Automated Smoke
API smoke against the running local app, in another shell:

```powershell
$env:ADMIN_SECRET="local-admin-secret"
$env:CABINET_BOOTSTRAP_USERNAME="local-admin"
$env:CABINET_BOOTSTRAP_PASSWORD="local-admin-pass"
pnpm run test:smoke:leads
pnpm run test:smoke:cabinet
```

### 4. Browser Smoke
One-command browser smoke:

```powershell
pnpm exec playwright install chromium
pnpm run test:smoke:cabinet:browser
```

The browser smoke is self-managed by default:
1. it starts a temporary local server instance;
2. logs in with bootstrap admin credentials;
3. verifies `/cabinet` access;
4. opens `/cabinet/admin/users` and verifies the admin-only surface renders;
5. opens one markdown material in `/cabinet/materials/:slug`;
6. runs simplify generation for the opened markdown material when DeepSeek env is configured;
7. regenerates the simplified view once;
8. returns back to the library;
9. performs logout;
10. verifies that `/cabinet` requires auth again.

Manual fallback:
1. Open `http://127.0.0.1:8787/cabinet`.
2. Confirm redirect to `/cabinet/login`.
3. Sign in with bootstrap admin credentials.
4. Confirm redirect to `/cabinet`.
5. Open `/cabinet/admin/users` and confirm the admin-only page renders a create form plus the current user list.
6. Confirm materials list is visible.
7. Open one markdown material with `Читать в кабинете`.
8. Confirm the material renders as readable markdown and not as raw frontmatter.
9. If DeepSeek env is configured, click `Пересказать простым языком` and confirm the simplified markdown appears.
10. Click `Перегенерировать` once and confirm the simplified view updates.
11. Click `Назад к библиотеке`.
12. Click logout.
13. Confirm return to login screen.

### 5. After Bootstrap
Once the first admin is created and verified, disable bootstrap env:

```powershell
$env:CABINET_BOOTSTRAP_ADMIN="0"
Remove-Item Env:CABINET_BOOTSTRAP_ALLOW_RESET -ErrorAction SilentlyContinue
Remove-Item Env:CABINET_BOOTSTRAP_PASSWORD -ErrorAction SilentlyContinue
```

## Acceptance / Validation
Smoke is green when:

1. `/api/cabinet/session` returns `401` before login.
2. `/api/cabinet/login` returns `200` and sets `HttpOnly` cookie.
3. `/api/cabinet/materials` returns non-empty list after login.
4. `/cabinet/admin/users` is reachable for the bootstrap admin and returns the current users list.
5. at least one markdown material opens via `/cabinet/materials/:slug` and renders without YAML frontmatter.
6. if DeepSeek env is configured, simplify state endpoint returns `200` and the browser smoke can complete one generate + one regenerate round-trip.
7. `/api/cabinet/logout` invalidates access.
8. `/api/admin/leads` still returns `401` on wrong secret and `200` on valid `ADMIN_SECRET`.

## Related
- docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
- docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md
- docs/runbooks/ENV_MATRIX.md

## Open Questions / TODO
1. Нужен ли отдельный production runbook для cabinet bootstrap на docker runtime, или достаточно обновить deploy docs позже.
