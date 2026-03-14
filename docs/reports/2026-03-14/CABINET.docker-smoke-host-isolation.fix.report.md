# CABINET Docker Smoke Host Isolation Fix Report

- Date: 2026-03-14
- Scope: stage-safe docker smoke deploy automation for cabinet/runtime verification
- Status: fixed and re-verified

## 1. Executive Summary

Починен automation gap в `deploy_docker_smoke`.

Реальная проблема была не в image build, не в app runtime и не в cabinet routes, а в том, что stage-safe smoke contour использовал тот же `Host` header, что и live production:

1. `Host: seminar-ai.ru`
2. `Host: www.seminar-ai.ru`

Из-за этого `127.0.0.1:18080` был не изолирован как самостоятельный smoke/stage path. Трафик мог попадать не в `seminar-app-smoke`, а в live-attached routing path, что делало smoke ambiguous и ломало проверку.

Исправление:

1. `deploy_docker_smoke` переведён на dedicated smoke host:
   - `Host: stage-smoke.local`
2. smoke router name также отделён от старого live-adjacent имени:
   - `seminar-stage`
3. smoke contour больше не зависит от public production domain rule.

После этого workflow `CI` с `publish_image=true` и `run_docker_smoke_deploy=true` прошёл green end-to-end, включая `deploy_docker_smoke`.

## 2. What Was Breaking

До исправления симптом выглядел так:

1. `ci` job проходил успешно;
2. `docker_publish` job проходил успешно;
3. `seminar-app-smoke` на VPS реально поднимался и становился `healthy`;
4. но `deploy_docker_smoke` падал на:
   - `curl: (7) Failed to connect to 127.0.0.1 port 18080: Connection refused`

На первый взгляд это выглядело как infra bind issue, но фактура оказалась тоньше:

1. stage app container был жив;
2. pinned digest и `BUILD_ID` совпадали;
3. сам edge smoke contour был неполностью поднят;
4. после ручного подъёма smoke edge стало видно, что route still ambiguous because the smoke host reused the public domain.

То есть основной дефект был architectural for automation:

`docker smoke` не был изолирован от live routing namespace.

## 3. Diagnosis Evidence

Во время диагностики было подтверждено:

1. `seminar-app-smoke` запускался на ожидаемом image digest.
2. `BUILD_ID` внутри smoke container соответствовал текущему commit.
3. Route `/api/cabinet/admin/users` физически присутствовал внутри runtime file `/app/server/index.mjs`.
4. При проверке изнутри `seminar-app-smoke` cabinet admin route отвечал корректно `200`.
5. При проверке через `127.0.0.1:18080` с `Host: seminar-ai.ru` можно было получить не smoke response path, а ambiguous routing behavior.

Это сняло гипотезы о том, что проблема была в:

1. старом image;
2. неудачной сборке;
3. пропавшем route;
4. сломанной cabinet auth path;
5. broken user-admin implementation.

## 4. Root Cause

Подтверждённая причина:

1. `deploy_docker_smoke` использовал тот же `Host` rule, что и live production;
2. smoke contour therefore competed with live routing namespace;
3. `127.0.0.1:18080` переставал быть trustworthy isolated verification path;
4. automation smoke gate становился non-deterministic.

Иными словами:

stage-safe smoke не должен был использовать production host header.

## 5. Fix Applied

### 5.1. Workflow changes

В [.github/workflows/ci.yml](/d:/Users/Roman/Desktop/Проекты/seminar/.github/workflows/ci.yml) сделаны точечные изменения:

1. `APP_ROUTER_NAME`:
   - было: `seminar-smoke`
   - стало: `seminar-stage`
2. `APP_HOST_RULE`:
   - было: `Host(\`seminar-ai.ru\`) || Host(\`www.seminar-ai.ru\`)`
   - стало: `Host(\`stage-smoke.local\`)`
3. `APP_ENABLE_WWW_REDIRECT`:
   - было: `1`
   - стало: `0`
4. smoke curls теперь ходят с:
   - `Host: stage-smoke.local`

Это сделало stage contour logically isolated from public edge routing.

### 5.2. Sticky comment

В workflow добавлен короткий sticky comment с product/ops intent:

1. docker smoke must use its own Host rule;
2. public production hosts make `127.0.0.1:18080` ambiguous;
3. stage traffic can otherwise partially route into the public app.

### 5.3. Runbook updates

Обновлены:

1. [GITHUB_GUARDRAILS.md](/d:/Users/Roman/Desktop/Проекты/seminar/docs/runbooks/GITHUB_GUARDRAILS.md)
2. [DEPLOY_DOCKER_CONTRACT.md](/d:/Users/Roman/Desktop/Проекты/seminar/docs/runbooks/DEPLOY_DOCKER_CONTRACT.md)

Зафиксировано:

1. smoke contour должен использовать dedicated smoke host header;
2. smoke/stage-safe path не должен повторно использовать public production domain;
3. docs теперь согласованы с automation reality.

## 6. Verification Performed

### 6.1. Repo / CI verification

Был запущен manual workflow:

1. workflow: `CI`
2. ref: `feature/ci-ghcr-pinned-digest`
3. inputs:
   - `publish_image=true`
   - `run_docker_smoke_deploy=true`

Результат:

1. `ci` -> success
2. `docker_publish` -> success
3. `deploy_docker_smoke` -> success

Successful run:

1. `23090432395`

### 6.2. Runtime artifact verification

На VPS smoke contour был подтверждён как совпадающий с текущим artifact:

1. runtime image:
   - `ghcr.io/kwentin3/seminar@sha256:...`
2. runtime `BUILD_ID`:
   - соответствует актуальному commit smoke-fix chain
3. `seminar-app-smoke`:
   - `healthy`

### 6.3. Stage-safe HTTP verification

После host isolation были подтверждены:

1. `GET /` on `127.0.0.1:18080` with `Host: stage-smoke.local` -> `200`
2. `GET /api/healthz` with `Host: stage-smoke.local` -> `200`
3. `GET /admin/obs/logs` with `Host: stage-smoke.local` -> `200`
4. `POST /api/cabinet/login` with `Host: stage-smoke.local` -> `200`
5. `GET /api/cabinet/admin/users` with explicit session cookie and `Host: stage-smoke.local` -> `200`

Это подтвердило, что stage contour теперь не просто "container healthy", а реально serves cabinet app path through isolated smoke edge.

## 7. Commits

Изменения шли двумя коммитами:

1. user-admin slice:
   - `7c8d43f`
   - `cabinet: add admin user management surface`
2. smoke host isolation fix:
   - `575b49a`
   - `ops: isolate docker smoke host routing`

Для самого automation gap релевантен второй commit.

## 8. Files Updated

1. [.github/workflows/ci.yml](/d:/Users/Roman/Desktop/Проекты/seminar/.github/workflows/ci.yml)
2. [GITHUB_GUARDRAILS.md](/d:/Users/Roman/Desktop/Проекты/seminar/docs/runbooks/GITHUB_GUARDRAILS.md)
3. [DEPLOY_DOCKER_CONTRACT.md](/d:/Users/Roman/Desktop/Проекты/seminar/docs/runbooks/DEPLOY_DOCKER_CONTRACT.md)
4. [CABINET.docker-smoke-host-isolation.fix.report.md](/d:/Users/Roman/Desktop/Проекты/seminar/docs/reports/2026-03-14/CABINET.docker-smoke-host-isolation.fix.report.md)

## 9. What This Fix Does Not Change

Исправление не меняет:

1. public production routing;
2. live cutover policy;
3. DeepSeek runtime path;
4. cabinet simplify scope;
5. user-admin product scope;
6. legacy rollback-only deploy residue.

Это узкий ops/stage fix, а не новый runtime subsystem.

## 10. Remaining Caveats

После исправления всё ещё остаются отдельные вещи вне этого scope:

1. worktree локально остаётся грязным из-за старых unrelated files (`data/seminar.sqlite`, `NOTE-007`, старые untracked reports/artifacts);
2. Node 20 deprecation warnings в GitHub Actions всё ещё есть, но не блокируют текущий smoke gate;
3. `stage-smoke.local` используется как internal host header for smoke only and is not a public host.

## 11. Final Readiness Judgement

`deploy_docker_smoke` теперь можно считать надёжным stage-safe automation baseline для этого проекта.

Основания:

1. route namespace smoke contour изолирован от live production;
2. workflow green не требует ручного обхода;
3. smoke edge path снова deterministic;
4. docs и workflow говорят об одном и том же;
5. stage-safe verification now proves the intended container rather than an ambiguous live-adjacent route.

## 12. Recommended Next Step

Следующий практический шаг:

1. использовать `deploy_docker_smoke` как обязательный regression gate для cabinet changes;
2. отдельно прогнать browser-level verification against the smoke contour when понадобится richer cabinet UX verification;
3. позже отдельно убрать Node 20 action deprecation warnings, но не смешивать это с cabinet/runtime work.
