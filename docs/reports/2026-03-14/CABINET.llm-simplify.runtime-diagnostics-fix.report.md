# CABINET LLM Simplify Runtime Diagnostics And Fix Report

Date: 2026-03-14
Project: seminar
Prompt ID: `SEMINAR-CABINET-LLM-SIMPLIFY-RUNTIME-DIAG-001`
Mode: audit / code / test / ops / docs
Status: fix implemented, deployed, live readiness gate passed

## 1. Executive Summary

The production problem was real and narrow:

- deploy was already correct;
- admin settings and `test connection` were already correct;
- reader integration was already correct;
- the failing part was the real provider generation path.

The main runtime cause is now confirmed:

1. the previous default timeout budget of `45000ms` was too small for real production markdown materials;
2. when `max_output_tokens` was unset, the provider was allowed to produce long outputs, which pushed latency far above the old timeout;
3. the old adapter collapsed several different upstream/runtime failures into the generic bucket `provider_error`, so production evidence was too coarse.

The implemented fix did three things:

1. added typed error taxonomy and safe diagnostics in the DeepSeek adapter path;
2. introduced an effective default output budget for simplify generation;
3. raised the runtime timeout default to a value consistent with observed live provider latency.

Live production verification after deployment is successful:

- one real production markdown document generated successfully in the reader;
- the generated result was saved in cache;
- a second simplify read returned `delivery_mode=cache`;
- `Перегенерировать` also completed successfully and returned the reader to `ready`.

Current readiness judgement:

- feature is now ready for real use within the intended MVP scope of markdown materials.

## 2. What Was Actually Broken

Before the fix, the observed live path looked like this:

1. reader opened correctly;
2. simplify action called the server correctly;
3. DeepSeek connection test from admin page passed;
4. real simplify generation for production markdown documents finished after about `45s`;
5. the UI ended in `failed`;
6. the stored state exposed `error_code=provider_error`.

That made the system look like a generic provider failure, but that was misleading.

The system did not fail on:

- auth;
- settings;
- route wiring;
- env secret presence;
- basic provider connectivity.

It failed on the real generation runtime budget.

## 3. Confirmed Runtime Cause

### 3.1. Direct provider probes

Safe direct probes against DeepSeek with the real production runtime key confirmed the following:

- a synthetic medium-size prompt completed successfully in about `14s`;
- the real `ARCH-005` markdown prompt completed successfully in about `119.9s` when no output cap was applied;
- the same real `ARCH-005` prompt completed successfully in about `54.9s` with `max_tokens=1200`;
- the same real `ARCH-005` prompt completed successfully in about `43.3s` with `max_tokens=900`;
- the larger `ARCH-003` markdown prompt completed successfully in about `41.6s` with `max_tokens=900`.

### 3.2. Confirmed hypothesis

The confirmed production hypothesis is:

- the old `45000ms` timeout was too aggressive for real markdown simplify generation;
- unset `max_output_tokens` let the provider produce overly long results;
- this increased latency enough to trigger the timeout path;
- the timeout was then normalized too coarsely and surfaced as generic `provider_error`.

So the real issue was not "DeepSeek is broken", but:

- timeout budget too low for the chosen output budget;
- insufficient runtime diagnostics;
- insufficient error taxonomy.

## 4. Diagnostic Improvements Added

### 4.1. Adapter-level diagnostics

The DeepSeek client now produces safe diagnostics alongside errors:

- stage
- provider HTTP status
- provider duration
- abort-fired flag
- response content type, where relevant
- response body length, where relevant
- short redacted provider message, where relevant

No sensitive values are logged:

- no API key
- no full prompt
- no full markdown input
- no full provider response body
- no generated simplify text

### 4.2. Service-level provider call logs

New runtime log events were added around the actual provider call:

- `cabinet_material_simplify_provider_call_started`
- `cabinet_material_simplify_provider_call_completed`
- `cabinet_material_simplify_provider_call_failed`

These now include safe runtime facts such as:

- slug
- material id
- provider
- model
- timeout budget
- source char count
- cache intent
- abort flag
- normalized error code
- provider duration
- provider HTTP status

### 4.3. Handler-level completion logs

Reader simplify handler logs were also improved so the normal request-complete event now includes:

- `simplify_status`
- `error_code`
- `delivery_mode`

The admin `test connection` completion log now also carries `error_code`.

## 5. Error Taxonomy After Hardening

The simplify runtime path now distinguishes at least these stable error codes:

- `timeout`
- `upstream_http_error`
- `rate_limit`
- `response_parse_error`
- `empty_response`
- `provider_error`
- `config_missing`
- existing specific cases still preserved:
  - `invalid_key`
  - `content_too_large`

### 5.1. Meaning

- `timeout`: request aborted by runtime timeout budget
- `upstream_http_error`: provider returned upstream `5xx`
- `rate_limit`: provider returned `429`
- `response_parse_error`: provider returned success HTTP but malformed JSON
- `empty_response`: provider returned success HTTP but no usable completion text
- `provider_error`: transport or non-classified provider failure
- `config_missing`: runtime key missing

### 5.2. User-visible mapping

Persisted failure state now maps to more honest but still safe messages, for example:

- timeout -> generation took too long
- upstream error -> provider temporarily unavailable
- parse failure -> provider returned unexpected response
- empty response -> provider returned empty result
- missing config -> admin must check DeepSeek key

This improves UX honesty without leaking internals.

## 6. Timeout And Provider Handling Changes

### 6.1. Timeout default

The default simplify timeout was changed from:

- `45000`

to:

- `75000`

This is not arbitrary. It matches the observed live runtime once output is bounded.

### 6.2. Effective output budget

When admin settings do not explicitly set `max_output_tokens`, simplify generation now uses a runtime fallback:

- `LLM_SIMPLIFY_DEFAULT_MAX_OUTPUT_TOKENS=900` by default

This is the key operational change that made real production markdown complete inside the timeout budget.

### 6.3. Cache identity change

The effective output budget now participates in config identity:

- `config_hash` is computed from the effective generation config, not from nullable settings only

This prevents stale reuse across materially different generation behavior.

## 7. Tests And Verification

## 7.1. Local verification

Executed successfully:

- `pnpm run test:cabinet`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run test:smoke:cabinet:browser`

### 7.2. New test coverage

Added/expanded:

1. DeepSeek client unit test for:
   - timeout
   - rate limit
   - upstream HTTP error
   - response parse failure
   - empty response
   - successful response diagnostics
2. Cabinet simplify integration coverage for:
   - default `max_output_tokens` fallback
   - typed timeout persistence in state
   - redacted diagnostics in server logs

### 7.3. Failure attribution preserved

The tested irreversible boundary for simplify generation is:

- persisted simplify state row and returned API state after provider attempt.

Tests assert observable terminal outcomes, not only call counts:

- final state
- final error code
- cache persistence
- repeated read behavior
- safe logging behavior

## 8. Live Production Verification

Production was updated to:

- commit: `f937d2b2dcf2ff072b87cab2f859bcdb1d987a03`
- image: `ghcr.io/kwentin3/seminar@sha256:f554b80ef0221b23fdea0585a5553c26f311482850d326b17f8105f385d567ed`

Post-deploy health verification:

- container health: `healthy`
- public `/`: `200`
- public `/api/healthz`: `200`

### 8.1. Admin checks

Confirmed live:

- `/cabinet/admin/llm-simplify` loads
- key is still configured
- `Проверить связь с LLM` succeeds
- connection test completes with `200`

### 8.2. Successful live generation

Verified on real production material:

- slug: `docs-seminar-llm-office-work-arch-005-ai-office-work-terminology-v0-1-a518fd1417`

Observed live facts:

- provider call started from the reader UI;
- `cabinet_material_simplify_provider_call_started` logged correctly;
- provider call completed successfully;
- `provider_duration_ms` was about `40105`;
- provider HTTP status was `200`;
- reader UI showed `Сгенерировано`;
- simplified markdown rendered in the live reader.

### 8.3. Cache hit confirmation

The readiness gate required:

- generate
- persist cache
- second read from cache

This was explicitly confirmed.

Observed live second read:

- `GET /api/cabinet/materials/:slug/simplify` returned `status=ready`
- `delivery_mode=cache`

Server logs also confirmed:

- `cabinet_material_simplify_completed`
- `simplify_status=ready`
- `delivery_mode=cache`

### 8.4. Regenerate confirmation

`Перегенерировать` was also exercised live.

Observed:

- state re-entered generating path;
- provider call started with `cache_intent=regenerate`;
- provider call completed successfully in about `41536ms`;
- final regenerate handler completed with:
  - `simplify_status=ready`
  - `delivery_mode=generated`
  - `force=true`

So regenerate does not break the simplify state machine.

## 9. Sensitive Data Check

A targeted log grep was run against production logs after live generation and regenerate.

No matches were found for:

- prompt marker strings
- generated simplify text strings
- API key markers
- authorization header fragments
- system prompt text

This confirms the new diagnostics are useful but still redacted.

One caveat remains:

- the observability layer currently over-redacts some non-secret numeric/material fields such as `max_output_tokens` and parts of `material_id`.

This is not a data leak, but it does reduce precision slightly for diagnostics.

## 10. Smoke / Job Hygiene

A small hygiene fix was applied to `deploy_docker_smoke`:

- smoke container no longer reuses the live production container name;
- smoke now uses `seminar-app-smoke`;
- smoke router/middleware naming was also separated to avoid direct collision with the live service labels.

What changed:

- live production container replacement risk was reduced;
- smoke no longer targets the canonical live container name.

What did not get fully solved in this task:

- `deploy_docker_smoke` still fails on the VPS because `curl http://127.0.0.1:18080/...` returns `Connection refused`

So the smoke naming collision is improved, but the `18080` bind/probe issue remains an independent ops caveat.

Importantly:

- this no longer blocks the truthful conclusion about the simplify feature itself;
- production live verification was completed directly against the real public runtime.

## 11. Remaining Risks And Limits

The feature is now functional, but a few caveats remain:

1. MVP still supports only markdown repo materials.
2. Very large documents can still fail with `content_too_large` by design.
3. Provider latency is still non-trivial; real generation takes roughly `40s` on current production docs.
4. `deploy_docker_smoke` still needs a separate fix for the `127.0.0.1:18080` probe path.
5. Observability redaction is slightly over-aggressive for some benign fields.

None of these block current MVP usage for the intended narrow scope.

## 12. Files Changed

Code/runtime:

- `server/llm/config.mjs`
- `server/llm/deepseek-client.mjs`
- `server/cabinet/material-simplify.mjs`
- `server/index.mjs`

Tests:

- `tests/cabinet/deepseek-client.unit.test.mjs`
- `tests/cabinet/cabinet-simplify.integration.test.mjs`
- `package.json`

Ops/docs:

- `.github/workflows/ci.yml`
- `ops/platform/seminar/compose.seminar.ghcr-smoke.yml`
- `.dev.vars.example`
- `README.md`
- `docs/runbooks/ENV_MATRIX.md`

Report:

- `docs/reports/2026-03-14/CABINET.llm-simplify.runtime-diagnostics-fix.report.md`

## 13. Final Readiness Judgement

Final judgement for the feature:

- `provider_error` is no longer the only bucket
- typed runtime diagnostics are now available
- one successful live generation is confirmed
- cache hit on repeated read is confirmed
- regenerate state machine is confirmed
- sensitive data was not observed in logs

Therefore:

- the simplify MVP is now ready for real use in the current markdown-only scope.

