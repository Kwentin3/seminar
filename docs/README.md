# Seminar Docs Index

## Current Runtime Snapshot

- Production hosting: JustHost VPS (`91.132.48.224`)
- Trusted public domain (canonical): `https://seminar-ai.ru/`
- SSH operations policy (updated `2026-02-27`): key-based root access only for deployment tasks
- App runtime: Node.js service (`server/index.mjs`) managed by `systemd`
- Edge/web: `nginx` reverse proxy
- Storage: SQLite (`/var/lib/seminar/seminar.sqlite` in production)
- Protection: `fail2ban` (`sshd`, `nginx-http-auth`, `nginx-botsearch`)
- TLS: Let's Encrypt (`certbot`)

## Primary Documents

1. [Go Live Runbook](./runbooks/GO_LIVE.md)
2. [Environment Matrix](./runbooks/ENV_MATRIX.md)
3. [Local Leads Smoke](./runbooks/LEADS_SMOKE_LOCAL.md)
4. [GitHub Guardrails](./runbooks/GITHUB_GUARDRAILS.md)
5. [Infrastructure ADR](./adr/ADR-001.infrastructure.baseline.v1.md)
6. [Phase 1 PRD](./prd/PRD-PHASE-1.LANDING.md)
7. [Documentation Canon](./DOCS_CANON.md)

## Local Developer Flow (Short)

1. `pnpm install`
2. `pnpm run build:web`
3. Set env (`ADMIN_SECRET` required)
4. `pnpm run start:vps`
5. Optional smoke: `pnpm run test:smoke:leads`
