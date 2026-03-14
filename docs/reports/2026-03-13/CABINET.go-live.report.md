---
id: REPORT-2026-03-13.cabinet.go-live
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/notes/NOTE-007.deploy-entrypoints-and-truth-map.md
  - docs/reports/2026-03-13/DEPLOY.anamnesis.pre-cabinet-go-live.report.md
  - docs/reports/2026-03-13/DEPLOY.context-stabilization.report.md
  - docs/runbooks/DEPLOY_DOCKER_CONTRACT.md
  - docs/runbooks/ENV_MATRIX.md
tags:
  - report
  - cabinet
  - go-live
  - deploy
  - production
---

# Cabinet Go-Live Report

## Executive Summary
1. Cabinet first production go-live was executed on `2026-03-13` through the active Docker production contour.
2. A fresh pre-deploy SQLite triplet backup was created before any rollout.
3. The first rollout used pinned digest `sha256:09f3d142fe0abd3f6056a1add28e77ad7972e28324d90f39524b273c6122db20` (`BUILD_ID=f61c1c58e6703362ca038660e8bdaf58fbcbc2f7`) and migrated the DB successfully, but it exposed a packaging issue:
   - runtime image did not contain `docs/seminar`
   - materials corpus was reduced to `1` PDF
4. That issue was fixed immediately by a forward-only packaging release:
   - commit `e45a0194d55a86d5285201c0cf16606b1af94107`
   - final production digest `sha256:bcf8b10f7b4f9fa49fac344aa5eafd19b4483f9f4c9959b5e955923190b6cd73`
5. First bootstrap login succeeded, bootstrap-sensitive envs were cleaned up, and cabinet now remains reachable without bootstrap mode enabled.
6. Landing, lead capture, cabinet auth, cabinet reader, and legacy `/admin` smoke checks passed on the resulting production state.

## Was Deploy Executed Or Aborted
Deploy was executed and completed successfully.

Notes:
1. There was no full rollback.
2. There was one corrective forward release after the first rollout exposed missing runtime materials content.

## Target Digest And Resulting Build ID
### Initial Rollout
1. image: `ghcr.io/kwentin3/seminar@sha256:09f3d142fe0abd3f6056a1add28e77ad7972e28324d90f39524b273c6122db20`
2. build id: `f61c1c58e6703362ca038660e8bdaf58fbcbc2f7`

### Final Production State
1. image: `ghcr.io/kwentin3/seminar@sha256:bcf8b10f7b4f9fa49fac344aa5eafd19b4483f9f4c9959b5e955923190b6cd73`
2. build id: `e45a0194d55a86d5285201c0cf16606b1af94107`

## Pre-Deploy Backup Reference
Fresh snapshot created before the first cabinet rollout:
1. backup dir: `/opt/seminar/backups/cabinet-go-live-20260313T135120Z`
2. included files:
   - `seminar.sqlite`
   - `seminar.sqlite-wal`
   - `seminar.sqlite-shm`
   - `seminar.docker.env.pre`
   - `.env.seminar.pre`

## Env Preparation Summary
Prepared on `/etc/seminar/seminar.docker.env`:
1. temporary create-first cabinet bootstrap keys were added
2. `CABINET_BOOTSTRAP_ALLOW_RESET` remained unset
3. no reset-enabled bootstrap mode was used

Prepared on `/opt/seminar/.env.seminar`:
1. pinned image digest updated
2. `BUILD_ID` updated

Secrets were not copied into this report.

## Rollout Steps Actually Executed
1. Verified pre-deploy live state:
   - current image
   - current `BUILD_ID`
   - container health
   - public reachability for `seminar-ai.ru` and `www.seminar-ai.ru`
   - pre-cabinet DB schema state
2. Created fresh backup snapshot under `/opt/seminar/backups/`.
3. Updated docker env with temporary bootstrap keys.
4. Updated `/opt/seminar/.env.seminar` to the first target digest and build id.
5. Pulled target image and ran docker-native rollout via:
   - `docker compose --env-file /opt/seminar/.env.seminar -f /opt/seminar/compose.seminar.ghcr.yml up -d --remove-orphans`
6. Confirmed DB migrations and bootstrap admin creation.
7. Discovered packaging defect:
   - runtime image contained `/app/content`
   - runtime image did not contain `/app/docs/seminar`
   - production materials table had only `1` row
8. Released a corrective image that includes `docs/seminar` in the runtime build context.
9. Updated `/opt/seminar/.env.seminar` to the corrective digest and reran docker-native rollout.
10. Verified final runtime:
   - healthy container
   - final digest
   - final `BUILD_ID`
   - `materials=14`
11. Performed first successful cabinet login.
12. Removed bootstrap-sensitive env keys, disabled bootstrap mode, and ran cleanup rollout.
13. Re-ran cabinet smoke after cleanup to confirm persistent auth without bootstrap.

## Migration Result
Migrations applied successfully.

Final `schema_migrations`:
1. `0001_create_leads.sql`
2. `0002_create_cabinet_auth_and_materials.sql`
3. `0003_add_material_curation_fields.sql`
4. `0004_add_material_curation_reviewed_at.sql`

Final DB counts observed:
1. `leads = 4`
2. `users = 1`
3. `sessions = 1`
4. `materials = 14`

Interpretation:
1. existing leads were preserved
2. cabinet tables exist and are active
3. materials corpus is now present in production

## Post-Deploy Smoke Result
Passed:
1. `GET /api/healthz -> 200`
2. `GET / -> 200`
3. lead flow:
   - production lead POST returned `200`
   - row count increased from `3` to `4`
4. `/cabinet/login` opens
5. bootstrap admin login succeeded
6. authenticated `/cabinet` opens
7. materials list renders with `14` items
8. markdown material opens in the in-app reader
9. logout returns to auth-gated state
10. legacy `/admin` still works via `ADMIN_SECRET`
11. cabinet session does not bypass `/admin`
12. `ADMIN_SECRET` does not bypass cabinet auth
13. recent docker logs showed:
   - no migration failures
   - no `schema_violation`
   - no runtime `error` entries in the checked window

Smoke tooling actually used:
1. `scripts/test-smoke-cabinet.mjs` against production runtime from inside the container
2. `scripts/test-smoke-cabinet-browser.mjs` against `https://seminar-ai.ru`
3. targeted production lead POST + DB verification
4. targeted anti-bypass checks via container-local fetch

## Bootstrap Cleanup Result
Cleanup completed successfully.

Resulting env state:
1. `CABINET_BOOTSTRAP_ADMIN=0`
2. `CABINET_BOOTSTRAP_USERNAME` removed
3. `CABINET_BOOTSTRAP_EMAIL` removed
4. `CABINET_BOOTSTRAP_PASSWORD` removed
5. `CABINET_BOOTSTRAP_ALLOW_RESET` absent

Post-cleanup validation:
1. container healthy
2. cabinet login still succeeds
3. browser smoke still passes

## Final Production State
1. Active runtime remains Docker + Traefik.
2. Active seminar container now runs:
   - digest `sha256:bcf8b10f7b4f9fa49fac344aa5eafd19b4483f9f4c9959b5e955923190b6cd73`
   - `BUILD_ID=e45a0194d55a86d5285201c0cf16606b1af94107`
3. Production DB is no longer pre-cabinet.
4. Cabinet is live on the domain.
5. Cabinet library contains `14` curated materials including markdown seminar docs.

## Rollback Actions
No rollback was executed.

Instead:
1. the first rollout was corrected by a forward-only packaging fix
2. rollback reference remained available throughout:
   - previous image `sha256:f17357c27e98897095b7945c5e529b3ed92dffd7d3ec5b47af80063a9744c5d4`
   - pre-deploy snapshot `/opt/seminar/backups/cabinet-go-live-20260313T135120Z`

## Open Caveats After Go-Live
1. `www.seminar-ai.ru` still responds `200 OK` directly and does not visibly redirect to apex in the public checks performed during this deployment.
2. `ai-work.pro` still points to the VPS by DNS but was not treated as an active seminar host in this rollout.
3. Startup still emits `obs.missing_request_id_detected` for startup-time events; this is not a schema violation, but it remains an observability cleanliness issue separate from cabinet go-live.
