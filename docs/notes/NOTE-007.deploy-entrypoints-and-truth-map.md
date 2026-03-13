---
id: NOTE-007.deploy-entrypoints-and-truth-map
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/reports/2026-03-13/DEPLOY.anamnesis.pre-cabinet-go-live.report.md
  - docs/notes/NOTE-006.deploy-contour-reality.md
  - docs/runbooks/DEPLOY_DOCKER_CONTRACT.md
  - docs/runbooks/ENV_MATRIX.md
  - docs/runbooks/GO_LIVE.md
  - docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md
  - README.md
  - docs/README.md
tags:
  - note
  - deploy
  - ops
  - handoff
  - truth-map
---

# Deploy Entry Points And Truth Map

## Purpose
Быстрый re-entry document для нового агента в пустом чате, чтобы не спутать active production path с legacy residue.

## Read This First
1. `docs/reports/2026-03-13/DEPLOY.anamnesis.pre-cabinet-go-live.report.md`
2. `docs/runbooks/DEPLOY_DOCKER_CONTRACT.md`
3. `docs/runbooks/ENV_MATRIX.md`

## Active Production Truth
На `2026-03-13` live production for `seminar` means:
1. `Docker`
2. `Traefik`
3. pinned GHCR image
4. SQLite mounted from `/opt/seminar/parity-data`

Active deploy control plane:
1. `/opt/seminar/.env.seminar`
2. `/etc/seminar/seminar.docker.env`
3. `/opt/seminar/compose.seminar.ghcr.yml`

## Default Deploy Path
Use only the Docker-native path:
1. pinned digest update
2. env preparation
3. SQLite triplet backup
4. `docker compose ... up -d --remove-orphans`
5. post-deploy smoke
6. cleanup bootstrap envs after first successful cabinet login

## Rollback Path
Nearest valid rollback:
1. revert to previous pinned image and `BUILD_ID`
2. rerun docker compose
3. if cabinet migrations were already applied and rollback needs old DB state, restore the pre-deploy SQLite triplet snapshot

## Legacy Paths
Read only as rollback or historical context:
1. `docs/runbooks/GO_LIVE.md`
2. `docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md`

Do not use by default:
1. `/var/www/seminar/releases/*`
2. `/var/www/seminar/current`
3. `systemctl restart seminar`
4. legacy CI `deploy` job that still targets the systemd path

## Cabinet First Go-Live Caveats
Before the first live cabinet rollout:
1. production DB is still pre-cabinet
2. cabinet bootstrap envs are not present by default
3. temporary create-first bootstrap envs must be added intentionally
4. `CABINET_BOOTSTRAP_ALLOW_RESET` must stay unset unless an intentional one-time reset is required
5. pre-deploy SQLite triplet backup is mandatory

## Operational Assumptions Already Closed
1. Canonical production contour is Docker + Traefik.
2. Live contour on `2026-03-13` matches the Docker canon.
3. Legacy `systemd + nginx` residue is not the active release path.
4. The next deploy prompt must be written against Docker-only rollout.

## Open Caveats Before Real Go-Live
1. Cabinet is not live yet on the domain.
2. Production DB has not applied cabinet migrations yet.
3. `www -> apex` behavior does not appear to match documented redirect intent.
4. `ai-work.pro` still points to the VPS by DNS but is not part of the active seminar routing labels.
