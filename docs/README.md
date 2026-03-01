# Seminar Docs Index

## Production Runtime Model (Docker Canon)

- Canonical baseline since `2026-03-01`.
- Runtime owner: Docker (`seminar-app`) on VPS.
- Edge owner: Traefik (`:80/:443`) with explicit host rules per project.
- Artifact policy: GHCR pinned digest only (`ghcr.io/kwentin3/seminar@sha256:<digest>`).
- Trusted public domain (canonical): `https://seminar-ai.ru/`
- Storage: SQLite persistent volume (`/var/lib/seminar/seminar.sqlite` inside runtime contract)
- Observability: structured logs to stdout, `/admin/obs/logs` with explicit source (`OBS_LOG_SOURCE=docker`)
- Legacy status: `systemd + nginx` is deprecated and allowed only for rollback.

## Primary Documents

1. [Production Baseline: Docker + Traefik](./infra-ops/PRODUCTION_BASELINE_DOCKER_TRAEFIK.md)
2. [Deploy Docker Contract](./runbooks/DEPLOY_DOCKER_CONTRACT.md)
3. [Go Live Runbook (Legacy Rollback Only)](./runbooks/GO_LIVE.md)
4. [GitHub Guardrails](./runbooks/GITHUB_GUARDRAILS.md)
5. [Environment Matrix](./runbooks/ENV_MATRIX.md)
6. [Infrastructure ADR](./adr/ADR-001.infrastructure.baseline.v1.md)
7. [Documentation Canon](./DOCS_CANON.md)
8. [Observability Contract: Logging Event Model v0.4](./contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md)
9. [OBS Log Sources Contract v0.1](./contracts/CONTRACT-OBS-002.log-retrieval-sources.v0.1.md)
10. [SQLite Backup SLA v0.1](./contracts/CONTRACT-OPS-001.sqlite-backup-sla.v0.1.md)

## Observability Quick Links

- [CONTRACT-OBS-001.logging-event-model.v0.4](./contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md)
- [CONTRACT-OBS-002.log-retrieval-sources.v0.1](./contracts/CONTRACT-OBS-002.log-retrieval-sources.v0.1.md)
- [OBS Log Retrieval Runbook](./runbooks/OBS_LOG_RETRIEVAL.md)
- [OBS Incident Playbook](./runbooks/OBS_INCIDENT_PLAYBOOK.md)

## Local Developer Flow (Short)

1. `pnpm install`
2. `pnpm run build:web`
3. Set env (`ADMIN_SECRET` required)
4. `pnpm run start:vps`
5. Optional smoke: `pnpm run test:smoke:leads`
