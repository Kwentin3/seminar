# CABINET LLM Simplify Stage Verification Report

Date: 2026-03-14
Project: seminar
Prompt ID: `SEMINAR-CABINET-LLM-SIMPLIFY-STAGE-VERIFICATION-001`
Mode: test / ops / audit / docs
Status: stage-safe verification completed, happy path passed

## 1. Executive Summary

The markdown simplify flow was verified successfully on the nearest stage-safe contour currently available in the project:

- not live production;
- not the broken VPS docker smoke bind;
- but an isolated temporary local production-like runtime using the real DeepSeek provider, temporary SQLite, real server routes, and real browser interaction.

Confirmed end-to-end on this contour:

1. cabinet login works;
2. markdown reader opens;
3. simplify generation succeeds;
4. cache row is written;
5. repeated read returns `delivery_mode=cache`;
6. regenerate succeeds;
7. original/simplified navigation remains intact;
8. redacted diagnostics remain present without leaking API key, prompt, or markdown body.

Judgement:

- the simplify flow is reproducible on a stage-safe contour and can be used as a truthful verification baseline;
- however, the current repo still lacks a dedicated always-green automated real-provider stage harness;
- today the best regression baseline is a controlled temporary local production-like runtime, not the current VPS `deploy_docker_smoke` contour.

## 2. Stage / Test Contour Used

### 2.1. Discovery result

No separate guaranteed-ready stage host was confirmed inside the repo/runtime truth.

What is present:

1. canonical live production: Docker + Traefik + GHCR pinned digest;
2. a VPS docker smoke contour in CI (`deploy_docker_smoke`);
3. local smoke infrastructure for cabinet (`test:smoke:cabinet`, `test:smoke:cabinet:browser`);
4. env examples that show how a staging host could exist, but not evidence of an active dedicated stage environment.

Relevant evidence:

- `ops/platform/seminar/.env.seminar.example` contains only a staging override example for host rule;
- `docs/notes/NOTE-007.deploy-entrypoints-and-truth-map.md` documents only the active production control plane;
- `.github/workflows/ci.yml` contains `deploy_docker_smoke`, but previous runtime diagnostics already established that this contour still fails independently on `127.0.0.1:18080`.

### 2.2. Chosen contour

Used contour:

- `temporary_local_production_like_runtime`
- runtime shape: `node server/index.mjs`
- temporary isolated SQLite database
- real DeepSeek provider
- real cabinet auth, reader routes, simplify routes, admin settings routes
- real browser interaction via Playwright

Reason for choosing it:

1. it is stage-safe;
2. it avoids live production;
3. it exercises the real provider path;
4. it reuses the repo’s existing local smoke/runtime infrastructure;
5. it avoids the currently known false-negative smoke bind issue on the VPS docker smoke contour.

## 3. Preconditions Confirmed

Confirmed on the chosen contour:

1. `/api/healthz` returned `200`.
2. Cabinet login succeeded.
3. Session role was `admin`.
4. `/api/cabinet/admin/llm-simplify/settings` was accessible.
5. `feature_enabled=true`.
6. `key_configured=true`.
7. `POST /api/cabinet/admin/llm-simplify/test-connection` returned `status=success`.
8. Schema contained both:
   - `llm_simplify_settings`
   - `material_simplifications`
9. At least one in-app markdown material was present.

## 4. Material Used For Verification

Verified material:

- slug: `docs-seminar-arch-003-ai-office-work-knowledge-domain-v0-1-2fbf5f6d97`
- title: `LLM Office Work Knowledge Domain Map`
- source path: `docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md`
- material status: `final`
- markdown length at read time: `13559` characters

Why this material was suitable:

1. it is a real `repo_markdown` material;
2. it opens via the in-app reader;
3. it is large enough to exercise the real provider path meaningfully;
4. it still completes within the fixed timeout/output budget.

## 5. Happy Path Results

### 5.1. Auth and reader open

Confirmed:

1. login succeeded;
2. the protected reader page opened for the markdown material;
3. the reader returned to `/cabinet` after back navigation;
4. original/simplified tab switching remained functional.

### 5.2. First simplify generation

Browser-triggered simplify generation completed successfully.

Observed API state after first generate:

- `status=ready`
- `delivery_mode=generated`
- `error_code=null`
- `can_regenerate=true`
- `generated_at=2026-03-14T14:10:20.962Z`

Storage confirmation after first generate:

- `material_simplifications.status=ready`
- `error_code=null`
- `generated_markdown_length=2905`

This confirms:

1. provider call completed successfully;
2. generated result was persisted into cache storage.

### 5.3. Cache hit on repeated read

After reloading the same reader route, the simplify state was fetched again.

Observed repeated-read state:

- `status=ready`
- `delivery_mode=cache`
- `error_code=null`
- `generated_at=2026-03-14T14:10:20.962Z`

This confirms the required readiness gate:

- second read did not require a fresh provider generation;
- the flow reused the stored simplify result as cache.

### 5.4. Regenerate path

Browser-triggered regenerate also completed successfully.

Observed regenerate result:

- `status=ready`
- `delivery_mode=generated`
- `error_code=null`
- `generated_at=2026-03-14T14:11:02.992Z`

Storage confirmation after regenerate:

- `material_simplifications.status=ready`
- `generated_markdown_length=2907`
- `generated_at` advanced from `2026-03-14T14:10:20.962Z` to `2026-03-14T14:11:02.992Z`

Post-regenerate repeated read:

- `status=ready`
- `delivery_mode=cache`
- `error_code=null`
- `generated_at=2026-03-14T14:11:02.992Z`

This confirms:

1. regenerate does not break the state machine;
2. cache remains readable after regenerate;
3. original and regenerated results remain tied to the same material identity.

## 6. Diagnostics And Logging Observations

Observed runtime log signals:

1. `cabinet_material_simplify_provider_call_started`
2. `cabinet_material_simplify_provider_call_completed`
3. `cabinet_material_simplify_completed`

Redaction sanity checks passed:

1. API key string was not found in captured logs.
2. Prompt marker `Исходный документ:` was not found in logs.
3. Prompt prelude `Ниже исходный документ в markdown.` was not found in logs.
4. `Authorization: Bearer` was not found in logs.

This means the stage-safe contour preserved the same useful diagnostics model as production without leaking sensitive material.

### 6.1. Error taxonomy sanity

On this happy-path verification no failure was intentionally induced.

So the following were confirmed:

1. success-path diagnostics shape matches the hardened runtime path;
2. no regression was observed in success-path logging;
3. failure buckets were not re-simulated here by design.

Truthful limitation:

- this report does not claim a fresh runtime proof for `timeout`, `rate_limit`, or `response_parse_error` on the stage-safe contour;
- those were already covered by the runtime hardening task and tests, not by this happy-path stage verification.

## 7. Test Infrastructure Fit

### 7.1. What already works well

The current test infrastructure is already strong in three layers:

1. integration tests cover simplify state transitions and runtime taxonomy;
2. browser smoke already covers the broad cabinet reader interaction shape;
3. local temporary-runtime orchestration is easy to reproduce and does not require production mutation.

### 7.2. What blocks a perfect automated stage check today

Two gaps remain:

1. `deploy_docker_smoke` is still not a trustworthy simplify verification gate because the contour has its own unresolved `127.0.0.1:18080` bind/probe issue.
2. `scripts/test-smoke-cabinet-browser.mjs` is currently stub-oriented:
   - it expects deterministic stub content like `Упрощённый пересказ #1/#2`;
   - it does not assert cache row persistence;
   - it does not assert a real-provider `delivery_mode=cache` on second read.

### 7.3. Regression-baseline judgement

Current judgement:

- yes, this flow is good enough to serve as a regression baseline conceptually;
- but no, the repo does not yet have it packaged as a single stable automated real-provider stage job.

Best current baseline:

1. temporary local production-like runtime;
2. real DeepSeek key in env;
3. browser interaction for reader flow;
4. API + DB checks for cache semantics;
5. log grep for redaction sanity.

## 8. Caveats / Remaining Limits

Remaining caveats:

1. No dedicated active stage host was confirmed.
2. VPS docker smoke remains independently unreliable for this feature until the `127.0.0.1:18080` issue is fixed.
3. The current browser smoke script is still tuned for stubbed simplify output, not real-provider text.
4. This verification used a temporary local production-like runtime, not a full Docker + Traefik contour.
5. The flow remains intentionally markdown-only.

None of these invalidate the happy-path result, but they matter for future automation strategy.

## 9. Final Recommendation

Recommendation:

- yes, the chosen contour can be treated as a reliable stage-safe verification path for now.

More precise wording:

1. It is reliable enough for repeated operator verification before or after simplify changes.
2. It is safer and more truthful than using live production as a substitute.
3. It should be considered the current practical regression baseline until the VPS docker smoke contour is repaired and a real-provider simplify harness is formalized.

Suggested future follow-up:

1. keep the current local production-like verification path as the manual truth baseline;
2. later extract it into a dedicated real-provider stage smoke/regression harness;
3. only then promote it into an automated stage gate.

## 10. Exact Evidence Snapshot

Observed contour summary:

- contour: `temporary_local_production_like_runtime`
- runtime: `node_server_temp_db_real_deepseek`
- login: `ok`
- settings: `ok`
- connection test: `success`
- initial simplify state: `idle`
- first generate: `ready/generated`
- second read: `ready/cache`
- regenerate: `ready/generated`
- post-regenerate read: `ready/cache`
- back navigation final URL: `/cabinet`
- redaction checks: passed

Final readiness for stage-safe verification:

- passed
