---
id: INDEX.epics
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: n/a
related:
  - docs/DOCS_CANON.md
  - docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md
  - docs/epics/EPIC-002.cabinet.auth-foundation/EPIC.md
tags:
  - index
  - epics
  - delivery
---

# Epics Index

## Purpose / Scope
Индекс фиксирует вход в домен эпиков проекта и связывает крупные инициативы с их context snapshot и связанными decision-документами.

## Context
По `docs/DOCS_CANON.md` каждый эпик обязан иметь собственную папку и `CONTEXT_SNAPSHOT.md`. Этот индекс нужен, чтобы новые эпики не терялись в структуре `docs/`.

## Main Section
| id | path | status | last_updated |
| --- | --- | --- | --- |
| `EPIC-002.cabinet.auth-foundation` | `docs/epics/EPIC-002.cabinet.auth-foundation/EPIC.md` | `draft` | `2026-03-13` |

## Acceptance / Validation
Индекс достаточен, если:

1. По нему можно быстро найти активный эпик и его snapshot.
2. Эпики перечислены без смешения с PRD/ADR/report-документами.

## Related
- docs/DOCS_CANON.md
- docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md
- docs/epics/EPIC-002.cabinet.auth-foundation/EPIC.md

## Open Questions / TODO
1. Нужен ли позднее отдельный статусный столбец для implementation-фазы и owner-review.
