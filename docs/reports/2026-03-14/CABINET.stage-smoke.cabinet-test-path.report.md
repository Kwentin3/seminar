# CABINET Stage Smoke Cabinet Test Path Report

- Date: 2026-03-14
- Scope: reproducible cabinet verification tests on isolated docker smoke contour
- Status: implemented and verified

## 1. Executive Summary

После фикса host isolation для `deploy_docker_smoke` были добавлены и проверены два usable cabinet test path для stage-safe contour:

1. stage API smoke
2. stage browser smoke

Оба path теперь работают на isolated smoke contour, а не на live production route.

## 2. What Was Added

### 2.1. API smoke hardening

Файл:

- [test-smoke-cabinet.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/scripts/test-smoke-cabinet.mjs)

Что добавлено:

1. `SMOKE_HOST_HEADER`
2. `CABINET_SMOKE_SKIP_LEGACY_ADMIN`
3. low-level `http/https` request helper instead of `fetch`

Почему это было нужно:

1. `fetch` не даёт надёжно переопределять `Host` header;
2. для isolated smoke contour это критично;
3. stage-safe verification должен бить в `stage-smoke.local`, а не в default host.

### 2.2. Browser smoke hardening

Файл:

- [test-smoke-cabinet-browser.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/scripts/test-smoke-cabinet-browser.mjs)

Что добавлено:

1. `PLAYWRIGHT_HOST_RESOLVER_RULES`
2. `PLAYWRIGHT_IGNORE_HTTPS_ERRORS`
3. `CABINET_BROWSER_SMOKE_SKIP_SIMPLIFY`
4. `CABINET_BROWSER_SMOKE_EXTERNAL_MINIMAL`
5. external-mode path that:
   - reuses an existing server;
   - verifies authenticated admin API inside browser session;
   - opens reader by slug from `/api/cabinet/materials`;
   - avoids brittle dependence on stage-specific library card copy.

## 3. Real Issues Found During Testing

Во время реального stage verification были найдены и исправлены дополнительные bugs:

1. API smoke initially failed because `fetch` did not provide a reliable `Host` override.
2. API smoke then failed because `set-cookie` from low-level node response can arrive as an array, not a string.
3. Browser smoke over HTTP tunnel failed because secure cabinet cookie did not survive on `http://...:18080`.
4. Browser smoke became reliable only over HTTPS smoke bind:
   - `https://stage-smoke.local:18443`
   - with `ignoreHTTPSErrors=1`

Это полезная диагностика, а не incidental noise: именно такие детали делают smoke path либо reproducible, либо fake-green.

## 4. Verification Performed

### 4.1. Local regression baseline

Проверено:

1. `pnpm run test:smoke:cabinet:browser`

Результат:

1. pass
2. self-managed local browser smoke не сломан новыми flags

### 4.2. Stage API smoke

Прогонялся exact repo script against isolated smoke contour:

1. `LEADS_BASE_URL=http://127.0.0.1:18080`
2. `SMOKE_HOST_HEADER=stage-smoke.local`
3. `CABINET_BOOTSTRAP_USERNAME=Kwentin3@mail.ru`
4. `CABINET_BOOTSTRAP_PASSWORD=398357`
5. `CABINET_SMOKE_SKIP_LEGACY_ADMIN=1`

Результат:

1. pass
2. output:
   - `Cabinet smoke passed. materials=14 host=stage-smoke.local legacy_admin_check=skip`

Что это реально подтверждает:

1. health endpoint available on isolated contour;
2. cabinet login works;
3. authenticated session works;
4. materials API returns data;
5. admin-only `/api/cabinet/admin/users` works;
6. reader open route works;
7. logout invalidates access.

### 4.3. Stage browser smoke

Прогонялся через SSH tunnel на HTTPS smoke bind:

1. tunnel:
   - local `127.0.0.1:18443 -> VPS 127.0.0.1:18443`
2. env:
   - `CABINET_BROWSER_SMOKE_USE_EXISTING_SERVER=1`
   - `LEADS_BASE_URL=https://stage-smoke.local:18443`
   - `PLAYWRIGHT_HOST_RESOLVER_RULES="MAP stage-smoke.local 127.0.0.1"`
   - `PLAYWRIGHT_IGNORE_HTTPS_ERRORS=1`
   - `CABINET_BOOTSTRAP_USERNAME=Kwentin3@mail.ru`
   - `CABINET_BOOTSTRAP_PASSWORD=398357`
   - `CABINET_BROWSER_SMOKE_EXTERNAL_MINIMAL=1`
   - `CABINET_BROWSER_SMOKE_SKIP_SIMPLIFY=1`

Результат:

1. pass
2. output:
   - `Cabinet browser smoke passed. baseUrl=https://stage-smoke.local:18443 simplify=skip`

Что это реально подтверждает:

1. browser login on isolated smoke contour works;
2. secure cookie survives in realistic HTTPS stage mode;
3. browser session can reach admin-only API;
4. browser session can fetch materials and open reader by slug;
5. cabinet logout path still works.

## 5. Why HTTPS Was Required For Browser Stage Smoke

Cabinet session cookie is secure in production-like docker contour.

Поэтому:

1. HTTP smoke bind `18080` good for API/edge checks;
2. but browser smoke with real auth cookies is more realistic and reliable on HTTPS bind `18443`;
3. local tunnel + host-resolver + `ignoreHTTPSErrors` gives a workable stage-safe browser verification path.

## 6. Docs Updated

Обновлён:

1. [GITHUB_GUARDRAILS.md](/d:/Users/Roman/Desktop/Проекты/seminar/docs/runbooks/GITHUB_GUARDRAILS.md)

Теперь там зафиксированы:

1. stage API smoke env shape;
2. stage browser smoke env shape;
3. tunnel/host-resolver expectations.

## 7. Files Updated

1. [test-smoke-cabinet.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/scripts/test-smoke-cabinet.mjs)
2. [test-smoke-cabinet-browser.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/scripts/test-smoke-cabinet-browser.mjs)
3. [GITHUB_GUARDRAILS.md](/d:/Users/Roman/Desktop/Проекты/seminar/docs/runbooks/GITHUB_GUARDRAILS.md)
4. [CABINET.stage-smoke.cabinet-test-path.report.md](/d:/Users/Roman/Desktop/Проекты/seminar/docs/reports/2026-03-14/CABINET.stage-smoke.cabinet-test-path.report.md)

## 8. Caveats

1. Stage browser smoke in external mode intentionally uses `minimal` assertions to avoid false failures from data-dependent library copy.
2. Simplify generation is skipped in stage browser smoke path by default in this mode to avoid unnecessary paid LLM calls during routine contour verification.
3. Legacy `/admin` secret check is skipped in stage API smoke when explicit `CABINET_SMOKE_SKIP_LEGACY_ADMIN=1` is used.

## 9. Final Judgement

Теперь у проекта есть не только container/edge smoke, но и два practical cabinet verification path на isolated smoke contour:

1. deterministic API smoke for regression and CI-like verification;
2. browser-level HTTPS smoke for realistic auth/session/reader checks.

Это делает stage-safe cabinet verification materially stronger than раньше.
