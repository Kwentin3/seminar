---
id: INDEX.seminar.llm-office-work
version: v0.1
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-10
core_snapshot: n/a
related:
  - docs/DOCS_CANON.md
  - docs/seminar/INDEX.md
  - docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-004.ai.office-work-taxonomy.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-006.ai.office-work-research-directions.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-008.ai.office-work-structured-outputs.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-009.ai.office-work-workflow-integration.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-010.ai.office-work-deep-research.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-011.ai.office-work-adoption-playbook.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-012.ai.office-work-implementation-scenarios.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-013.ai.office-work-adaptive-prompting-systems.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-014.ai.office-work-seminar-teaching-model.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-015.ai.office-work-capability-model.v0.1.md
tags:
  - index
  - seminar
  - llm
  - office-work
  - knowledge-domain
---

# LLM Office Work Domain Index

## Purpose / Scope
Этот индекс является быстрым входом в knowledge-ветку про использование LLM в офисной работе. Он нужен для навигации, контроля роста домена и понятного маршрута для новых агентов и редакторов.

Границы индекса:
- покрывает только домен `LLM usage in office work`;
- не дублирует содержимое root document и дочерних документов;
- не открывает темы `RAG`, `AI agents`, `vector databases`, `tool orchestration`.

## Context
Доменная ветка строится вокруг корневого документа `ARCH-003` и расширяет его минимальным набором таксономических и навигационных артефактов. С `2026-03-10` она выделена внутри `docs/seminar/`, а shared governance остается в `docs/ARCHITECTURE/`.

## Main Section

### 1. Domain Snapshot
Домен описывает, почему LLM в офисной работе часто дают плохой пользовательский опыт, и какие практики делают их полезными в повторяемых процессах. Фокус остается на методологии, образовательных материалах и knowledge framing для B2B-сценариев внедрения.

### 2. Document Map
| id | path | role |
|---|---|---|
| `ARCH-003.ai.office-work-knowledge-domain` | `docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md` | Корневой документ домена: позиционирование, границы, базовая карта. |
| `INDEX.seminar.llm-office-work` | `docs/seminar/LLM_OFFICE_WORK/INDEX.md` | Навигационный вход и правила расширения knowledge-ветки. |
| `ARCH-004.ai.office-work-taxonomy` | `docs/seminar/LLM_OFFICE_WORK/ARCH-004.ai.office-work-taxonomy.v0.1.md` | Таксономия проблем, решений и фундаментальных концептов. |
| `ARCH-005.ai.office-work-terminology` | `docs/seminar/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md` | Рабочий словарь домена с терминами, notes и related concepts. |
| `ARCH-006.ai.office-work-research-directions` | `docs/seminar/LLM_OFFICE_WORK/ARCH-006.ai.office-work-research-directions.v0.1.md` | Исследовательские кластеры и приоритеты следующей декомпозиции. |
| `ARCH-007.ai.office-work-negative-ux-taxonomy` | `docs/seminar/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md` | Первый прикладной problem note: taxonomy негативного пользовательского опыта. |
| `ARCH-008.ai.office-work-structured-outputs` | `docs/seminar/LLM_OFFICE_WORK/ARCH-008.ai.office-work-structured-outputs.v0.1.md` | Solution-level practice note: structured data как основной слой интеграции LLM в workflow. |
| `ARCH-009.ai.office-work-workflow-integration` | `docs/seminar/LLM_OFFICE_WORK/ARCH-009.ai.office-work-workflow-integration.v0.1.md` | Process-level practice note: как встроить LLM и structured outputs в повторяемый офисный workflow. |
| `ARCH-010.ai.office-work-deep-research` | `docs/seminar/LLM_OFFICE_WORK/ARCH-010.ai.office-work-deep-research.v0.1.md` | Research synthesis: внешние кейсы, проблемы, практики и методы обучения для расширения домена. |
| `ARCH-011.ai.office-work-adoption-playbook` | `docs/seminar/LLM_OFFICE_WORK/ARCH-011.ai.office-work-adoption-playbook.v0.1.md` | Framework-level playbook: методология внедрения LLM в офисной работе на основе problem, process и research layers. |
| `ARCH-012.ai.office-work-implementation-scenarios` | `docs/seminar/LLM_OFFICE_WORK/ARCH-012.ai.office-work-implementation-scenarios.v0.1.md` | Use-case layer: типовые сценарии внедрения LLM в офисных workflow на основе playbook и domain notes. |
| `ARCH-013.ai.office-work-adaptive-prompting-systems` | `docs/seminar/LLM_OFFICE_WORK/ARCH-013.ai.office-work-adaptive-prompting-systems.v0.1.md` | Practice note: adaptive prompting как управляемый prompt layer для repeatable office workflows. |
| `ARCH-014.ai.office-work-seminar-teaching-model` | `docs/seminar/LLM_OFFICE_WORK/ARCH-014.ai.office-work-seminar-teaching-model.v0.1.md` | Teaching framework: как переводить domain stack в seminar format и B2B-entry educational flow. |
| `ARCH-015.ai.office-work-capability-model` | `docs/seminar/LLM_OFFICE_WORK/ARCH-015.ai.office-work-capability-model.v0.1.md` | Capability framework: как читать зрелость организации и выбирать следующий шаг внедрения. |

### 3. Suggested Reading Order
1. Сначала `ARCH-003` как domain root.
2. Затем `ARCH-004` для понимания структуры problem/solution/concept space.
3. Затем `ARCH-005` для выравнивания терминов.
4. Затем `ARCH-006` для выбора следующего research направления.
5. Затем `ARCH-007` для прикладной карты failure patterns офисного пользователя.
6. Затем `ARCH-008` для базовой solution practice по structured outputs.
7. Затем `ARCH-009` для workflow integration на уровне процесса.
8. Затем `ARCH-010` для внешнего research corpus и next-step planning.
9. Затем `ARCH-011` для adoption methodology и проектирования rollout-подхода.
10. Затем `ARCH-012` для набора типовых implementation scenarios.
11. Затем `ARCH-013` для prompt-system layer и стабилизации repeatable scenarios.
12. Затем `ARCH-014` для seminar teaching architecture и B2B-entry framing.
13. Затем `ARCH-015` для capability and maturity framing после seminar/discovery.

### 4. Domain Expansion Rules
1. Новые документы допускаются только если не помещаются в одну из существующих четырех ролей: root, taxonomy, terminology, research.
2. Следующие документы должны быть дочерними по отношению к конкретному кластеру, а не общими "про все сразу".
3. Запрещено открывать новые ветки по `RAG`, `agents`, `vector DB`, `tool orchestration` внутри этого индекса.
4. Новый документ должен ссылаться минимум на `ARCH-003`, этот индекс и один профильный документ ветки.
5. Если новый документ не меняет навигацию домена, отдельный новый индекс не создается.

## Acceptance / Validation
Индекс достаточен, если:

1. Новый агент может открыть этот файл и понять структуру knowledge-ветки.
2. Все документы домена перечислены и имеют ясную роль.
3. Правила роста ограничивают расползание документационного домена.

## Related
- docs/DOCS_CANON.md
- docs/seminar/INDEX.md
- docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-004.ai.office-work-taxonomy.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-006.ai.office-work-research-directions.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-008.ai.office-work-structured-outputs.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-009.ai.office-work-workflow-integration.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-010.ai.office-work-deep-research.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-011.ai.office-work-adoption-playbook.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-012.ai.office-work-implementation-scenarios.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-013.ai.office-work-adaptive-prompting-systems.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-014.ai.office-work-seminar-teaching-model.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-015.ai.office-work-capability-model.v0.1.md

## Open Questions / TODO
1. Нужен ли отдельный дочерний документ по teaching patterns после появления первых seminar-specific notes.
2. Должен ли future problem taxonomy split появиться только после накопления реальных кейсов, а не заранее.
