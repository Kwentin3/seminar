---
id: REPORT-2026-03-13.cabinet.ux-cleanup-pass
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/reports/2026-03-13/CABINET.live-gui-role-audit.report.md
  - docs/reports/2026-03-13/CABINET.lecturer-reading-ux.report.md
  - docs/reports/2026-03-13/CABINET.lecturer-curation-status.report.md
  - docs/notes/NOTE-008.cabinet.live-gui-ux-findings.md
  - docs/notes/NOTE-009.cabinet.ux-cleanup-followup.md
tags:
  - report
  - cabinet
  - ux
  - cleanup
  - lecturer
---

# CABINET UX Cleanup Pass Report

## Executive Summary
1. This pass targeted the already-known GUI friction points from the live role audit rather than reopening product or architecture questions.
2. The cleanup focused on:
   - library card density;
   - lecturer-first signal hierarchy;
   - trusted/core material emphasis;
   - reader header compaction;
   - calmer narrow-screen reading entry.
3. No auth, role, cabinet-routing, or materials-architecture changes were introduced.
4. The result is visibly calmer:
   - the library reads less like a registry;
   - the reader gets to the article body faster;
   - source-path and tag noise moved into secondary disclosure.

## Targeted UX Problems
The target problems for this pass were:
1. cards felt too dense on first scan;
2. lecturer-useful signals had to compete with source-path and tag noise;
3. trusted/core materials were present, but not foregrounded enough;
4. the reader header delayed entry into the text, especially on narrow screens;
5. overall tone still leaned registry-like instead of preparation-first.

Out of scope by design:
1. no new role model;
2. no CMS/editor flow;
3. no redesign of auth or navigation architecture;
4. no heavy recommendation layer.

## What Changed In Library Cards
1. Cards were re-layered into a clearer hierarchy:
   - title;
   - status/recommendation/reading badges;
   - prep cue;
   - summary;
   - a short secondary signal row;
   - actions;
   - only then contextual metadata.
2. Source path, language, audience, category, and tags were moved into a collapsible `details` block.
3. Tag noise was reduced:
   - only a short preview remains visible inside the contextual disclosure;
   - overflow is compressed into `+N`.
4. Recommended materials now get a subtle visual emphasis instead of the same flat weight as everything else.

## Signal Hierarchy Changes
The library now follows a lecturer-useful hierarchy more closely:
1. title;
2. trust/maturity signals;
3. short “why read this” cue;
4. summary;
5. theme/type/updated/curated quick signals;
6. secondary provenance only on demand.

Practical effect:
1. the first scan answers “what is this, can I trust it, and should I read it now?” faster;
2. technical metadata is still available, but it no longer dominates the card.

## Trusted / Core Materials Emphasis
1. The existing `recommended_for_lecture_prep` and status model remained the source of truth.
2. Default library view now softly groups the experience into:
   - `С чего начать`
   - `Остальная библиотека`
3. This is not a new recommendation engine; it is a calmer presentation of the already curated trusted layer.

## Reader Ergonomics Changes
1. The reader top block was compacted.
2. Before the article body, the reader now shows only:
   - title and summary via the page card header;
   - status/recommendation/reading badges;
   - action buttons;
   - a short `Коротко о материале` quick-facts row.
3. The longer provenance payload moved into a collapsible `Контекст материала` block below the article.
4. This reduces visual delay before the markdown content begins and is especially helpful on narrow screens.

## Lecturer Usefulness Judgement
`Yes, the GUI is noticeably calmer and more lecturer-friendly after this pass.`

Why:
1. the library is easier to scan;
2. it is clearer what to start with first;
3. noisy metadata no longer competes with the purpose of the material;
4. the reader feels less like “metadata before content” and more like “open and read”.

## What Was Intentionally Not Done
1. No role-based redesign.
2. No new admin/viewer experiential split.
3. No new curation model.
4. No markdown renderer rewrite.
5. No changes to auth/session behavior.

## Checks Run
Shell context:
`PowerShell`

Executed:
1. `pnpm --filter @seminar/contracts run build`
2. `pnpm --filter @seminar/web run typecheck`
3. `pnpm run build:web`
4. `pnpm run test:cabinet`
5. `pnpm run test:obs`
6. `pnpm run test:smoke:cabinet:browser`

Visual verification:
1. browser smoke still followed the canonical login -> library -> reader -> logout route;
2. a local production-like browser pass confirmed the calmer library top and shorter reader entry.

## Next Step
The next sensible step should stay small:
1. one more pass on card wording and microcopy;
2. slight trimming of remaining contextual metadata on mobile;
3. no new product surface until several real lecturer sessions confirm the current direction.
