# OBS Incident Playbook (LLM-Friendly)

## Purpose
Этот playbook предназначен для кодового/LLM-агента и инженера дежурства проекта «Семинары».

Цель:
- быстро диагностировать инциденты через уже внедренный observability baseline;
- делать это без чтения исходного кода.

Источник истины:
- backend structured logs в journald;
- retrieval в формате NDJSON (`1 line = 1 JSON event`) через:
  - CLI: `pnpm run obs:logs -- ...`
  - HTTP debug endpoint: `GET /admin/obs/logs` (если нужен удаленный доступ агентом).

## Prerequisites
- Рабочее место: production VPS или shell с доступом к production journald.
- В репозитории доступны `pnpm` и скрипт `obs:logs`:
  - `pnpm run obs:logs -- --since "2026-02-28T00:00:00Z" --level info --limit 1`
- Для HTTP retrieval нужен admin auth:
  - заголовок `X-Admin-Secret: <ADMIN_SECRET>`
  - секрет не печатать в терминал/логи/отчеты.
- В примерах ниже использовать placeholder’ы:
  - `<ADMIN_SECRET>`
  - `<REQUEST_ID>`
  - `<SINCE_ISO>`

## Quick Start (30 Seconds)
1. Последние `warn` за 10 минут:
```bash
SINCE="$(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
pnpm run obs:logs -- --since "$SINCE" --level warn --limit 200
```

2. Последние `error` за 10 минут:
```bash
SINCE="$(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
pnpm run obs:logs -- --since "$SINCE" --level error --limit 200
```

3. Поиск цепочки по `request_id` (info + warn + error):
```bash
SINCE="$(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
for L in info warn error; do
  pnpm run obs:logs -- --since "$SINCE" --level "$L" --request-id "<REQUEST_ID>" --limit 200
done
```

4. Фильтр по домену (`leads`) через `jq`:
```bash
SINCE="$(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
pnpm run obs:logs -- --since "$SINCE" --level error --limit 500 | jq -c 'select(.domain=="leads")'
```

## Event Model Cheat Sheet
- `domain`: бизнес-зона (`runtime|leads|admin|obs`).
- `module`: технический источник (например `leads/submit-handler`).
- `event`: машинное имя события (`*_started|*_completed|*_failed|...`).
- `request_id`: ключ корреляции всех событий одного HTTP запроса.
- `error.code`: машинная причина (namespaced: `runtime.*`, `leads.*`, `admin.*`, `obs.*`).
- `meta`: технические флаги (`schema`, `payload_truncated`, `schema_violation`, `logger_error`, `missing_request_id`, ...).

Severity:
- `info`: штатный ход процесса.
- `warn`: деградация без полной остановки.
- `error`: неуспешная операция или нарушение инварианта.

Ключевые `obs.*` self-diagnostics:
- `obs.info_rate_limited`
- `obs.payload_truncated`
- `obs.redaction_failed`
- `obs.schema_violation_detected`
- `obs.missing_request_id_detected`
- `obs.logger_internal_error`
- `obs.event_size_exceeded`

## Incident Procedures
### A) Лиды не доходят / пропали
Symptoms:
- бизнес видит провалы заявок, формы отправляются нестабильно.

Hypotheses:
- backend отклоняет заявки (`lead_submit_failed`);
- rate limit / duplicate / turnstile / internal error;
- запросы не доходят до `/api/leads`.

Commands:
```bash
SINCE="$(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
pnpm run obs:logs -- --since "$SINCE" --level error --limit 500 | jq -c 'select(.domain=="leads" or .event=="http_request_failed")'
pnpm run obs:logs -- --since "$SINCE" --level info --limit 500 | jq -c 'select(.event=="lead_submit_started" or .event=="lead_submit_completed")'
```

Expected signals:
- `lead_submit_failed` с `error.code`:
  - `leads.turnstile_failed`
  - `leads.rate_limited`
  - `leads.duplicate_lead`
  - `leads.validation_failed`
  - `leads.internal_error`
  - `leads.unhandled_exception`
- дисбаланс: много `lead_submit_started`, мало `lead_submit_completed`.

Next action:
- взять `request_id` проблемного `lead_submit_failed` и пройти Request Trace Workflow.

### B) Валидация лида режет трафик
Symptoms:
- рост 4xx по лидам, жалобы на “не проходит форма”.

Hypotheses:
- ошибка нормализации телефона/страны;
- некорректный payload клиента;
- жесткие входные проверки.

Commands:
```bash
SINCE="$(date -u -d '60 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
pnpm run obs:logs -- --since "$SINCE" --level error --limit 500 | jq -c 'select(.event=="lead_submit_failed")'
pnpm run obs:logs -- --since "$SINCE" --level warn --limit 500 | jq -c 'select(.event=="http_request_failed")'
```

Expected signals:
- `lead_submit_failed` + `error.code` в `leads.validation_failed` / `leads.country_required`.
- `payload.reason` часто содержит `invalid_input` / `country_required`.

Next action:
- сверить проблемные случаи с контрактом входного payload формы и country/phone нормализацией.

### C) База/зависимость отвалилась (`runtime_dependency_failed`)
Symptoms:
- ошибки после релиза/рестарта, сервис деградирует.

Hypotheses:
- не выставлен критичный env;
- внешняя зависимость недоступна;
- runtime стартовал с предупреждениями.

Commands:
```bash
SINCE="$(date -u -d '120 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
pnpm run obs:logs -- --since "$SINCE" --level warn --limit 500 | jq -c 'select(.event=="runtime_dependency_failed")'
pnpm run obs:logs -- --since "$SINCE" --level error --limit 500 | jq -c 'select(.domain=="runtime")'
```

Expected signals:
- `runtime_dependency_failed` с `error.code`:
  - `runtime.turnstile_not_configured`
  - `runtime.admin_secret_missing`
- или `http_request_failed` + `runtime.unhandled_error`.

Next action:
- проверить env и состояние зависимостей по runbook’ам deploy/runtime.

### D) Admin доступ не работает (auth failures vs internal)
Symptoms:
- `/api/admin/leads` или `/admin/obs/logs` возвращает 401/500.

Hypotheses:
- неверный `X-Admin-Secret`;
- `ADMIN_SECRET` отсутствует;
- внутренняя ошибка admin handler.

Commands:
```bash
SINCE="$(date -u -d '60 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
pnpm run obs:logs -- --since "$SINCE" --level warn --limit 500 | jq -c 'select(.event=="admin_auth_failed")'
pnpm run obs:logs -- --since "$SINCE" --level error --limit 500 | jq -c 'select(.event=="admin_action_failed" or .event=="http_request_failed")'
```

Expected signals:
- `admin_auth_failed` + `error.code=admin.unauthorized` -> auth проблема (401).
- `admin_action_failed` + `error.code=admin.secret_missing` -> env проблема (500).
- `admin_action_failed` + `error.code=admin.action_failed|admin.unhandled_exception|admin.obs_logs_failed|admin.leads_query_failed` -> внутренняя ошибка.

Next action:
- сначала исключить auth/env, затем идти в trace по конкретному `request_id`.

### E) Логгер сломан/шумит (`obs.*`)
Symptoms:
- необычно много `obs.*`, потеря диагностичности, подозрение на проблемы логгера.

Hypotheses:
- schema violation в событиях;
- redaction/serialization деградация;
- rate limit режет полезные info;
- oversized события.

Commands:
```bash
SINCE="$(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
pnpm run obs:logs -- --since "$SINCE" --level warn --limit 1000 | jq -c 'select(.domain=="obs")'
pnpm run obs:logs -- --since "$SINCE" --level error --limit 1000 | jq -c 'select(.domain=="obs")'
```

Expected signals:
- `obs.schema_violation_detected`
- `obs.redaction_failed`
- `obs.logger_internal_error`
- `obs.info_rate_limited` (`meta.suppressed_info_count`)
- `obs.payload_truncated`
- `obs.event_size_exceeded`

Next action:
- если есть `obs.logger_internal_error` или массовые `schema_violation_detected`, зафиксировать инцидент уровня observability и собрать sample по `request_id`.

### F) Запросы медленные (`duration_ms`)
Symptoms:
- рост latency API, жалобы на “долго отвечает”.

Hypotheses:
- деградация в leads flow;
- bottleneck в обработчике или зависимостях;
- хвост latency в runtime.

Commands:
```bash
SINCE="$(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
pnpm run obs:logs -- --since "$SINCE" --level info --limit 1000 | jq -c 'select(.event=="http_request_completed" and .duration_ms>=500)'
pnpm run obs:logs -- --since "$SINCE" --level info --limit 1000 | jq -c 'select(.event=="lead_submit_completed" and .duration_ms>=500)'
pnpm run obs:logs -- --since "$SINCE" --level error --limit 1000 | jq -c 'select(.event=="lead_submit_failed" or .event=="http_request_failed")'
```

Expected signals:
- высокий `duration_ms` в `http_request_completed`.
- при деградации лидов: `lead_submit_failed` и/или рост `duration_ms` в `lead_submit_completed`.

Next action:
- выбрать top-N медленных `request_id` и пройти trace для корневой причины.

### G) Лендинг деградировал из-за контента (`content`/`landing`)
Symptoms:
- Hero/roles ведут себя нестабильно после релиза контента.

Hypotheses:
- bundle не загрузился (`content_bundle_failed`);
- bundle загружен, но контракт нарушен (`content_schema_violation_detected`);
- рендер деградировал (`landing_render_degraded`).

Commands:
```bash
SINCE="$(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
pnpm run obs:logs -- --since "$SINCE" --level info --limit 1000 | jq -c 'select(.event=="content_bundle_loaded" or .event=="hero_variant_selected")'
pnpm run obs:logs -- --since "$SINCE" --level warn --limit 1000 | jq -c 'select(.event=="content_schema_violation_detected" or .event=="landing_render_degraded")'
pnpm run obs:logs -- --since "$SINCE" --level error --limit 1000 | jq -c 'select(.event=="content_bundle_failed")'
```

Expected signals:
- `content_bundle_loaded` + `payload.content_bundle_hash`.
- `hero_variant_selected` + `payload.variant_id|reason|content_unit_hash`.
- `content_schema_violation_detected` + `error.code=content.*` + `payload.degradation_tier`.
- `landing_render_degraded` + `error.code=landing.*`.

Next action:
- взять `request_id` из первого `warn/error` и пройти Request Trace Workflow.

## Request Trace Workflow
1. Найти проблемное событие (`warn`/`error`) и выписать `request_id`.
2. Выгрузить timeline по `request_id` в нескольких severity:
```bash
SINCE="$(date -u -d '60 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"
RID="<REQUEST_ID>"
for L in info warn error; do
  pnpm run obs:logs -- --since "$SINCE" --level "$L" --request-id "$RID" --limit 500
done
```
3. Собрать цепочку:
- ожидаемый каркас: `http_request_started -> <domain events> -> http_request_completed|http_request_failed`
- для лидов: `lead_submit_started -> lead_submit_completed|lead_submit_failed`.
4. Если цепочка неполная:
- проверить `obs.missing_request_id_detected`;
- расширить `--since` окно.

## HTTP Retrieval (Debug Endpoint)
Endpoint:
- `GET /admin/obs/logs`
- query:
  - `since` (required)
  - `until` (optional)
  - `level` (optional exact filter)
  - `request_id` (optional)
  - `limit` (default 200, max 2000)
- auth:
  - header `X-Admin-Secret: <ADMIN_SECRET>`

Примеры:
```bash
# 200 warn за 10 минут
curl -N \
  -H "X-Admin-Secret: <ADMIN_SECRET>" \
  "http://127.0.0.1:8787/admin/obs/logs?since=$(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ)&level=warn&limit=200"

# Цепочка по request_id
curl -N \
  -H "X-Admin-Secret: <ADMIN_SECRET>" \
  "http://127.0.0.1:8787/admin/obs/logs?since=<SINCE_ISO>&level=info&request_id=<REQUEST_ID>&limit=500"
```

## GAP / Limitations
- В runtime доступны события доменов `runtime`, `content`, `landing`, `leads`, `admin`, `obs`.
- Для `content/landing` диагностики ориентироваться на связку:
  - `content_bundle_loaded|content_bundle_failed`
  - `content_schema_violation_detected`
  - `hero_variant_selected`
  - `landing_render_degraded`

## Appendix: One-Liners
1. `warn` за 15 минут:
```bash
pnpm run obs:logs -- --since "$(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%SZ)" --level warn --limit 500
```
2. `error` за 15 минут:
```bash
pnpm run obs:logs -- --since "$(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%SZ)" --level error --limit 500
```
3. Только `leads` из `error`:
```bash
pnpm run obs:logs -- --since "<SINCE_ISO>" --level error --limit 1000 | jq -c 'select(.domain=="leads")'
```
4. Только `obs` diagnostics:
```bash
pnpm run obs:logs -- --since "<SINCE_ISO>" --level warn --limit 1000 | jq -c 'select(.domain=="obs")'
```
5. По `request_id` и `info`:
```bash
pnpm run obs:logs -- --since "<SINCE_ISO>" --level info --request-id "<REQUEST_ID>" --limit 500
```
6. По `request_id` и `error`:
```bash
pnpm run obs:logs -- --since "<SINCE_ISO>" --level error --request-id "<REQUEST_ID>" --limit 500
```
7. Найти `runtime_dependency_failed`:
```bash
pnpm run obs:logs -- --since "<SINCE_ISO>" --level warn --limit 1000 | rg "runtime_dependency_failed"
```
8. Найти `lead_submit_failed`:
```bash
pnpm run obs:logs -- --since "<SINCE_ISO>" --level error --limit 1000 | rg "lead_submit_failed"
```
9. Найти schema violations:
```bash
pnpm run obs:logs -- --since "<SINCE_ISO>" --level warn --limit 1000 | rg "obs.schema_violation_detected"
```
10. Найти `obs.info_rate_limited` и suppressed count:
```bash
pnpm run obs:logs -- --since "<SINCE_ISO>" --level warn --limit 1000 | jq -c 'select(.event=="obs.info_rate_limited") | {ts,request_id,suppressed:.meta.suppressed_info_count}'
```
11. Грубая статистика событий по domain (info):
```bash
pnpm run obs:logs -- --since "<SINCE_ISO>" --level info --limit 2000 | jq -r '.domain' | sort | uniq -c
```
12. Топ request_id в error (best-effort):
```bash
pnpm run obs:logs -- --since "<SINCE_ISO>" --level error --limit 2000 | jq -r '.request_id' | sort | uniq -c | sort -nr | head
```
13. `content_bundle_failed` за окно:
```bash
pnpm run obs:logs -- --since "<SINCE_ISO>" --level error --limit 1000 | jq -c 'select(.event=="content_bundle_failed")'
```
14. `landing_render_degraded` за окно:
```bash
pnpm run obs:logs -- --since "<SINCE_ISO>" --level warn --limit 1000 | jq -c 'select(.event=="landing_render_degraded")'
```
