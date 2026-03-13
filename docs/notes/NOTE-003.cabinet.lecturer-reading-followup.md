---
id: NOTE-003.cabinet.lecturer-reading-followup
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/reports/2026-03-13/CABINET.lecturer-reading-ux.report.md
  - docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
tags:
  - note
  - cabinet
  - lecturer
  - reading
  - followup
---

# Cabinet Lecturer Reading Follow-Up

## Purpose
Короткий memo по тому, что логично делать после lecturer reading slice, не смешивая это с CMS, client cabinet или editor workflow.

## Recommended Follow-Up
1. Add a light freshness/status signal for materials:
   - `draft`
   - `working`
   - `final`
2. Improve seminar-oriented curation:
   - stronger summaries for weak cards;
   - cleaner categorization where titles are too archival.
3. Add one narrow regression around non-markdown detail behavior so reader/external split does not drift.
4. Revisit related-materials heuristics only if lecturers actually use them and need better adjacency.

## Explicitly Not Proposed Here
1. No CMS.
2. No editor UI.
3. No full-text engine.
4. No user-generated annotations.
5. No cabinet/admin merge.

## Why This Is The Right Next Step
1. The main gap is no longer “cannot read”.
2. The next gap is “can read, but can we orient faster and trust material freshness”.
3. That can be improved without reopening auth architecture or overgrowing the product.
