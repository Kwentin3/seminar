---
id: NOTE-004.cabinet.material-status-and-curation
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/reports/2026-03-13/CABINET.lecturer-curation-status.report.md
  - docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
tags:
  - note
  - cabinet
  - curation
  - status
---

# Cabinet Material Status And Curation Follow-Up

## Purpose
Короткий follow-up memo после введения material statuses и lecturer-oriented curation signals.

## What To Improve Next
1. Re-check the remaining `draft` materials after a few real lecturer sessions and confirm whether they should stay exploratory.
2. Decide whether `curation_reviewed_at` should remain a plain pass-date signal or evolve into a tiny freshness rubric.
3. Keep the core-library set small and explicit rather than widening the “trusted” layer automatically.

## What Not To Do Under This Note
1. Do not turn statuses into an approval workflow.
2. Do not add version history platform semantics.
3. Do not expand this into editor tooling.

## Why This Matters
1. The main lecturer gap is no longer “cannot read”.
2. The next practical gap is “can read, but is this the material I should trust today”.
3. The curator pass improved trust, but the next gains still come from light curation rather than heavy product expansion.
