# CABINET LLM Simplify Live Rollout Verification Report

Date: 2026-03-14
Project: seminar
Scope: production rollout, runtime configuration, live WebGUI verification, reader/admin functional check
Status: partially successful rollout; feature is live, but document generation currently fails on provider timeout path

## 1. Executive Summary

The `Пересказать простым языком` MVP is now deployed to live production and exposed in the real cabinet UX.

The following is confirmed in production:

- the new build is running in the live Docker stack;
- the cabinet admin page for LLM settings is reachable and working;
- DeepSeek runtime key is present server-side;
- `Проверить связь с LLM` succeeds from the live GUI;
- markdown reader pages show the simplify action and simplify tabs;
- simplify API routes are live and callable from the browser session.

The current blocker is not deployment and not missing configuration. The remaining production issue is on the generation path itself:

- live simplify generation reaches the server handler;
- the server attempts the provider call;
- the request runs for about `45s`;
- the request ends in `simplify_status=failed`;
- the UI correctly renders the failure state;
- this happened for both a large and a shorter markdown document.

Current judgment:

- rollout succeeded structurally;
- admin/settings surface is operational;
- reader integration is operational;
- provider generation is not yet production-ready due to timeout behavior on the live path.

## 2. Deployment Facts

### 2.1. Released revision

- Git commit deployed: `84839435a35ffa86d27e03e005078d9cd82f49b7`
- Commit message: `cabinet: add deepseek simplify reader slice`
- Published image: `ghcr.io/kwentin3/seminar@sha256:8aee8212da571102c958894d15d062ce140758c47a6242ac2c0a88cbdada9721`

### 2.2. CI/CD outcome

The GitHub Actions run published the image successfully. One deploy-related job failed, but its failure was operational, not build-related.

Observed job state:

- `ci`: success
- `docker_publish`: success
- `deploy_docker_smoke`: failed

Root cause of that failure:

- the smoke job deployed a container on VPS;
- the smoke container used the same service/container name;
- the smoke health probe hit `127.0.0.1:18080` and got `Connection refused`;
- this was a smoke/probe issue, not an image build issue.

### 2.3. Canonical production reconciliation

After the smoke deployment side effect, production was reconciled back to the canonical Docker Compose path.

Confirmed after reconciliation:

- `/opt/seminar/.env.seminar` points to the new image digest;
- the canonical compose stack is up;
- the running `seminar-app` container uses the new image;
- container health is `healthy`;
- public root responds `200`;
- public `/api/healthz` responds `200`.

## 3. Runtime Configuration Facts

### 3.1. DeepSeek secret placement

The DeepSeek API key is configured server-side in production runtime environment.

Confirmed:

- the key was added to the production env file under `/etc/seminar/seminar.docker.env`;
- the application container sees the runtime variable;
- the key was not added to the repository;
- the key was not stored in SQLite;
- the GUI does not expose the raw key.

### 3.2. Admin settings state observed in production

From the live cabinet admin page, the following state was observed:

- API key state: `API key настроен`
- feature flag: enabled
- model: `deepseek-chat`
- prompt version: `v1`
- prompt text: present in settings UI

This matches the intended MVP split:

- secret in env;
- non-secret simplify config in application settings storage/UI.

## 4. Live GUI Verification

Verification was performed through a real browser session against the live domain.

The following flow was executed successfully:

1. log in to cabinet as admin;
2. open cabinet library;
3. confirm presence of `LLM-настройки`;
4. open `/cabinet/admin/llm-simplify`;
5. verify settings UI loads correctly;
6. run `Проверить связь с LLM`;
7. open markdown reader documents;
8. trigger `Пересказать простым языком`;
9. inspect resulting UI state and server behavior;
10. log out from cabinet.

The browser session was explicitly terminated back to the login screen after verification.

## 5. Admin Surface Verification

### 5.1. Route availability

Confirmed live:

- `GET /cabinet/admin/llm-simplify` returns the page in an authenticated admin session;
- anonymous access to settings API is still protected;
- admin settings UI loads actual values from the backend.

### 5.2. Connection test

`Проверить связь с LLM` was executed from the real admin GUI.

Confirmed:

- browser initiated `POST /api/cabinet/admin/llm-simplify/test-connection`;
- request completed with `200`;
- UI reported successful connection confirmation;
- server logs recorded `cabinet_llm_connection_test_completed`.

Observed server-side latency:

- approximately `1889ms` for the successful connection test path.

Judgment:

- DeepSeek credentials and minimal provider connectivity are working in production.

## 6. Reader Surface Verification

### 6.1. Reader UX presence

Confirmed on live markdown reader pages:

- action button `Пересказать простым языком` is visible;
- segmented document mode tabs are present:
  - `Оригинал`
  - `Простым языком`
- reader remains on the same material route;
- navigation back to the library remains intact.

This confirms that the chosen product shape from the anamnesis was implemented as intended: same route, same reader frame, mode switch inside the document context.

### 6.2. Simplify API presence

Confirmed from live browser behavior:

- `GET /api/cabinet/materials/:slug/simplify` is live;
- `POST /api/cabinet/materials/:slug/simplify` is live;
- the browser successfully calls them from an authenticated cabinet session.

Anonymous checks also confirmed the routes are protected at the API layer.

## 7. Material Verification Runs

Two real markdown documents were checked in production.

### 7.1. Document A: knowledge-domain map

Slug:

- `docs-seminar-arch-003-ai-office-work-knowledge-domain-v0-1-2fbf5f6d97`

Observed sequence:

- initial simplify state: `idle`;
- user triggered simplify from the reader UI;
- browser called `POST /api/cabinet/materials/.../simplify`;
- server kept the request open for about `45s`;
- final simplify result returned as `failed`;
- UI rendered error state.

Observed server timing:

- `duration_ms` about `45021` on the generation handler.

### 7.2. Document B: terminology document

Slug:

- `docs-seminar-llm-office-work-arch-005-ai-office-work-terminology-v0-1-a518fd1417`

Observed sequence:

- initial simplify state: `idle`;
- user triggered simplify from the reader UI;
- browser called `POST /api/cabinet/materials/.../simplify`;
- server kept the request open for about `45s`;
- final simplify result returned as `failed`;
- UI rendered error state.

Observed server timing:

- `duration_ms` about `45015` on the generation handler.

### 7.3. Result consistency

The important finding is that failure is consistent across two different markdown materials, including one that is meaningfully shorter than the first.

That reduces confidence in a "document too large only" explanation.

Current most likely interpretation:

- the provider path is reachable;
- the connection test is healthy;
- but the live generation path is not completing within the configured timeout budget.

## 8. UI State Verification

### 8.1. Successful UI behavior

The reader UI behaved correctly as a state machine even when generation failed.

Confirmed states and transitions:

- original reader state visible;
- simplify mode entered from reader action;
- loading/generating state shown;
- final failure state shown without breaking the page;
- retry affordance shown as `Попробовать снова`;
- original tab remained available;
- library navigation remained available.

### 8.2. Failed state details

For the second verified document, the state endpoint returned:

- `feature_enabled: true`
- `key_configured: true`
- `provider: deepseek`
- `model: deepseek-chat`
- `prompt_version: v1`
- `status: failed`
- `error_code: provider_error`
- `error_message: Не удалось получить пересказ.`
- `can_generate: true`
- `can_regenerate: true`

Judgment:

- the UX fallback is correct for MVP;
- users see a bounded failure state rather than a broken reader;
- the remaining problem is backend completion, not client-state handling.

## 9. Server/Network Evidence

### 9.1. Public and authenticated route evidence

Confirmed during rollout and verification:

- `GET https://seminar-ai.ru/` -> `200`
- `GET https://seminar-ai.ru/api/healthz` -> `200`
- `GET /cabinet/admin/llm-simplify` -> `200` for authenticated admin session
- `GET /api/cabinet/admin/llm-simplify/settings` -> `401` when anonymous
- `GET /api/cabinet/materials/:slug/simplify` -> `401` when anonymous

### 9.2. Application log evidence

The following events were observed in production logs:

- `cabinet_llm_settings_read_completed`
- `cabinet_llm_connection_test_completed`
- `cabinet_material_simplify_completed` for state reads
- `cabinet_material_simplify_completed` for generation attempts with `simplify_status=failed`

Most important repeated signal:

- generation requests consistently finish in about `45s` with failure.

## 10. Current Diagnosis

### 10.1. What is already proven working

- deployment packaging;
- Docker runtime rollout;
- env-based secret injection;
- admin page routing and auth;
- settings loading;
- test-connection flow;
- reader UI integration;
- simplify API reachability;
- error-state rendering in reader.

### 10.2. What is not yet working in production

- successful end-to-end simplified content generation for real markdown documents.

### 10.3. Most probable issue class

Based on the observed evidence, the issue is most likely one of the following:

1. generation timeout is too aggressive for real document runs in production;
2. provider call is waiting on a response shape/path that does not complete inside current timeout;
3. the provider adapter collapses timeout and other upstream issues into the generic `provider_error` bucket;
4. request size or output size is still large enough to push the request over the current budget even for "shorter" documents.

What is not supported by current evidence:

- missing API key;
- broken admin settings;
- missing routes;
- browser-side action bug;
- unauthenticated access confusion;
- absent production deployment.

## 11. Risk Assessment

### 11.1. Product risk

If released to real users in the current state, the feature is visible but functionally unreliable because generation ends in failure even though the entry points look ready.

### 11.2. Operational risk

The `deploy_docker_smoke` job currently has an unsafe interaction pattern with the canonical production service naming. This can create rollout ambiguity or accidental service replacement during future deploys.

### 11.3. Observability risk

The current `provider_error` result is too coarse for fast incident diagnosis. For the next pass, timeout vs upstream-response vs rate-limit should be distinguishable in logs and API state.

### 11.4. UX risk

The UI fallback is good, but repeated failed attempts could still encourage pointless regenerate spam unless timeout failure is understood and mitigated.

## 12. Recommended Immediate Next Steps

### 12.1. Backend/runtime follow-up

First implementation slice to take next:

1. inspect the current DeepSeek adapter timeout behavior in production path;
2. separate `timeout` from generic `provider_error`;
3. verify whether current timeout is hardcoded at about `45s`;
4. temporarily increase timeout for production verification;
5. rerun one short markdown document end-to-end;
6. confirm cache-ready state on second read without another provider call.

### 12.2. Smoke/deploy hygiene

Before the next production rollout:

1. fix the smoke job so it does not collide with the canonical live container name;
2. ensure smoke bind/health probe matches the actual container port behavior;
3. keep canonical deploy through the compose/env path only.

### 12.3. Product readiness gate

The feature should not yet be considered fully production-ready until at least one real markdown document completes successfully and is then served from cache on a repeat read.

## 13. Final Judgement

This rollout should be considered a successful infrastructure and integration deployment, but not yet a successful functional production release.

Reason:

- the system is present, wired, reachable, authenticated, and user-visible;
- live provider connectivity exists;
- but the core value path, generating usable simplified content for a real document, is still blocked by the runtime timeout/failure path.

Short verdict:

- `deployment`: success
- `admin/settings`: success
- `reader integration`: success
- `live generation`: failing
- `production readiness`: not yet complete

