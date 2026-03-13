---
id: INDEX.adr
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: n/a
related:
  - docs/DOCS_CANON.md
  - docs/adr/ADR-001.infrastructure.baseline.v1.md
  - docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md
tags:
  - index
  - adr
  - architecture
---

# ADR Index

## Purpose / Scope
Индекс собирает архитектурные решения проекта в одном месте и делает видимыми смены системных границ.

## Context
`ADR-001` зафиксировал инфраструктурный baseline для Phase 1. Discovery по cabinet/auth поднимает новую границу вокруг identity, access control и internal materials area, поэтому добавляется draft `ADR-002`.

## Main Section
| id | path | status | last_updated |
| --- | --- | --- | --- |
| `ADR-001.infrastructure.baseline` | `docs/adr/ADR-001.infrastructure.baseline.v1.md` | `draft` | `2026-02-27` |
| `ADR-002.cabinet.auth-baseline` | `docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md` | `draft` | `2026-03-13` |

## Acceptance / Validation
Индекс достаточен, если:

1. Он показывает действующий infra baseline и новый draft architectural decision по cabinet/auth.
2. Из индекса можно перейти к связанным PRD и epic-документам.

## Related
- docs/DOCS_CANON.md
- docs/adr/ADR-001.infrastructure.baseline.v1.md
- docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md

## Open Questions / TODO
1. Нужно ли позже ввести классификацию ADR по доменам (`infra`, `cabinet`, `ops`, `ai`).
