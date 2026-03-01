# VPS.PLATFORM.SEMINAR.CUTOVER.PROD.1.report

## 1. Executive summary
- Controlled cutover `seminar` на Traefik `:80/:443` **не выполнен**.
- До public switch выполнены pre-cutover шаги: snapshot SQLite, запуск `seminar-app` в Docker, внутренний smoke через Traefik smoke-port `127.0.0.1:18080`.
- На smoke обнаружена критическая аномалия в `/admin/obs/logs` (контейнер перезапускался, в логах `spawn journalctl ENOENT`), что нарушает gate для docker OBS source.
- По правилу "при любой аномалии -> остановка и rollback" выполнен rollback в legacy (`nginx + systemd`), публичный прод восстановлен.

## 2. SPEC GUARD confirmation
1. Контракты подтверждены:
   - `docs/contracts/CONTRACT-OPS-001.sqlite-backup-sla.v0.1.md`
   - `docs/contracts/CONTRACT-OBS-002.log-retrieval-sources.v0.1.md`
2. Проверенные инварианты:
   - один writer во время snapshot (legacy `seminar.service` остановлен);
   - SQLite trio snapshot (`.sqlite`, `-wal`, `-shm`) выполнен консистентно;
   - `ADMIN_SECRET` не выводился в отчёт/логи.
3. Обнаруженный конфликт факта с ожидаемым baseline:
   - на live release VPS в `server/obs/log-retrieval.mjs` присутствует только journald path (`streamJournaldEvents`), docker adapter отсутствует.
   - это блокирует контрактный docker-режим `/admin/obs/logs`.

## 3. Pre-cutover state
- `systemctl is-active seminar nginx` -> `active / active`
- `curl http://127.0.0.1:8787/api/healthz` -> `{"ok":true}`
- `curl -I https://seminar-ai.ru` -> `HTTP/1.1 200 OK`
- Listener baseline:
  - `nginx` на `:80/:443`
  - `node` на `127.0.0.1:8787`
  - Traefik smoke на `127.0.0.1:18080/18443`
- Leads count до миграции: `1`

## 4. Snapshot evidence
- Legacy writer остановлен:
  - `systemctl stop seminar`
  - `systemctl is-active seminar` -> `inactive`
  - проверка writer процесса -> `WRITER_NONE`
- Snapshot directory:
  - `/opt/seminar/backups/cutover-20260301T114141Z`
- Скопированы файлы:
  - `seminar.sqlite`
  - `seminar.sqlite-wal`
  - `seminar.sqlite-shm`
- SHA256:
  - `seminar.sqlite` -> `5c9dec1886cc01f5f2307ee1ea87f9b32a4cef0f8f9a2c68beebc558013bedab`
  - `seminar.sqlite-shm` -> `e454326acee9ffb69d2f959ad4d4566ba51cc714bc5bc6ea33c76925450ff1d4`
  - `seminar.sqlite-wal` -> `860bbfd5dcbd12093a03b5dd64ffcd00288eb4920b1b6dd95068a939bba55674`

## 5. Smoke evidence
- Docker seminar поднят в `edge`:
  - `seminar-app Up (healthy)`
  - env-invariant keys присутствуют: `HOST`, `OBS_LOG_SOURCE`, `OBS_DOCKER_CONTAINER`, `DATABASE_PATH`
  - structured startup лог зафиксировал `host":"0.0.0.0`
- Внутренний smoke через `127.0.0.1:18080` + `Host: seminar-ai.ru`:
  - `/` -> `200`
  - `/api/healthz` -> `200`
  - `POST /api/leads` -> `200`
  - duplicate lead -> `409`
- Критическая аномалия:
  - при обращении `/admin/obs/logs` контейнер перезапускался;
  - в `docker logs seminar-app` зафиксировано:
    - `Error: spawn journalctl ENOENT`
  - это указывает на journald retrieval path внутри контейнера и отсутствие валидного docker retrieval path в live release.

## 6. Public switch evidence
- Public switch **не выполнен**:
  - `systemctl stop nginx` не выполнялся;
  - Traefik production stack на `:80/:443` не запускался.
- Причина: failure в smoke gate (`/admin/obs/logs` contract broken for docker runtime).

## 7. Rollback readiness
### Выполненный rollback (фактически)
1. `docker compose -f /opt/seminar/compose.seminar.yml down`
2. `systemctl start seminar`
3. Проверка legacy:
   - `systemctl is-active seminar nginx` -> `active / active`
   - `curl http://127.0.0.1:8787/api/healthz` -> `{"ok":true}`
   - `curl -I https://seminar-ai.ru` -> `HTTP/1.1 200 OK`

### Готовый rollback < 10 min (операционно)
1. Stop docker seminar route/container (`docker compose down` для seminar stack).
2. Ensure nginx active (`systemctl start nginx`).
3. Ensure legacy app active (`systemctl start seminar`).
4. Verify `https://seminar-ai.ru` + `/api/healthz`.

## 8. Verdict (PASS/ROLLBACK)
`ROLLBACK`

Обоснование:
1. Smoke gate для `/admin/obs/logs` в docker runtime не пройден.
2. Обнаружен конфликт live-artifact vs утвержденный OBS docker adapter baseline.
3. Cutover остановлен до переключения публичного edge, legacy доступ сохранен.

## 9. Next minimal step (1 пункт)
1. Обновить live release на VPS до артефакта с фактическим docker OBS adapter (`streamObsEvents`/`OBS_LOG_SOURCE=docker` path), повторить Task 2 smoke и только затем выполнять edge switch.
