---
id: ARCH-009.ai.office-work-workflow-integration
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
  - docs/seminar/LLM_OFFICE_WORK/ARCH-004.ai.office-work-taxonomy.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-006.ai.office-work-research-directions.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-008.ai.office-work-structured-outputs.v0.1.md
tags:
  - architecture
  - practice-note
  - workflow
  - integration
  - llm
  - office-work
---

# Office Workflow Integration

## Purpose / Scope
Этот документ фиксирует, как LLM должна встраиваться в реальные офисные workflow и бизнес-процессы. Его задача: показать, что LLM не должна использоваться как случайный чат-инструмент, а должна быть включена в повторяемый процесс с понятными входами, выходами и проверками.

Главная идея:
- LLM является шагом процесса;
- structured output является транспортным слоем;
- workflow связывает генерацию, проверку и интеграцию в рабочую систему.

Документ не является tutorial, runbook или PRD. Это архитектурный practice note уровня процесса.

## Context
В domain framework уже зафиксированы две ключевые вещи. `ARCH-007` показал, что негативный UX часто возникает из copy-paste workflow, poor task formulation, template mismatch и отсутствия quality control. `ARCH-008` зафиксировал, что LLM должна генерировать structured data, а не финальный документ.

Текущий документ продолжает эту линию и отвечает на следующий вопрос: как превратить structured outputs из локальной практики в рабочий офисный процесс. Фокус здесь не на самом формате данных, а на контуре, внутри которого LLM приносит повторяемую пользу.

## Main Section

### A. Problem Recap
Когда LLM используется как изолированный чат, в офисной среде быстро проявляются типовые проблемы:
- copy-paste workflow вместо автоматизации;
- poor task formulation вместо явной постановки задачи;
- template mismatch на выходе;
- отсутствие повторяемости;
- отсутствие интеграции с системами и документными контурами.

Даже structured outputs сами по себе не решают проблему, если они остаются просто результатом в окне чата. Польза появляется тогда, когда генерация становится частью управляемого workflow.

### B. Workflow Paradigm
Базовая модель выглядит так:

`task`

`context collection`

`prompt construction`

`LLM generation`

`structured output`

`validation`

`document / record / task`

Ключевой смысл этой модели: LLM не является самостоятельным инструментом работы, а выполняет определенную роль внутри процесса. Это меняет способ мышления:
- не "спросить у чата и посмотреть, что получится";
- а "встроить генерацию в шаг, где есть входы, правила и следующий потребитель результата".

### C. Workflow Components

#### 1. Task Definition
Любой workflow начинается с определения задачи. Офисная задача должна быть названа не общими словами, а как конкретная рабочая операция.

Типовые примеры:
- подготовить отчет;
- сформировать письмо;
- обработать список данных;
- разобрать transcript встречи;
- подготовить CRM summary.

Хорошо определенная задача сразу задает ожидаемый тип результата и следующий шаг процесса.

#### 2. Context Collection
Следующий слой - сбор контекста. В офисной работе контекст обычно включает:
- исходные данные;
- шаблон или тип артефакта;
- ограничения;
- аудиторию;
- правила допустимого вывода.

Без этого этапа LLM получает слишком абстрактную задачу и начинает компенсировать нехватку информации вероятным текстом. Workflow-подход делает сбор контекста явной частью процесса, а не скрытым ожиданием пользователя.

#### 3. Prompt Construction
После сбора контекста формируется промпт. На этом уровне возможны:
- prompt template;
- adaptive prompt;
- prompt builder;
- автоматическая сборка prompt из полей формы.

Важно не то, насколько "красивый" промпт получается, а то, насколько он стабильно выражает задачу, контекст и ожидаемую структуру выхода.

#### 4. LLM Generation
Генерация остается отдельным шагом, но ее роль меняется. Модель не должна сразу производить финальный документ. Предпочтительный выход:

`structured output`

Это может быть `JSON`, `CSV`, `XML`, структурированный summary, классифицированный список полей или другой машиночитаемый результат.

#### 5. Validation
После генерации нужен этап проверки. Валидация должна покрывать:
- формат;
- структуру;
- обязательные поля;
- допустимые значения;
- ограничения задачи.

В зависимости от риска она может быть:
- автоматической;
- rule-based;
- human-in-the-loop;
- комбинированной.

Без validation workflow быстро скатывается обратно в красивый, но ненадежный чат.

#### 6. Integration
Только после проверки результат передается в конечный контур:
- документ;
- CRM;
- таблицу;
- task system;
- workflow system.

Здесь и проявляется отличие workflow integration от chat-first usage: результат не остается "ответом", а становится входом для следующего шага бизнеса.

### D. Workflow Patterns

#### Pattern 1. Document Assembly

`input data`

`LLM -> JSON`

`template engine`

`Word / PDF`

Этот паттерн полезен там, где документ имеет строгую форму. Модель отвечает за смысловые поля, а template engine - за оформление.

#### Pattern 2. Spreadsheet Automation

`LLM -> CSV`

`Excel`

`analysis`

Это хороший контур для списков, классификаций, summary tables и подготовки данных к аналитике.

#### Pattern 3. CRM Data Entry

`LLM -> JSON`

`CRM record`

Вместо длинного текстового summary workflow передает по полям: клиент, проблема, стадия, приоритет, next action.

#### Pattern 4. Meeting Processing

`transcript`

`LLM -> structured summary`

`task system`

Этот паттерн переводит встречу в список действий, решений и follow-up элементов, а не просто в красивое резюме для чтения.

### E. Benefits Of Workflow Integration
Workflow-подход дает несколько практических преимуществ.

Первое: повторяемость. Один и тот же сценарий можно запускать снова без полного переизобретения процесса.

Второе: контроль качества. Validation и human-in-the-loop ставятся в явные точки, а не остаются на совести пользователя.

Третье: интеграция. Structured outputs и downstream step позволяют встроить результат в реальные бизнес-системы.

Четвертое: автоматизация. Уменьшается объем ручного copy-paste и пост-обработки.

Пятое: снижение галлюцинаций как скрытой проблемы. Ошибку легче заметить в structured step и validation layer, чем в длинном свободном тексте.

Шестое: управление формой. Итоговый документ или запись собирается системно, а не случайно.

### F. Relationship With Structured Outputs
`ARCH-008` зафиксировал, что structured outputs являются базовой практикой. Этот документ уточняет их роль:

structured outputs - это транспортный слой workflow.

Без workflow они остаются просто более аккуратным видом ответа. Внутри workflow они становятся связующим элементом между LLM и бизнес-системой, между генерацией смысла и операционным действием.

### G. Relationship With Negative UX
Workflow-подход отвечает на несколько проблем из `ARCH-007`.

Он снижает:
- copy-paste workflow, потому что результат двигается по процессу, а не вручную между окнами;
- template mismatch, потому что сборка документа выносится в отдельный шаг;
- poor task formulation, потому что задача и контекст формализуются до генерации;
- lack of quality control, потому что validation становится обязательным этапом.

Важно, что workflow integration не отменяет роль человека. Она помогает поставить человека в правильную точку процесса, а не оставлять его в конце с хаотичным текстом.

### H. Office Automation Stack
Рабочий стек можно описать так:

`LLM`

`structured data`

`automation tool`

`business system`

`document`

Не каждый сценарий требует все слои сразу, но логика остается одной: модель производит не финальную "магическую" ценность, а управляемый промежуточный результат, который затем проходит через операционный контур.

## Acceptance / Validation
Документ достаточен, если:

1. Описывает workflow как процессный контур, а не как набор инструментов.
2. Остается в границах `LLM usage in office work`.
3. Не дублирует `ARCH-007` и `ARCH-008`, а связывает problem note и structured outputs в общий process layer.
4. Показывает, как LLM становится шагом повторяемого процесса.
5. Дает основу для следующих solution-side документов.

## Related
- docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/INDEX.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-004.ai.office-work-taxonomy.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-006.ai.office-work-research-directions.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-008.ai.office-work-structured-outputs.v0.1.md

## Open Questions / TODO
1. Какие классы workflow лучше всего подходят для первого внедрения: документы, таблицы, CRM или сценарии обработки встреч.
2. Где проходит практическая граница между automation и human-in-the-loop в офисных сценариях разного риска.
3. Нужен ли следующий документ про adaptive prompting до или после office AI adoption playbook.
