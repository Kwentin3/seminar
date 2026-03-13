---
id: REPORT-2026-03-13.cabinet.curator-pass
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/reports/2026-03-13/CABINET.lecturer-curation-status.report.md
  - docs/notes/NOTE-004.cabinet.material-status-and-curation.md
  - docs/notes/NOTE-005.cabinet.core-library-curation.md
  - docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
tags:
  - report
  - cabinet
  - curator-pass
  - lecturer
  - materials
---

# CABINET Curator Pass Report

## Executive Summary
1. Curator pass был направлен не на новые функции, а на повышение доверия к библиотеке как к рабочей опоре лектора.
2. Главная проблема до pass была в том, что cabinet уже умел читать материалы, но статусы и темы ещё не давали достаточно уверенного lecturer-facing сигнала.
3. В результате pass:
   - статусы стали правдивее;
   - темы стали конкретнее;
   - появился отдельный trust-signal `curation_reviewed_at`;
   - lecturer core library стало легче распознать.
4. После pass текущий inventory выглядит так:
   - `5 final`
   - `7 working`
   - `2 draft`
5. Библиотека стала заметно более доверенной для lecturer prep workflow.

## What Was Wrong From The Trust Perspective
1. Source `status: draft` почти везде не отражал реальную lecturer usefulness.
2. Часть зрелых documents выглядела слишком сырой из-за conservative source frontmatter.
3. Несколько theme labels были слишком общими:
   - `Семинарные материалы`
   - слишком абстрактные taxonomy labels
4. `source_updated_at` сам по себе был слабым trust-signal:
   - он показывал дату исходника;
   - он не показывал, что библиотека вообще была повторно пересмотрена куратором.

## Status Changes Made
### Promoted To `final`
1. `Structured Outputs In Office Work`
   - это уже стабильный practice note, на который можно опираться при подготовке лектора;
   - документ описывает базовую рабочую парадигму, а не exploratory direction.
2. `Office Workflow Integration`
   - документ достаточно зрелый как опорная процессная рамка;
   - он напрямую поддерживает seminar methodology.

### Promoted To `working`
1. `LLM Office Work Taxonomy`
   - полезен как supporting map;
   - достаточно зрелый для использования, но не как главный anchor.
2. `LLM Office Work Terminology`
   - glossary уже полезен как справочный support layer.
3. `LLM Office Work Negative UX Taxonomy`
   - central problem framing для лектора;
   - важен для подготовки narrative, но ещё не treated as immutable anchor.

### Intentionally Left As `draft`
1. `LLM Office Work Research Directions`
   - по смыслу это карта будущего роста, а не текущая рабочая опора.
2. `Office AI Capability Model`
   - полезен, но пока ближе к next-step discovery framework, чем к стабильной seminar anchor.

### Kept As-Is
1. `Knowledge Domain Map` remained `final`
2. `Seminar Teaching Model` remained `final`
3. `Методические материалы семинара` remained `final`
4. `Deep Research`, `Adoption Playbook`, `Implementation Scenarios`, `Adaptive Prompting Systems` remained `working`

## Theme Label Normalization
Нормализация была сделана в сторону меньшего числа, но большей полезности.

### Reworked Labels
1. `Negative UX Taxonomy` -> `Проблемы и недоверие`
2. `Research Directions` -> `Следующие исследования`
3. `Workflow Integration` -> `Встраивание в workflow`
4. `Deep Research` -> `Внешние кейсы и практика`
5. `Adoption Playbook` -> `Внедрение и adoption`
6. `Capability Model` -> `Оценка зрелости`
7. `Taxonomy` -> `Карта проблем и решений`
8. `Terminology` -> `Термины и glossary`

### Why This Helps
1. темы стали ближе к lecturer mental model;
2. стало проще понять, в каком контексте материал полезен;
3. меньше archival/technical labels, больше signals “зачем это читать”.

## Freshness / Trust Signal Decision
1. Только `source_updated_at` оказалось недостаточно.
2. Добавлен лёгкий curator-facing signal:
   - `curation_reviewed_at`
3. Его смысл:
   - это не дата изменения исходника;
   - это дата последнего curator review библиотечной metadata.
4. Это даёт простой и честный trust-layer без lifecycle workflow.

## Lecturer Core Library After Pass
Ядро библиотеки сейчас лучше всего понимать так:
1. материалы с `recommended_for_lecture_prep = true` составляют lecturer core library;
2. среди них `final` материалы являются самой надёжной базой;
3. `working` материалы остаются допустимой рабочей опорой, но с более живым статусом.

Практически core library сейчас включает:
1. `Knowledge Domain Map`
2. `Seminar Teaching Model`
3. `Методические материалы семинара`
4. `Structured Outputs In Office Work`
5. `Office Workflow Integration`
6. `Negative UX Taxonomy`
7. `Deep Research`
8. `Office AI Adoption Playbook`
9. `Office AI Implementation Scenarios`
10. `Adaptive Prompting Systems In Office Work`

## How Much More Useful It Became
Короткий честный ответ:

`Да, библиотека после curator pass стала более надёжной и практичной для лектора.`

Почему:
1. стало понятнее, какие материалы брать в работу;
2. стало легче отличать exploratory layer от рабочей опоры;
3. темы стали быстрее считываться при сканировании списка;
4. curator review date добавил недостающий signal доверия.

## What Did Not Enter This Pass
1. No CMS
2. No editor workflow
3. No approval states
4. No version-history semantics
5. No full-text or collaboration layer

## Next Step
Следующий шаг всё ещё должен быть curator-light:
1. проверить remaining `draft` после нескольких реальных lecturer sessions;
2. не расширять `final` слой автоматически;
3. решить, нужен ли очень лёгкий stale-policy поверх `curation_reviewed_at`.
