# Seminar

Landing + lead capture + minimal admin panel + internal materials cabinet with in-app markdown reading for lecturers.

Canonical production runtime:
- JustHost VPS
- Trusted public domain (canonical): https://seminar-ai.ru/
- Docker + Traefik + GHCR pinned digest
- SQLite storage

Runtime truth:
- Local development and local smoke use `node server/index.mjs`.
- Canonical production uses Docker + Traefik.
- Legacy `systemd + nginx` exists only as rollback/live snapshot reference, not as target release path.
- If you are resuming deploy work in a fresh chat, read `docs/notes/NOTE-007.deploy-entrypoints-and-truth-map.md` first.

## Quick Start (Local)

1. Install dependencies:

```bash
pnpm install
```

2. Build frontend:

```bash
pnpm run build:web
```

3. Set required env and run server:

```bash
pnpm run start:vps
```

Minimum local env:

```bash
ADMIN_SECRET=local-admin-secret
CABINET_BOOTSTRAP_ADMIN=1
CABINET_BOOTSTRAP_USERNAME=local-admin
CABINET_BOOTSTRAP_EMAIL=local-admin@example.com
CABINET_BOOTSTRAP_PASSWORD=local-admin-pass
```

Bootstrap behavior:
- `CABINET_BOOTSTRAP_ADMIN=1` creates the first admin if it does not exist yet.
- Existing admin credentials are reset only when `CABINET_BOOTSTRAP_ALLOW_RESET=1` is added for that specific startup.
- After the first successful login, turn bootstrap back off and remove `CABINET_BOOTSTRAP_PASSWORD` from env.

4. Optional smoke checks:

```bash
pnpm run test:smoke:leads
pnpm run test:smoke:cabinet
pnpm exec playwright install chromium
pnpm run test:smoke:cabinet:browser
```

Cabinet reader flow:
- `/cabinet` is the protected library.
- Markdown materials can be opened in-app via `/cabinet/materials/:slug`.
- PDFs and other non-markdown assets still open through the source/open route.
- Materials now expose lecturer-facing curation signals: `draft`, `working`, `final`, theme, reading mode, lecture-prep recommendation, and curator review date.

## Documentation

- Deploy re-entry for a new agent: [docs/notes/NOTE-007.deploy-entrypoints-and-truth-map.md](./docs/notes/NOTE-007.deploy-entrypoints-and-truth-map.md)
- Latest pre-go-live deploy anamnesis: [docs/reports/2026-03-13/DEPLOY.anamnesis.pre-cabinet-go-live.report.md](./docs/reports/2026-03-13/DEPLOY.anamnesis.pre-cabinet-go-live.report.md)
- Main docs index: [docs/README.md](./docs/README.md)
- Go-live runbook: [docs/runbooks/GO_LIVE.md](./docs/runbooks/GO_LIVE.md)
- Env matrix: [docs/runbooks/ENV_MATRIX.md](./docs/runbooks/ENV_MATRIX.md)
- Local smoke runbook: [docs/runbooks/LEADS_SMOKE_LOCAL.md](./docs/runbooks/LEADS_SMOKE_LOCAL.md)
- Cabinet local smoke runbook: [docs/runbooks/CABINET_LOCAL_SMOKE.md](./docs/runbooks/CABINET_LOCAL_SMOKE.md)
- CI guardrails: [docs/runbooks/GITHUB_GUARDRAILS.md](./docs/runbooks/GITHUB_GUARDRAILS.md)
- Canonical production baseline: [docs/infra-ops/PRODUCTION_BASELINE_DOCKER_TRAEFIK.md](./docs/infra-ops/PRODUCTION_BASELINE_DOCKER_TRAEFIK.md)
- Legacy live snapshot: [docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md](./docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md)
