---
id: REPORT-2026-03-13.cabinet.ux-polish-pass
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/reports/2026-03-13/CABINET.ux-cleanup-pass.report.md
  - docs/notes/NOTE-009.cabinet.ux-cleanup-followup.md
  - docs/reports/2026-03-13/CABINET.live-gui-role-audit.report.md
tags:
  - report
  - cabinet
  - ux
  - polish
  - lecturer
---

# CABINET UX Polish Pass

## Executive Summary
1. This pass was intentionally smaller than the previous cleanup pass.
2. It addressed three narrow follow-ups:
   - shorter prep microcopy;
   - quieter `updated/curated` signals in the library;
   - a slightly shorter reader entry before the article body.
3. No product scope was widened.

## What Changed
### Library
1. Prep cues were shortened so they read faster during first-pass scanning.
2. `updated` and `curated` stopped competing with theme/type as equal quick-signal chips.
3. They now sit in a quieter secondary line under the primary lecturer-facing cues.

### Reader
1. The top block became slightly shorter.
2. `updated` and `curated` moved out of the quick-facts card grid into a quieter muted line.
3. Quick facts now focus on the fastest orienting questions:
   - theme
   - type

## Effect
1. The library now feels less metadata-forward.
2. The reader reaches the article body a little sooner on narrow screens.
3. The interface keeps the same structure, but the “registry” feel is reduced another step.

## Checks Run
Shell context:
`PowerShell`

Executed:
1. `pnpm --filter @seminar/web run typecheck`
2. `pnpm run build:web`
3. `pnpm run test:cabinet`
4. `pnpm run test:smoke:cabinet:browser`

## Remaining Next Step
1. If we continue polishing, the next useful pass is mostly copy and spacing:
   - trim one or two remaining contextual labels;
   - verify live production look after next deploy;
   - stop before this turns into redesign work.
