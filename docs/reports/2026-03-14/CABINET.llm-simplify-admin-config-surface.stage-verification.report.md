# CABINET.llm-simplify-admin-config-surface.stage-verification.report

## Executive summary

Обновлённая admin GUI surface для `LLM simplify` проверена на stage-safe contour после smoke deploy.  
Verification подтверждает, что новый config surface не остался только локальной реализацией: он реально доступен через browser flow на `stage-smoke.local`, открывается в admin session и не ломает существующий cabinet path.

## Contour used

Использован существующий project-approved stage-safe contour:

- GitHub Actions workflow: `CI`
- run: `23092292132`
- `headSha`: `1a032056f5193ed3fe5f1f0a9c6736245405e266`
- contour type: `deploy_docker_smoke`
- host header: `stage-smoke.local`
- local tunnel:
  - `127.0.0.1:18080 -> VPS 127.0.0.1:18080`
  - `127.0.0.1:18443 -> VPS 127.0.0.1:18443`

Это не live production и не local-only runtime, а безопасный production-like smoke contour.

## Preconditions confirmed

Подтверждено:

1. `CI` job success.
2. `docker_publish` success.
3. `deploy_docker_smoke` success.
4. `curl -H "Host: stage-smoke.local" http://127.0.0.1:18080/api/healthz` -> `200`.
5. Browser smoke смог открыть cabinet через HTTPS smoke bind.

## Browser verification path

Использован existing browser smoke harness:

- `CABINET_BROWSER_SMOKE_USE_EXISTING_SERVER=1`
- `LEADS_BASE_URL=https://stage-smoke.local:18443`
- `PLAYWRIGHT_HOST_RESOLVER_RULES="MAP stage-smoke.local 127.0.0.1"`
- `PLAYWRIGHT_IGNORE_HTTPS_ERRORS=1`
- `CABINET_BROWSER_SMOKE_EXTERNAL_MINIMAL=0`
- `CABINET_BROWSER_SMOKE_SKIP_SIMPLIFY=1`

Логин выполнялся в реальную admin session на smoke contour.

## What was verified

Browser path подтвердил:

1. login works;
2. cabinet library opens;
3. `/cabinet/admin/users` opens;
4. navigation from users page to `/cabinet/admin/llm-simplify` works;
5. updated LLM settings page renders without runtime/UI errors;
6. new admin controls are visible in browser:
   - `Timeout budget`
   - `Single-pass input limit`
   - `Oversized document behavior`
   - `Effective config and guardrails`
7. navigation back to users and then back to library remains intact;
8. logout path still works.

## What was intentionally not done

В этом verification path сознательно не выполнялось:

- paid simplify generation;
- prompt mutation on smoke contour;
- connection test click;
- live production changes.

Причина: цель этой проверки была узкой — подтвердить, что новая admin config surface реально доступна и не ломает cabinet flow на stage-safe contour.

## Result

Stage-safe verification для admin config surface можно считать успешной.

Новая страница:

- реально доехала до smoke contour;
- реально открывается в browser flow;
- показывает вынесенные runtime controls;
- не ломает auth/library/admin navigation.

## Caveats

1. Verification не подтверждала семантику paid provider calls на smoke contour.
2. Verification не включала save mutation через браузер.
3. Node 20 deprecation warnings в GitHub Actions остаются отдельным CI hygiene item и не относятся к cabinet simplify behavior.

## Final judgement

Новый admin config surface пригоден к дальнейшему использованию как stage-safe regression baseline:

- structural/UI availability подтверждена;
- contour reproducible;
- existing smoke harness уже умеет проходить через эту страницу.

Следующий шаг, если понадобится deeper regression:

- добавить узкий browser smoke step на save round-trip для harmless non-secret field update в isolated contour.
