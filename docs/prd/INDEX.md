---
id: INDEX.prd
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: n/a
related:
  - docs/DOCS_CANON.md
  - docs/prd/PRD-PHASE-1.LANDING.md
  - docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
tags:
  - index
  - prd
  - product
---

# PRD Index

## Purpose / Scope
Индекс задаёт предсказуемую навигацию по product requirements проекта без смешения с ADR, контрактами и отчётами.

## Context
В репозитории уже есть Phase 1 PRD по лендингу. Discovery по cabinet/auth создаёт новый продуктовый слой, поэтому для домена `docs/prd/` нужен явный индекс.

## Main Section
| id | path | status | last_updated |
| --- | --- | --- | --- |
| `PRD-PHASE-1.landing` | `docs/prd/PRD-PHASE-1.LANDING.md` | `draft` | `2026-02-27` |
| `PRD-002.cabinet.materials-auth` | `docs/prd/PRD-002.cabinet.materials-auth.v0.1.md` | `draft` | `2026-03-13` |

## Acceptance / Validation
Индекс достаточен, если:

1. По нему можно увидеть действующий PRD лендинга и draft PRD следующего слоя.
2. PRD остаются отделены от архитектурных и операционных документов.

## Related
- docs/DOCS_CANON.md
- docs/prd/PRD-PHASE-1.LANDING.md
- docs/prd/PRD-002.cabinet.materials-auth.v0.1.md

## Open Questions / TODO
1. Нужен ли отдельный archived-раздел, когда старые PRD начнут заменяться новыми версиями.
