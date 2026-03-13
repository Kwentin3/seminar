---
id: REPORT.docs.llm-office-work-domain-map-create-1
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-06
core_snapshot: n/a
related:
  - docs/DOCS_CANON.md
  - docs/templates/DOC_TEMPLATE.md
  - docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md
  - docs/ARCHITECTURE/NORTH_STAR.md
  - docs/ARCHITECTURE/INDEX.md
  - docs/ARCHITECTURE/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
tags:
  - report
  - docs
  - architecture
  - llm
---

# DOCS LLM Office Work Domain Map Create Report

## Purpose / Scope
Отчет фиксирует создание первого опорного документа домена знаний по использованию LLM в офисной работе и минимальных сопутствующих артефактов, необходимых каноном.

## Context
Задача была ограничена режимом audit-first:
- без web research;
- без создания лишних дочерних документов;
- с опорой на `docs/DOCS_CANON.md`, `docs/templates/DOC_TEMPLATE.md`, `docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md` и `docs/ARCHITECTURE/NORTH_STAR.md`.

Выбран архитектурный путь, потому что документ является knowledge-domain frame и governance-level опорой, а не PRD, не market review и не учебной программой.

## Main Section

### Summary
Создан один корневой документ домена:
- `docs/ARCHITECTURE/ARCH-003.ai.office-work-knowledge-domain.v0.1.md`

Он фиксирует:
- purpose and scope домена;
- problem frame;
- foundational concepts;
- problem domains;
- solution domains;
- research clusters;
- domain boundaries;
- terminology starter set;
- next-doc recommendations.

### Changed Files
1. `docs/ARCHITECTURE/ARCH-003.ai.office-work-knowledge-domain.v0.1.md` - новый корневой knowledge-domain map документ.
2. `docs/ARCHITECTURE/INDEX.md` - новый минимальный индекс архитектурного домена.
3. `docs/reports/2026-03-06/DOCS.LLM_OFFICE_WORK.DOMAIN_MAP.CREATE.1.report.md` - данный отчет.

### Why This Type And Path
1. Выбран `docs/ARCHITECTURE/`, потому что в репозитории уже существует архитектурный паттерн для governance- и north-star документов (`ARCH-*` в `docs/ARCHITECTURE/`).
2. Новый документ по смыслу является доменной рамкой и документом управления знанием, а не PRD, ADR-контрактом или runbook.
3. Создание отдельного нового корня `docs/<new-domain>/` на этом шаге было бы преждевременным ростом контекста.

### Checks Performed
1. Проверен `docs/DOCS_CANON.md` на типы документов, routing, naming rules, header metadata и индексное правило.
2. Проверен `docs/templates/DOC_TEMPLATE.md` на обязательную структуру.
3. Проверены `docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md` и `docs/ARCHITECTURE/NORTH_STAR.md` на ограничения роста домена и стратегическое соответствие.
4. Проверена текущая структура `docs/` на существующий архитектурный паттерн и отсутствие `docs/ARCHITECTURE/INDEX.md`.
5. Выполнен self-check содержимого на предмет:
   - domain map вместо эссе;
   - отсутствия RAG-first / agent-first смещения;
   - наличия boundaries, problem taxonomy, solution taxonomy и next-doc layer;
   - отсутствия лишних документов.

### Issues / Limitations
1. Формальный тип `ARCH` присутствует в репозитории как существующая практика, хотя в `DOCS_CANON` он не перечислен отдельно рядом с `ADR`; для этой задачи был использован именно существующий паттерн репозитория.
2. Отдельный поддоменный research index пока сознательно не создавался, чтобы не расширять домен раньше времени.

### What Was Intentionally Not Done
1. Не создавались дочерние research-документы.
2. Не создавался отдельный glossary-файл.
3. Не добавлялись новые архитектурные сущности вне минимально необходимого набора.
4. Не выполнялся web research.

## Acceptance / Validation
Результат соответствует текущему шагу, если:

1. В репозитории появился один основной доменный документ, один REPORT и один минимальный индекс.
2. Новый документ оформлен как knowledge-domain map, а не как PRD или учебный конспект.
3. В документе есть Purpose/Scope, boundaries, problem/solution framing, future decomposition и acceptance block.
4. Изменения согласованы с ограничением на узкий рост документационного домена.

## Related
- docs/DOCS_CANON.md
- docs/templates/DOC_TEMPLATE.md
- docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md
- docs/ARCHITECTURE/NORTH_STAR.md
- docs/ARCHITECTURE/INDEX.md
- docs/ARCHITECTURE/ARCH-003.ai.office-work-knowledge-domain.v0.1.md

## Open Questions / TODO
1. Следующий разумный шаг: отдельный документ problem taxonomy для негативного пользовательского опыта.
2. После появления первых дочерних документов стоит решить, нужен ли отдельный research index внутри этой knowledge-ветки.
