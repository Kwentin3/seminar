# OBS Log Retrieval (NDJSON)

Related contracts:
1. `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md`
2. `docs/contracts/CONTRACT-OBS-002.log-retrieval-sources.v0.1.md`

## Source selection (explicit, no fallback)

Set source explicitly:

```bash
export OBS_LOG_SOURCE=journald
# or
export OBS_LOG_SOURCE=docker
```

Rules:
1. `OBS_LOG_SOURCE` MUST be `journald` or `docker`.
2. Unknown value returns explicit error.
3. No auto-fallback between sources.

## CLI retrieval

Baseline command:

```bash
pnpm run obs:logs -- --since "2026-02-28T00:00:00Z" --level info --limit 200
```

Optional filters:

```bash
pnpm run obs:logs -- --since "2026-02-28T00:00:00Z" --until "2026-02-28T23:59:59Z" --level warn --request-id "req_xxx" --limit 50
```

Constraints:
1. `--since` is required.
2. `--level` is required (`debug|info|warn|error`).
3. `--limit` is required.
4. Output is NDJSON (`1 line = 1 JSON event`).

### Journald source env

```bash
export OBS_LOG_SOURCE=journald
export OBS_JOURNALD_SERVICE=seminar
# optional:
# export OBS_JOURNALCTL_BIN=/usr/bin/journalctl
```

### Docker source env

```bash
export OBS_LOG_SOURCE=docker
export OBS_DOCKER_CONTAINER=seminar-app
# optional:
# export OBS_DOCKER_BIN=/usr/bin/docker
```

Docker retrieval uses `docker logs` with args-array and allowlist options only.

## Admin endpoint (debug retrieval)

```bash
curl -N -H "X-Admin-Secret: <ADMIN_SECRET>" "http://127.0.0.1:8787/admin/obs/logs?since=2026-02-28T00:00:00Z&level=info&limit=200"
```

Constraints:
1. `since` is required.
2. `limit` default is `200`, max is `2000`.
3. Response type: `application/x-ndjson`.
4. Source is selected only through `OBS_LOG_SOURCE`.
5. Endpoint remains admin-protected (`X-Admin-Secret`).

## Budget behavior

1. Soft limit: query `limit` (bounded by endpoint max).
2. Hard caps are enforced for retrieval safety:
   - hard line cap;
   - hard byte cap.
3. When hard cap is reached, retrieval stops deterministically and emits structured diagnostics.
