#!/usr/bin/env bash
set -euo pipefail
base="http://127.0.0.1:18080"
host="seminar-ai.ru"
secret=$(grep '^ADMIN_SECRET=' /etc/seminar/seminar.docker.env | sed 's/^ADMIN_SECRET=//' | tr -d '\r\n')
since=$(date -u +%Y-%m-%dT%H:%M:%SZ)

home_status=$(curl -sS -o /tmp/parity-home.out -w '%{http_code}' -H "Host: ${host}" "${base}/")
health_status=$(curl -sS -o /tmp/parity-health.json -w '%{http_code}' -H "Host: ${host}" "${base}/api/healthz")

payload='{"name":"Parity Smoke User","phone":"+79990001123","locale":"ru","source":"parity-smoke","turnstile_token":"x"}'
lead_create_status=$(curl -sS -o /tmp/parity-lead-create.json -w '%{http_code}' -H "Host: ${host}" -H 'Content-Type: application/json' --data "$payload" "${base}/api/leads")
lead_dup_status=$(curl -sS -o /tmp/parity-lead-dup.json -w '%{http_code}' -H "Host: ${host}" -H 'Content-Type: application/json' --data "$payload" "${base}/api/leads")

obs_status=$(curl -sS --max-time 8 -o /tmp/parity-obs.ndjson -w '%{http_code}' -H "Host: ${host}" -H "X-Admin-Secret: ${secret}" "${base}/admin/obs/logs?since=${since}&level=info&limit=20" || true)

printf 'HOME_STATUS=%s\n' "$home_status"
printf 'HEALTH_STATUS=%s\n' "$health_status"
printf 'LEAD_CREATE_STATUS=%s\n' "$lead_create_status"
printf 'LEAD_DUP_STATUS=%s\n' "$lead_dup_status"
printf 'OBS_STATUS=%s\n' "$obs_status"
printf 'HEALTH_BODY='; cat /tmp/parity-health.json; printf '\n'
printf 'LEAD_CREATE_BODY='; cat /tmp/parity-lead-create.json; printf '\n'
printf 'LEAD_DUP_BODY='; cat /tmp/parity-lead-dup.json; printf '\n'
printf 'OBS_HEAD\n'; head -n 10 /tmp/parity-obs.ndjson || true