---
id: ARCH-015.ai.office-work-capability-model
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
  - docs/seminar/LLM_OFFICE_WORK/ARCH-011.ai.office-work-adoption-playbook.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-012.ai.office-work-implementation-scenarios.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-013.ai.office-work-adaptive-prompting-systems.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-014.ai.office-work-seminar-teaching-model.v0.1.md
tags:
  - architecture
  - capability-model
  - maturity
  - llm
  - office-work
---

# Office AI Capability Model

## Purpose / Scope
Этот документ фиксирует capability model для использования LLM в офисной работе. Его задача: дать компактную maturity framework, по которой можно оценивать текущий уровень организации, видеть основные gaps и выбирать реалистичный следующий шаг внедрения.

Документ не является audit rubric, vendor scorecard или formal consulting deliverable. Это framework-документ, который нужен для:
- диагностики уровня зрелости после seminar or discovery conversation;
- связи между training, workflow adoption и governance;
- выбора следующего внедренческого шага без расползания в абстрактную трансформационную программу.

Границы:
- только `LLM usage in office work`;
- только capability and maturity framing;
- без детальной организационной реорганизации и enterprise transformation theory.

## Context
Текущий domain stack уже описывает проблему, solution patterns, workflow integration, implementation scenarios, adaptive prompting и seminar teaching model. Но после этого остается практический вопрос: как понять, где находится конкретная организация и чего ей не хватает для перехода на следующий уровень.

`ARCH-011` описывает adoption path. `ARCH-014` показывает, как семинар может привести к диагностическому next step. `NORTH_STAR` фиксирует, что семинар должен быть B2B-entry point в корпоративные внедрения. Следовательно, capability model нужен как промежуточный инструмент между seminar insight и implementation scope.

Он помогает не отвечать на вопрос "использует ли компания AI вообще", а отвечать на более полезный вопрос: на каком уровне у компании сейчас находятся задачи, люди, prompts, workflows, governance и integration.

## Main Section

### A. Capability Problem
Организации редко находятся в одном простом состоянии вроде "AI есть" или "AI нет". На практике у них почти всегда смешанная картина:
- отдельные сотрудники уже активно используют чат;
- в нескольких командах есть удачные сценарии;
- structured outputs почти не используются;
- governance либо слабая, либо слишком запретительная;
- руководство хочет value, но не видит repeatable model.

Если не иметь capability frame, возникают два типовых перекоса.

Первый перекос: переоценка зрелости. Компания видит несколько power users и делает вывод, что adoption уже состоялось, хотя на уровне массовой практики еще нет ни repeatability, ни workflow integration.

Второй перекос: недооценка зрелости. Компания видит хаотичный early-stage usage и считает, что "ничего не работает", хотя на самом деле уже есть сценарии, из которых можно собрать pilot.

Capability model нужен, чтобы упростить разговор до понятных слоев зрелости и не спорить о впечатлениях.

### B. Core Principle
Ключевой принцип capability model:

`maturity = repeatable value under controlled conditions`

Для этого недостаточно, чтобы кто-то умел хорошо писать промпты. Зрелость возникает только тогда, когда несколько capability dimensions начинают работать вместе:
- люди понимают, как использовать LLM;
- задачи выбраны правильно;
- outputs имеют управляемую форму;
- workflow не обрывается на чате;
- review and safety понятны;
- value можно воспроизводить не одним энтузиастом.

Из этого следует важный вывод: capability model должен смотреть не только на technology usage, но и на operational discipline вокруг нее.

### C. Capability Dimensions
Для текущего домена достаточно шести измерений.

#### 1. Mental Model And Literacy
Что оценивается:
- понимают ли сотрудники ограничения LLM;
- различают ли question, task, data, document and workflow;
- умеют ли формулировать задачу beyond chat intent.

Это базовое измерение. Без него все остальные capability layers быстро разваливаются.

#### 2. Use Case Selection
Что оценивается:
- выбраны ли repeatable office scenarios;
- связаны ли сценарии с реальной работой;
- есть ли фокус на narrow, high-frequency tasks;
- различаются ли productivity use cases и process use cases.

Многие организации срываются именно здесь: они берут либо слишком общие, либо слишком амбициозные use cases.

#### 3. Output Discipline
Что оценивается:
- используются ли structured outputs;
- есть ли schemas, field logic or templates;
- понимается ли разница между draft, structured payload and final artifact.

Это измерение отделяет зрелое использование от "красивого текста в чате".

#### 4. Workflow Integration
Что оценивается:
- встроен ли результат в downstream process;
- есть ли context collection, validation and handoff;
- уменьшается ли copy-paste and manual cleanup.

Здесь становится видно, осталась ли LLM личным помощником или стала частью офисного workflow.

#### 5. Governance And Review
Что оценивается:
- понимают ли сотрудники red lines;
- есть ли human-in-the-loop для risk-heavy tasks;
- различаются ли safe and unsafe usage zones;
- не загоняет ли governance usage в shadow mode.

Это измерение критично для перехода от стихийного adoption к organizational trust.

#### 6. Scale And Transferability
Что оценивается:
- можно ли повторить практику в нескольких ролях;
- завязана ли value на отдельных power users;
- есть ли champions, templates, common patterns;
- способен ли pilot перейти в broader rollout.

Именно здесь capability model начинает работать как инструмент B2B-diagnostic conversation.

### D. Capability Levels
Для домена достаточно пяти уровней зрелости.

#### Level 0. No Working Capability
Признаки:
- AI почти не используется или используется эпизодически;
- сотрудники не понимают limits and safe usage;
- value не обнаруживается.

Главный следующий шаг:
- базовый seminar and mental-model reset.

#### Level 1. Chat-First Experimentation
Признаки:
- есть личное использование чата;
- value локальна и нестабильна;
- outputs mostly free-text;
- success зависит от отдельных энтузиастов.

Главный следующий шаг:
- стабилизировать 2-3 frequent scenarios and basic prompt discipline.

#### Level 2. Structured Productivity
Признаки:
- есть repeatable prompts;
- появляются templates and structured outputs;
- отдельные задачи решаются predictably;
- still weak process integration.

Главный следующий шаг:
- переводить лучшие scenarios в workflow shape.

#### Level 3. Workflow Capability
Признаки:
- есть context, generation, validation and handoff;
- несколько scenarios встроены в реальные процессы;
- value заметна в time saving, consistency and manual-work reduction;
- review model уже описана.

Главный следующий шаг:
- расширять governance, champions and cross-team reproducibility.

#### Level 4. Organizational Capability
Признаки:
- capability не зависит от единичных power users;
- есть repeatable patterns across roles;
- training, governance and scenario portfolio связаны;
- organization может масштабировать and prioritize use cases осознанно.

Главный следующий шаг:
- portfolio management and capability refinement, а не просто "больше AI".

### E. Reading The Model
Capability model полезно читать не как линейную шкалу "все или ничего", а как карту асимметрий.

Организация может выглядеть так:
- `Level 2` по literacy;
- `Level 1` по governance;
- `Level 3` по одному CRM workflow;
- `Level 0` по transferability.

Это нормальная картина. Ценность модели в том, что она помогает видеть weakest link.

Если literacy низкая, то workflow pilot будет хрупким.

Если workflows есть, но governance слабая, рост пойдет в shadow usage.

Если power users сильные, но transferability низкая, то компания будет постоянно путать единичные успехи с масштабируемой capability.

### F. Relationship With Seminar And Playbook
`ARCH-014` описывает, как seminar помогает выявить barriers and readiness. Capability model нужен как следующий шаг после teaching layer.

Практическая связка выглядит так:
- seminar дает shared mental model;
- diagnostic questions выявляют current state;
- capability model помогает назвать этот state;
- playbook предлагает realistic next move.

`ARCH-011` задает adoption path. Capability model уточняет, на каком именно отрезке этого path находится конкретная организация.

Таким образом, capability model полезен не только для оценки, но и для scope framing:
- нужен ли basic literacy intervention;
- пора ли строить pilot;
- готовы ли workflows к structured outputs;
- где governance является blocker.

### G. Diagnostic Use
Для практического использования capability model достаточно нескольких типовых вопросов.

По literacy:
- как сотрудники сейчас формулируют задачи для LLM;
- различают ли они draft, data and final artifact.

По use cases:
- какие 3-5 tasks уже реально повторяются;
- где больше всего ручной рутины and cleanup.

По output discipline:
- есть ли structured outputs or only free text;
- можно ли проверять output field-by-field.

По workflow:
- что происходит после ответа модели;
- остается ли все в чате или уходит в document, CRM, table or task system.

По governance:
- что сотрудникам запрещено;
- знают ли они эти правила;
- где нужен mandatory review.

По scale:
- кто реально использует AI;
- могут ли другие команды повторить same pattern.

Этого достаточно для легкого capability reading без превращения разговора в тяжелый enterprise audit.

### H. Implementation Guidelines
Для применения capability model полезны несколько правил.

Первое: не использовать модель как инструмент формальной оценки ради оценки. Она нужна для выбора следующего realistic step.

Второе: не пытаться насильно поставить организацию на один "общий уровень". Лучше видеть capability by dimensions.

Третье: связывать каждый diagnosed gap с действием:
- literacy gap -> teaching intervention;
- output gap -> structured output practice;
- workflow gap -> scenario design;
- governance gap -> safe usage framing.

Четвертое: не путать capability with enthusiasm. Высокий интерес к AI не равен высокой зрелости.

Пятое: использовать модель как bridge between seminar and implementation. Это особенно важно для B2B-flow, где после обучения нужен понятный следующий разговор.

## Acceptance / Validation
Документ достаточен, если:

1. Читается как capability and maturity framework, а не как audit bureaucracy.
2. Содержит clear capability dimensions and levels.
3. Связывает seminar, playbook and implementation logic в единый diagnostic frame.
4. Остается в границах `LLM usage in office work`.
5. Поддерживает B2B-entry logic из `NORTH_STAR`.

## Related
- docs/ARCHITECTURE/NORTH_STAR.md
- docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/INDEX.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-011.ai.office-work-adoption-playbook.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-012.ai.office-work-implementation-scenarios.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-013.ai.office-work-adaptive-prompting-systems.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-014.ai.office-work-seminar-teaching-model.v0.1.md

## Open Questions / TODO
1. Нужен ли следующим шагом отдельный lightweight diagnostic worksheet on top of this capability model.
2. Должны ли capability dimensions later split by role groups: managers, office staff, champions, operators.
3. Где проходит граница между capability model and implementation readiness assessment.
