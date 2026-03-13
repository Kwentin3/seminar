---
id: ARCH-008.ai.office-work-structured-outputs
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
tags:
  - architecture
  - practice-note
  - structured-outputs
  - llm
  - office-work
---

# Structured Outputs In Office Work

## Purpose / Scope
Этот документ фиксирует базовую практику интеграции LLM в офисную работу через структурированные данные. Его задача: показать, что в большинстве офисных сценариев LLM полезнее использовать как генератор данных и структуры, а не как генератор финального документа.

Основная идея документа:
- LLM генерирует смысл и структуру;
- structured data становится транспортным и проверяемым слоем;
- workflow и шаблон превращают данные в рабочий артефакт.

Документ не является tutorial, runbook или PRD. Это архитектурно-практический note о том, как уменьшить хаос и повысить предсказуемость в офисных сценариях.

## Context
В knowledge-domain framework уже зафиксировано, что негативный опыт возникает из попытки использовать LLM как генератор готовых корпоративных документов. `ARCH-007` показал типовые failure patterns: template mismatch, copy-paste workflow, poor task formulation, hallucinations и document vs data conflict.

Текущий документ переводит problem layer в solution layer. Он описывает практику, которая уменьшает зависимость от свободного текста и делает выход модели более пригодным для проверки, автоматизации и интеграции в офисные процессы.

## Main Section

### A. Problem Recap
Большая часть проблем офисного использования LLM возникает не из-за самого факта генерации текста, а из-за выбора неправильного целевого результата.

Когда пользователь просит у модели готовый документ, появляются типовые сбои:
- template mismatch: результат не совпадает с корпоративной формой;
- copy-paste workflow: ответ приходится переносить и чинить вручную;
- poor task formulation: неполная задача приводит к неуправляемому свободному тексту;
- hallucinations: недостоверные элементы растворяются внутри длинного ответа;
- document vs data conflict: офису нужен не просто текст, а формализованный артефакт.

Общий источник проблемы простой: LLM пытаются использовать как генератор документов, хотя в офисной среде ей надежнее поручать генерацию структуры и данных.

### B. Structured Output Paradigm
Ключевая парадигма выглядит так:

`LLM -> data -> workflow -> document`

Или в еще более короткой форме:

`LLM -> data`

`template -> document`

Это разделение ролей:

| Уровень | Роль |
|---|---|
| LLM | Генерирует смысл, поля, структуру, классификацию и черновые значения |
| Данные | Служат транспортным и проверяемым слоем |
| Шаблон | Оформляет результат в документ, письмо, карточку, запись или отчет |

Практический смысл этого разделения:
- модель не обязана идеально воспроизводить корпоративную форму;
- данные можно валидировать отдельно от финального представления;
- документ собирается downstream-инструментом, а не надеждой на "идеальный ответ в чате".

### C. Core Structured Formats

#### JSON
`JSON` является универсальным форматом для большинства structured output сценариев. Он подходит, когда результат нужно представить как набор полей, списков и вложенных блоков.

Пример:

```json
{
  "client": "Company A",
  "problem": "manual reporting",
  "solution": "automation",
  "benefits": ["time saving", "accuracy"]
}
```

Почему он полезен:
- легко читать и валидировать;
- удобно передавать в CRM, внутренние сервисы и automation tools;
- позволяет явно задать схему ожидаемого результата.

#### CSV
`CSV` подходит там, где результат по смыслу является таблицей. Это естественный формат для офисных задач, связанных со списками, классификацией строк, выгрузками и табличной аналитикой.

Типичные сценарии:
- Excel;
- Google Sheets;
- BI-системы;
- импорт и экспорт табличных данных.

Сильная сторона `CSV` в том, что пользователь сразу получает не абзацы текста, а строки и колонки, с которыми можно продолжать работу.

#### XML
`XML` полезен там, где корпоративные системы, интеграции или legacy-контуры уже ожидают формальную иерархическую разметку. Для everyday office usage он обычно менее удобен, чем `JSON`, но остается важным как формат машинно-обрабатываемого вывода.

Практический смысл `XML` в этом домене: показать, что LLM может выдавать не только текст, но и формализованный payload для downstream-систем.

### D. Structured Output Patterns

#### Pattern 1. Document Generation
Сценарий:

`LLM -> JSON`

`JSON -> Word template`

Здесь модель генерирует поля и содержательные блоки, а шаблон документа собирает финальную форму. Это снижает риск template mismatch и убирает иллюзию, что один чат-ответ должен сразу стать готовым документом.

#### Pattern 2. Spreadsheet Generation
Сценарий:

`LLM -> CSV`

`CSV -> Excel`

Этот паттерн полезен для классификаций, списков задач, реестров, табличных summary и подготовки данных для аналитики. Результат становится сразу пригодным для табличной работы, а не для ручного переписывания абзацев.

#### Pattern 3. CRM Integration
Сценарий:

`LLM -> JSON`

`JSON -> CRM record`

Вместо того чтобы писать длинный свободный summary, модель возвращает набор полей: клиент, проблема, приоритет, стадия, suggested next step. Это делает выход пригодным для карточки, а не только для чтения человеком.

#### Pattern 4. Workflow Automation
Сценарий:

`LLM -> structured data`

`automation tool -> document / task / record`

Здесь structured output становится промежуточным слоем между LLM и automation. Именно этот паттерн наиболее важен для офисной среды, потому что он превращает чат-ответ в часть повторяемого процесса.

### E. Advantages
Structured outputs дают пять ключевых преимуществ.

Первое: предсказуемость. Пользователь и система ожидают не произвольный текст, а фиксированную структуру.

Второе: проверяемость. Поля, колонки и схемы легче валидировать, чем длинные абзацы.

Третье: интеграция. `JSON`, `CSV` и `XML` можно передавать в системы, шаблоны и automation layers.

Четвертое: автоматизация. Structured output легче превратить в следующий шаг workflow без ручного copy-paste.

Пятое: контроль формата. Оформление перестает зависеть от того, насколько аккуратно модель "угадает" корпоративный стиль.

### F. Practical Prompt Patterns
Structured outputs требуют более явной постановки задачи. Базовые prompt patterns выглядят так:

`Return result strictly in JSON format using the following schema.`

`Output must be a CSV table with the following columns.`

`Return XML using the following tag structure.`

Но важен не только сам формат. Хороший prompt для structured output обычно также фиксирует:
- обязательные поля;
- допустимые значения;
- что делать при нехватке данных;
- что нельзя выдумывать;
- как помечать неизвестные значения.

То есть structured prompt дисциплинирует не только output format, но и само мышление о задаче.

### G. Implications for Office AI Adoption
Для офисного внедрения эта практика важна по трем причинам.

Во-первых, structured outputs уменьшают пространство для скрытых hallucinations. Ошибка в поле или колонке заметнее, чем ошибка, спрятанная в красивом абзаце.

Во-вторых, structured outputs упрощают workflow integration. Их легче вставить в CRM, таблицу, шаблон письма, отчетную форму или automation scenario.

В-третьих, structured outputs делают LLM более предсказуемой. Пользователь получает не "примерно подходящий текст", а более контролируемый и машиночитаемый результат.

### H. Relationship With Negative UX
Этот документ напрямую отвечает на часть проблем из `ARCH-007`.

Он помогает против:
- template mismatch, потому что шаблон документа отделяется от генерации данных;
- copy-paste workflow, потому что результат легче передать в следующий step процесса;
- poor task formulation, потому что схема и поля дисциплинируют постановку задачи;
- hallucinations, потому что structured output легче проверять;
- document vs data conflict, потому что данные становятся явным промежуточным слоем между LLM и документом.

Важно при этом понимать предел практики: structured outputs не решают все сами по себе. Они работают лучше всего вместе с human-in-the-loop, simple validation и workflow-based usage.

## Acceptance / Validation
Документ достаточен, если:

1. Объясняет structured outputs как практику, а не как tutorial по форматам.
2. Ясно показывает парадигму `LLM -> data -> workflow -> document`.
3. Остается в границах `LLM usage in office work`.
4. Не дублирует negative UX taxonomy, а отвечает на нее с solution-side.
5. Дает основу для следующих прикладных документов без расползания домена.

## Related
- docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/INDEX.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-004.ai.office-work-taxonomy.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-006.ai.office-work-research-directions.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md

## Open Questions / TODO
1. Какие structured formats наиболее полезны для разных классов офисных задач: документы, таблицы, CRM, внутренние формы.
2. Где лучше проходит граница между structured output и final artifact assembly в типовых корпоративных процессах.
3. Какой минимальный validation layer нужен, чтобы structured outputs стали устойчивой рабочей практикой.
