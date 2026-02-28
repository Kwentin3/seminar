# OBS.LOGGING.PLAYBOOK.INCIDENTS.REPORT.1.report

## 1. Executive summary
Создан LLM-friendly incident playbook для observability baseline проекта «Семинары» с пошаговыми процедурами диагностики через NDJSON retrieval (CLI и HTTP debug endpoint).  
Код не менялся. Обновлена docs-навигация ссылкой на новый runbook.

## 2. SPEC GUARD results
Проверены источники:
- `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md`
- `docs/runbooks/OBS_LOG_RETRIEVAL.md`
- `scripts/obs/logs.mjs`
- `server/index.mjs`
- `docs/reports/2026-02-28/OBS.LOGGING.BASELINE.IMPLEMENT.1.report.md`
- `docs/reports/2026-02-28/OBS.LOGGING.BASELINE.HARDEN.1.report.md`

Фактический интерфейс CLI (`pnpm run obs:logs -- ...`):
- поддерживаются параметры:
  - `--since` (обязательный)
  - `--until` (опциональный)
  - `--level` (обязательный; exact filter: `debug|info|warn|error`)
  - `--request-id` (опциональный)
  - `--limit` (обязательный; cap до 2000)
  - `--service` (опциональный)
- output: NDJSON (`process.stdout.write(JSON.stringify(event)+"\n")`)

Фактический HTTP retrieval:
- endpoint: `GET /admin/obs/logs`
- auth: `X-Admin-Secret` через текущий admin механизм (`ADMIN_SECRET`, `isSecretValid`)
- параметры:
  - `since` required
  - `until` optional
  - `level` optional (exact filter)
  - `request_id` optional
  - `limit` default 200, max 2000
- response: `application/x-ndjson`, streaming (`flushHeaders` + `response.write(...)`)

Реально присутствующие MUST события:
- runtime: `http_request_started`, `http_request_completed`, `runtime_dependency_failed`
- leads: `lead_submit_started`, `lead_submit_completed`, `lead_submit_failed`
- admin: `admin_auth_succeeded`, `admin_auth_failed`
- obs: `obs.info_rate_limited`, `obs.payload_truncated`, `obs.redaction_failed`, `obs.schema_violation_detected`, `obs.missing_request_id_detected`, `obs.logger_internal_error` (+ `obs.event_size_exceeded`)

GAP (по контрактной таблице minimum set):
- content: `content_bundle_loaded`, `content_bundle_failed`, `content_schema_violation_detected` — отсутствуют
- landing: `hero_variant_selected`, `landing_render_degraded` — отсутствуют

## 3. Что создано
- Новый runbook:
  - `docs/runbooks/OBS_INCIDENT_PLAYBOOK.md`
- Внутри runbook:
  - Purpose / Prerequisites / Quick Start
  - Event model cheat sheet
  - 6 обязательных incident procedures (A–F)
  - Request trace workflow
  - HTTP retrieval section
  - GAP / Limitations
  - Appendix c 12 one-liners
- Интеграция в docs:
  - добавлена ссылка в `docs/README.md` (Primary Documents)

## 4. Файлы изменены
- `docs/runbooks/OBS_INCIDENT_PLAYBOOK.md` (new)
- `docs/README.md` (updated)
- `docs/reports/2026-02-28/OBS.LOGGING.PLAYBOOK.INCIDENTS.REPORT.1.report.md` (new)

## 5. Proof (ссылки на команды/интерфейсы, которые описаны)
- CLI параметры и обязательность:
  - `scripts/obs/logs.mjs` (`parseArgs`, required checks `since/level/limit`, output NDJSON)
- HTTP endpoint + auth + limits + streaming:
  - `server/index.mjs` (`/admin/obs/logs`, `authenticateAdminRequest`, `parseObsLimit`, `content-type`, `flushHeaders`, `response.write`)
- Реальные внедренные события и GAP:
  - `OBS.LOGGING.BASELINE.IMPLEMENT.1.report.md`
  - `OBS.LOGGING.BASELINE.HARDEN.1.report.md`
  - `server/index.mjs` / `server/obs/logger.mjs` (event wiring)

## 6. Verdict (PASS/FAIL)
PASS

## 7. Next minimal step (1 пункт)
1. Отдельной задачей добавить `content`/`landing` события (из контрактного minimum set) и расширить playbook процедурами для этих доменов.
