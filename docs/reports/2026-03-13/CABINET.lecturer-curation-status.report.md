---
id: REPORT-2026-03-13.cabinet.lecturer-curation-status
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
  - docs/reports/2026-03-13/CABINET.lecturer-reading-ux.report.md
  - docs/notes/NOTE-003.cabinet.lecturer-reading-followup.md
  - docs/notes/NOTE-004.cabinet.material-status-and-curation.md
  - docs/runbooks/CABINET_LOCAL_SMOKE.md
tags:
  - report
  - cabinet
  - lecturer
  - curation
  - status
---

# CABINET Lecturer Curation Status Report

## Executive Summary
1. До этой итерации cabinet уже умел читать материалы, но почти не помогал лектору оценить зрелость документа.
2. Главный UX-gap был не в доступе к контенту, а в доверии и ориентации:
   - материал читается, но непонятно, это черновик или уже опорная версия;
   - карточки плохо подсказывали, что брать в работу прямо сейчас.
3. Для lecturer-first v1.x выбран минимальный status model:
   - `draft`
   - `working`
   - `final`
4. Source of truth сделан смешанным, но простым:
   - frontmatter остаётся baseline для `status` и `last_updated`;
   - curated registry overrides аккуратно промотируют часть материалов в `working` / `final` и добавляют lecture-prep signals.
5. После итерации библиотека стала заметно полезнее:
   - теперь видно, что читать в первую очередь;
   - каким материалам можно доверять как опорным;
   - какие документы пока стоит читать осторожно.

## Lecturer UX Gap Before Changes
1. В библиотеке уже были type, summary, source и reading-mode, но этого не хватало для оценки зрелости документа.
2. Почти все seminar markdown sources в frontmatter имели `status: draft`, поэтому текущий source status сам по себе не помогал при подготовке лектора.
3. Лектору было трудно быстро отличить:
   - исследовательский черновик;
   - рабочий материал для подготовки;
   - текущую опорную версию.
4. Самый сильный gap был в metadata model и карточках:
   - detail view уже умел читать;
   - list view плохо отвечал на вопрос “что брать в работу сейчас”.

## Chosen Status Model
Выбран ровно один минимальный набор:

1. `draft`
   - исследовательский или сырой материал;
   - полезен для расширения контекста, но не как основная опора.
2. `working`
   - материал уже можно брать в подготовку;
   - он полезен практическим содержанием, но ещё не считается главным anchor document.
3. `final`
   - текущий опорный материал;
   - его можно использовать как базовую рабочую версию для подготовки лектора.

Почему именно этот набор:
1. он понятен без product training;
2. он не превращается в editorial workflow;
3. его достаточно для решения lecturer problem “доверять / использовать / читать осторожно”.

## Curator Signals Added
1. `material_status`
2. `theme`
3. `reading_mode`
4. `source_updated_at`
5. `recommended_for_lecture_prep`

Почему именно они:
1. status отвечает за зрелость;
2. theme помогает быстро понять смысл материала;
3. reading mode показывает, читать ли в портале или открывать отдельно;
4. updated signal даёт минимальный ориентир по актуальности;
5. lecture-prep recommendation помогает выделить рабочее ядро библиотеки.

## Source Of Truth Decision
1. Markdown frontmatter теперь используется как baseline source of truth для:
   - `status`
   - `last_updated`
   - `tags`
2. Curated layer живёт в `server/cabinet/materials-registry.mjs` и делает только лёгкие overrides:
   - promotion части материалов в `working` / `final`;
   - theme mapping;
   - `recommended_for_lecture_prep`
3. SQLite остаётся delivery layer:
   - registry sync materializes curation fields into `materials`
   - cabinet routes читают уже нормализованную metadata model
4. Это решение не требует CMS discipline и не ломает текущий registry-driven pipeline.

## How It Shows Up In Library And Reader
### Library
1. Добавлен простой filter по статусу.
2. На карточке сразу видны:
   - status badge;
   - lecture-prep recommendation badge;
   - readable in portal / external only;
   - theme;
   - updated signal.
3. API/order теперь выводит рекомендованные и более зрелые материалы выше, так что список легче сканировать глазами.

### Reader / Detail View
1. Status виден в верхней полосе сигналов.
2. Recommendation badge виден рядом со статусом.
3. Theme и updated signal показаны в metadata block.
4. Reading flow при этом не усложнился и остался спокойным.

## Real Counts After Curation Pass
Inventory после текущей curated iteration:
1. `14` total materials
2. `3` materials with `final`
3. `4` materials with `working`
4. `7` materials with `draft`
5. `7` materials marked as `recommended_for_lecture_prep`

Это достаточно, чтобы библиотека перестала быть “плоским списком” и получила рабочее ядро для подготовки лектора.

## What Did Not Enter This Slice
1. No CMS.
2. No editor UI.
3. No approval workflow.
4. No publication history/version graph.
5. No full-text search engine.
6. No comments/annotations/collaboration layer.

## Lecturer Usefulness Judgement
Короткий честный ответ:

`Да, библиотека стала заметно полезнее для лектора.`

Почему:
1. стало быстрее выбирать, что читать;
2. стало понятнее, каким материалам доверять;
3. стало проще отличать черновики от рабочих и опорных документов;
4. current reading flow теперь подкреплён не только доступом, но и curator context.

Что всё ещё остаётся слабым местом:
1. часть статусов сейчас определяется curated overrides, а не обновлёнными source docs;
2. updated signal остаётся базовым и не равен полноценной freshness governance;
3. related materials пока всё ещё heuristic, а не осмысленная seminar map.

## Recommended Next Step
Следующим шагом логично усиливать не workflow, а качество curation:
1. дочистить слабые summaries и темы у оставшихся `draft` материалов;
2. при необходимости добавить один очень лёгкий stale/fresh signal policy;
3. не расширять это в CMS или approval platform.
