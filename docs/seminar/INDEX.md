---
id: INDEX.seminar
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
  - docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/INDEX.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-014.ai.office-work-seminar-teaching-model.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-015.ai.office-work-capability-model.v0.1.md
tags:
  - index
  - seminar
  - knowledge-domain
  - education
  - ai-literacy
---

# Seminar Domain Index

## Purpose / Scope
Индекс фиксирует отдельный seminar-домен внутри проектовой документации. Он нужен для навигации по knowledge-, teaching- и methodology-материалам без смешения их с landing- и ops-документами.

## Context
По `North Star` семинар является образовательным B2B-entry слоем проекта, а лендинг выступает каналом входа. Поэтому seminar-домен отделен на уровне документации, но остается частью общего проекта и наследует shared governance из `docs/ARCHITECTURE/`.

## Main Section

### 1. Domain Core
| id | path | role |
|---|---|---|
| `ARCH-003.ai.office-work-knowledge-domain` | `docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md` | Корневая карта домена: позиционирование, границы, next-doc layer. |
| `INDEX.seminar.llm-office-work` | `docs/seminar/LLM_OFFICE_WORK/INDEX.md` | Вход в рабочую knowledge-ветку по LLM в офисной работе. |
| `ARCH-014.ai.office-work-seminar-teaching-model` | `docs/seminar/LLM_OFFICE_WORK/ARCH-014.ai.office-work-seminar-teaching-model.v0.1.md` | Teaching framework для перевода domain stack в seminar format. |
| `ARCH-015.ai.office-work-capability-model` | `docs/seminar/LLM_OFFICE_WORK/ARCH-015.ai.office-work-capability-model.v0.1.md` | Capability framing для post-seminar discovery и внедрения. |

### 2. Boundary Rules
1. В seminar-домен попадают research, методология, teaching model, capability framing и knowledge maps.
2. В seminar-домен не попадают PRD лендинга, UX-аудиты, lead-flow и operational runbooks.
3. Shared strategy и governance остаются в `docs/ARCHITECTURE/`, а не дублируются здесь.

## Acceptance / Validation
Индекс достаточен, если:

1. Новый агент может открыть его и быстро отличить seminar-domain от landing-domain.
2. Корневой knowledge document и его дочерняя ветка читаются как единый доменный маршрут.
3. Границы домена не допускают смешения с продуктовой документацией лендинга.

## Related
- docs/README.md
- docs/ARCHITECTURE/NORTH_STAR.md
- docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/INDEX.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-014.ai.office-work-seminar-teaching-model.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-015.ai.office-work-capability-model.v0.1.md

## Open Questions / TODO
1. Нужен ли позднее отдельный индекс для seminar-specific artifacts и teaching assets, если они начнут расти отдельно от knowledge-docs.
