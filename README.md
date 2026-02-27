# Seminar

Landing + lead capture + minimal admin panel.

Current production runtime:
- JustHost VPS
- Node.js service (`server/index.mjs`) under `systemd`
- `nginx` reverse proxy
- SQLite storage

## Quick Start (Local)

1. Install dependencies:

```bash
pnpm install
```

2. Build frontend:

```bash
pnpm run build:web
```

3. Set required env (`ADMIN_SECRET`) and run server:

```bash
pnpm run start:vps
```

4. Optional smoke check:

```bash
pnpm run test:smoke:leads
```

## Documentation

- Main docs index: [docs/README.md](./docs/README.md)
- Go-live runbook: [docs/runbooks/GO_LIVE.md](./docs/runbooks/GO_LIVE.md)
- Env matrix: [docs/runbooks/ENV_MATRIX.md](./docs/runbooks/ENV_MATRIX.md)
- Local smoke runbook: [docs/runbooks/LEADS_SMOKE_LOCAL.md](./docs/runbooks/LEADS_SMOKE_LOCAL.md)
- CI guardrails: [docs/runbooks/GITHUB_GUARDRAILS.md](./docs/runbooks/GITHUB_GUARDRAILS.md)
