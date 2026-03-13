---
id: NOTE-002.cabinet.phase-1.1.followups
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/reports/2026-03-13/CABINET.v1.post-audit.report.md
  - docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
  - docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md
tags:
  - note
  - cabinet
  - phase-1.1
  - followup
---

# Cabinet Phase 1.1 Follow-Ups

## Purpose
Короткий memo по остаточным follow-up задачам после завершения Phase 1.1 hardening. Это не Phase 2 roadmap и не новый продуктовый scope.

## Proposed Work
1. Keep browser smoke stable in CI and revisit only if Playwright/tooling starts to flap.
2. If cabinet scope grows, add one more browser smoke around materials open route rather than broadening this phase baseline.
3. Revisit session policy only when product really needs device/session management beyond current internal-team use.
4. Keep canonical-vs-legacy docs in sync whenever deploy runbooks change.

## Completed In Phase 1.1
1. Cabinet logging was aligned with obs canon.
2. Cabinet-specific obs checks were added.
3. Regression coverage for TTL expiry and production `Secure` cookie was added.
4. A stable browser smoke was added.
5. Runtime/docs truth was clarified around canonical Docker vs legacy rollback contour.

## Explicitly Out Of Scope
1. New roles.
2. User-management UI.
3. Client cabinet.
4. Materials CMS/upload flow.
5. Cabinet/admin consolidation.

## Done When
1. Cabinet logs больше не деградируют в obs schema violation по своему naming.
2. Есть хотя бы один тест на expiry boundary и один на production cookie flags.
3. Есть один стабильный browser-level smoke path.
4. Ops/docs не оставляют двусмысленности по production deployment truth.

## Related
- docs/reports/2026-03-13/CABINET.v1.post-audit.report.md
- docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
- docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md
