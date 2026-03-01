# VPS.PLATFORM.SEMINAR.CUTOVER.PROD.3.report

## 1. Executive summary
- Controlled production cutover completed with verdict `PASS`.
- Public domain `https://seminar-ai.ru` is served by Traefik -> Docker `seminar-app`.
- Deployment used pinned digest image only:
  - `ghcr.io/kwentin3/seminar@sha256:f17357c27e98897095b7945c5e529b3ed92dffd7d3ec5b47af80063a9744c5d4`
- Public smoke matrix and reboot resilience checks are green.

Run artifacts:
- `RUN_DIR=/opt/seminar/forensics/cutover3-20260301T161801Z`
- `SNAP_DIR=/opt/seminar/backups/cutover3-20260301T161801Z`

## 2. SPEC GUARD confirmation
Confirmed before and during run:
1. `CONTRACT-OPS-001.sqlite-backup-sla.v0.1` active.
2. `CONTRACT-OBS-002.log-retrieval-sources.v0.1` active.
3. `OBS_LOG_SOURCE=docker` in runtime env.
4. No DNS changes performed.
5. One-writer rule enforced: `seminar.service` stopped before SQLite snapshot and migration copy.

## 3. Snapshot evidence
Pre-cutover commands:
1. `systemctl is-active nginx seminar`
2. `curl -I https://seminar-ai.ru`
3. `systemctl stop seminar`
4. SQLite trio snapshot (`seminar.sqlite`, `seminar.sqlite-wal`, `seminar.sqlite-shm`)
5. `sha256sum` capture
6. writer absence check (no listener on `:8787`)

Snapshot SHA256:
```text
5c9dec1886cc01f5f2307ee1ea87f9b32a4cef0f8f9a2c68beebc558013bedab  seminar.sqlite
7beaa6cc6be8cbf3cd47bc2624bef72d5505d4fcdd1df7f7ba0f58a6169293b2  seminar.sqlite-shm
ad299957e0eccdf5d66c115b2ffd01950fdb47415c69638342d016d45395da4f  seminar.sqlite-wal
```

## 4. Parity proof
Pinned image pulled and deployed with:
1. `docker pull ghcr.io/kwentin3/seminar@sha256:f17357c27e98897095b7945c5e529b3ed92dffd7d3ec5b47af80063a9744c5d4`
2. `docker compose --env-file /opt/seminar/.env.seminar -f /opt/seminar/compose.seminar.ghcr.yml up -d --remove-orphans`

Parity checks (PASS):
```text
expected_image=ghcr.io/kwentin3/seminar@sha256:f17357c27e98897095b7945c5e529b3ed92dffd7d3ec5b47af80063a9744c5d4
runtime_image=ghcr.io/kwentin3/seminar@sha256:f17357c27e98897095b7945c5e529b3ed92dffd7d3ec5b47af80063a9744c5d4
expected_build_id=dcf5f3483d09b2639e40231293a42f78cbf872c3
runtime_build_id=dcf5f3483d09b2639e40231293a42f78cbf872c3
runtime_obs_source=docker
```

## 5. Smoke evidence
Public smoke results:
```text
ROOT_CODE=200
HEALTH_CODE=200
LEAD_CODE=200
DUP_CODE=409
OBS_CODE=200
```

`/admin/obs/logs` returned `200` in docker source mode.

## 6. Public switch evidence
Switch steps:
1. `systemctl stop nginx`
2. `docker compose --env-file /opt/platform/traefik/.env.platform-edge -f /opt/platform/traefik/compose.platform-edge.yml up -d --remove-orphans`

TLS confirmation:
```text
issuer=C = US, O = Let's Encrypt, CN = R13
subject=CN = seminar-ai.ru
```

HTTP confirmation:
```text
curl -I https://seminar-ai.ru -> HTTP/2 200
```

## 7. Rollback readiness
Dry-run rollback sequence (documented, not executed):
1. `docker compose --env-file /opt/platform/traefik/.env.platform-edge -f /opt/platform/traefik/compose.platform-edge.yml down`
2. `docker compose --env-file /opt/seminar/.env.seminar -f /opt/seminar/compose.seminar.ghcr.yml down`
3. `systemctl start nginx`
4. `systemctl start seminar`
5. Legacy smoke check: `https://seminar-ai.ru`, `http://127.0.0.1:8787/api/healthz`

Current owner state:
1. `nginx` -> `inactive`
2. `seminar` -> `inactive`
3. `docker` -> `active`
4. `:80/:443` owned by docker-proxy (Traefik stack)

## 8. Verdict (PASS / ROLLBACK)
`PASS`

## 9. Next minimal step (1 пункт)
1. Перевести legacy unit/service в explicit standby policy и удерживать мониторинг acceptance window перед полной деактивацией legacy flow.
