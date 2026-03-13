---
id: CONTRACT-OBS-001.obs.logging-event-model
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: n/a
related:
  - docs/DOCS_CANON.md
  - docs/prd/PRD-PHASE-1.LANDING.md
  - docs/contracts/CONTRACT-001.landing.content-json.v1.0.md
tags:
  - contract
  - observability
  - logging
  - event-model
---

# CONTRACT-OBS-001: Logging Event Model v0.4

## Purpose / Scope
Этот контракт фиксирует baseline-модель событий логирования для Phase 1 проекта "Семинары". Контракт задает:
1. каноничную структуру события;
2. правила корреляции, редактирования и ограничения объема;
3. LLM-friendly извлечение логов;
4. обязательные проверки контракта (unit/integration/e2e-smoke).

Scope (Phase 1 runtime):
1. Local/dev runtime: Node.js + SQLite.
2. Canonical production runtime: Docker + Traefik + SQLite.
3. Legacy `systemd + journald + nginx` contour сохраняется только как rollback/live snapshot path.
4. Frontend console logging (без серверного ingestion pipeline в Phase 1).

## Goals
1. Сделать лог-события предсказуемыми и машинно-читаемыми.
2. Гарантировать correlation между бизнес-событиями и ошибками.
3. Исключить утечки секретов/PII (redaction-by-default).
4. Обеспечить надежный CLI-канал выдачи NDJSON для debug/LLM-агентов.

## Non-goals
1. Внешние APM/SaaS observability платформы.
2. Distributed tracing между сервисами.
3. Введение `audit_events` таблицы как канала наблюдаемости.
4. Полноценный metrics stack (Prometheus/Grafana и т.п.).

## Principles
1. Event-first: система пишет структурированные события, а не произвольные строки.
2. Correlation-first: каждое значимое событие связано с `request_id` или явной причиной отсутствия.
3. Redaction-by-default: payload считается небезопасным до очистки.
4. Bounded payload: размер события ограничен предсказуемым бюджетом.
5. Operational safety: logger MUST NOT ломать бизнес-поток.
6. LLM-friendly retrieval: выдача логов MUST быть доступна через CLI в NDJSON.

## Transport
1. Backend MUST писать JSON события в stdout.
2. Log retrieval source MUST быть явным и соответствовать runtime contour:
   - canonical production: docker logs adapter;
   - legacy rollback contour: journald.
3. Source switching MUST follow `CONTRACT-OBS-002`.
4. Frontend в Phase 1 SHOULD использовать только console logging; отправка frontend logs на backend MAY быть добавлена в следующих версиях контракта.

## Correlation Model
1. Backend MUST генерировать `request_id` для каждого HTTP-запроса.
2. Backend MUST возвращать `request_id` клиенту в `x-request-id`.
3. Async invariant MUST соблюдаться: приоритет AsyncLocalStorage; explicit pass допустим для участков, где ALS неприменим.
4. Для frontend:
   - `request_id` SHOULD пробрасываться best effort из HTTP ответа;
   - `client_session_id` MUST генерироваться при старте приложения и прикладываться к frontend событиям в `meta`.

## Canonical Event Model
Каждое backend событие MUST соответствовать каноничной форме:

```json
{
  "ts": "2026-02-27T12:34:56.789Z",
  "level": "info",
  "event": "lead_submitted",
  "domain": "leads",
  "module": "leads/submit-handler",
  "request_id": "req_01HS4M2EXAMPLE",
  "payload": {},
  "error": null,
  "duration_ms": 42,
  "meta": {
    "schema": "obs.event.v0.4"
  }
}
```

Field rules:
1. `ts` MUST быть ISO-8601 UTC.
2. `level` MUST быть одним из `debug|info|warn|error`.
3. `event` MUST быть `snake_case` и в прошедшем времени (`*_started`, `*_completed`, `*_failed`, `*_selected`, `*_limited`).
4. `domain` MUST описывать бизнес/операционный домен (`runtime`, `content`, `landing`, `leads`, `admin`, `cabinet`, `obs`).
5. `module` MUST быть `kebab-case/path` и MUST соответствовать regex `^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$`.
6. `request_id` SHOULD присутствовать для всех HTTP-связанных событий.
7. `request_id` SHOULD быть stable URL-safe opaque string (ULID/UUID/opaque id допустимы).
8. `payload` MUST быть объектом (пустой объект допустим).
9. `error` MUST быть `null` или объектом error contract.
10. `duration_ms` MAY отсутствовать для событий без измеряемой операции.
11. `meta` MUST быть объектом технических флагов схемы.

Semantic boundaries:
1. `domain` = зона ответственности (что произошло).
2. `module` = технический источник (где произошло).
3. `error.code` = нормализованный машинный код причины (почему неуспех).

## Severity Policy
1. `debug` MAY использоваться для локальной диагностики; в production SHOULD быть минимальным.
2. `info` MUST использоваться для штатных важных шагов потока.
3. `warn` MUST использоваться для деградаций и recoverable отклонений без остановки потока.
4. `error` MUST использоваться для неуспешного результата операции или нарушения инварианта.
5. Phase 1: `error` используется и для критических/фатальных случаев; отдельного `critical` уровня нет.
6. Один и тот же исход операции MUST NOT логироваться одновременно как `warn` и `error`.

## Error Contract (Namespaced)
При `level=error` поле `error` MUST иметь структуру:

```json
{
  "code": "leads.validation_failed",
  "category": "validation",
  "retryable": false,
  "origin": "domain",
  "message": "lead payload rejected by schema"
}
```

Rules:
1. `error.code` MUST быть namespaced и начинаться с: `content.`, `leads.`, `admin.`, `cabinet.`, `runtime.`, `obs.`.
2. `category` MUST описывать класс ошибки (например `validation`, `dependency`, `internal`, `timeout`).
3. `retryable` MUST быть boolean.
4. `origin` MUST быть одним из `domain|infra|external|obs`.
5. `message` MUST быть коротким и MUST NOT содержать PII/секреты.
6. При `level=error` поле `error` MUST быть объектом (не `null`).
7. При `level=warn` поле `error` MAY быть объектом как structured reason для деградации.
8. При `level=debug|info` поле `error` SHOULD быть `null`.
9. `origin` классифицирует происхождение причины (`domain|infra|external|obs`) и MUST NOT использоваться как замена `domain` или `module`.

## `obs` Domain (Self-Diagnostics)
`obs` домен MUST использоваться для самодиагностики подсистемы логирования/наблюдаемости.

Минимальные обязательные `obs` события:
1. `obs.info_rate_limited`
2. `obs.payload_truncated`
3. `obs.redaction_failed`
4. `obs.schema_violation_detected`
5. `obs.missing_request_id_detected`
6. `obs.logger_internal_error`

`obs` события SHOULD быть rate-limited, чтобы не создавать шум.

## Redaction-by-default (MUST)
1. Logger MUST применять редактирование до сериализации события.
2. Logger MUST NOT логировать в явном виде:
   - `authorization`, `cookie`, `token`, `password`, `api_key`;
   - connection strings;
   - `process.env` dump;
   - полный phone/email.
3. Известные чувствительные ключи MUST маскироваться автоматически (например `***redacted***`).
4. Если редактирование падает, logger MUST fail-closed:
   - бизнес-код продолжается;
   - пишется деградированное `obs.redaction_failed`;
   - исходный небезопасный payload MUST NOT быть выведен.

## Payload Budget (MUST)
1. Максимальный размер сериализованного события после redaction: 4KB.
2. При превышении лимита logger MUST обрезать payload детерминированно (с сохранением валидного JSON объекта).
3. В обрезанном событии MUST быть `meta.payload_truncated=true`.
4. Logger SHOULD дополнительно писать `obs.payload_truncated` (rate-limited).

## `duration_ms` Policy
1. Для lifecycle событий `duration_ms` MAY отсутствовать (`request_received`, `worker_tick_started`).
2. Для operational result событий `duration_ms` MUST присутствовать (`lead_submit_completed`, `admin_auth_failed`, `content_bundle_loaded`).

Examples:
1. `lead_submit_completed` MUST включать `duration_ms`.
2. `hero_variant_selected` MAY не включать `duration_ms`.

## Info Volume Control (No Heavy Pipeline)
Конфигурация через env (без магических чисел в коде):
1. `OBS_INFO_EVENTS_PER_REQUEST_MAX` (MUST, default `30`).
2. `OBS_INFO_EVENTS_PER_PROCESS_PER_SEC_MAX` (MAY, default `0` = disabled).

Behavior:
1. При превышении лимита `info` события MUST подавляться (drop), не сэмплироваться.
2. Для каждого `request_id` MUST логироваться только одно `obs.info_rate_limited`.
3. `obs.info_rate_limited.meta.suppressed_info_count` MUST содержать число подавленных `info` событий.

## Determinism Hooks
1. `content_bundle_hash` MUST вычисляться по нормализованному content bundle:
   - stable key ordering;
   - UTF-8;
   - canonical JSON serialization без пробельных вариаций.
2. `content_unit_hash` MUST вычисляться по нормализованному unit payload (один логический модуль контента).
3. Событие `hero_variant_selected` MUST включать:
   - `payload.variant_id`;
   - `payload.reason` (`persisted|random|fallback`);
   - `payload.content_unit_hash`.

## Mandatory Core Events (Phase 1)
Минимальный обязательный набор доменных событий:

| Domain | MUST Events (minimum set) |
|---|---|
| `runtime` | `http_request_started`, `http_request_completed`, `runtime_dependency_failed` |
| `content` | `content_bundle_loaded`, `content_bundle_failed`, `content_schema_violation_detected` |
| `landing` | `hero_variant_selected`, `landing_render_degraded` |
| `leads` | `lead_submit_started`, `lead_submit_completed`, `lead_submit_failed` |
| `admin` | `admin_auth_succeeded`, `admin_auth_failed`, `admin_action_denied` |
| `cabinet` | `cabinet_auth_failed`, `cabinet_login_succeeded`, `cabinet_logout_succeeded` |
| `obs` | `obs.info_rate_limited`, `obs.payload_truncated`, `obs.redaction_failed`, `obs.missing_request_id_detected`, `obs.logger_internal_error` |

Phase policy:
1. Таблица задает целевой minimum set по доменам для Phase 1.
2. Внедрение MUST Events допускается поэтапно.
3. Отсутствующие MUST Events MUST фиксироваться как GAP в отчете внедрения/верификации.

## LLM-Friendly Log Retrieval
### CLI (MUST)
Production MUST предоставлять CLI-команду/скрипт для чтения journald логов в NDJSON.

Required interface:
1. `--since` (MUST)
2. `--until` (MAY)
3. `--level` (MUST)
4. `--request-id` (MAY)
5. `--limit` (MUST)

Output contract:
1. Формат MUST быть JSONL/NDJSON (`1 line = 1 event`).
2. Источник MUST быть journald (`journalctl -u <service> ...`).
3. Команда MUST быть стабильна для production debug-процедур.

Example (non-normative):
```bash
./scripts/obs/logs.sh --since "2026-02-27T00:00:00Z" --level info --limit 200
```

### HTTP Debug Endpoint (SHOULD)
1. Endpoint SHOULD быть `GET /admin/obs/logs`.
2. `since` MUST быть обязательным query parameter.
3. Response SHOULD быть `application/x-ndjson`.
4. Response SHOULD быть streaming.
5. `limit` default SHOULD быть `200`; max SHOULD быть `2000`.
6. Auth MUST использовать текущий проектный admin механизм (`ADMIN_SECRET` или действующий эквивалент).
7. Endpoint MUST NOT позиционироваться как мониторинг pipeline; только debug/agent retrieval.

## Meta Schema (Allowed Keys)
`meta` MUST быть объектом и MAY содержать только перечисленные ключи:
1. `schema` (MUST, string, example: `obs.event.v0.4`)
2. `payload_truncated` (boolean)
3. `redaction_failed` (boolean)
4. `logger_error` (boolean)
5. `schema_violation` (boolean)
6. `missing_request_id` (boolean)
7. `process_id` (number|string)
8. `host` (string, optional)
9. `build` (string, optional)
10. `suppressed_info_count` (number)

## Fail-safe Rules (MUST)
1. Logger MUST NEVER throw в вызывающий код.
2. Если отсутствуют `module` или `event`, logger MUST подставить `unknown` и выставить `meta.schema_violation=true`.
3. Если в HTTP-событии отсутствует `request_id`, logger MUST:
   - выставить `meta.missing_request_id=true`;
   - выписать `obs.missing_request_id_detected` (rate-limited).
4. При проблемах сериализации logger MUST:
   - заменить `payload` на `{}`;
   - выставить `meta.logger_error=true`;
   - при необходимости выписать `obs.logger_internal_error`.

## Verification
### Unit (MUST)
1. Redaction: phone/email/token маскируются.
2. Naming enforcement: `event` проверяется по regex `^[a-z0-9]+(_[a-z0-9]+)*$` и policy прошедшего времени; `module` проверяется по regex `^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$`.
3. Payload budget truncation: при >4KB выставляется `meta.payload_truncated=true`.
4. Info rate limiting: при серии `info` событий (например, 25/35/50) соблюдается лимит `OBS_INFO_EVENTS_PER_REQUEST_MAX`, затем появляется `obs.info_rate_limited` с корректным `suppressed_info_count`.

### Integration (MUST)
1. Async correlation: один `request_id` сохраняется через `await`, таймеры и микротаски.

### E2E Smoke (SHOULD)
1. Lead flow: для одной заявки доступна связная цепочка событий по одному `request_id` (`lead_submit_started` -> `lead_submit_completed|lead_submit_failed`).

## Production Invariant: Journald Retention
Деплой-чеклист MUST включать настройку journald retention в `journald.conf`:
1. `SystemMaxUse=500M`
2. `MaxRetentionSec=2592000` (30 дней)

Без этих параметров observability baseline считается неполным для production.
