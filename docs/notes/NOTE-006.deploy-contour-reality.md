---
id: NOTE-006.deploy-contour-reality
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/reports/2026-03-13/DEPLOY.anamnesis.pre-cabinet-go-live.report.md
  - docs/runbooks/DEPLOY_DOCKER_CONTRACT.md
  - docs/runbooks/GO_LIVE.md
  - docs/infra-ops/PRODUCTION_BASELINE_DOCKER_TRAEFIK.md
  - docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md
tags:
  - note
  - deploy
  - production
  - docker
  - rollback
---

# Deploy Contour Reality

## Purpose
Зафиксировать live reality на `2026-03-13`, чтобы ближайший cabinet go-live не строился вокруг устаревшего operational образа.

## Live Truth
1. Реальный public contour сейчас:
   - `Docker`
   - `Traefik`
   - pinned GHCR image
   - SQLite mount from `/opt/seminar/parity-data`
2. Активный deploy control plane:
   - `/opt/seminar/.env.seminar`
   - `/opt/seminar/compose.seminar.ghcr.yml`
   - `/etc/seminar/seminar.docker.env`
3. Реальный seminar runtime контейнер:
   - `seminar-app`
4. Реальный ingress контейнер:
   - `platform-edge-traefik`

## Legacy Reality
1. `seminar.service`, `nginx`, and `/var/www/seminar/releases/*` still exist on the host.
2. They are not the active production path on `2026-03-13`.
3. They should be treated as:
   - rollback residue
   - historical forensic context
   - not the default rollout path

## Operational Consequence
До отдельной cleanup-работы считать обязательным правило:
1. ближайшие deploy prompts must target Docker-only rollout
2. legacy `systemctl restart seminar` path must not be used as the default release action
3. rollback may still reference legacy assets only as an emergency exception

## CI / Docs Caveat
1. Repo still contains a legacy CI `deploy` job targeting `/var/www/seminar/releases/*`.
2. This job no longer represents live production truth.
3. Any go-live preparation must explicitly bypass that legacy path and use the Docker rollout contract instead.
