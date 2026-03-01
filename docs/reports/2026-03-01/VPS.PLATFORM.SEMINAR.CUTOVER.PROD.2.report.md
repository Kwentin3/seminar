# VPS.PLATFORM.SEMINAR.CUTOVER.PROD.2.report

## 1. Executive summary
- Production cutover `seminar` на Traefik `:80/:443` выполнен частично и завершился `ROLLBACK`.
- Pre-cutover gates (snapshot, pinned digest parity, smoke через `127.0.0.1:18080`) прошли успешно.
- На этапе public switch Traefik в `:80/:443` отдавал self-signed TLS certificate, валидный LE cert не поднялся в отведённое окно.
- По hard rule выполнен немедленный rollback на `nginx + systemd`; публичный доступ восстановлен.

## 2. SPEC GUARD confirmation
Подтверждено перед cutover:
1. `CONTRACT-OPS-001.sqlite-backup-sla.v0.1` присутствует и используется для snapshot procedure.
2. `CONTRACT-OBS-002.log-retrieval-sources.v0.1` присутствует; docker source policy соблюдён.
3. Deploy Docker Contract Mode A активен:
   - pinned digest only;
   - parity-check до edge switch.
4. CI publish digest зафиксирован:
   - run: `https://github.com/Kwentin3/seminar/actions/runs/22544771309`
   - image: `ghcr.io/kwentin3/seminar@sha256:f17357c27e98897095b7945c5e529b3ed92dffd7d3ec5b47af80063a9744c5d4`
   - build_id: `dcf5f3483d09b2639e40231293a42f78cbf872c3`

## 3. Snapshot evidence
Snapshot (вторая итерация, актуальная перед switch):
- `SNAPSHOT_DIR=/opt/seminar/backups/cutover2b-20260301T141151Z`

Writer control:
1. `systemctl stop seminar`
2. проверка listener `127.0.0.1:8787` -> отсутствует на момент snapshot
3. `seminar-app` container удалён перед копированием (writer исключён)

Copied SQLite trio:
1. `seminar.sqlite`
2. `seminar.sqlite-wal`
3. `seminar.sqlite-shm`

SHA256:
```text
5c9dec1886cc01f5f2307ee1ea87f9b32a4cef0f8f9a2c68beebc558013bedab  seminar.sqlite
7beaa6cc6be8cbf3cd47bc2624bef72d5505d4fcdd1df7f7ba0f58a6169293b2  seminar.sqlite-shm
ad299957e0eccdf5d66c115b2ffd01950fdb47415c69638342d016d45395da4f  seminar.sqlite-wal
```

## 4. Parity proof
Pulled image (pinned digest):
```text
ghcr.io/kwentin3/seminar@sha256:f17357c27e98897095b7945c5e529b3ed92dffd7d3ec5b47af80063a9744c5d4
```

Parity checks before switch (PASS):
1. `.Config.Image` == expected pinned digest reference.
2. `BUILD_ID=dcf5f3483d09b2639e40231293a42f78cbf872c3`.
3. `OBS_LOG_SOURCE=docker`.
4. `spawn journalctl ENOENT` = `0`.
5. `spawn docker ENOENT` = `0`.

## 5. Smoke evidence
Smoke via Traefik smoke bind (`127.0.0.1:18080`) before public switch:
```text
ROOT_CODE=200
HEALTH_CODE=200
OBS_CODE=200
```

Дополнительно (первая итерация pre-switch):
```text
LEAD_CODE=200
DUP_CODE=409
```

OBS signal:
1. `obs_log_source_selected` присутствует в `seminar-app` logs.
2. source marker -> `docker`.

## 6. Public switch evidence
Что было выполнено:
1. остановлен `nginx`;
2. поднят Traefik prod stack (`compose.platform-edge.yml`) на `:80/:443`;
3. выполнена TLS проверка `https://seminar-ai.ru`.

Failure signature:
```text
curl: (60) SSL certificate problem: self signed certificate
```

Повторная попытка с TLS retry (~3 минуты) дала тот же результат:
1. валидный cert не появился в retry window;
2. cutover остановлен по hard rule.

ACME state after attempts:
1. `/opt/platform/traefik/acme/acme.json` существует;
2. `le.Certificates` = `null` (cert не выдан на момент попытки).

## 7. Rollback readiness
Rollback выполнен фактически (не только dry-run):
1. `docker compose --env-file /opt/platform/traefik/.env.platform-edge -f /opt/platform/traefik/compose.platform-edge.yml down`
2. `systemctl start nginx`
3. `systemctl start seminar`
4. проверка:
   - `systemctl is-active nginx seminar` -> `active / active`
   - `curl http://127.0.0.1:8787/api/healthz` -> `{"ok":true}`
   - `curl -I https://seminar-ai.ru` -> `HTTP/1.1 200 OK`

Rollback SLA check:
1. фактическое восстановление legacy прошло в пределах минутного окна (значительно < 10 минут).

## 8. Verdict (PASS / ROLLBACK)
`ROLLBACK`

Причина:
1. public edge switch не прошёл TLS gate (self-signed certificate вместо валидного LE cert).
2. hard rule соблюдён: при аномалии выполнен немедленный rollback.

## 9. Next minimal step (1 пункт)
1. Перед повторным cutover закрыть ACME gate (получить валидный LE cert на Traefik prod stack и зафиксировать причину, почему `le.Certificates` остаётся пустым), затем повторить `PROD` cutover prompt.
