---
id: ARCH-013.ai.office-work-adaptive-prompting-systems
version: v0.1
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-10
core_snapshot: n/a
related:
  - docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/INDEX.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-008.ai.office-work-structured-outputs.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-009.ai.office-work-workflow-integration.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-011.ai.office-work-adoption-playbook.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-012.ai.office-work-implementation-scenarios.v0.1.md
tags:
  - architecture
  - practice-note
  - adaptive-prompting
  - llm
  - office-work
---

# Adaptive Prompting Systems In Office Work

## Purpose / Scope
Этот документ фиксирует практику adaptive prompting для офисной работы. Его задача: показать, как перейти от статичного prompt template к более управляемой системе, где prompt собирается из контекста задачи, типа артефакта, ограничений и ожидаемого structured output.

Документ не является tutorial, runbook или low-level API guide. Это архитектурно-практический note о том, как проектировать prompt layer для repeatable office workflows:
- когда статичный prompt перестает работать;
- из каких входов должен собираться adaptive prompt;
- как adaptive prompting связан с structured outputs и workflow integration;
- где такая практика дает наибольшую пользу в офисных сценариях.

Границы:
- только `LLM usage in office work`;
- без model-specific tuning, agent orchestration и vendor comparison;
- без ухода в deep software architecture.

## Context
В текущем домене уже зафиксировано несколько вещей. `ARCH-008` показал, что офисные сценарии выигрывают от structured outputs. `ARCH-009` показал, что LLM полезна как шаг workflow, а не как isolated chat. `ARCH-011` зафиксировал, что adoption требует перехода от ad hoc usage к repeatable patterns. `ARCH-012` разложил это на implementation scenarios.

На этом фоне становится виден следующий практический разрыв: даже хороший prompt library быстро деградирует, если каждый сценарий держится на одном статичном шаблоне. Офисная работа слишком зависит от:
- аудитории;
- типа документа;
- уровня формальности;
- доступного контекста;
- downstream format;
- ограничений по безопасности и quality control.

Текущий документ нужен для описания именно этого слоя: как делать prompting не "универсальным текстом на все случаи", а адаптивной сборкой под конкретную задачу и workflow.

## Main Section

### A. Problem Framing
Статичный prompt удобен как старт. Он помогает стандартизировать первый сценарий и снять хаос раннего experimentation. Но в офисной среде он быстро упирается в повторяющиеся ограничения.

Один и тот же базовый сценарий почти всегда меняется по нескольким осям:
- другой тип пользователя;
- другая аудитория;
- другой шаблон результата;
- разная полнота входных данных;
- разный downstream workflow;
- разные red lines и review rules.

Если эти различия не попадают в prompt layer, происходят типовые сбои:
- output становится слишком общим;
- prompt library разрастается в десятки почти одинаковых шаблонов;
- сотрудники начинают редактировать prompt вручную каждый раз;
- repeatability падает;
- structured output теряет устойчивость.

Из этого следует рабочая гипотеза: для зрелой офисной практики prompt должен рассматриваться не как статичный текст, а как собираемая система.

### B. Core Principle
Ключевой принцип adaptive prompting можно сформулировать так:

`prompt = assembled context + task logic + output contract`

Практически это означает, что prompt строится не "целиком руками каждый раз" и не "одним вечным шаблоном", а из нескольких слоев.

Первый слой - task logic. Он описывает, что именно нужно сделать:
- summarization;
- extraction;
- classification;
- drafting;
- transformation.

Второй слой - context package. Он включает:
- входные данные;
- роль пользователя;
- аудиторию;
- business goal;
- available evidence;
- missing data signals.

Третий слой - output contract. Он фиксирует:
- тип результата;
- required fields;
- schema or section order;
- allowed values;
- uncertainty handling;
- validation expectations.

Четвертый слой - workflow constraints. Он определяет:
- куда пойдет результат дальше;
- где нужен human review;
- что нельзя выдумывать;
- какие ограничения безопасности действуют.

Adaptive prompting полезен именно потому, что делает эти слои явными и управляемыми.

### C. Prompt Assembly Model
Для офисного workflow достаточно простой assembly model из шести компонентов.

#### 1. Scenario Selector
Система сначала определяет тип сценария:
- meeting processing;
- email drafting;
- CRM update;
- document preparation;
- spreadsheet classification;
- knowledge response.

Это защищает от ситуации, когда один общий prompt пытаются натянуть на все задачи сразу.

#### 2. Task Frame
Далее задается рабочая логика задачи:
- summarize;
- extract;
- rewrite;
- classify;
- generate next-step draft.

Task frame должен быть коротким, но четким. Он отвечает за вид работы, а не за все детали сценария.

#### 3. Context Pack
Следующий слой - конкретный контекст. В офисной среде он обычно состоит из:
- source material;
- role or department;
- audience;
- priority;
- template expectations;
- known constraints;
- missing information markers.

Именно context pack превращает общий prompt в привязанный к задаче контур.

#### 4. Output Schema
После этого задается expected output. Это может быть:
- `JSON` schema;
- fixed list of fields;
- CSV columns;
- ordered section block;
- short answer plus references.

Без output schema adaptive prompting быстро скатывается обратно в "умный текст", который неудобно проверять и интегрировать.

#### 5. Quality And Safety Rules
Отдельный слой должен говорить модели:
- не выдумывать отсутствующие данные;
- помечать uncertainty;
- сохранять tone boundaries;
- не раскрывать запрещенный content;
- оставлять fields empty or flagged if evidence is missing.

Этот слой особенно важен для офисного trust model.

#### 6. Review Handoff
Последний элемент задает downstream behavior:
- кто проверяет результат;
- что считается draft vs final;
- куда передается output;
- какие поля особенно важны для human review.

Без этого prompt layer остается изолированным и не встраивается в workflow.

### D. Adaptive Prompting Patterns
Внутри офисной практики достаточно выделить несколько устойчивых паттернов.

#### Pattern 1. Slot-Based Prompting
Базовый prompt template имеет фиксированные slots:
- task;
- audience;
- source data;
- format;
- constraints;
- output schema.

Это самый простой adaptive pattern. Он уже лучше статичного текста, потому что допускает controlled variability без потери структуры.

#### Pattern 2. Missing-Data Aware Prompting
Если входные данные неполны, prompt заранее сообщает модели:
- какие поля обязательны;
- какие могут быть unknown;
- как маркировать gaps;
- что делать, если evidence is insufficient.

Этот pattern особенно полезен против hallucination-by-completion, когда модель пытается "дописать правдоподобно" то, чего ей не дали.

#### Pattern 3. Audience-Adaptive Prompting
Одна и та же задача может требовать разной формы в зависимости от аудитории:
- внутренний менеджер;
- клиент;
- коллега по команде;
- руководитель;
- CRM operator.

Здесь меняются tone, density, structure и допустимый уровень детализации. Audience adaptation нужна, чтобы не держать отдельный static prompt на каждую вариацию.

#### Pattern 4. Schema-Guided Prompting
Prompt собирается вокруг output contract:
- section order;
- fields;
- enumerations;
- null policy;
- validation hints.

Это самый важный pattern для scenarios, где результат идет в document template, CRM, spreadsheet or task system.

#### Pattern 5. Review-Aware Prompting
Prompt учитывает, будет ли результат:
- только черновиком;
- полуготовым артефактом;
- data payload for downstream system.

От этого зависит, насколько aggressively модель должна резюмировать, формализовать или маркировать uncertainty.

### E. Relationship With Structured Outputs
`ARCH-008` зафиксировал structured outputs как базовую practice. Adaptive prompting не заменяет ее, а делает устойчивой.

Structured output отвечает на вопрос "в каком формате нужен результат".

Adaptive prompting отвечает на вопрос "как собрать prompt так, чтобы этот формат consistently получался при разных входах и вариациях сценария".

Практически это означает:
- schema должна быть частью prompt assembly, а не внешним пожеланием;
- variability задачи должна управляться входными слотами, а не ручной редактурой промпта;
- validation-friendly output начинается не после генерации, а на этапе сборки prompt.

### F. Relationship With Workflow Integration
`ARCH-009` описал workflow как контур `task -> context -> generation -> validation -> integration`. Adaptive prompting живет между context collection и generation.

Его роль:
- превратить собранный context в управляемую инструкцию;
- сделать generation repeatable;
- сохранить совместимость с validation and downstream systems.

Если workflow integration отвечает за процессный каркас, то adaptive prompting отвечает за качество интерфейса между контекстом задачи и моделью.

### G. Practical Use In Office Scenarios
Adaptive prompting особенно полезен в уже выделенных implementation scenarios.

В meeting processing он помогает менять prompt в зависимости от:
- типа встречи;
- уровня формальности;
- необходимости task extraction;
- доступности transcript versus notes.

В email drafting он адаптирует:
- audience;
- tone;
- urgency;
- required sections;
- approval status.

В CRM data structuring он меняет:
- набор полей;
- приоритетные signal types;
- required next-action logic;
- confidence marking.

В document preparation он связывает:
- document type;
- section template;
- available source data;
- missing-data policy;
- structured output block for template engine.

То есть adaptive prompting не является отдельным use case. Это reusable layer, который делает уже известные сценарии менее хрупкими и более repeatable.

### H. Implementation Guidelines
Для внедрения adaptive prompting в офисной среде полезны несколько правил.

Первое: начинать не с "универсального супершаблона", а с 3-5 repeatable scenarios, где variability уже видна, но еще контролируема.

Второе: держать prompt assembly прозрачной. Пользователь и редактор должны понимать, какие slots формируют итоговую инструкцию.

Третье: фиксировать output contract отдельно от narrative instructions. Это облегчает validation и снижает расползание prompt text.

Четвертое: проектировать missing-data behavior заранее. Если это не сделать, модель почти всегда будет компенсировать пробелы правдоподобной генерацией.

Пятое: не превращать adaptive prompting в hidden complexity. Если система настолько сложна, что никто не понимает, как формируется prompt, поддержка быстро деградирует.

Шестое: связывать adaptive prompting с review model. Prompt должен знать, что является draft, что является structured payload и где именно стоит human checkpoint.

## Acceptance / Validation
Документ достаточен, если:

1. Читается как practice note про adaptive prompting systems, а не как prompt tutorial.
2. Объясняет, почему static prompts ограничены в офисной среде.
3. Содержит assembly model, key patterns и связь с structured outputs and workflow integration.
4. Остается в границах `LLM usage in office work`.
5. Дает основу для дальнейшего развития prompt libraries без расползания в agent architecture.

## Related
- docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/INDEX.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-008.ai.office-work-structured-outputs.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-009.ai.office-work-workflow-integration.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-011.ai.office-work-adoption-playbook.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-012.ai.office-work-implementation-scenarios.v0.1.md

## Open Questions / TODO
1. Нужен ли следующим шагом отдельный document по prompt libraries, или adaptive prompting уже покрывает достаточный уровень детализации.
2. Какие slots должны быть обязательными для early-stage office scenarios, а какие можно оставлять optional.
3. Где проходит граница между adaptive prompting system и слишком сложной hidden configuration layer.
