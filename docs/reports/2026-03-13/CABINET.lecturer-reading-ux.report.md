---
id: REPORT-2026-03-13.cabinet.lecturer-reading-ux
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
  - docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md
  - docs/reports/2026-03-13/CABINET.phase-1.1.hardening.report.md
  - docs/runbooks/CABINET_LOCAL_SMOKE.md
  - docs/notes/NOTE-003.cabinet.lecturer-reading-followup.md
tags:
  - report
  - cabinet
  - lecturer
  - ux
  - reading
---

# CABINET Lecturer Reading UX Report

## Executive Summary
1. До этой итерации cabinet был полезен как curated materials catalog, но не как рабочее место лектора для чтения и подготовки.
2. Главный UX-gap был в переходе от карточки материала к самому содержанию:
   - библиотека помогала найти документ;
   - портал почти не помогал его спокойно прочитать.
3. После текущих изменений cabinet стал lecturer workspace light:
   - markdown-материалы читаются прямо внутри портала;
   - YAML frontmatter больше не мешает чтению;
   - между библиотекой и чтением появился понятный маршрут и обратный путь.
4. Текущий curated corpus остаётся небольшим, но уже практичным:
   - всего `14` материалов в registry;
   - `13` из них — markdown и теперь читаются in-app;
   - `1` PDF остаётся external/open flow.
5. Cabinet теперь уже можно использовать как рабочую опору лектора, но с понятными ограничениями:
   - это reader поверх curated repo materials;
   - это ещё не knowledge workspace с полнотекстовым поиском, заметками или progress tracking.

## Cabinet Before Changes: Lecturer View
1. Найти материал было можно:
   - были список, search и фильтры;
   - карточки уже содержали title, summary, type и source path.
2. Читать markdown удобно было нельзя:
   - CTA вёл в raw/open route;
   - markdown открывался как исходный файл, а не как нормальный документ в приложении.
3. Переход из библиотеки к содержанию был слишком техническим:
   - список говорил “материал существует”;
   - портал не давал спокойного reading flow.
4. Metadata уже помогали понять тему документа, но не хватало рабочего сигнала:
   - можно ли читать прямо сейчас;
   - где читатель окажется после клика;
   - чем карточка помогает подготовке лектора, а не просто inventory.

## UX Problems That Blocked Lecturer Use
1. Cabinet был ближе к registry/file listing, чем к reading workspace.
2. У markdown не было detail/read view внутри защищённого cabinet surface.
3. Карточки не различали “читается в портале” и “открывается отдельно”.
4. Не было лёгкого маршрута назад после открытия материала.
5. Лектору приходилось мысленно держать связь между карточкой и исходным документом, вместо того чтобы читать материал в одном контуре.

## Changes Implemented
1. Добавлен protected detail route:
   - `/cabinet/materials/:slug`
2. Добавлен cabinet API для material detail/read payload:
   - metadata
   - reading mode
   - stripped markdown content
   - related materials
3. Library cards теперь показывают reading mode:
   - `Можно читать прямо в кабинете`
   - `Открывается отдельно`
4. Для markdown-материалов primary CTA теперь ведёт в in-app reader.
5. Для всех материалов сохранён secondary path к source/open route.
6. В reader добавлены:
   - title
   - summary
   - source/provenance
   - tags
   - back-to-library path
   - related materials block

## How Markdown Reads Now
1. Markdown рендерится как документ, а не как сырой текст.
2. YAML frontmatter отрезается до передачи в reader view.
3. Поддерживается нормальный GFM-уровень чтения:
   - headings
   - lists
   - tables
   - quotes
   - code blocks
   - links
   - emphasis
   - horizontal rules
4. Рендер делается безопасно:
   - без raw HTML injection path;
   - через controlled markdown renderer.
5. Визуально reader intentionally restrained:
   - спокойная типографика;
   - читаемые отступы;
   - длинный текст не выглядит как сырой dump.

## What Is Better For Lecturers Now
1. Из библиотеки теперь можно перейти в реальное чтение, а не только во внешний raw/open flow.
2. Перед кликом видно, какой материал читается в портале.
3. После открытия markdown пользователь остаётся внутри cabinet context.
4. Reader page связывает карточку и содержание:
   - metadata сверху;
   - document body ниже;
   - source path и related materials рядом.
5. Browser smoke теперь покрывает lecturer-like flow:
   - login
   - library
   - open markdown
   - back
   - logout

## What Is Still Weak
1. Cabinet по-прежнему не умеет полнотекстово искать внутри содержимого markdown.
2. Нет signals по актуальности/статусу материала типа `draft/final/obsolete`.
3. PDF остаётся external-only flow.
4. Reader пока не превращает markdown в richer seminar workflow:
   - нет заметок;
   - нет избранного;
   - нет reading progress.
5. Related materials сейчас intentionally light:
   - это cheap curation aid;
   - не полноценная knowledge navigation graph.

## Recommendation
Короткий честный ответ на главный вопрос:

`Да, после этой итерации cabinet уже заметно удобнее и полезнее лектору как рабочая опора для подготовки к семинару.`

Почему:
1. библиотека перестала быть только каталогом;
2. markdown-материалы теперь реально читаются внутри защищённого портала;
3. переходы между поиском, выбором и чтением стали намного прямее.

С оговорками:
1. это хороший lecturer reading baseline, а не полноценный knowledge workspace;
2. следующий шаг должен усиливать curation/navigation, а не расползаться в CMS или новый product surface.
