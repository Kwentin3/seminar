---
id: REPORT-2026-03-13.cabinet.ux-polish-deploy
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/reports/2026-03-13/CABINET.go-live.report.md
  - docs/reports/2026-03-13/DEPLOY.anamnesis.pre-cabinet-go-live.report.md
  - docs/reports/2026-03-13/DEPLOY.context-stabilization.report.md
  - docs/notes/NOTE-007.deploy-entrypoints-and-truth-map.md
  - docs/reports/2026-03-13/CABINET.ux-cleanup-pass.report.md
  - docs/reports/2026-03-13/CABINET.ux-polish-pass.report.md
  - docs/artifacts/2026-03-13/cabinet-ux-polish-deploy-check
tags:
  - report
  - cabinet
  - deploy
  - production
  - ux
  - polish
---

# Cabinet UX Polish Deploy Report

## Executive Summary
1. A production deploy of the cabinet UX polish build was executed on `2026-03-13` through the active Docker rollout path.
2. The rollout used pinned digest `sha256:7c3e163febd1550b9fdf3ec1869c11bf1c5fc9cd585cc4ae0e856b105359bafd` with `BUILD_ID=1ce86ba9c586b8ae4dae55797444e78fc1981430`.
3. A fresh pre-deploy SQLite triplet backup and control-plane env snapshot were created before any production changes.
4. The container was recreated successfully and reached `running|healthy` on the new image.
5. Cabinet browser smoke, cabinet HTTP smoke, live lead submission, and live visual verification all passed against `https://seminar-ai.ru`.
6. No rollback was required.

## Was Deploy Executed Or Aborted
Deploy was executed and completed successfully.

## Target Digest And Resulting Build ID
1. image: `ghcr.io/kwentin3/seminar@sha256:7c3e163febd1550b9fdf3ec1869c11bf1c5fc9cd585cc4ae0e856b105359bafd`
2. build id: `1ce86ba9c586b8ae4dae55797444e78fc1981430`
3. previous production image: `ghcr.io/kwentin3/seminar@sha256:bcf8b10f7b4f9fa49fac344aa5eafd19b4483f9f4c9959b5e955923190b6cd73`
4. previous build id: `e45a0194d55a86d5285201c0cf16606b1af94107`

## Pre-Deploy Backup Reference
Fresh snapshot created before rollout:
1. backup dir: `/opt/seminar/backups/ux-polish-rollout-20260313T193051Z`
2. included files:
   - `seminar.sqlite`
   - `seminar.sqlite-wal`
   - `seminar.sqlite-shm`
   - `.env.seminar.pre`
   - `seminar.docker.env.pre`

## Env Preparation Summary
Updated only the active Docker control plane:
1. `/opt/seminar/.env.seminar`
   - `SEMINAR_IMAGE` pinned to the new digest
   - `BUILD_ID` updated to the release commit
2. `/etc/seminar/seminar.docker.env`
   - unchanged for this rollout
3. No cabinet bootstrap envs were re-enabled.
4. No reset-sensitive auth envs were introduced.

## Rollout Steps Actually Executed
1. Verified pre-deploy live state:
   - current container image
   - current `BUILD_ID`
   - `running|healthy` state
   - live DB schema and migration state
   - public reachability for apex and `www`
2. Created a fresh backup snapshot under `/opt/seminar/backups/`.
3. Updated `/opt/seminar/.env.seminar` to the new pinned digest and build id.
4. Pulled the target image on the VPS.
5. Executed:
   - `docker compose --env-file /opt/seminar/.env.seminar -f /opt/seminar/compose.seminar.ghcr.yml up -d --remove-orphans`
6. Waited for `seminar-app` to return to `running|healthy`.
7. Reviewed recent container logs for startup and schema issues.

## Migration Result
No new schema migration was introduced by this release.

Observed live DB state after rollout:
1. tables:
   - `leads`
   - `materials`
   - `schema_migrations`
   - `sessions`
   - `users`
2. migrations still present:
   - `0001_create_leads.sql`
   - `0002_create_cabinet_auth_and_materials.sql`
   - `0003_add_material_curation_fields.sql`
   - `0004_add_material_curation_reviewed_at.sql`

Interpretation:
1. cabinet schema remained intact
2. no DB rollback was needed
3. this rollout was application-only from a schema perspective

## Post-Deploy Smoke Result
Passed:
1. `GET https://seminar-ai.ru/api/healthz -> 200`
2. `GET https://seminar-ai.ru/ -> 200`
3. `GET https://seminar-ai.ru/cabinet/login -> 200`
4. cabinet browser smoke against the live domain:
   - login
   - library
   - markdown reader
   - logout
5. cabinet HTTP smoke against the live domain:
   - unauthorized session -> `401`
   - login -> `200`
   - materials -> `200`
   - material open -> `200`
   - logout -> `200`
   - post-logout materials -> `401`
   - `/api/admin/leads` wrong secret -> `401`
   - `/api/admin/leads` valid secret -> `200`
6. live lead submission:
   - before count: `4`
   - after count: `5`
   - result: lead persisted successfully
7. live materials count remained `14`

## Live Visual Verification
Browser-first screenshots were captured from the real production domain:
1. `docs/artifacts/2026-03-13/cabinet-ux-polish-deploy-check/01-landing.png`
2. `docs/artifacts/2026-03-13/cabinet-ux-polish-deploy-check/02-login.png`
3. `docs/artifacts/2026-03-13/cabinet-ux-polish-deploy-check/03-library-admin.png`
4. `docs/artifacts/2026-03-13/cabinet-ux-polish-deploy-check/04-reader-admin.png`
5. `docs/artifacts/2026-03-13/cabinet-ux-polish-deploy-check/05-reader-mobile.png`
6. `docs/artifacts/2026-03-13/cabinet-ux-polish-deploy-check/06-logout.png`

Observed result:
1. updated library hierarchy is visible in production
2. reader header is more compact before the article body
3. the mobile reader still looks usable after the polish rollout

## Rollback Actions
No rollback actions were executed.

Nearest rollback reference for this rollout:
1. previous image: `ghcr.io/kwentin3/seminar@sha256:bcf8b10f7b4f9fa49fac344aa5eafd19b4483f9f4c9959b5e955923190b6cd73`
2. previous build id: `e45a0194d55a86d5285201c0cf16606b1af94107`
3. DB snapshot: `/opt/seminar/backups/ux-polish-rollout-20260313T193051Z`

## Final Production State
1. active runtime remains `Docker + Traefik`
2. active container image is now `sha256:7c3e163febd1550b9fdf3ec1869c11bf1c5fc9cd585cc4ae0e856b105359bafd`
3. active build id is now `1ce86ba9c586b8ae4dae55797444e78fc1981430`
4. landing, lead capture, cabinet auth, cabinet reader, and legacy `/admin` all remain available
5. cabinet materials count remains `14`
6. lead data was preserved and incremented through a live smoke submission

## Open Caveats
1. `https://www.seminar-ai.ru/` still answers directly with `200` instead of a documented apex redirect.
2. Startup logs still contain warning-level events for missing request id on bootstrap and missing Turnstile secret; these did not block rollout and did not produce schema violations.
3. Legacy `systemd + nginx` residue still exists on the host and remains non-default rollback/historical context only.
