---
id: INDEX.architecture
version: v0.2
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-10
core_snapshot: n/a
related:
  - docs/DOCS_CANON.md
  - docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md
  - docs/ARCHITECTURE/NORTH_STAR.md
  - docs/landing/INDEX.md
  - docs/seminar/INDEX.md
tags:
  - index
  - architecture
  - governance
  - strategy
---

# Architecture Index

## Purpose / Scope
Минимальный индекс shared architecture-домена. Нужен для предсказуемой навигации по базовым governance- и strategy-документам проекта без смешения их с продуктовыми и seminar-specific knowledge-ветками.

## Context
С `2026-03-10` seminar knowledge-документы вынесены в отдельный домен `docs/seminar/`. Этот индекс теперь покрывает только общее ядро `docs/ARCHITECTURE/` и указывает на соседние доменные входы, не дублируя их содержимое.

## Main Section

### 1. Shared Architecture Core
| id | path | status | last_updated |
|---|---|---|---|
| `ARCH-001.arch.context-governance` | `docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md` | `draft` | `2026-03-01` |
| `ARCH-002.arch.north-star` | `docs/ARCHITECTURE/NORTH_STAR.md` | `draft` | `2026-03-01` |

### 2. Neighboring Domain Indices
| id | path | role |
|---|---|---|
| `INDEX.landing` | `docs/landing/INDEX.md` | Вход в продуктовый домен лендинга: PRD, контент, lead-flow, UX и smoke-материалы. |
| `INDEX.seminar` | `docs/seminar/INDEX.md` | Вход в seminar knowledge-домен: методология, research, teaching model и capability framing. |

## Acceptance / Validation
Индекс считается достаточным, если:

1. Он перечисляет shared architecture-документы проекта.
2. Он не смешивает shared governance с доменными ветками `landing` и `seminar`.
3. Он указывает на соседние доменные входы без дублирования их содержимого.

## Related
- docs/DOCS_CANON.md
- docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md
- docs/ARCHITECTURE/NORTH_STAR.md
- docs/landing/INDEX.md
- docs/seminar/INDEX.md

## Open Questions / TODO
1. Нужен ли позднее отдельный `strategy`-индекс, если shared architecture-домен вырастет beyond governance + north star.
