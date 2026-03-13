---
id: ARCH-006.ai.office-work-research-directions
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
tags:
  - architecture
  - research
  - llm
  - office-work
---

# LLM Office Work Research Directions

## Purpose / Scope
Этот документ фиксирует направления следующего углубления knowledge-ветки. Его задача: показать, какие исследовательские линии допустимы внутри текущего scope и какие из них логично разворачивать следующими.

## Context
Исследовательские направления опираются на `ARCH-003` и `ARCH-004`. Они не являются отдельными длинными исследованиями, а задают future slots для controlled growth knowledge domain.

## Main Section

### 1. Research Direction Model
Каждое направление описывается через:
- фокус исследования;
- практический вопрос;
- ожидаемый тип следующего документа;
- приоритет для ближайшей очереди.

### 2. Research Directions
| Direction | Focus | Practical Question | Next Document Type | Priority |
|---|---|---|---|---|
| Negative user experience | Где и почему пользователь теряет доверие к LLM | Какие failure patterns повторяются в офисных сценариях чаще всего | Problem taxonomy note | High |
| Corporate AI adoption | Какие барьеры мешают внедрению в компании | Что мешает переходу от энтузиазма к регулярной практике | Research note / framework | Medium |
| Adaptive prompting systems | Как строить динамические prompt-шаблоны | Какие входы нужны, чтобы шаблон не вырождался | Solution note | High |
| Prompt libraries | Как проектировать библиотеки сценариев без деградации качества | Где проходит граница между reuse и шаблонным вредом | Solution note | Medium |
| Structured output usage | Как использовать JSON/CSV/XML в офисной среде | Какие типы задач лучше переводить в structured output first | Practice note | High |
| Office workflow integration | Как встраивать LLM в повторяемые процессы | Где заканчивается чат и начинается workflow | Workflow note | High |
| AI literacy training | Как обучать не-технических сотрудников | Какие концепты обязательны до практики prompt usage | Teaching note | Medium |
| Governance models | Какие правила safe usage достаточно легкие и рабочие | Как не превратить governance в pure restriction layer | Governance note | Medium |
| Document workflows vs data workflows | Где разумнее разделять данные и форму | Когда лучше генерировать данные, а когда черновик документа | Concept note | High |
| Quality control and human-in-the-loop | Как проектировать review и validation | Какие checkpoints дают доверие без лишней бюрократии | Quality note | High |

### 3. Near-Term Priority Set
Ближайший минимальный порядок роста:

1. Negative user experience.
2. Structured output usage.
3. Office workflow integration.
4. Adaptive prompting systems.

Причина приоритета:
- эти направления ближе всего к прикладной ценности для seminar methodology;
- они напрямую связаны с негативным пользовательским опытом;
- они не требуют ухода в platform-first architecture.

### 4. Deferred Directions
Отложить до появления более плотного корпуса практики:

1. Corporate AI adoption как отдельную организационную линию.
2. Governance models beyond baseline red lines.
3. Развернутые teaching frameworks по AI literacy.

## Acceptance / Validation
Документ достаточен, если:

1. Он перечисляет допустимые research-направления внутри текущего scope.
2. Он помогает понять, какой документ логично создавать следующим.
3. Он не открывает ветки вне границ домена.

## Related
- docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/INDEX.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-004.ai.office-work-taxonomy.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md

## Open Questions / TODO
1. Какой следующий документ даст наибольшую практическую пользу: negative UX taxonomy или structured outputs note.
2. Следует ли отделять seminar teaching research от enterprise workflow research после появления первых прикладных материалов.
