---
id: REPORT-2026-03-14.cabinet.llm-simplify-anamnesis
status: draft
owner: @Codex
approved_by: []
last_updated: 2026-03-14
related:
  - docs/reports/2026-03-13/CABINET.lecturer-reading-ux.report.md
  - docs/reports/2026-03-13/CABINET.lecturer-curation-status.report.md
  - docs/reports/2026-03-13/CABINET.live-gui-role-audit.report.md
  - docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
  - docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md
  - docs/runbooks/ENV_MATRIX.md
tags:
  - report
  - cabinet
  - llm
  - simplify
  - anamnesis
---

# CABINET LLM Simplify Anamnesis Report

## 1. Executive Summary
1. Feature fit is good: this is a natural extension of the current lecturer reader, not a new standalone subsystem.
2. The clean MVP is `markdown-only`, reader-first, synchronous generation with cache, and no chunking, queue, bulk processing, or PDF support.
3. The current cabinet already has the right anchor point for the action:
   - one protected reader route;
   - one top action row;
   - one article body slot;
   - one clear back-to-library path.
4. Source of truth is mixed today:
   - source body lives in repo files;
   - curation logic lives in `server/cabinet/materials-registry.mjs`;
   - normalized delivery metadata lives in SQLite `materials`;
   - the reader still loads markdown from file at request time.
5. Cache invalidation should not rely on `source_updated_at` alone. The right freshness identity for simplify is a computed `source_hash` of the exact LLM input plus `prompt_hash` and model/config identity.
6. The safest admin model for the current project is split:
   - `DEEPSEEK_API_KEY` stays env-only;
   - prompt/model defaults live in a new tiny SQLite settings table;
   - admin UI for these settings should live inside cabinet admin role, not legacy shared-secret `/admin`.
7. Main risks before implementation:
   - document/prompt leakage into logs;
   - regenerate spam causing needless API spend;
   - stale cache if identity is based only on dates;
   - overgrowing the first slice into queue/chunking/editor tooling.

## 2. Reader Integration Reality
### Current reader shape
1. The reader is a single protected route, `/cabinet/materials/:slug`, implemented in `apps/web/src/routes/CabinetMaterialPage.tsx:20-70` and backed by `GET /api/cabinet/materials/:slug` in `server/index.mjs:299-347`.
2. The page has one clear top metadata/actions block, then one article body slot, then related materials and context details:
   - top badges and actions: `apps/web/src/routes/CabinetMaterialPage.tsx:123-179`
   - action row with back + source: `apps/web/src/routes/CabinetMaterialPage.tsx:148-165`
   - single markdown article slot: `apps/web/src/routes/CabinetMaterialPage.tsx:182-205`
3. Previous UX work deliberately positioned cabinet as a calm reader, not a dashboard. That is reinforced by `docs/reports/2026-03-13/CABINET.lecturer-reading-ux.report.md` and the live GUI audit.

### What helps the new scenario
1. The reader already has a natural action zone near the existing back/source buttons.
2. There is already a strong conceptual split between:
   - original curated metadata;
   - article body.
3. Navigation is already understandable:
   - back to library;
   - open source file;
   - related materials.

### What will fight the new scenario
1. The current page has no view-mode layer. It assumes one article body per page.
2. Mobile already pays scroll cost before the article body, as noted in `docs/reports/2026-03-13/CABINET.live-gui-role-audit.report.md`.
3. A large inline panel above the article would add even more density to a page that is already metadata-first.

### Recommended reader UX
1. Keep the same reader route. Do not create a separate simplify route as the primary MVP path.
2. Add the trigger in the existing top action zone, next to current reader actions.
3. After generation, show a tight two-state view switch directly above the article body:
   - `Оригинал`
   - `Пересказ простым языком`
4. When the user clicks `Пересказать простым языком`, the system should:
   - fetch cache state;
   - generate only if cache is missing or stale;
   - switch the body view to the simplified version on success.
5. Keep the page-level metadata, related materials, and back-to-library path unchanged between views.
6. Use a query-string view mode only if linkability is desired, for example `?view=simplified`. This is optional for MVP and should not force a new route tree.

### Why not a separate route
1. A dedicated route would duplicate the same metadata frame and create an unnecessary “back to original” problem.
2. The current UX already has mild navigation duplication; adding another reader route would amplify it.
3. The user mental model is “same document, alternate explanation”, not “new document”.

## 3. Material Source / Version Reality
### What the system does today
1. Materials are discovered from two registry roots in `server/cabinet/materials-registry.mjs:27-45`:
   - `docs/seminar` as `repo_markdown`
   - `content` as `repo_pdf`
2. Registry build logic extracts markdown metadata from frontmatter and headings in `server/cabinet/materials-registry.mjs:187-210`.
3. Curated overrides are applied in the same registry file, especially for status/theme/recommendation.
4. On startup, the server materializes normalized rows into SQLite through `syncMaterialsFromRegistry(...)` in `server/cabinet/materials-registry.mjs:343-430`, called from `server/index.mjs:70-77`.
5. For actual reading, the detail endpoint does not read markdown from SQLite. It reads the source file from disk at request time in `server/index.mjs:1374-1387`.

### Real source-of-truth judgement
1. Source of truth for markdown body: repo file on disk.
2. Source of truth for curation metadata: mixed frontmatter + curated registry overrides.
3. Source of truth for cabinet delivery/indexing: SQLite `materials`.
4. This means the current system is not “DB-authored content”. It is “file-authored content with DB-materialized metadata”.

### What is available for freshness today
1. `source_updated_at` exists as a display signal in `materials`, populated from frontmatter/overrides.
2. `updated_at` on the `materials` row is sync-time metadata, not source-body identity.
3. Repo scan on 2026-03-14 shows the seminar markdown corpus still largely carries `status: draft` and `last_updated: 2026-03-10`, so date-only freshness would be weak and easy to forget.

### Recommended freshness identity
1. Add computed `source_hash` for simplify and compute it from the exact LLM input payload, not from `source_updated_at`.
2. For markdown MVP, that payload should be canonicalized from at least:
   - material slug or source path
   - title
   - stripped markdown body
3. Treat `source_updated_at` as a UI/debug snapshot only, not as cache truth.
4. Cache becomes stale when any of these change:
   - `source_hash`
   - `prompt_hash`
   - provider/model/config identity
   - explicit manual regenerate

### MVP material type boundary
1. Support only `material_type = markdown` and `source_kind = repo_markdown`.
2. Do not attempt PDFs in v1. Current PDF flow is external-only by design, and there is no extraction layer.
3. Do not generalize to arbitrary text-like docs until there is an explicit parsing contract.

## 4. Caching Model Options
### Options considered
1. Add simplify columns onto `materials`.
   - Rejected: mixes volatile generated content with curated source metadata and makes cache identity/versioning awkward.
2. Store one generic JSON blob in a future `app_settings`.
   - Rejected for MVP: too vague, weak queryability, and not aligned with current narrow schema style.
3. Create a dedicated simplify cache table.
   - Recommended.

### Recommended storage model
Use a dedicated SQLite table, for example `material_simplifications`.

Suggested minimum fields:

| field | purpose |
| --- | --- |
| `id` | row identity |
| `material_id` | FK to `materials.id` |
| `feature_kind` | fixed `simple_retell` for future extensibility |
| `provider` | `deepseek` |
| `model` | chosen model id |
| `source_hash` | hash of exact LLM input payload |
| `source_updated_at_snapshot` | optional debug/UI snapshot |
| `prompt_hash` | hash of active simplify prompt/context |
| `config_hash` | hash of relevant non-secret model options |
| `status` | `generating` / `ready` / `failed` |
| `generated_markdown` | simplified content |
| `error_code` | typed failure for UI/debug |
| `error_message` | redacted failure summary only |
| `created_at` | first creation time |
| `updated_at` | last mutation time |
| `generated_at` | last successful generation time |

Recommended uniqueness:
1. Unique key on `(material_id, feature_kind, provider, model, source_hash, prompt_hash, config_hash)`.
2. Keep one cache row per identity and update it in place on explicit regenerate.

### State semantics
1. `valid cached result`:
   - current identity row exists;
   - `status = ready`;
   - `generated_markdown` is non-empty.
2. `stale result`:
   - there is a prior row for the material;
   - current identity does not match that row.
3. `missing result`:
   - no row exists for current identity.
4. `generation failed`:
   - current identity row exists with `status = failed`.

### Regenerate semantics
1. `Перегенерировать` is an explicit force action from the simplified view.
2. It should bypass a valid cache hit for the current identity, call the provider again, and overwrite the current identity row.
3. It should not silently create a second competing “current” row for the same identity.

### Avoiding pointless API spend
1. Cache hit should be the default path.
2. The server should create a `generating` state before the provider call so concurrent requests do not fan out.
3. The client should disable the trigger while generation is running.
4. A tiny per-user/per-material cooldown for forced regenerate is justified even in MVP.

## 5. DeepSeek Integration Boundary
### Existing pattern reality
1. The project has no mature reusable external-provider adapter layer yet.
2. The only current outbound API integration is the inline Turnstile verification helper in `server/index.mjs:1527-1565`.
3. The codebase does already isolate some concerns into modules (`server/cabinet/*`, `server/obs/*`), so adding one small provider module and one cabinet orchestration module fits the current architecture.

### Recommended module split
1. Provider adapter:
   - `server/llm/deepseek-client.mjs`
2. Cabinet feature orchestrator:
   - `server/cabinet/material-simplify.mjs`
3. Keep HTTP handlers thin in `server/index.mjs`.

### Recommended MVP endpoint shape
1. `GET /api/cabinet/materials/:slug/simplify`
   - returns current simplify state for the active identity
   - may include cached content if `ready`
2. `POST /api/cabinet/materials/:slug/simplify`
   - default: generate if missing/stale, otherwise return cache
   - with `force = true`: regenerate
3. `GET /api/cabinet/admin/llm-settings`
   - admin-only, returns non-secret settings and key presence state
4. `PUT /api/cabinet/admin/llm-settings`
   - admin-only, updates prompt/model defaults
5. `POST /api/cabinet/admin/llm-settings/test`
   - admin-only, server-side connection test with configured env key

### Timeout / retry / error policy
1. Add an explicit timeout using `AbortController`.
2. For MVP, use no automatic retry on generation calls. The explicit user action `Перегенерировать` is the retry mechanism.
3. Connection test can also stay single-attempt in MVP.

### Failure handling
1. Invalid or missing API key:
   - admin settings page should show “key missing” or “connection failed”;
   - reader should surface a generic unavailable state, not provider raw text.
2. Model/provider error:
   - store typed redacted failure;
   - show user-safe failure state with retry path.
3. Timeout:
   - mark `failed`;
   - show retry action.
4. Rate limit:
   - show temporary failure state;
   - do not hammer retries automatically.
5. Oversized document:
   - return a typed `too_large` style failure;
   - keep the original reader usable.

### Size limit and chunking
1. Current seminar markdown corpus is modest. Local repo inspection on 2026-03-14 found the largest stripped markdown body at about `17.5k` characters.
2. That makes chunking unnecessary for MVP.
3. Introduce a hard size limit anyway, so the first slice is explicit and safe.
4. Recommended MVP stance:
   - one request per document;
   - hard limit;
   - no chunk merge logic.

## 6. Admin Settings Options
### Current reality
1. The existing `/admin` page is legacy and narrow:
   - browser field for `X-Admin-Secret`
   - load leads only
   - no cabinet role/session usage
   - see `apps/web/src/routes/AdminPage.tsx:12-170` and `server/index.mjs:708-757`
2. Cabinet roles already exist (`admin`, `viewer`), but there is no cabinet-native admin settings surface yet.
3. `ADMIN_SECRET` is already documented as env-only in `docs/runbooks/ENV_MATRIX.md`.

### Recommended admin model
1. Do not place LLM settings under legacy `/admin`.
2. Add a new cabinet-native admin page under the authenticated cabinet route space.
3. Keep the secret and the editable settings split:
   - `DEEPSEEK_API_KEY`: env only
   - prompt/model defaults: SQLite table

### Why env-only for the API key
1. Current production truth is Docker env files plus SQLite, not a secret-management subsystem.
2. SQLite is backed up and operationally visible; storing provider keys there would widen secret exposure.
3. Browser-entered secret management inside the app would require a new secure write path into server config, which is too much for this MVP.
4. The honest MVP is:
   - show whether the key is configured;
   - test it server-side;
   - edit it through ops env management, not through the browser.

### Recommended non-secret settings table
Use a tiny dedicated table, for example `llm_simplify_settings`, not a generic platform-wide settings engine.

Suggested fields:
1. `id` fixed singleton
2. `provider`
3. `model`
4. `system_prompt`
5. `prompt_version`
6. `temperature` only if really needed
7. `max_output_tokens` only if really needed
8. `updated_at`
9. `updated_by_user_id`

### Connection test
1. Run it server-side with the env key.
2. Return:
   - configured / not configured
   - success / failed
   - redacted error category
   - tested model id
3. Do not echo the key back to the client.

### Test sandbox
1. Not needed in MVP.
2. A connection test is enough.
3. A free-form prompt sandbox would increase cost, abuse surface, and scope.

## 7. Security / Privacy / Ops Considerations
1. Never expose `DEEPSEEK_API_KEY` to the client bundle, browser storage, or JSON responses.
2. Do not log source markdown, simplified markdown, prompt text, or raw provider responses.
3. This matters because the current logger redacts keys like `api_key`, `secret`, `password`, `phone`, and `email`, but it is not a “safe to log arbitrary document content” system; see `server/obs/logger.mjs:23-31` and `server/obs/logger.mjs:90-140`.
4. Treat simplify failures as typed/redacted events only:
   - provider category
   - timeout
   - rate limit
   - config missing
5. Prevent regenerate spam with:
   - UI disable while pending
   - server in-flight guard for the identity key
   - small force-regenerate cooldown
6. Keep simplify endpoints behind cabinet session auth. Admin settings routes must also enforce `role = admin`.
7. Update ops docs before rollout:
   - env matrix with new vars
   - deploy docs with key provisioning
   - smoke/runbook with connection test plus one generate/cache-hit scenario
8. New SQLite tables mean normal migration/backup discipline applies, but this is still a small schema extension, not a topology change.

## 8. Architecture Fit Judgement
1. This is a reader/cabinet extension, not a new platform.
2. The natural boundary is:
   - one new provider adapter
   - one new cabinet service
   - two new DB tables
   - one cabinet-admin settings page
3. The unreasonable boundary starts when the feature tries to become:
   - document chat
   - background jobs
   - PDF ingestion pipeline
   - generic AI workspace
4. Migration impact is moderate and contained:
   - one table for simplify cache
   - one table for non-secret LLM settings
5. A new admin surface is required, but it should be narrow and cabinet-native.

## 9. Recommended MVP Scope
### Include in v1
1. Reader button `Пересказать простым языком` for markdown materials only.
2. Cached simplified view in the same reader page.
3. Explicit `Перегенерировать`.
4. Admin-only cabinet settings page for prompt/model defaults and connection test.
5. Env-managed API key presence/status.
6. Clear labels that the simplified text is LLM-generated, not the original document.

### Exclude from v1
1. Chat with document.
2. Multiple audience modes.
3. Bulk generation.
4. Background queue.
5. Mass reprocessing.
6. Usage analytics.
7. Advanced cost controls.
8. PDF support.
9. Chunking.
10. In-app key editing.

### Recommended disclaimer
`Это упрощённый LLM-пересказ. Он может сокращать, переупорядочивать или терять детали. Для точных формулировок используйте оригинал документа.`

### Generated/stale state UX
1. Show status near the simplified view header:
   - `Сгенерировано`
   - `Из кэша`
   - `Устарело`
   - `Ошибка генерации`
2. Show `generated_at` and, when useful, the current prompt/model label.
3. Keep stale warning inside the simplified view itself, not only in admin.

## 10. Recommended Storage Model
1. Keep `materials` as curated source metadata only.
2. Add `material_simplifications` for cached outputs and generation state.
3. Add `llm_simplify_settings` for non-secret admin-editable settings.
4. Use `source_hash + prompt_hash + provider/model/config` as cache identity.
5. Compute staleness, do not fake it with one boolean on `materials`.

## 11. Recommended Admin Model
1. New page inside cabinet, admin-role only.
2. Keep legacy `/admin` for leads/ops as-is for now.
3. Show:
   - provider enabled/disabled
   - key configured yes/no
   - connection test result
   - active model
   - prompt editor
   - optional minimal model options only if truly used
4. Do not show or return the raw API key.
5. Document clearly that changing prompt/model invalidates simplify cache for future reads.

## 12. Risk Register
| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Logging source/prompt content | Current logger is redaction-by-default for secrets, not for arbitrary document bodies | Ban content logging in simplify flow; store only typed/redacted failure metadata |
| Regenerate spam / duplicate cost | Reader button is easy to click repeatedly | In-flight guard, cooldown, cache-first default, client disable |
| Weak freshness identity | `source_updated_at` is manual and low-fidelity | Use computed `source_hash` from actual LLM input |
| Admin surface confusion | Legacy `/admin` uses shared secret and is the wrong place for feature settings | Add cabinet-native admin settings route |
| Oversized or slow documents | LLM request can hang or exceed provider limits | Hard size limit, timeout, no chunking in MVP |
| Scope drift | Easy to turn “simplify” into a larger AI subsystem | Fix MVP boundary in implementation prompt and tests |
| Secret storage mistakes | SQLite/browser storage would widen exposure | Keep API key env-only |
| Stale cache after prompt/model edits | Old simplified text may look current | Include `prompt_hash` and config identity in cache key; show stale state |

## 13. Exact Next Implementation Prompt Recommendation
Use the next implementation prompt to request one narrow slice:

1. Implement `markdown-only` cabinet simplify MVP for the existing reader.
2. Add SQLite migrations for:
   - `material_simplifications`
   - `llm_simplify_settings`
3. Keep `DEEPSEEK_API_KEY` env-only; do not build in-app secret storage.
4. Add server modules:
   - `server/llm/deepseek-client.mjs`
   - `server/cabinet/material-simplify.mjs`
5. Add endpoints for:
   - simplify state/read/generate/regenerate
   - cabinet-admin LLM settings read/update/test
6. Support only `repo_markdown` materials that are already readable in-app.
7. Compute cache identity from:
   - exact LLM input hash
   - prompt hash
   - provider/model/config
8. Add reader UI:
   - `Пересказать простым языком`
   - same-page original/simplified switch
   - `Перегенерировать`
   - clear LLM disclaimer and stale/generated state
9. Add safeguards:
   - no content logging
   - request timeout
   - no automatic retries on generate
   - in-flight dedupe and small regenerate cooldown
10. Do not add:
   - PDF support
   - chunking
   - queue/background jobs
   - bulk generation
   - chat
11. Update tests and docs:
   - integration tests for cache hit/stale/force regenerate/auth
   - env/runbook docs for new vars and smoke path

Recommended opening line for that prompt:

`Implement cabinet MVP v1 for "Пересказать простым языком" using DeepSeek for markdown reader materials only. Keep the API key env-only, add cache/state in SQLite, add a cabinet-admin settings page for non-secret prompt/model config plus connection test, and do not introduce chunking, PDF support, bulk processing, or background jobs.`
