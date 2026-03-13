---
id: ARCH-014.ai.office-work-seminar-teaching-model
version: v0.1
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-10
core_snapshot: n/a
related:
  - docs/ARCHITECTURE/NORTH_STAR.md
  - docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/INDEX.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-011.ai.office-work-adoption-playbook.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-012.ai.office-work-implementation-scenarios.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-013.ai.office-work-adaptive-prompting-systems.v0.1.md
tags:
  - architecture
  - teaching-model
  - seminar
  - llm
  - office-work
---

# Seminar Teaching Model For LLM In Office Work

## Purpose / Scope
Этот документ фиксирует teaching model для семинаров по использованию LLM в офисной работе. Его задача: перевести knowledge-domain в образовательную рамку, которая помогает корпоративной аудитории быстро перейти от поверхностного chat-first интереса к более зрелому пониманию workflow-based usage.

Документ не является учебной программой, детальным сценарием выступления или маркетинговым описанием семинара. Это framework-документ, который задает:
- чему именно должен учить семинар;
- в какой логике подавать материал;
- как связывать problem layer, solution layer и implementation scenarios;
- как использовать семинар как B2B-entry point в дальнейшее внедрение.

Границы:
- только `LLM usage in office work`;
- только teaching architecture для seminar format;
- без превращения документа в sales deck или product PRD.

## Context
`NORTH_STAR` фиксирует, что проект "Семинары" нужен как B2B-канал привлечения клиентов на внедрение ИИ через образовательные продукты. Это означает, что семинар не должен быть ни абстрактной лекцией "про AI вообще", ни набором разрозненных prompt tricks. Его функция двойная:
- дать участникам реальную прикладную рамку;
- помочь выявить зрелость, pain points и readiness клиента к следующему шагу внедрения.

Внутри текущего домена уже собраны problem, process и practice layers. `ARCH-007` описывает negative UX. `ARCH-011` дает adoption methodology. `ARCH-012` показывает implementation scenarios. `ARCH-013` добавляет prompt-system layer. Теперь нужен teaching layer, который объясняет, как из этих материалов делать содержательно связанный seminar format для офисной аудитории.

## Main Section

### A. Teaching Problem
Типичный корпоративный семинар по AI проваливается по одной из двух причин.

Первая: он слишком абстрактный. Участникам рассказывают про технологии, тренды и возможности, но не переводят это в структуру офисной работы. После такого семинара остается ощущение "интересно, но непонятно, что делать завтра".

Вторая: он слишком инструментальный. Участникам дают набор prompt tricks, но не объясняют:
- почему chat-first usage ломается;
- как связаны data, template и workflow;
- почему structured outputs важнее "красивого ответа";
- где проходят границы безопасного применения.

Для B2B-семинаров этого недостаточно. Организация покупает не вдохновение и не список лайфхаков, а снижение хаоса, рост repeatability и понимание, где именно начинается внедрение. Следовательно, seminar teaching model должен учить не "общему AI", а правильной operational mental model.

### B. Core Teaching Principle
Ключевой принцип teaching model:

`teach workflow thinking, not chat tricks`

Практически это означает четыре опорные идеи.

Первая: участникам нужно сначала переопределить ментальную модель LLM. Не "умный эксперт", а инструмент работы с контекстом, структурой и вероятным output.

Вторая: обучение должно идти от реальных офисных задач, а не от функций модели. Люди лучше понимают материал, когда он привязан к письмам, встречам, отчетам, CRM и таблицам.

Третья: семинар должен показывать переход:

`problem -> structure -> workflow -> outcome`

а не просто последовательность "вот еще один prompt".

Четвертая: семинар должен оставлять у клиента не только знания, но и диагностический результат: какие use cases у них уже видны, где основные barriers и какой следующий шаг внедрения реалистичен.

### C. Learning Objectives
Teaching model должен обеспечивать минимум пять результатов обучения.

#### 1. Correct Mental Model
Участник должен понять:
- что LLM не знает корпоративный контекст автоматически;
- почему свободный чат дает нестабильный результат;
- почему плохой output часто связан не с моделью, а с постановкой задачи.

#### 2. Task Structuring Skill
Участник должен научиться различать:
- вопрос;
- задачу;
- структуру;
- данные;
- документ;
- workflow step.

Это один из главных переходов от beginner usage к usable office practice.

#### 3. Structured Output Awareness
Участник должен понять ценность:
- `JSON`;
- `CSV`;
- field-based outputs;
- schema-guided generation;
- data-before-document logic.

Даже если аудитория не техническая, эта часть критична для снятия document-vs-data confusion.

#### 4. Workflow-Based Usage
Участник должен увидеть, что зрелое использование LLM выглядит не как длинный диалог, а как повторяемый процесс с context, generation, validation and handoff.

#### 5. Safe And Responsible Use
Участник должен унести базовую рамку:
- где нужен human review;
- какие данные рискованно загружать;
- что делать при missing information;
- почему уверенный текст не равен надежному результату.

### D. Seminar Module Structure
Базовая teaching architecture может быть собрана из шести модулей.

#### Module 1. Reset The Mental Model
Цель модуля - снять магическое восприятие LLM. Здесь важно объяснить:
- что модель делает хорошо;
- что она делает плохо;
- почему "знающий чат" - плохая рабочая метафора.

Этот модуль опирается на `ARCH-007` и нужен, чтобы участники перестали оценивать качество только по гладкости текста.

#### Module 2. Explain The Office Mismatch
Здесь показывается разрыв между:
- смыслом;
- формой;
- шаблоном;
- регламентом;
- quality control.

Именно в этом модуле удобно объяснять, почему офис живет документами, а LLM надежнее работает со структурой и данными.

#### Module 3. Show Structured Outputs
Третий модуль переводит проблему в практику:
- `LLM -> data -> workflow -> document`;
- fields and schemas;
- `JSON/CSV` как operational literacy;
- template engine versus free text.

Это критический модуль, потому что без него семинар снова скатится в prompt-show.

#### Module 4. Show Workflow Integration
Здесь показывается, что LLM полезна как step inside process:
- context collection;
- generation;
- validation;
- downstream use.

Модуль нужен, чтобы связать отдельные prompts с офисной системой работы.

#### Module 5. Walk Through Implementation Scenarios
На этом этапе семинар переходит к типовым use cases:
- meeting processing;
- email drafting;
- spreadsheet automation;
- CRM data structuring;
- document preparation;
- knowledge support.

Именно здесь участники начинают узнавать свои собственные процессы.

#### Module 6. Diagnose Adoption Readiness
Финальный модуль нужен не столько для обучения, сколько для перевода семинара в B2B-follow-up. Здесь организация может увидеть:
- где у нее already visible use cases;
- какие barriers мешают adoption;
- какие сценарии подходят для pilot;
- какие части требуют governance or training first.

### E. Teaching Flow
Рекомендуемая логика подачи выглядит так:

`problem`

`wrong usage pattern`

`better model`

`implementation scenarios`

`adoption implications`

`diagnostic next step`

Эта последовательность важна. Если начать сразу с scenarios, аудитория увидит набор разрозненных кейсов. Если начать только с theory, потеряется практический смысл. Если закончить без diagnostic handoff, семинар даст знания, но не приведет к следующему B2B-step.

Правильный seminar flow должен оставлять у участника ощущение:
- я понял, почему раньше результат был слабым;
- я увидел более надежную модель использования;
- я могу представить несколько сценариев для своей работы;
- я понимаю, что нам как организации делать дальше.

### F. Teaching Methods
Формат обучения внутри семинара должен быть pragmatic-first.

#### 1. Contrast-Based Explanation
Полезно показывать не только "как правильно", но и:
- типичный плохой запрос;
- типичный плохой результат;
- почему он ломается;
- как та же задача выглядит в structured or workflow-based form.

Это хорошо работает для снятия negative UX illusions.

#### 2. Scenario-Centered Teaching
Вместо объяснения "возможностей модели" стоит строить подачу вокруг конкретных офисных задач. Это повышает узнавание и помогает участникам быстро переводить материал на свою среду.

#### 3. Layered Teaching
Материал подается слоями:
- сначала mental model;
- затем output logic;
- затем workflow;
- затем implementation scenario;
- затем adoption implication.

Такой порядок снижает cognitive overload.

#### 4. Diagnostic Questions
Семинар должен включать вопросы, которые помогают организации увидеть себя:
- где вы уже используете AI стихийно;
- какие документы и процессы самые повторяемые;
- где больше всего copy-paste and manual cleanup;
- какие сценарии требуют review by default.

Это делает семинар одновременно образовательным и квалификационным инструментом.

### G. Relationship With B2B Funnel
Согласно `NORTH_STAR`, семинар - не конечный продукт, а вход в корпоративный диалог. Поэтому teaching model должен быть спроектирован так, чтобы после семинара возникал не абстрактный интерес, а понятный next step.

Рабочая логика может быть такой:
- семинар выявляет problem patterns;
- seminar discussion проявляет scenarios with demand;
- diagnostic layer показывает readiness and barriers;
- follow-up conversation переводит это в pilot, workshop or implementation scope.

Отсюда следует важное ограничение: seminar teaching model не должен перегружать аудиторию академической полнотой. Его цель - не исчерпать тему, а создать прикладное понимание и открыть путь к следующему шагу.

### H. Implementation Guidelines
Для использования teaching model полезны несколько правил.

Первое: не начинать семинар с технологической эйфории. Лучше начинать с узнаваемой боли и failure patterns.

Второе: не строить подачу вокруг "лучших промптов". Промпты должны быть встроены в общую модель задачи, данных и workflow.

Третье: держать structured outputs в центре прикладной части. Именно они отделяют методологию внедрения от поверхностного chat usage.

Четвертое: использовать implementation scenarios как зеркало для аудитории, а не как абстрактный каталог кейсов.

Пятое: заканчивать семинар диагностическим и operational вопросом: какие 1-3 сценария реалистично взять в первую волну.

Шестое: сохранять B2B alignment. Teaching model должен усиливать доверие к методологии внедрения, а не превращаться в нейтральную "лекцию про AI".

## Acceptance / Validation
Документ достаточен, если:

1. Читается как teaching framework для seminar format, а не как учебная программа или sales text.
2. Согласован с `NORTH_STAR` и не конфликтует с B2B-entry logic проекта.
3. Связывает problem, playbook, implementation scenarios и prompt-system layer в одну teaching architecture.
4. Остается в границах `LLM usage in office work`.
5. Дает основу для будущих seminar materials without exploding the domain.

## Related
- docs/ARCHITECTURE/NORTH_STAR.md
- docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/INDEX.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-011.ai.office-work-adoption-playbook.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-012.ai.office-work-implementation-scenarios.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-013.ai.office-work-adaptive-prompting-systems.v0.1.md

## Open Questions / TODO
1. Нужен ли следующим шагом отдельный seminar-specific document про diagnostic flow after the session.
2. Какие 1-3 scenarios should be mandatory in every short-format seminar regardless of industry.
3. Где проходит граница между seminar teaching model и implementation workshop model.
