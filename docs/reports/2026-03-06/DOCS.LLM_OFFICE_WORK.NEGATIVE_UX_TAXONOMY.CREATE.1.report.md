---
id: REPORT.docs.llm-office-work-negative-ux-taxonomy-create-1
version: v0.1
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-06
core_snapshot: n/a
related:
  - docs/ARCHITECTURE/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
  - docs/ARCHITECTURE/LLM_OFFICE_WORK/INDEX.md
  - docs/ARCHITECTURE/LLM_OFFICE_WORK/ARCH-004.ai.office-work-taxonomy.v0.1.md
  - docs/ARCHITECTURE/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md
  - docs/ARCHITECTURE/LLM_OFFICE_WORK/ARCH-006.ai.office-work-research-directions.v0.1.md
  - docs/ARCHITECTURE/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md
tags:
  - report
  - docs
  - research-note
  - negative-ux
  - llm
---

# DOCS LLM Office Work Negative UX Taxonomy Create Report

## Purpose / Scope
Отчет фиксирует создание первого прикладного документа knowledge-ветки по теме негативного пользовательского опыта использования LLM в офисной среде.

## Context
Документ создан как Phase 3.1 внутри уже существующего knowledge-domain framework. Целью было не расширять общий домен, а сделать первый прикладной taxonomy-level note, который объясняет, почему офисные пользователи получают плохой результат от LLM.

## Main Section

### Summary
Создан новый документ:

1. `docs/ARCHITECTURE/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md`

Также обновлены индексы навигации:

1. `docs/ARCHITECTURE/LLM_OFFICE_WORK/INDEX.md`
2. `docs/ARCHITECTURE/INDEX.md`

### Why This Format
1. Выбран `ARCH-level research note`, потому что документ систематизирует проблемные паттерны, а не описывает продуктовые требования, процесс выполнения или учебную инструкцию.
2. Формат taxonomy note позволяет углубить один problem cluster из общей domain taxonomy без дублирования всего knowledge framework.
3. Документ расположен в `docs/ARCHITECTURE/LLM_OFFICE_WORK/`, потому что это уже каноничное место для knowledge-ветки данного домена.

### Problems Identified In The Document
1. Incorrect mental model.
2. Poor task formulation.
3. Chat-first limitation.
4. Document vs data conflict.
5. Template mismatch.
6. Hallucination and trust crisis.
7. Copy-paste workflow.
8. Lack of quality control.
9. Security and data risk.
10. Power users vs regular users gap.

### Checks Performed
1. Проверено domain alignment: документ остается в границах `LLM usage in office work`.
2. Проверено non-duplication: новый note не повторяет общую taxonomy, а детализирует только negative UX layer.
3. Проверено structure clarity: документ читается как taxonomy, а не как статья или tutorial.
4. Проверено наличие обязательных блоков: `Purpose / Scope`, `Context`, `Main Section`, `Acceptance / Validation`, `Related`, `Open Questions / TODO`.
5. Проверена навигация: новый документ добавлен в domain index и верхний architecture index.

### What Was Intentionally Not Done
1. Не выполнялся web research.
2. Не добавлялись статистика, источники и внешние исследования.
3. Не создавался следующий документ по structured outputs.
4. Не создавались дополнительные problem notes сверх одного минимально нужного.

### Next Logical Documents
1. `Structured Outputs in Office Work` как следующий прикладной document.
2. `Office Workflow Integration` как следующий problem-to-solution bridge note.

## Acceptance / Validation
Результат достаточен, если:

1. Создан один новый прикладной taxonomy-level document.
2. Индексы обновлены ровно настолько, насколько нужно для навигации.
3. Документ помогает объяснить причины негативного UX без ухода в технологический ресерч.

## Related
- docs/ARCHITECTURE/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
- docs/ARCHITECTURE/LLM_OFFICE_WORK/INDEX.md
- docs/ARCHITECTURE/LLM_OFFICE_WORK/ARCH-004.ai.office-work-taxonomy.v0.1.md
- docs/ARCHITECTURE/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md
- docs/ARCHITECTURE/LLM_OFFICE_WORK/ARCH-006.ai.office-work-research-directions.v0.1.md
- docs/ARCHITECTURE/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md

## Open Questions / TODO
1. Какие negative UX clusters стоит переводить в training material, а какие в tooling requirements.
2. Нужно ли после structured outputs note отдельно собрать brief adoption playbook для seminar use cases.
