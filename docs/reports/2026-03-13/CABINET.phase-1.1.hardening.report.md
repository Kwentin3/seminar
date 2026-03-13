---
id: REPORT-2026-03-13.cabinet.phase-1.1.hardening
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/reports/2026-03-13/CABINET.v1.post-audit.report.md
  - docs/notes/NOTE-002.cabinet.phase-1.1.followups.md
  - docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md
  - docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md
  - docs/runbooks/CABINET_LOCAL_SMOKE.md
  - docs/runbooks/ENV_MATRIX.md
  - docs/runbooks/GITHUB_GUARDRAILS.md
tags:
  - report
  - cabinet
  - hardening
  - phase-1.1
  - auth
---

# CABINET Phase 1.1 Hardening Report

## Executive Summary
1. Phase 1.1 stayed inside the intended hardening scope: no new product features, no role expansion, no cabinet/admin merge.
2. Cabinet logging is now aligned with the current obs canon:
   - `cabinet` became a valid obs domain;
   - `cabinet.*` became a valid error namespace;
   - cabinet handlers no longer emit invalid event names that degrade into `unknown` / `schema_violation`.
3. Two targeted auth regressions were added and are green:
   - expired session denial + cleanup;
   - production-mode `Secure` cookie.
4. A stable browser-level smoke now exists as a one-command, self-managed Playwright smoke.
5. Runtime/docs truth is now more explicit:
   - local = `node server/index.mjs`;
   - canonical production = Docker + Traefik;
   - legacy `systemd + nginx` = rollback/live snapshot only.
6. Cabinet v1 is now calmer to operate internally than in the post-audit state.

## What Entered Phase 1.1
1. Obs alignment for cabinet-specific events.
2. Cabinet-specific obs verification in automated tests.
3. Two narrow session regressions.
4. One browser-level smoke on real UI route flow.
5. Docs/CI cleanup around runtime truth and smoke expectations.

## Obs Alignment
### What Was Changed
1. `server/obs/logger.mjs` now accepts:
   - `cabinet` in allowed domains;
   - `cabinet.` in allowed error namespaces.
2. `requiresRequestId()` now treats cabinet events like other HTTP-facing domains.
3. Cabinet route logging was normalized in `server/index.mjs`:
   - `cabinet_material_opened` -> `cabinet_material_open_completed`
   - `cabinet_material_missing` -> `cabinet_material_open_failed`
   - `cabinet_bootstrap_admin_ready` -> `cabinet_bootstrap_completed`
4. Bootstrap warning error origin was corrected from invalid `ops` semantics to supported `infra`.
5. Obs contract docs were updated so cabinet namespace is not just “accepted by code”, but documented in canon.

### Verification
1. Unit-level obs contract test now accepts `cabinet` without schema violation.
2. Integration-level obs test now drives a real cabinet flow and asserts:
   - `cabinet_auth_failed`
   - `cabinet_login_succeeded`
   - `cabinet_material_open_completed`
   - `cabinet_logout_succeeded`
   - no `obs.schema_violation_detected`
   - no `unknown` event for cabinet request ids

## Regression Tests Added
### 1. TTL Expiry
Covered behavior:
1. an expired session no longer authorizes `/api/cabinet/session`;
2. the expired DB session row is removed on the next auth check;
3. guarded materials access stays blocked;
4. logout still returns a cleared cookie safely after expiry.

### 2. Production Secure Cookie
Covered behavior:
1. `NODE_ENV=production` emits `Secure` on the cabinet session cookie;
2. `HttpOnly` and `SameSite=Lax` remain present;
3. existing local/dev test still confirms non-`Secure` cookie in local mode.

## Browser Smoke Choice
### Chosen Harness
Raw `playwright` package with a self-managed smoke script:
1. `scripts/test-smoke-cabinet-browser.mjs`
2. `pnpm run test:smoke:cabinet:browser`

### Why This Harness
1. It is smaller than introducing a full e2e framework.
2. It runs as one command locally.
3. It is CI-friendly after installing Chromium once.
4. It avoids brittle shell orchestration by starting its own temporary server by default.

### Covered UI Flow
1. open `/cabinet`
2. confirm redirect to `/cabinet/login`
3. login with bootstrap admin
4. confirm arrival at `/cabinet`
5. confirm materials are visible
6. logout
7. confirm `/cabinet` requires auth again

## Docs / Runtime Truth Cleanup
1. `README.md` now states runtime truth explicitly:
   - local Node flow;
   - canonical Docker + Traefik production;
   - legacy rollback-only contour.
2. `docs/runbooks/ENV_MATRIX.md` now includes a dedicated legacy rollback row.
3. `docs/runbooks/CABINET_LOCAL_SMOKE.md` now includes the browser smoke as a first-class local check.
4. `docs/runbooks/GITHUB_GUARDRAILS.md` now reflects browser smoke in CI and required checks.
5. `docs/contracts/CONTRACT-OBS-001...` no longer conflicts with the canonical docker retrieval story.
6. `docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md` is now explicitly marked as legacy live snapshot / rollback reference.

## Risks Closed
1. Cabinet logging no longer conflicts with obs naming/domain contract.
2. The previous “cabinet events can degrade into `unknown` / `schema_violation`” risk is closed by tests.
3. Session expiry boundary is now covered by a deterministic regression test.
4. Production `Secure` cookie behavior is now covered by a deterministic regression test.
5. Browser verification gap is reduced from “manual only” to a reproducible scripted smoke.
6. Runtime/docs ambiguity around canonical vs legacy contour is reduced substantially.

## Risks Still Open
1. Browser smoke now exists, but like any browser harness it depends on Playwright browser installation in local/CI environments.
2. Lead smoke remains API-level; this phase intentionally did not expand into broader end-to-end coverage outside cabinet.
3. Legacy rollback docs still exist by design; future edits must keep them clearly subordinate to canonical Docker docs.

## What Was Intentionally Not Done
1. No new roles.
2. No user-management UI.
3. No client cabinet.
4. No materials CMS/editor.
5. No cabinet/admin consolidation.
6. No session policy redesign beyond the tested current baseline.

## Changed Files
1. `server/obs/logger.mjs`
2. `server/index.mjs`
3. `tests/obs/logger.contract.test.mjs`
4. `tests/obs/log-retrieval.integration.test.mjs`
5. `tests/cabinet/cabinet-session-regressions.integration.test.mjs`
6. `scripts/test-smoke-cabinet-browser.mjs`
7. `package.json`
8. `pnpm-lock.yaml`
9. `.github/workflows/ci.yml`
10. `README.md`
11. `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md`
12. `docs/runbooks/OBS_IMPLEMENTATION_PATTERN.md`
13. `docs/runbooks/CABINET_LOCAL_SMOKE.md`
14. `docs/runbooks/ENV_MATRIX.md`
15. `docs/runbooks/GITHUB_GUARDRAILS.md`
16. `docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md`
17. `docs/notes/NOTE-002.cabinet.phase-1.1.followups.md`

## Checks Performed
1. `pnpm install`
2. `pnpm run test:cabinet`
3. `pnpm run test:obs`
4. `pnpm exec playwright install chromium`
5. `pnpm run build:web`
6. `pnpm run test:smoke:cabinet:browser`
7. `pnpm run build`

## Recommendation
Cabinet v1 after Phase 1.1 is ready for calmer internal exploitation than before:
1. auth/session/materials contour remains small and intact;
2. observability is no longer fighting the cabinet surface;
3. the main remaining caveats are operational hygiene, not missing core hardening.

Recommended verdict:
`Yes, cabinet v1 is now operationally steadier for internal team use after hardening.`
