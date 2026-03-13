---
id: INDEX.landing
version: v0.1
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-10
core_snapshot: n/a
related:
  - docs/README.md
  - docs/ARCHITECTURE/NORTH_STAR.md
  - docs/prd/PRD-PHASE-1.LANDING.md
  - docs/contracts/CONTRACT-001.landing.content-json.v1.0.md
  - docs/runbooks/LEADS_SMOKE_LOCAL.md
tags:
  - index
  - landing
  - lead-engine
  - product-ux
---

# Landing Domain Index

## Purpose / Scope
Индекс фиксирует landing-домен внутри проекта. Он нужен для навигации по продуктовым и UX-материалам лендинга как канала лидогенерации без смешения их с seminar knowledge-веткой.

## Context
По `North Star` лендинг не является отдельным продуктом: это управляемый вход в B2B-диалог через семинары. Поэтому landing-домен выделен для удобства работы с продуктом и конверсией, но остается подчиненным общей стратегии проекта.

## Main Section

### 1. Domain Core
| id | path | role |
|---|---|---|
| `PRD-PHASE-1.landing` | `docs/prd/PRD-PHASE-1.LANDING.md` | Источник истины по продуктовым рамкам, scope и DoD текущей landing-фазы. |
| `CONTRACT-001.landing.content-json` | `docs/contracts/CONTRACT-001.landing.content-json.v1.0.md` | Контентный контракт между producer, validator и Web UI. |
| `RUNBOOK.leads-smoke-local` | `docs/runbooks/LEADS_SMOKE_LOCAL.md` | Проверка минимального lead-flow на локальном контуре. |

### 2. Boundary Rules
1. В landing-домен попадают PRD, UX, content contracts, form conversion и lead/admin flow.
2. В landing-домен не попадают seminar research notes, teaching model и capability framing.
3. Shared infra/runbooks остаются в shared core, даже если используются лендингом.

## Acceptance / Validation
Индекс достаточен, если:

1. Он дает короткий вход в landing-specific документы без похода по всему `docs/`.
2. Граница между landing и seminar читается по ролям документов, а не только по именам файлов.
3. Индекс не дублирует содержимое PRD и контрактов.

## Related
- docs/README.md
- docs/ARCHITECTURE/NORTH_STAR.md
- docs/prd/PRD-PHASE-1.LANDING.md
- docs/contracts/CONTRACT-001.landing.content-json.v1.0.md
- docs/runbooks/LEADS_SMOKE_LOCAL.md

## Open Questions / TODO
1. Нужно ли позднее завести отдельный landing research/audit index, если UX- и content-report'ы продолжат расти.
