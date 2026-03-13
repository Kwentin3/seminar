---
id: REPORT-2026-03-13.cabinet.v1.post-audit
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/epics/EPIC-002.cabinet.auth-foundation/EPIC.md
  - docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
  - docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md
  - docs/reports/2026-03-13/CABINET.auth.discovery.report.md
  - docs/runbooks/CABINET_LOCAL_SMOKE.md
  - docs/runbooks/ENV_MATRIX.md
tags:
  - report
  - audit
  - cabinet
  - auth
  - post-implementation
---

# CABINET v1 Post-Audit Report

## Executive Summary
1. Cabinet v1 is usable for the internal team, but the correct rollout verdict is `Go-with-caveats`, not unconditional `Go`.
2. Core auth contour is sound enough for v1:
   - password hashes only;
   - server-validated SQLite sessions;
   - `HttpOnly` cookie with `SameSite=Lax`;
   - cabinet and legacy `/admin` remain isolated.
3. The most serious v1 ops risk was bootstrap behavior: before this post-audit, leaving `CABINET_BOOTSTRAP_ADMIN=1` could reset an existing admin password on every restart.
4. That risk was hardened in this post-audit:
   - default bootstrap is now create-first;
   - resetting an existing admin requires explicit `CABINET_BOOTSTRAP_ALLOW_RESET=1`;
   - reset also revokes prior sessions.
5. Materials library is no longer just a noisy file listing:
   - current registry yields `14` active materials;
   - duplicate titles were not found;
   - summaries are now meaningful after frontmatter-aware extraction.
6. Main remaining risks are operational, not product-expansion gaps:
   - cabinet logs currently drift from observability canon and can emit schema-violation records;
   - runtime truth is still split between canonical Docker docs and legacy deployment artifacts;
   - browser-level automated verification is still absent.

## What Was Audited
1. Bootstrap admin behavior in `server/index.mjs` and env contract in `server/cabinet/config.mjs`.
2. Session and auth flow in `server/cabinet/auth.mjs`, `server/cabinet/passwords.mjs`, cabinet API routes and tests.
3. Route/access isolation between cabinet and legacy `/admin`.
4. Materials registry quality in `server/cabinet/materials-registry.mjs`.
5. Runbooks/env/docs consistency across `.dev.vars.example`, `README.md`, `docs/runbooks/*`, `docs/adr/ADR-002...`.
6. Existing integration tests, smoke coverage and gaps.

## Bootstrap Admin Audit Findings
### Current Behavior After Post-Audit Hardening
1. Bootstrap config is read centrally in `server/cabinet/config.mjs:38-39`.
2. If `CABINET_BOOTSTRAP_ADMIN=0`, startup does not mutate users and reports either:
   - `skipped` when an active admin exists;
   - `missing` when no active admin exists (`server/index.mjs:1079-1084`).
3. If `CABINET_BOOTSTRAP_ADMIN=1` and matching user does not exist, startup creates an admin (`server/index.mjs:1127-1143`).
4. If `CABINET_BOOTSTRAP_ADMIN=1` and matching user exists:
   - default behavior is now `exists` / no-op (`server/index.mjs:1105-1107`);
   - password/email/role update happens only when `CABINET_BOOTSTRAP_ALLOW_RESET=1` (`server/index.mjs:1105-1124`).
5. Intentional reset now also revokes existing sessions for that user (`server/index.mjs:1121-1123`).

### What Happens If Bootstrap Is Left Enabled
1. If `CABINET_BOOTSTRAP_ALLOW_RESET` is not set, startup logs a warning and does not rotate the password (`server/index.mjs:933-945`).
2. This reduces the old “perpetual password reset on every restart” risk to an ops warning instead of a live auth mutation.
3. If `CABINET_BOOTSTRAP_ALLOW_RESET=1` is left enabled together with bootstrap credentials, repeated startup will still re-assert the configured password.
4. That remaining behavior is acceptable for v1 only if docs keep stressing “one startup only” usage.

### Assessment
1. Bootstrap baseline is now safe enough for v1 internal use.
2. Residual risk remains `important`, not `critical`: an operator can still leave the explicit reset flag enabled, but that now requires a second, intentional env.
3. Docs and env examples now describe the safer flow in:
   - `.dev.vars.example`
   - `README.md`
   - `docs/runbooks/ENV_MATRIX.md`
   - `docs/runbooks/CABINET_LOCAL_SMOKE.md`
   - `docs/adr/ADR-002...`

## Session / Auth Audit Findings
1. Session expiration exists:
   - TTL comes from `CABINET_SESSION_TTL_HOURS`, default `168h` (`server/cabinet/config.mjs:54-62`).
2. Logout invalidates the server-side session and clears the cookie:
   - `deleteSession()` removes the DB row (`server/cabinet/auth.mjs:108-113`);
   - cleared cookie is returned by `serializeClearedSessionCookie()` (`server/cabinet/auth.mjs:142-155`);
   - logout route uses both (`server/index.mjs:182-199`).
3. Expired sessions are cleaned opportunistically on auth/login flows:
   - `clearExpiredSessions()` exists (`server/cabinet/auth.mjs:77-79`);
   - it runs during login and request auth (`server/index.mjs:139`, `server/cabinet/auth.mjs:159-160`).
4. Repeated login by the same user creates parallel sessions; older sessions are not revoked on normal login (`server/cabinet/auth.mjs:81-106`).
5. Obvious session fixation risk is low:
   - session token is freshly generated server-side on login (`server/cabinet/auth.mjs:82-84`);
   - request-supplied token is never upgraded into an authenticated session.
6. User existence leakage via response body is handled correctly:
   - both “unknown login” and “wrong password” return the same `401 cabinet_invalid_credentials` (`server/index.mjs:118-135`).
7. Timing leakage was reduced in this post-audit:
   - password verification now falls back to a dummy stored hash when the user is missing (`server/cabinet/passwords.mjs:21-24`, `server/cabinet/passwords.mjs:62-63`; `server/index.mjs:119`).
8. Cookie flags are correct for local/prod baseline:
   - `HttpOnly` + `SameSite=Lax` always (`server/cabinet/auth.mjs:126-153`);
   - `Secure` only when `NODE_ENV=production` (`server/cabinet/config.mjs:62`, `server/cabinet/auth.mjs:135-136`, `server/cabinet/auth.mjs:152-153`).
9. Cookie scope is `Path=/`, but cabinet session still does not authorize legacy `/admin`; route isolation remains at the handler layer, not by shared cookie trust.

## Route / Access Isolation Findings
1. Unauthenticated access to cabinet APIs is blocked by `requireCabinetSession()` (`server/index.mjs:1198-1220`).
2. Cabinet data endpoints checked in audit:
   - `/api/cabinet/session`
   - `/api/cabinet/materials`
   - `/api/cabinet/materials/:slug/open`
3. Legacy `/admin` still relies on `X-Admin-Secret`; cabinet session does not bypass it.
4. `ADMIN_SECRET` does not bypass cabinet auth.
5. No extra public cabinet JSON endpoints were found outside the protected cabinet route set.
6. Note:
   - `/cabinet` itself remains an SPA route that loads the app shell and then redirects client-side after session check.
   - This is acceptable for v1 because cabinet data APIs stay protected server-side.

## Materials Library Findings
1. Current active library size: `14` materials.
2. Current shape:
   - `13` markdown docs from `docs/seminar/**/*`
   - `1` curated PDF from `content/Методические материалы семинара.pdf`
3. Duplicate titles were not found in the current registry snapshot.
4. Current categories are coherent enough for v1:
   - `seminar-knowledge`
   - `seminar-assets`
5. Current types are coherent enough for v1:
   - `markdown`
   - `pdf`
6. One duplicate/noise PDF remains intentionally excluded by hardcoded registry curation (`server/cabinet/materials-registry.mjs:24-29`).
7. Before this post-audit, many summaries degraded to `---` because the scanner treated YAML frontmatter as content.
8. That quality issue was fixed:
   - frontmatter is now stripped before summary extraction (`server/cabinet/materials-registry.mjs:83-124`).
9. Remaining limitation:
   - tags are still mostly path-inferred, so taxonomy is functional but editorially thin.
10. Overall assessment:
   - library is now genuinely useful for an internal team;
   - it is still a curated registry, not a CMS.

## Runtime / Env / Docs Consistency Findings
1. New cabinet env variables are now documented consistently in code-adjacent docs.
2. Bootstrap/reset flow is now explicit in `.dev.vars.example`, `README.md`, `docs/runbooks/ENV_MATRIX.md`, `docs/runbooks/CABINET_LOCAL_SMOKE.md`, `docs/adr/ADR-002...`.
3. Local bootstrap/login flow is understandable from docs after this post-audit.
4. Production-safe flow is improved, but repo-wide runtime truth is still mixed:
   - canonical docs point to Docker + Traefik;
   - legacy deploy artifacts and live-baseline docs still describe `systemd + nginx`.
5. For cabinet auth itself this is not a direct security flaw, but it remains an ops/documentation risk because manual deploy expectations can drift.

## Test Coverage Findings
### Covered Now
1. Unauthorized user gets `401` from cabinet session endpoint.
2. Successful login returns a session cookie.
3. Cookie flags include `HttpOnly` and `SameSite=Lax` in local mode.
4. Authorized user can fetch materials.
5. Authorized user can open a material.
6. Logout removes access.
7. Legacy `/admin` still rejects wrong `ADMIN_SECRET` and accepts the valid one.
8. `ADMIN_SECRET` alone does not open cabinet.
9. Cabinet session alone does not open legacy `/admin`.
10. Bootstrap behavior now has explicit integration coverage for:
    - first create;
    - no-op when left enabled without reset flag;
    - intentional reset only with `CABINET_BOOTSTRAP_ALLOW_RESET=1`.

### Still Not Covered
1. Session expiry boundary behavior at exact TTL.
2. Rate-limit window reset behavior after cooldown.
3. Production-mode `Secure` cookie assertion under `NODE_ENV=production`.
4. Browser-level cabinet UI automation.
5. Cabinet observability event compatibility with obs schema.

### Assessment
1. Current test baseline is sufficient for v1 team rollout.
2. Browser-level gap is not a blocker for Phase 1 use, but it should move into Phase 1.1 because cabinet has its own login UX now.

## Risk Register
### Critical
1. None confirmed after the post-audit hardening.

### Important
1. Observability contract drift:
   - during audit runs, cabinet-specific structured logs emitted schema-violation records and normalized `unknown` events because cabinet event/domain naming is not yet aligned with the obs canon.
   - This is an ops/debugging risk, not an auth bypass.
2. Repo-wide runtime truth is still split between canonical Docker docs and legacy deployment artifacts.
3. Explicit reset mode can still re-assert admin credentials on restart if `CABINET_BOOTSTRAP_ALLOW_RESET=1` is left enabled intentionally or by mistake.

### Minor
1. Parallel sessions remain valid on repeated login.
2. Expired session cleanup is opportunistic rather than scheduled.
3. Materials taxonomy is still path-derived and light on editorial curation.
4. Browser-level automated verification is still missing.

### Deferred
1. Richer audit trail for login/material opens.
2. Admin UI for creating `viewer` users without env bootstrap.
3. Stronger session management policy (single-session or device list).

## What Was Fixed In This Post-Audit
1. Bootstrap hardening:
   - added explicit `CABINET_BOOTSTRAP_ALLOW_RESET`;
   - default bootstrap no longer resets an existing admin;
   - intentional reset revokes active sessions.
2. Auth hardening:
   - reduced timing-based user existence leakage with dummy-hash fallback.
3. Materials curation:
   - markdown summary extraction now ignores YAML frontmatter markers and metadata keys.
4. Integration coverage:
   - added bootstrap create/no-op/reset integration test;
   - added explicit cabinet-vs-admin isolation checks;
   - added cookie flag assertions.
5. Docs/runbooks/env notes:
   - clarified create-first vs reset-explicit bootstrap flow everywhere it matters operationally.

## What Was Intentionally Not Fixed
1. Cabinet observability event taxonomy was not refactored in this audit because it touches a wider logging contract, not only cabinet auth.
2. Browser-level automation was not added because the current MCP/browser layer remains unstable on this machine and that would turn the audit into tooling work.
3. Session model was not expanded into single-session enforcement or richer audit logging; that would exceed Phase 1 scope.
4. Materials registry architecture was not rewritten into CMS/editorial tooling.

## Changed Files
1. `server/cabinet/config.mjs`
2. `server/cabinet/passwords.mjs`
3. `server/cabinet/materials-registry.mjs`
4. `server/index.mjs`
5. `tests/cabinet/cabinet-auth.integration.test.mjs`
6. `tests/cabinet/cabinet-bootstrap.integration.test.mjs`
7. `package.json`
8. `.dev.vars.example`
9. `README.md`
10. `docs/runbooks/ENV_MATRIX.md`
11. `docs/runbooks/CABINET_LOCAL_SMOKE.md`
12. `docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md`

## Checks Performed
1. `pnpm run test:cabinet`
2. `pnpm run test:obs`
3. `pnpm run build:web`
4. Direct registry inventory check via `node --input-type=module`:
   - counted active materials;
   - checked duplicate titles;
   - verified categories/types;
   - verified summary extraction quality after hardening.
5. Focused code audit for:
   - bootstrap path;
   - session lifecycle;
   - cabinet route protection;
   - legacy `/admin` isolation;
   - env/doc consistency.

## Issues / Limitations
1. A separate live browser smoke was attempted conceptually, but this turn relied on integration tests plus targeted code audit because the shell policy wrapper blocked the ad hoc local server orchestration command shape.
2. Existing dirty worktree entries unrelated to cabinet audit were intentionally left untouched.
3. Observability schema drift was observed during audit runs, but not fixed in this pass.

## Recommended Phase 1.1
1. Align cabinet log events/domains with obs canon and add cabinet-specific obs tests.
2. Add one session-boundary regression test for TTL expiry and one production-mode cookie flag test.
3. Stabilize one browser-level cabinet smoke path in CI/local harness.
4. Resolve repo-wide runtime truth so manual ops instructions do not mix canonical Docker and legacy rollback flow.

## Go / No-Go Verdict
`Go-with-caveats`

Cabinet v1 can already be used by the internal team because the primary auth/session/materials/isolation contour is sound and tested. The remaining caveats are operational:
1. keep bootstrap reset usage disciplined;
2. do not treat cabinet logs as fully canon-compliant until Phase 1.1 obs alignment is done;
3. do not let runtime/docs ambiguity leak into manual deployment steps.

## Next Step
Use the follow-up memo:
1. `docs/notes/NOTE-002.cabinet.phase-1.1.followups.md`

That memo is intentionally short and can be turned into a narrow Phase 1.1 implementation prompt without reopening product scope.
