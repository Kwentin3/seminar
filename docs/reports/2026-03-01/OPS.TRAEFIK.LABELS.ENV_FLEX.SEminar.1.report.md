# OPS.TRAEFIK.LABELS.ENV_FLEX.SEminar.1.report

## 1. Executive summary
- Закрыта причина ACME failure `no matching rule`: routing labels вынесены на `seminar-app` и параметризованы через env.
- Добавлен production attachment compose для seminar и обновлён smoke compose без domain hardcode в YAML.
- Добавлен `ops/platform/seminar/.env.seminar.example` с обязательными routing/TLS переменными и инструкциями.
- Обновлены runbooks/templates: edge ownership, env-label contract, pre-cutover routing parity check.
- Локальные `lint/typecheck/tests` прошли; на VPS подтверждено `docker compose config`, что labels подставляются детерминированно.

## 2. SPEC GUARD results
Проверенные SoT:
1. `ops/platform/traefik/compose.platform-edge.yml`
2. `ops/platform/traefik/compose.platform-edge.smoke.yml`
3. `ops/platform/seminar/compose.seminar.ghcr-smoke.yml`
4. `docs/runbooks/PLATFORM_EDGE_BASELINE.md`
5. `docs/templates/PROJECT_DOCKER_ATTACH.md`
6. `docs/runbooks/SEMINAR_MIGRATION_DOCKER.md`
7. `docs/runbooks/DEPLOY_DOCKER_CONTRACT.md`
8. `docs/reports/2026-03-01/VPS.PLATFORM.ACME.CERT_CAPTURE.PRE_SWITCH.1.report.md`

Письменная фиксация:
1. Labels должны жить на **service контейнере приложения** (`seminar-app`), а не на `traefik` service.
2. Обязательные production env для routing:
   - `APP_ROUTER_NAME`
   - `APP_HOST_RULE`
   - `APP_SERVICE_PORT`
   - `TRAEFIK_CERTRESOLVER`
   - `TRAEFIK_ENTRYPOINTS_WEB`
   - `TRAEFIK_ENTRYPOINTS_WEBSECURE`
3. Хардкод доменов исключён через передачу готового `APP_HOST_RULE` (строка `Host(...) || Host(...)`) из env.

Проверка `edge` attach:
1. Seminar attachment compose использует external network `edge`.
2. STOP_CONTRACT_REQUIRED не требуется.

## 3. Что сделано
1. Обновлён `ops/platform/seminar/compose.seminar.ghcr-smoke.yml`:
   - labels переведены на env-параметры;
   - добавлены explicit router/service keys без хардкода домена.
2. Добавлен production attachment:
   - `ops/platform/seminar/compose.seminar.ghcr.yml`;
   - image через `${SEMINAR_IMAGE}` (pinned digest contract), `edge` network, env-based labels.
3. Добавлен env-шаблон:
   - `ops/platform/seminar/.env.seminar.example`.
4. Обновлены документы:
   - `docs/templates/PROJECT_DOCKER_ATTACH.md`
   - `docs/runbooks/SEMINAR_MIGRATION_DOCKER.md`
   - `docs/runbooks/PLATFORM_EDGE_BASELINE.md`
   - `docs/runbooks/DEPLOY_DOCKER_CONTRACT.md`
5. Обновлён CI smoke deploy (`.github/workflows/ci.yml`):
   - экспорт required routing env;
   - добавлен routing parity gate через `docker compose config` + `grep` по labels.

## 4. Изменённые файлы
1. `.github/workflows/ci.yml`
2. `ops/platform/seminar/compose.seminar.ghcr-smoke.yml`
3. `ops/platform/seminar/compose.seminar.ghcr.yml` (new)
4. `ops/platform/seminar/.env.seminar.example` (new)
5. `docs/templates/PROJECT_DOCKER_ATTACH.md`
6. `docs/runbooks/SEMINAR_MIGRATION_DOCKER.md`
7. `docs/runbooks/PLATFORM_EDGE_BASELINE.md`
8. `docs/runbooks/DEPLOY_DOCKER_CONTRACT.md`

## 5. Доказательства (compose config snippet / grep)
Проверка отсутствия доменного хардкода в compose YAML:
```bash
rg -n 'seminar-ai\.ru|www\.seminar-ai\.ru' ops/platform/seminar -g '*.yml' -S
# no matches
```

Проверка effective labels на VPS (`docker compose config`):
```text
--- smoke label proof
traefik.http.routers.seminar-web.rule: Host(`seminar-ai.ru`) || Host(`www.seminar-ai.ru`)
traefik.http.routers.seminar-websecure.middlewares: seminar-www-redirect
traefik.http.routers.seminar-websecure.tls.certresolver: le
traefik.http.services.seminar-svc.loadbalancer.server.port: "8787"

--- prod label proof
traefik.http.routers.seminar-web.rule: Host(`seminar-ai.ru`) || Host(`www.seminar-ai.ru`)
traefik.http.routers.seminar-websecure.middlewares: seminar-www-redirect
traefik.http.routers.seminar-websecure.tls.certresolver: le
traefik.http.services.seminar-svc.loadbalancer.server.port: "8787"

--- prod no-middleware fallback proof
traefik.http.routers.seminar-websecure.middlewares: seminar-noop
```

Локальная верификация quality gates:
```text
pnpm -r lint                         -> PASS
pnpm --filter @seminar/... typecheck -> PASS
pnpm run validate:content            -> PASS
pnpm run test:content:validator      -> PASS
pnpm run test:obs                    -> PASS
```

## 6. Strategic Gate verdict
`PASS`

Обоснование:
1. Root cause ACME capture (`no matching rule`) закрыт на конфигурационном уровне: domain routers теперь обязаны приходить из app labels через env.
2. Добавлен обязательный routing parity-check до deploy/cutover.
3. `exposedByDefault=false` не изменялся, публичные API приложения не менялись.

## 7. Verdict (PASS/FAIL)
`PASS`

## 8. Next minimal step (1 пункт)
1. Запустить новый `ACME CERT CAPTURE` run с `ops/platform/seminar/compose.seminar.ghcr.yml` и заполненным `/opt/seminar/.env.seminar`, затем подтвердить `Let's Encrypt` issuer в форензике до публичного cutover.
