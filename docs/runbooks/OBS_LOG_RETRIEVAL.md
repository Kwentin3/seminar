# OBS Log Retrieval (NDJSON)

## CLI (`journalctl` -> NDJSON)

```bash
pnpm run obs:logs -- --since "2026-02-28T00:00:00Z" --level info --limit 200
```

Optional filters:

```bash
pnpm run obs:logs -- --since "2026-02-28T00:00:00Z" --until "2026-02-28T23:59:59Z" --level warn --request-id "req_xxx" --limit 50
```

Notes:
- `--since` is required.
- `--level` is required (`debug|info|warn|error`).
- `--limit` is required.
- Output is NDJSON (`1 line = 1 JSON event`).

## Admin endpoint (debug retrieval)

```bash
curl -N -H "X-Admin-Secret: <ADMIN_SECRET>" "http://127.0.0.1:8787/admin/obs/logs?since=2026-02-28T00:00:00Z&level=info&limit=200"
```

Constraints:
- `since` is required.
- `limit` default is `200`, max is `2000`.
- Response type: `application/x-ndjson`.
