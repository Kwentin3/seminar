---
id: NOTE-005.cabinet.core-library-curation
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/reports/2026-03-13/CABINET.curator-pass.report.md
  - docs/reports/2026-03-13/CABINET.lecturer-curation-status.report.md
  - docs/notes/NOTE-004.cabinet.material-status-and-curation.md
tags:
  - note
  - cabinet
  - curation
  - core-library
---

# Cabinet Core Library Curation

## Purpose
Зафиксировать текущее lecturer-facing ядро библиотеки после curator pass без превращения этого слоя в formal publishing workflow.

## Current Core Library
Опорное ядро для подготовки лектора сейчас составляют материалы с `recommended_for_lecture_prep = true`.

Практически это:
1. карта домена;
2. teaching model семинара;
3. методические материалы семинара;
4. structured outputs;
5. workflow integration;
6. negative UX taxonomy;
7. deep research;
8. adoption playbook;
9. implementation scenarios;
10. adaptive prompting systems.

## Curator Reading Rule
1. `final` = можно использовать как стабильную опору.
2. `working` = можно брать в подготовку, но держать в голове, что документ ещё живой.
3. `draft` = читать как exploratory/supporting layer, а не как основную опору.

## Guardrail
Не расширять core-library badge/meaning автоматически.
Любое расширение ядра должно происходить только после осмысленного curator review.
