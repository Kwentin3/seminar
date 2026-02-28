# OBS.LOGGING.BASELINE.IMPLEMENT.1.report

## 1. Executive summary
В проекте «Семинары» внедрён observability baseline по `CONTRACT-OBS-001.logging.event-model.v0.4.md`: единый fail-safe logger, сквозной `request_id` через `AsyncLocalStorage`, CLI retrieval из journald в NDJSON, debug endpoint `GET /admin/obs/logs`, wiring обязательных core событий (runtime/leads/admin), плюс unit/integration тесты контракта и smoke подтверждение.

## 2. SPEC GUARD results
- Прочитаны и использованы:
  - `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md`
  - `docs/contracts/CONTRACT-001.landing.content-json.v1.0.md`
  - `docs/DOCS_CANON.md`
  - `docs/prd/PRD-PHASE-1.LANDING.md`
- Обязательные OBS-инварианты, закрытые реализацией:
  - каноничная модель события (`ts/level/event/domain/module/request_id/payload/error/duration_ms/meta.schema`)
  - `logger MUST NEVER throw` (fail-safe)
  - redaction-by-default (phone/email/token/sensitive keys)
  - bounded payload 4KB + `meta.payload_truncated=true` + `obs.payload_truncated`
  - per-request info rate-limit через `OBS_INFO_EVENTS_PER_REQUEST_MAX` (default 30) + `obs.info_rate_limited` с `meta.suppressed_info_count`
  - async-correlation через `AsyncLocalStorage` + `x-request-id`
  - retrieval: CLI NDJSON и `/admin/obs/logs` NDJSON streaming с лимитами
- Затронутые слои:
  - runtime/backend (`server/index.mjs`, `server/obs/*`)
  - admin API (`/api/admin/leads`, `/admin/obs/logs`)
  - ops/debug retrieval (`scripts/obs/logs.mjs`, runbook)
  - CI/tests (`.github/workflows/ci.yml`, `tests/obs/*`)
- Текущий admin auth механизм найден и использован:
  - `server/index.mjs`: header `X-Admin-Secret` + env `ADMIN_SECRET` + `isSecretValid(...)`.
  - Этот же механизм применён к `/admin/obs/logs`.

## 3. Что сделано
- Logger baseline:
  - единый logger utility: `server/obs/logger.mjs`
  - API: `log({ ... })` + `debug/info/warn/error`
  - redaction-by-default, error contract normalization, payload budget 4KB, self-diagnostics `obs.*`
  - fail-safe поведение для schema violations, missing request_id, redaction/serialization проблем
- Correlation:
  - `AsyncLocalStorage` context: `server/obs/request-context.mjs`
  - middleware генерирует `request_id`, проставляет `x-request-id`, сохраняет context
- Retrieval:
  - journald reader: `server/obs/log-retrieval.mjs`
  - CLI: `scripts/obs/logs.mjs` (`--since`, `--until`, `--level`, `--request-id`, `--limit`)
  - HTTP debug endpoint: `GET /admin/obs/logs` (streaming NDJSON, auth, since required, limit default 200 max 2000)
  - runbook: `docs/runbooks/OBS_LOG_RETRIEVAL.md`
- Runtime wiring событий:
  - `runtime`: `http_request_started`, `http_request_completed`
  - `leads`: `lead_submit_started`, `lead_submit_completed`, `lead_submit_failed`
  - `admin`: `admin_auth_succeeded`, `admin_auth_failed`
  - `obs`: self-diagnostics из logger
- CI:
  - добавлен шаг `Test observability contract` в `.github/workflows/ci.yml`
- Tests:
  - unit: redaction, naming enforcement, payload budget, info-rate-limit
  - integration: async correlation
  - integration: CLI filtering + `/admin/obs/logs` streaming/auth/limit

## 4. Изменённые файлы
- `.github/workflows/ci.yml`
- `package.json`
- `server/index.mjs`
- `server/obs/request-context.mjs`
- `server/obs/logger.mjs`
- `server/obs/log-retrieval.mjs`
- `scripts/obs/logs.mjs`
- `tests/obs/logger.contract.test.mjs`
- `tests/obs/log-retrieval.integration.test.mjs`
- `docs/runbooks/OBS_LOG_RETRIEVAL.md`

## 5. Доказательства (logs / tests / responses)
- Shell context для проверок: PowerShell.
- Выполнено:
  - `pnpm -r lint` -> PASS
  - `pnpm -r typecheck` -> PASS
  - `pnpm -r build` -> PASS
  - `pnpm run validate:content` -> PASS
  - `pnpm run test:content:validator` -> PASS
  - `pnpm run test:obs` -> PASS (7 tests)
  - smoke leads (`node scripts/test-smoke-leads.mjs` при поднятом `server/index.mjs`) -> PASS
- Пример NDJSON chain (из smoke логов, один `request_id`):
  - `http_request_started` -> `lead_submit_started` -> `lead_submit_completed` -> `http_request_completed`
  - `request_id=req_ef740d5b-c604-4d50-b38d-7166b39ca4c8`
- Пример CLI фильтрации:
  - `pnpm run obs:logs -- --since "2026-02-28T00:00:00Z" --level info --request-id "req_ef740d5b-c604-4d50-b38d-7166b39ca4c8" --limit 5`
  - выдаёт NDJSON только для указанного `request_id`.
- PII redaction подтверждён:
  - unit-test `redaction masks phone, email and token values` PASS
  - в runtime логах phone/email/token не пишутся в открытом виде.

## 6. Strategic Gate verdict
PASS. Решение не является временным workaround: добавлен базовый наблюдаемый слой с контрактной моделью событий, централизованным logger, корреляцией запроса, retrieval каналами (CLI + admin endpoint), CI-гейтом и контрактными тестами.

GAP зафиксирован:
- В `CONTRACT-OBS-001` в таблице minimum set есть `content`/`landing` MUST events; в рамках этой задачи реализован согласованный минимальный поднабор из TASK 3 (runtime/leads/admin + obs self-diagnostics). Расширение до полного wish-list следует отдельной задачей.

## 7. Verdict (PASS / FAIL)
PASS

## 8. Next minimal step (1 пункт)
1. Добавить `content` и `landing` runtime события (`content_bundle_loaded|failed`, `content_schema_violation_detected`, `hero_variant_selected`, `landing_render_degraded`) на текущий content loader path, чтобы закрыть полный minimum set таблицы OBS контракта.
