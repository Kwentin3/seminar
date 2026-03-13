---
id: REPORT-2026-03-13.deploy.anamnesis.pre-cabinet-go-live
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/runbooks/DEPLOY_DOCKER_CONTRACT.md
  - docs/runbooks/ENV_MATRIX.md
  - docs/runbooks/GO_LIVE.md
  - docs/infra-ops/PRODUCTION_BASELINE_DOCKER_TRAEFIK.md
  - docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md
  - docs/notes/NOTE-006.deploy-contour-reality.md
  - docs/reports/2026-03-13/CABINET.phase-1.1.hardening.report.md
tags:
  - report
  - deploy
  - ops
  - production
  - cabinet
---

# Deployment Anamnesis Before Cabinet Go-Live

## Executive Summary
1. Real production on `2026-03-13` is already running on Docker, not on the legacy `systemd + nginx` contour.
2. Active public ingress is:
   - `platform-edge-traefik` on `:80/:443`
   - `seminar-app` container from pinned GHCR digest
   - SQLite mounted from `/opt/seminar/parity-data`
3. Legacy `seminar.service`, `nginx` config, and `/var/www/seminar/releases/*` are still present on the host, but they are currently inactive and should be treated as rollback residue only.
4. Live application state is behind the current local repository:
   - live container `BUILD_ID = dcf5f3483d09b2639e40231293a42f78cbf872c3`
   - local repo HEAD at audit time = `1a994ab7190141d6a520e41314f1565774e0bbb6`
5. Cabinet backend is not live yet:
   - `/cabinet*` public routes return the SPA shell
   - `/api/cabinet/*` returns `404 Unknown API route`
6. Live SQLite is still pre-cabinet:
   - tables: `leads`, `schema_migrations`
   - applied migrations: only `0001_create_leads.sql`
7. Cabinet first go-live therefore requires both:
   - docker image update
   - production schema jump through cabinet migrations `0002+`
8. Production docker env is missing cabinet bootstrap variables, so env preparation is mandatory before the first cabinet rollout.
9. No automated seminar backup timer/cron was found; available backups under `/opt/seminar/backups/*` look like manual cutover snapshots.
10. Safest next step is `Go-with-caveats` for deploy preparation:
   - prepare a Docker-only rollout prompt
   - include pre-deploy DB backup
   - include temporary cabinet bootstrap envs
   - include explicit rollback to the previous pinned image and DB snapshot

## Real Live Contour
### Host and Runtime
1. Production host reachable by SSH: `root@91.132.48.224` (`hostname = r1121293`).
2. Active runtime services on the VPS:
   - `docker`: `active`
   - `seminar`: `inactive`
   - `nginx`: `inactive`
   - `traefik` systemd service: `inactive`
3. Active seminar runtime is containerized:
   - container: `seminar-app`
   - image: `ghcr.io/kwentin3/seminar@sha256:f17357c27e98897095b7945c5e529b3ed92dffd7d3ec5b47af80063a9744c5d4`
   - created: `2026-03-01T16:18:01Z`
   - health: `healthy`
4. Active edge ingress is also containerized:
   - container: `platform-edge-traefik`
   - image: `traefik:v3.5`
   - host ports published: `80`, `443`
5. Host-level `ss -ltnp` showed docker-proxy on `:80/:443` and no active host listener on `:8787`.

### Legacy Residue Still Present
1. `/etc/systemd/system/seminar.service` still exists and points to:
   - `WorkingDirectory=/var/www/seminar/current`
   - `EnvironmentFile=/etc/seminar/seminar.env`
   - `ExecStart=/usr/bin/node server/index.mjs`
2. Legacy `nginx` config still exists and still references:
   - `seminar-ai.ru`
   - `www.seminar-ai.ru`
   - `ai-work.pro`
   - `www.ai-work.pro`
   - proxy target `http://127.0.0.1:8787`
3. `/var/www/seminar/current` still points to `/var/www/seminar/releases/20260228084351`.
4. These pieces are not the active live path anymore. They remain relevant only as rollback residue or historical context.

## Domain / Ingress Reality
### DNS
Observed from the operator workstation on `2026-03-13`:
1. `seminar-ai.ru -> 91.132.48.224`
2. `www.seminar-ai.ru -> 91.132.48.224`
3. `ai-work.pro -> 91.132.48.224`
4. `www.ai-work.pro -> 91.132.48.224`

### Active Public Routing
1. Active Traefik labels on `seminar-app` route only:
   - `Host(\`seminar-ai.ru\`)`
   - `Host(\`www.seminar-ai.ru\`)`
2. `ai-work.pro` is still pointed at the VPS by DNS, but it is not represented in the active seminar container routing labels.
3. TLS is terminated by Traefik, not by certbot/nginx:
   - ACME enabled via `--certificatesresolvers.le.acme.*`
   - storage path: `/opt/platform/traefik/acme/acme.json`

### Public Behavior Notes
1. `https://seminar-ai.ru/` returns `200 OK`.
2. `https://www.seminar-ai.ru/` also returns `200 OK` directly, without the expected visible redirect to apex.
3. This means the effective `www -> apex` behavior is currently not matching the intent expressed in compose labels and docs.
4. `https://ai-work.pro/` did not produce a clean trusted response from the operator workstation during this audit, so it should not be treated as a verified seminar public domain for the upcoming cabinet rollout.

## Current App State On Server
### Deploy Footprint
1. Active seminar deployment lives under `/opt/seminar`, not under `/var/www/seminar/current`.
2. `/opt/seminar` contains:
   - `.env.seminar`
   - `compose.seminar.ghcr.yml`
   - `compose.seminar.ghcr-smoke.yml`
   - `backups/`
   - `parity-data/`
3. `/opt/seminar` is not a git checkout:
   - `git rev-parse HEAD` there returned `no_git_checkout`
4. This is an artifact/compose deployment model, not `git pull on server`.

### Running Build Identity
1. Running image reference is pinned by digest in `.env.seminar`.
2. Running `BUILD_ID` in the container env is `dcf5f3483d09b2639e40231293a42f78cbf872c3`.
3. Local repo HEAD at audit time is newer than live, so production is not at current local state.

### Built Frontend Assets
1. Container working directory is `/app`.
2. Built frontend assets are present inside the active container:
   - `/app/apps/web/dist/index.html`
   - `/app/apps/web/dist/assets/*`

### User-Facing Cabinet State
1. Public `GET /cabinet/login` returns `200`, but this is only the SPA shell.
2. Public cabinet API endpoints are not live yet:
   - `/api/cabinet/session -> 404`
   - `/api/cabinet/materials -> 404`
3. Cabinet go-live on the domain is therefore still pending.

## Env / Secrets Readiness For Cabinet
### Active Production Env Files
1. Canonical live container env file: `/etc/seminar/seminar.docker.env`
2. Legacy rollback env file: `/etc/seminar/seminar.env`

### Present Docker Env Keys
Observed by name only, without values:
1. `ADMIN_SECRET`
2. `BUILD_ID`
3. `DATABASE_PATH`
4. `HOST`
5. `NODE_ENV`
6. `OBS_DOCKER_BIN`
7. `OBS_DOCKER_CONTAINER`
8. `OBS_LOG_SOURCE`
9. `PORT`

### Missing Cabinet Env Keys
Cabinet bootstrap variables are not present in the live docker env:
1. `CABINET_BOOTSTRAP_ADMIN`
2. `CABINET_BOOTSTRAP_USERNAME`
3. `CABINET_BOOTSTRAP_EMAIL`
4. `CABINET_BOOTSTRAP_PASSWORD`
5. `CABINET_BOOTSTRAP_ALLOW_RESET`

### Cabinet Bootstrap Recommendation
Safest first-live strategy:
1. temporary create-first bootstrap via env
2. keep `CABINET_BOOTSTRAP_ALLOW_RESET` unset or `0`
3. deploy once with bootstrap enabled
4. verify first admin login successfully
5. remove `CABINET_BOOTSTRAP_PASSWORD` and disable `CABINET_BOOTSTRAP_ADMIN`
6. perform a cleanup rollout so long-lived production env no longer contains bootstrap password

### Deployment Risk
1. Current docker env is not sufficient for first cabinet launch.
2. A deploy prompt must include explicit env file preparation before rollout.

## DB / Migration Readiness
### Real Live Database Path
1. Host data mount: `/opt/seminar/parity-data`
2. Active DB file on host: `/opt/seminar/parity-data/seminar.sqlite`
3. Container path: `/var/lib/seminar/seminar.sqlite`

### Current Live Schema State
Observed via read-only container-side SQLite inspection:
1. existing tables:
   - `leads`
   - `schema_migrations`
2. applied migrations:
   - `0001_create_leads.sql`
3. row counts observed:
   - `leads = 3`
4. cabinet tables do not exist yet:
   - no `users`
   - no `sessions`
   - no `materials`

### Migration Mechanics
1. Application startup applies migrations automatically from `migrations/` before the server begins serving requests.
2. This is implemented in `server/index.mjs`:
   - `applyMigrations(db, migrationsDir)` runs during startup
   - every `.sql` file not present in `schema_migrations` is executed in order
3. First cabinet rollout will therefore apply pending schema changes on startup.

### Backup Reality
1. Existing backup snapshots were found under `/opt/seminar/backups/`.
2. Snapshot directories include full SQLite triplets:
   - `seminar.sqlite`
   - `seminar.sqlite-wal`
   - `seminar.sqlite-shm`
3. No `systemd` timer, root crontab entry, or `/etc/cron*` seminar backup job was found during this audit.
4. Backup practice currently appears manual, not automated.

### Required Pre-Deploy DB Step
1. Pre-deploy DB backup is mandatory before the first cabinet rollout.
2. Backup must include the SQLite triplet, not just the main `.sqlite` file.
3. Post-deploy DB verification must confirm:
   - `users`, `sessions`, `materials` tables exist
   - `schema_migrations` includes cabinet migrations

## Safest Rollout Path
### Recommended Path
Use the active Docker contour under `/opt/seminar` and do not use the legacy release-folder path.

Recommended rollout shape for the next deploy prompt:
1. capture current pinned image ref, `BUILD_ID`, and copy `.env.seminar`
2. capture a fresh SQLite triplet backup under `/opt/seminar/backups/<timestamp>/`
3. update `/etc/seminar/seminar.docker.env` with temporary cabinet bootstrap vars
4. update `/opt/seminar/.env.seminar` with the new pinned digest and new `BUILD_ID`
5. `docker pull` the target image
6. `docker compose --env-file /opt/seminar/.env.seminar -f /opt/seminar/compose.seminar.ghcr.yml up -d --remove-orphans`
7. wait for healthy container
8. run post-deploy smoke checks
9. login with bootstrap admin and verify cabinet
10. remove bootstrap password env and disable bootstrap
11. run a cleanup compose rollout

### Paths To Avoid
Do not use as the primary go-live path:
1. `.github/workflows/ci.yml` legacy `deploy` job (`/var/www/seminar/releases/*` + `systemctl restart seminar`)
2. `/var/www/seminar/current` release swap as default production path
3. `systemctl restart seminar` as the main go-live operation

## Rollback Path
### Nearest Realistic Rollback
For the active live contour, the realistic rollback is Docker-native:
1. restore previous pinned `SEMINAR_IMAGE` and `BUILD_ID` in `/opt/seminar/.env.seminar`
2. run `docker compose ... up -d --remove-orphans`
3. re-run smoke checks

### DB Rollback
1. If the cabinet rollout fails before schema application, app rollback may be sufficient.
2. If cabinet migrations are applied and runtime behavior is not acceptable, the safest rollback is:
   - container/image rollback
   - restore the pre-deploy SQLite triplet backup
3. Because live DB is currently still pre-cabinet, the first cabinet go-live is the moment where DB rollback discipline matters most.

### Legacy Rollback
1. Legacy `seminar.service + nginx` rollback is still mechanically possible because files remain on the server.
2. It is not the nearest rollback path anymore and should be treated as emergency-only, not default rollback.

## Required Post-Deploy Smoke Checks
Minimum mandatory checks after the first cabinet deployment:
1. `GET /api/healthz -> 200`
2. `GET / -> 200` and landing renders
3. lead flow still succeeds (`/api/leads`)
4. `/cabinet/login` opens
5. bootstrap admin login succeeds
6. authenticated `/cabinet` opens and materials list renders
7. at least one markdown material opens in the cabinet reader
8. logout returns the user to auth-gated state
9. legacy `/admin` still works through `ADMIN_SECRET`
10. cabinet session does not bypass legacy `/admin`
11. `ADMIN_SECRET` does not bypass cabinet auth
12. recent logs show:
   - no startup errors
   - no migration failures
   - no obs schema violations

## Risk Register
### Critical
1. Live app is not cabinet-ready yet:
   - cabinet API routes are absent
   - cabinet DB schema is absent
2. First cabinet deploy changes both runtime and DB state; skipping a pre-deploy SQLite backup would be unsafe.

### Important
1. CI still contains a legacy production `deploy` job that targets the inactive runtime contour and can mislead operators.
2. Cabinet bootstrap envs are not present in live docker env and must be added deliberately for the first rollout.
3. `www.seminar-ai.ru` is not visibly redirecting to apex, despite the current docker routing intent.
4. `ai-work.pro` still points to the VPS by DNS but is not part of the active seminar routing labels, which creates domain-ownership ambiguity for operators.

### Minor
1. Legacy `seminar.service`, `nginx`, and `/var/www/seminar/releases` still create context noise during audits.
2. Backup practice is visible on disk but not yet proven to be automated or codified as a routine.

## Verdict
`Go-with-caveats` for moving to deploy preparation.

Interpretation:
1. There is enough factual clarity to write a safe deploy prompt now.
2. There is not enough safety to perform a blind deploy without explicit:
   - env preparation
   - SQLite triplet backup
   - docker-native rollout/rollback steps
   - post-deploy cabinet smoke checks

## Exact Next Prompt Recommendation
Use a dedicated deploy implementation prompt with this shape:

1. target the active production contour only:
   - `/opt/seminar/.env.seminar`
   - `/etc/seminar/seminar.docker.env`
   - `/opt/seminar/compose.seminar.ghcr.yml`
2. forbid the legacy `systemd + nginx` path except emergency rollback
3. require a fresh SQLite triplet backup before rollout
4. require temporary create-first cabinet bootstrap envs
5. require pinned digest update + `BUILD_ID` update
6. require docker compose rollout + health wait
7. require login-based cabinet smoke and `/admin` regression smoke
8. require bootstrap env cleanup after successful first login
9. require rollback instructions that restore both:
   - previous pinned image
   - pre-deploy DB backup if schema rollback is needed
