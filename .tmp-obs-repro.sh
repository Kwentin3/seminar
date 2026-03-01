#!/usr/bin/env bash
set -euo pipefail
secret="$(grep '^ADMIN_SECRET=' /etc/seminar/seminar.docker.env | sed 's/^ADMIN_SECRET=//' | tr -d '\r\n')"
since="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
status=$(curl -sS --max-time 8 -o /tmp/repro-obs.ndjson -w "%{http_code}" -H "Host: seminar-ai.ru" -H "X-Admin-Secret: ${secret}" "http://127.0.0.1:18080/admin/obs/logs?since=${since}&level=info&limit=5" || true)
echo "OBS_STATUS=${status}"
head -n 5 /tmp/repro-obs.ndjson 2>/dev/null || true
