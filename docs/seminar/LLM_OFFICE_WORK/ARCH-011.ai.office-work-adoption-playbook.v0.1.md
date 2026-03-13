---
id: ARCH-011.ai.office-work-adoption-playbook
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
  - docs/seminar/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-008.ai.office-work-structured-outputs.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-009.ai.office-work-workflow-integration.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-010.ai.office-work-deep-research.v0.1.md
tags:
  - architecture
  - playbook
  - adoption
  - llm
  - office-work
---

# Office AI Adoption Playbook

## Purpose / Scope
Этот документ фиксирует практическую методологию внедрения LLM в офисной работе. Его задача: перевести доменную рамку и deep research в управляемый adoption framework, который помогает организациям уходить от случайного chat-first использования к повторяемым и безопасным рабочим сценариям.

Документ не является tutorial, runbook или PRD. Это framework-документ для проектирования корпоративного внедрения:
- как выбирать уровень зрелости использования;
- как двигаться по стадиям adoption;
- какие практики, training и governance нужны на каждом этапе;
- какие метрики показывают, что внедрение дает реальную пользу, а не просто активность.

Границы:
- только `LLM usage in office work`;
- без vendor comparison и product recommendations;
- без низкоуровневой технической реализации платформ.

## Context
`ARCH-007` зафиксировал, почему офисные пользователи получают плохой UX: неправильная ментальная модель, poor task formulation, template mismatch, copy-paste workflow, слабый quality control и governance gaps. `ARCH-008` показал, что более надежная практика строится через structured outputs. `ARCH-009` перевел это в process layer: LLM должна быть шагом workflow, а не отдельным чат-инструментом. `ARCH-010` добавил внешний evidence layer с реальными use cases, barriers, best practices и training patterns.

Текущий документ нужен как следующий слой домена: не еще одна taxonomy и не еще один research note, а рабочая рамка внедрения. Он отвечает на вопрос, как превратить разрозненные знания о проблемах, structured outputs и workflow integration в понятный adoption path для офисной среды.

## Main Section

### A. Adoption Problem
Главная проблема внедрения LLM в офисе состоит в том, что организация часто покупает доступ к модели раньше, чем формирует способ ее использования. Из-за этого возникают типовые barriers:
- incorrect mental model: пользователи ждут "умного эксперта", а не вероятностный генератор;
- chat-first usage: работа остается в окне диалога и не входит в процессы;
- poor task formulation: модель получает намерение вместо задачи;
- hallucination concerns: единичные ошибки быстро подрывают доверие;
- lack of workflow integration: output не становится частью следующего шага;
- governance gaps: сотрудники не понимают, что можно загружать, кто проверяет и какие red lines действуют.

Deep research подтверждает, что эти барьеры не являются краевыми случаями. Они повторяются и в enterprise reports, и в community evidence, и в практических workflow кейсах. Следовательно, внедрение LLM нельзя сводить к обучению "нескольким промптам" или к раздаче лицензий. Нужна методология, которая связывает поведение пользователя, структуру задач, тип результата и организационный контур.

### B. Core Adoption Principle
Ключевой принцип playbook:

`LLM should augment workflows, not replace them.`

Практическая модель выглядит так:

`task`

`context`

`LLM`

`structured output`

`workflow`

`business system`

Из этой модели следуют четыре базовых правила.

Первое: LLM не должна восприниматься как универсальный исполнитель работы. Ее роль ограничена генерацией черновика, структуры, полей, классификации и промежуточного содержательного слоя.

Второе: контекст должен быть собран до генерации. Чем больше задача зависит от аудитории, шаблона, данных и ограничений, тем меньше можно опираться на свободный диалог.

Третье: structured output предпочтительнее свободного текста там, где результат должен проверяться, интегрироваться или переиспользоваться.

Четвертое: ценность возникает не в момент ответа модели, а в момент прохождения результата через workflow и downstream system.

### C. Adoption Layers
Playbook предлагает рассматривать внедрение LLM как движение по четырем слоям.

#### Layer 1. Individual Productivity
На первом уровне LLM помогает отдельному сотруднику повысить личную производительность. Типовые сценарии:
- writing assistance;
- email drafting;
- summarization;
- idea generation;
- first-draft support.

Это естественная входная точка, потому что она дает быстрый и низкопороговый старт. Но этот слой нестабилен: польза зависит от личного навыка, а результаты трудно стандартизировать. Здесь особенно заметны barriers из `ARCH-007`: неверная ментальная модель, poor task formulation и переоценка качества свободного текста.

#### Layer 2. Structured Tasks
На втором уровне организация начинает переводить отдельные задачи в более стабильный формат. Появляются:
- repeatable prompts;
- prompt templates;
- structured outputs;
- fixed schemas;
- document or data templates.

Это переход от "спросить что-нибудь у чата" к "решить типовую задачу по понятной форме". На этом уровне резко уменьшаются template mismatch и copy-paste хаос, потому что задача и результат начинают описываться явнее.

#### Layer 3. Workflow Integration
На третьем уровне LLM становится частью процессов:
- document pipelines;
- CRM processing;
- spreadsheet workflows;
- meeting processing;
- intake and triage scenarios.

Здесь LLM уже не отдельный инструмент, а один из шагов в последовательности: task definition, context collection, generation, validation, integration. Это тот слой, на котором организация начинает получать повторяемую и измеримую ценность.

#### Layer 4. Organizational Integration
Четвертый уровень добавляет организационный контур:
- governance;
- training;
- safe usage policies;
- AI champions;
- adoption metrics;
- role ownership.

Без этого слоя даже хорошие workflow остаются локальными островками. Organizational integration делает AI не личным хаком отдельных сотрудников, а частью управляемой рабочей среды.

### D. Adoption Stages
Слои зрелости полезно переводить в стадии внедрения.

#### Stage 1. Exploration
Сотрудники экспериментируют с LLM индивидуально. Организация наблюдает за ранними use cases, но процесс еще не стандартизирован.

Цель этапа:
- выявить естественные сценарии спроса;
- увидеть реальные pain points;
- не мешать learning-by-doing, но и не оставлять его совсем без рамки.

Риск этапа:
- chat-first usage закрепляется как норма;
- появляются shadow AI и неконтролируемая загрузка данных;
- early disappointment превращается в общий скепсис.

#### Stage 2. Structured Usage
Организация переводит наиболее частые сценарии в repeatable usage. Появляются:
- prompt templates;
- simple task framing;
- structured outputs;
- базовые usage guidelines.

На этом этапе важно не охватить все, а стабилизировать 3-5 сценариев, которые уже реально используются. Ценность stage 2 в том, что он превращает хаотичное экспериментирование в первые repeatable patterns.

#### Stage 3. Workflow Integration
Следующий шаг - встроить устойчивые сценарии в рабочие процессы. Здесь появляются:
- context forms;
- validation steps;
- template engines;
- передача результата в CRM, таблицу, документный контур или task system.

Именно на этом этапе AI начинает уменьшать ручную работу, а не только помогать с первым черновиком. Если stage 2 отвечает на вопрос "как получить более предсказуемый output", то stage 3 отвечает на вопрос "как этот output начинает реально работать".

#### Stage 4. Organizational Adoption
На последнем этапе формируются:
- formal governance;
- training model;
- champion network;
- adoption dashboards;
- policy and review routines.

Это не означает тотальную автоматизацию. Напротив, зрелая организационная adoption фиксирует, где LLM помогает, где нужен human-in-the-loop и где automation вообще не должна идти дальше.

### E. Practical Adoption Patterns
Для первого внедрения устойчивее всего работают сценарии, которые уже подтверждены доменом и deep research.

#### 1. Meeting Summarization
Хороший начальный сценарий, если итогом является не просто summary, а structured follow-up:
- ключевые решения;
- action items;
- owners;
- deadlines.

Это быстро демонстрирует пользу, но требует проверки полноты и корректности.

#### 2. Email Drafting
Полезен как стартовый productivity pattern, особенно для:
- ответа клиенту;
- follow-up письма;
- внутреннего уведомления;
- переписывания tone and clarity.

Но этот сценарий не должен быть единственной формой adoption, иначе организация застревает на personal productivity layer.

#### 3. Document Preparation
Подходит для случаев, где есть повторяемая форма:
- memo;
- brief;
- proposal section;
- report block.

Наиболее устойчивый вариант: LLM формирует поля и блоки, а шаблон собирает финальный документ.

#### 4. Spreadsheet Analysis And Classification
Сценарии работы со списками, реестрами и таблицами особенно полезны, когда LLM возвращает `CSV` или схожую структурированную форму:
- классификация строк;
- нормализация описаний;
- summary columns;
- первичная аналитическая подготовка.

#### 5. CRM Data Structuring
Один из самых ценных сценариев для зрелого внедрения. Вместо длинного narrative summary LLM помогает собрать:
- client summary;
- problem statement;
- priority;
- next step;
- meeting recap fields.

Это хорошо ложится на логику `structured output -> workflow -> business system`.

### F. Training Model
Устойчивое adoption требует не только prompt tips, а минимальной образовательной модели. В playbook достаточно четырех обязательных блоков.

Первый блок - AI literacy. Сотрудник должен понимать, что LLM:
- не знает корпоративный контекст по умолчанию;
- может ошибаться уверенно;
- требует явной постановки задачи;
- не заменяет проверку в рисковых сценариях.

Второй блок - prompt literacy. Речь не о "магических фразах", а о навыке задавать:
- цель;
- аудиторию;
- ограничения;
- формат;
- критерии acceptable output.

Третий блок - structured data awareness. Пользователь должен различать:
- текст;
- данные;
- документ;
- шаблон.

И понимать, почему `JSON`, `CSV` и другие structured forms уменьшают хаос.

Четвертый блок - safe usage. Сотрудники должны знать:
- что нельзя загружать;
- какие данные чувствительны;
- когда нужен human review;
- какие инструменты одобрены организацией.

Практический принцип training model: учить нужно не "AI вообще", а конкретные сценарии работы. Наиболее полезны короткие scenario-based sessions, привязанные к реальным ролям и повторяемым задачам.

### G. Governance Model
Governance в этом playbook минималистична по форме, но обязательна по сути. Она должна включать:

#### 1. Data Policies
Явные правила по конфиденциальным данным, персональным данным, клиентским материалам и внутренним документам.

#### 2. Usage Guidelines
Короткие и прикладные правила:
- где LLM допустима;
- где output требует review;
- где использование запрещено или ограничено.

#### 3. Human-In-The-Loop Review
Обязательная проверка для сценариев, где ошибка дорога:
- клиентская коммуникация;
- регуляторные документы;
- официальная отчетность;
- sensitive internal decisions.

#### 4. AI Champions
Нужны внутренние носители практики, которые:
- помогают коллегам;
- собирают удачные сценарии;
- переводят личные hacks в repeatable patterns;
- служат мостом между пользователями и governance.

Governance не должна быть только запретительной. Ее задача - уменьшать хаос и shadow usage, а не делать adoption невозможной.

### H. Metrics For Adoption
Playbook предлагает смотреть не только на usage volume, но и на качество встраивания в процесс.

Минимальный набор метрик:
- usage frequency: как часто инструмент используется в реальных рабочих сценариях;
- task completion speed: сократилось ли время на типовую задачу;
- reduction of manual work: уменьшился ли объем copy-paste, переписывания и рутинной пост-обработки;
- workflow automation rate: какой процент сценариев проходит через structured and validated flow, а не через свободный чат;
- repeatability: можно ли воспроизвести сценарий разными сотрудниками;
- review burden: уменьшилась ли нагрузка на человека после stabilization workflow;
- adoption spread: usage остается у power users или переходит к массовым сотрудникам.

Неправильная метрика - просто считать число запросов к модели. Это показывает активность, но не говорит, встроилась ли LLM в реальную офисную работу.

### I. Relationship With Existing Documents
Этот playbook собирает вместе уже существующие слои домена.

`ARCH-007` дает problem frame: почему users fail and disengage.

`ARCH-008` дает solution discipline: structured outputs как более надежный слой результата.

`ARCH-009` дает process frame: workflow integration как базовую форму зрелого использования.

`ARCH-010` дает external evidence: реальные кейсы, barriers, best practices и training patterns.

Тем самым `ARCH-011` не заменяет эти документы, а превращает их в adoption methodology: как двигаться от personal experimentation к organizational integration без расползания хаоса.

## Acceptance / Validation
Документ достаточен, если:

1. Читается как framework document по внедрению, а не как tutorial, PRD или runbook.
2. Опирается на `ARCH-007`, `ARCH-008`, `ARCH-009` и `ARCH-010`.
3. Содержит adoption principle, layers, stages, practical patterns, training, governance и metrics.
4. Остается в границах `LLM usage in office work`.
5. Не дублирует workflow integration и structured outputs, а использует их как опорные слои.

## Related
- docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/INDEX.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-008.ai.office-work-structured-outputs.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-009.ai.office-work-workflow-integration.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-010.ai.office-work-deep-research.v0.1.md

## Open Questions / TODO
1. Какие 3-5 office workflows чаще всего стоит брать в первый adoption wave для B2B-семинаров.
2. Какая минимальная governance model дает эффект без избыточного friction для раннего внедрения.
3. Нужен ли следующим шагом отдельный документ `Office AI Implementation Scenarios` или сначала стоит оформить `Adaptive Prompting Systems`.
