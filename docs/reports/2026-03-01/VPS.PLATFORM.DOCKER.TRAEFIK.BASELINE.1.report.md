# VPS.PLATFORM.DOCKER.TRAEFIK.BASELINE.1.report

## 1. Executive summary
- Выполнен OPS baseline для multi-project Docker edge на VPS без переключения текущего прод-домена `seminar-ai.ru` с legacy nginx.
- Закрыт контекстный GAP: добавлены redacted live snapshots (`systemd`, `nginx`, env keys, порты, DNS, TLS).
- Реализован и проверен рабочий Traefik smoke stack на VPS (`127.0.0.1:18080/18443`) с shared external network `edge` и host-rule `Host(edge-smoke.local)`.
- Production cutover на Traefik `:80/:443` намеренно не выполнен: действуют стратегические contract gates по SQLite backup/restore SLA и OBS logs policy.

## 2. SPEC GUARD results
### Проверенные SoT
- `docs/reports/2026-03-01/SEMINAR.DOCKERIZE.AUDIT_PLAN.1.report.md`
- `docs/runbooks/GO_LIVE.md`
- `docs/runbooks/ENV_MATRIX.md`
- `docs/runbooks/GITHUB_GUARDRAILS.md`
- `docs/adr/ADR-001.infrastructure.baseline.v1.md`
- `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md`
- `docs/runbooks/OBS_LOG_RETRIEVAL.md`

### Инварианты (письменно)
- Edge invariants:
  - только явные `Host(...)` правила;
  - без catch-all (`_`, wildcard-by-default);
  - production ports только `80/443`;
  - `exposedByDefault=false`;
  - shared external network `edge`.
- Storage invariants (SQLite WAL):
  - перенос только консистентным trio: `.sqlite`, `-wal`, `-shm`;
  - единственный writer во время cutover;
  - rollback возможен через snapshot-копию.
- Observability invariants:
  - текущий контракт привязан к journald (`journalctl`) как source of truth;
  - Docker stdout baseline требует отдельного policy/contract решения для `/admin/obs/logs`.

### Guard outcomes
- `STOP_REQUIRE_CONTEXT`: CLOSED
  - live snapshots добавлены в `docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md`.
- `STOP_CONTRACT_REQUIRED`: OPEN (prod cutover blocked)
  - backup/restore SLA контракт (RPO/RTO/retention/drill cadence) не утвержден;
  - OBS policy (`journald` vs docker logs adapter) не утверждена для production.
- `STOP_SCOPE_DRIFT`: not triggered
  - публичные API приложения не менялись.

## 3. Что сделано
1. Снят live baseline VPS (read-only) и зафиксирован в документации.
2. Определён edge контракт для Traefik multi-project (без catch-all).
3. Добавлен platform stack:
   - `compose.platform-edge.yml` (target 80/443)
   - `compose.platform-edge.smoke.yml` (safe smoke 127.0.0.1:18080/18443)
4. Добавлен шаблон подключения произвольного проекта через labels/network.
5. Добавлен migration plan v2 для seminar (HOST bind, SQLite trio migration, OBS gate).
6. Добавлен deploy docker contract (atomic roll-forward/rollback + smoke gate).
7. На VPS:
   - установлен Docker Engine + Compose plugin;
   - создана external network `edge`;
   - поднят Traefik smoke stack;
   - проверен smoke router `edge-smoke.local` -> `200`;
   - подтверждена автоподнятие после `systemctl restart docker`.

## 4. Изменённые файлы
- `docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md`
- `docs/runbooks/PLATFORM_EDGE_BASELINE.md`
- `ops/platform/traefik/.env.platform-edge.example`
- `ops/platform/traefik/compose.platform-edge.yml`
- `ops/platform/traefik/compose.platform-edge.smoke.yml`
- `docs/templates/PROJECT_DOCKER_ATTACH.md`
- `docs/runbooks/SEMINAR_MIGRATION_DOCKER.md`
- `docs/runbooks/DEPLOY_DOCKER_CONTRACT.md`
- `docs/reports/2026-03-01/VPS.PLATFORM.DOCKER.TRAEFIK.BASELINE.1.report.md`

## 5. Доказательства (команды/вывод/логи)
### Live context
- SSH доступ к VPS:
  - `echo ok && whoami && hostname` -> `ok / root / r1121293`
- Live systemd snapshot:
  - `cat /etc/systemd/system/seminar.service` (зафиксирован в docs)
- Live nginx snapshot:
  - `cat /etc/nginx/sites-available/seminar` (включая домены `seminar-ai.ru`, `www.seminar-ai.ru`, `ai-work.pro`, `www.ai-work.pro`)
- Env keys inventory:
  - `PORT`, `HOST`, `NODE_ENV`, `DATABASE_PATH`, `ADMIN_SECRET=<redacted>`
- Ports:
  - `nginx` слушает `:80/:443`
  - `node` слушает `127.0.0.1:8787`
- TLS:
  - `certbot certificates` -> активный cert `seminar-ai.ru` + `www.seminar-ai.ru`

### Platform stack
- Docker installed and enabled:
  - initial install: `Docker 29.2.1`
  - pinned runtime for compatibility: `Docker 28.5.2`
  - `Docker Compose version v5.1.0`
  - `systemctl is-active docker` -> `active`
  - `systemctl is-enabled docker` -> `enabled`
- External network:
  - `docker network create edge` (created/exists)
- Smoke stack up:
  - `docker compose --env-file .env.platform-edge -f compose.platform-edge.smoke.yml up -d`
  - `platform-edge-smoke-traefik` exposed on `127.0.0.1:18080 -> 80` and `healthy`
- Router smoke:
  - `curl -i -H 'Host: edge-smoke.local' http://127.0.0.1:18080/` -> `HTTP/1.1 200 OK`
- Compatibility evidence:
  - on Docker `29.x` Traefik provider logged:
    - `client version 1.24 is too old. Minimum supported API version is 1.44`
  - after pinning to Docker `28.5.2`, router `edge-smoke@docker` работает стабильно.
- ACME storage evidence:
  - file `/opt/platform/traefik/acme/acme.json` exists, mode `0600`, bind-mounted into Traefik.
- Restart resilience (reboot proxy check):
  - `systemctl restart docker`
  - containers auto-restored (`Up`)
  - post-restart smoke -> `ok`
- Production safety check:
  - `systemctl is-active seminar nginx` -> `active / active`
  - `curl http://127.0.0.1:8787/api/healthz` -> `{ "ok": true }`
  - `curl -I https://seminar-ai.ru` -> `HTTP/1.1 200 OK`

### Not available in this run
- ACME cert issuance on a dedicated smoke domain не проверено (нет выделенного test DNS host для Traefik challenge).

## 6. Strategic Gate verdict
- `STOP_REQUIRE_CONTEXT`: PASS (closed)
- `STOP_CONTRACT_REQUIRED`: FAIL (open)
  - backup/restore SLA not approved
  - OBS production policy not approved

## 7. Verdict (PASS/FAIL)
`FAIL` for production cutover readiness.

Обоснование: platform baseline и smoke реализованы, но обязательные contracts для безопасного production ввода не закрыты.

## 8. Next minimal step (1 пункт)
1. Утвердить два контракта (SQLite backup/restore SLA + OBS logs policy для Docker), после чего выполнить controlled cutover Traefik на `:80/:443` по `docs/runbooks/SEMINAR_MIGRATION_DOCKER.md`.
