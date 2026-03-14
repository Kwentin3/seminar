---
id: REPORT-2026-03-13.cabinet.live-gui-role-audit
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/reports/2026-03-13/CABINET.go-live.report.md
  - docs/notes/NOTE-007.deploy-entrypoints-and-truth-map.md
  - docs/reports/2026-03-13/CABINET.lecturer-reading-ux.report.md
  - docs/reports/2026-03-13/CABINET.lecturer-curation-status.report.md
  - docs/notes/NOTE-005.cabinet.core-library-curation.md
  - docs/notes/NOTE-008.cabinet.live-gui-ux-findings.md
tags:
  - report
  - cabinet
  - production
  - gui
  - ux
  - roles
---

# CABINET Live GUI Role Audit

## Executive Summary
1. Production GUI audit was completed on the live domain `https://seminar-ai.ru` through a real browser walkthrough.
2. MCP Playwright transport failed on the first `navigate`, so the audit used local Playwright fallback against the production domain. This was a browser-first audit, not an API-only substitute.
3. Admin scenario was completed through the real login page with the existing live admin account.
4. Lecturer scenario was completed with a temporary production `viewer` account created only for the audit, used for the GUI walkthrough, and deleted together with its live sessions immediately after the audit.
5. The portal is already usable for daily internal work:
   - login is clear;
   - library is readable;
   - markdown reader is genuinely usable;
   - status and curator signals help lecturer orientation.
6. The main weakness is not broken functionality but interface density:
   - the library still feels more like a curated internal registry than a polished lecturer workspace;
   - cards contain too much low-level metadata for first-pass scanning.

## Audit Method
### Browser Method
1. Attempted MCP Playwright first.
2. MCP browser session failed immediately with `Transport closed`.
3. Per the WebGUI triage rule, the audit switched to local Playwright fallback to distinguish transport failure from site failure.
4. All walkthrough findings below come from live browser interaction against `https://seminar-ai.ru`.

### Admin Login Method
1. Used the existing production admin account through `/cabinet/login`.
2. Completed the full flow:
   - landing
   - login
   - cabinet library
   - markdown reader
   - logout

### Lecturer Login Method
1. Production did not have a separate `viewer` user at audit start.
2. A temporary viewer account was created directly in the live SQLite DB using the app's own password-hash module from the running container.
3. The account was used only for the audit walkthrough.
4. After the audit:
   - viewer sessions were deleted;
   - the temporary user was deleted;
   - a follow-up inventory check confirmed production returned to a single live `admin` user.

## Screenshot Artifacts
Artifacts saved under:

`docs/artifacts/2026-03-13/cabinet-live-gui-role-audit/`

Primary evidence:
1. `01-landing.png`
2. `02-cabinet-login.png`
3. `03-cabinet-library-admin.png`
4. `03b-cabinet-library-admin-top.png`
5. `04-cabinet-reader-admin.png`
6. `04b-cabinet-reader-admin-top.png`
7. `05-logout-auth-gated.png`
8. `06-cabinet-library-lecturer.png`
9. `06b-cabinet-library-lecturer-top.png`
10. `07-cabinet-reader-lecturer.png`
11. `07b-cabinet-reader-lecturer-top.png`
12. `08-cabinet-reader-lecturer-mobile.png`

## GUI Evaluation As Admin
### What Works Well
1. Login is straightforward and visually calm.
2. After login it is immediately obvious that the user landed in the materials library, not in a vague dashboard.
3. The library top block is clean:
   - signed-in state is visible;
   - admin gets a lightweight stats line;
   - logout is easy to find.
4. Material cards are informative:
   - status badge;
   - lecture-prep recommendation;
   - readable-in-portal signal;
   - short summary;
   - structured metadata.
5. Markdown reader is already solid for real preparation work:
   - readable width;
   - decent typography;
   - metadata visible without overwhelming the article body;
   - back path is obvious.

### What Feels Raw
1. The list is still dense. A single card exposes a lot of metadata at once, including source path and full tag rows.
2. The visual language is tidy but austere; it feels like a careful internal tool rather than a deliberately shaped lecturer workspace.
3. The top nav and in-page back navigation coexist, which is not broken, but does add mild navigational duplication.

## GUI Evaluation As Lecturer
### What Works Well
1. A lecturer can quickly understand what to read first because the cards show:
   - status;
   - recommendation for lecture prep;
   - reading mode;
   - summary;
   - theme.
2. The first screen already answers the practical question:
   - “can I read this here right now?”
3. The reader view is useful for real preparation, not just for metadata lookup.
4. Mobile reading is still narrow and long, but it remains usable rather than broken.

### What Still Slows The Lecturer
1. The library cards are heavier than they need to be for fast scanning before a lecture.
2. Technical fields like source path and long tag clusters compete with the truly important lecturer signals.
3. The overall tone is still slightly “service/admin interface” rather than “focused reading workspace”.
4. There is no stronger visual distinction between core anchor materials and the rest beyond badges, so the trusted core is visible but not strongly foregrounded.

## Role-Difference Findings
1. Visible GUI role difference is currently minimal.
2. The real visible difference observed in production:
   - `admin` sees the lightweight stats line with material count and categories;
   - `viewer` does not see that line.
3. Otherwise the library and reader experience are intentionally almost identical.
4. For the current internal-only phase this is acceptable and not a product bug.
5. This does mean the role split is currently operational rather than experiential.

## Visual / UX Strengths
1. The interface is clean and coherent.
2. Core CTA hierarchy is understandable:
   - login button;
   - read in cabinet;
   - open source;
   - logout.
3. Text remains readable in long markdown documents.
4. Status and curator signals are visible enough to be practically useful.
5. The portal no longer feels like a raw file listing.

## Visual / UX Weaknesses
1. The library is still visually too metadata-heavy for first-pass scanning.
2. The card layout gives almost equal weight to lecturer-relevant signals and technical provenance details.
3. The GUI is useful, but not yet “pleasantly opinionated”; it still carries some internal-tool plainness.
4. The mobile reader is usable, but the long metadata block before the article body increases scroll cost on narrow screens.

## Overall Judgement
### Admin / Organizer
`7/10`

Usable, stable, clear, and not embarrassing for internal daily work. The main rough edge is density rather than broken flow.

### Lecturer
`7/10`

Already helpful as a working preparation tool because reading and choosing materials is viable in-browser. It still needs lighter scanning and stronger emphasis on the trusted core library.

### Combined Verdict
The production GUI is already adequate for real internal use.

It is not yet polished enough to feel like a mature knowledge workspace, but it is clearly beyond “just a service table”.

## Top Improvements By Priority
1. Reduce library card density on the first screen by demoting source path and some tags below the primary lecturer signals.
2. Strengthen the visual foregrounding of core lecture-prep materials so the trusted subset is easier to spot at a glance.
3. Shorten or soften technical wording where lecturer-facing copy still sounds registry-like instead of task-oriented.
4. Rebalance the reader top block for narrow screens so the article body starts slightly earlier.
5. Decide whether the header navigation and in-page back navigation should remain duplicated or be clarified.

## What To Do Next
The next product step should stay small:
1. run one focused card-density cleanup pass;
2. make the core-library signals slightly more visually dominant;
3. improve narrow-screen reader ergonomics without redesigning the whole app.
