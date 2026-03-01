# Seminar Migration to Docker (v2, Plan Only)

## Scope
План миграции `seminar` на Docker platform edge (Traefik) без изменения публичного API.

## Contract References
1. `docs/contracts/CONTRACT-OPS-001.sqlite-backup-sla.v0.1.md`
2. `docs/contracts/CONTRACT-OBS-002.log-retrieval-sources.v0.1.md`

## Preconditions
1. Live snapshots зафиксированы: `systemd`, `nginx`, env keys.
2. Traefik smoke stack green в изоляции (без захвата `:80/:443`).
3. External network `edge` создана.
4. Seminar image digest получен из CI GHCR publish (`ghcr.io/kwentin3/seminar@sha256:<digest>`).

## Hard Constraints From Audit
1. `HOST` внутри контейнера НЕ должен быть `127.0.0.1` (иначе Traefik не достучится).
2. SQLite переносится как trio файлов:
   - `seminar.sqlite`
   - `seminar.sqlite-wal`
   - `seminar.sqlite-shm`
3. До успешного smoke нельзя переключать production домен.

## Runtime Env Contract for Docker Seminar
- Required:
  - `PORT=8787`
  - `HOST=0.0.0.0`
  - `DATABASE_PATH=<mounted_volume_path>/seminar.sqlite`
  - `ADMIN_SECRET=<secret>`
- Optional (current behavior parity):
  - `TURNSTILE_SECRET_KEY`
  - `TURNSTILE_MODE`
  - `ALLOW_TURNSTILE_MOCK` (MUST remain disabled in prod)

## SQLite Volume Migration Procedure
1. Prepare destination volume path.
2. Stop legacy app writer (`seminar.service`) before copy.
3. Copy trio files atomically to destination.
4. Set owner/group to runtime user inside container.
5. Start Docker app and run read/write smoke.
6. Keep original copy for rollback window.

Reference copy command (example):
```bash
install -d -m 750 /opt/seminar/data
systemctl stop seminar
cp -a /var/lib/seminar/seminar.sqlite /opt/seminar/data/
cp -a /var/lib/seminar/seminar.sqlite-wal /opt/seminar/data/ 2>/dev/null || true
cp -a /var/lib/seminar/seminar.sqlite-shm /opt/seminar/data/ 2>/dev/null || true
```

## Backup/Restore Baseline (SQLite)
Backup/restore baseline зафиксирован контрактом:
`docs/contracts/CONTRACT-OPS-001.sqlite-backup-sla.v0.1.md`

Cutover gate:
1. Перед cutover MUST быть выполнен backup по контракту.
2. Restore success criteria MUST быть проверяемы через smoke.

## OBS `/admin/obs/logs` Policy Decision
OBS source policy зафиксирован контрактом:
`docs/contracts/CONTRACT-OBS-002.log-retrieval-sources.v0.1.md`

Cutover gate:
1. Для docker runtime MUST быть задан `OBS_LOG_SOURCE=docker`.
2. Для legacy runtime MUST быть задан `OBS_LOG_SOURCE=journald`.
3. No silent fallback между источниками.
4. `/admin/obs/logs` остается под `ADMIN_SECRET`.

## Cutover Sequence (High-Level)
1. Green smoke on Traefik + seminar container in non-prod exposure.
2. Freeze writes, execute final SQLite copy.
3. Switch edge ownership from nginx to Traefik.
4. Run smoke matrix (`/`, `/api/healthz`, lead submit, duplicate, admin auth).
5. Monitor error budget window before declaring stable.
