---
id: CONTRACT-OBS-002.log-retrieval-sources
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-01
core_snapshot: n/a
related:
  - docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md
  - docs/runbooks/OBS_LOG_RETRIEVAL.md
  - docs/runbooks/SEMINAR_MIGRATION_DOCKER.md
tags:
  - contract
  - observability
  - logs
  - retrieval
---

# CONTRACT-OBS-002: Log Retrieval Sources v0.1

## Purpose / Scope
Контракт задаёт минимальную модель retrieval-источников для `/admin/obs/logs` и CLI retrieval tooling, сохраняя текущий structured logging contract.

Scope:
1. Retrieval sources: `journald` (legacy), `docker` (docker runtime).
2. Endpoint `GET /admin/obs/logs`.
3. CLI retrieval script (`pnpm run obs:logs -- ...`).

Non-goals:
1. Внешние observability системы (Loki/ELK/etc).
2. Изменение публичного API `/admin/obs/logs`.
3. Полный observability stack redesign.

## Source Model
Supported sources:
1. `journald` (source of truth для legacy baseline).
2. `docker` (source of truth для docker runtime через `docker logs`).

Selection rule:
1. Source MUST задаваться явно:
   - env: `OBS_LOG_SOURCE=journald|docker`
2. No silent fallback:
   - если выбран `docker`, но docker retrieval недоступен -> error;
   - если выбран `journald`, но journald retrieval недоступен -> error.

Unknown source policy:
1. Невалидное значение `OBS_LOG_SOURCE` MUST приводить к явной ошибке retrieval.

## Retrieval Interface (Minimum)
Обязательные параметры семантики:
1. `since` (required)
2. `level` (optional for endpoint; required for CLI parity when указано в интерфейсе запуска)
3. `limit` (bounded)
4. `request_id` (optional filter)
5. `until` (optional)

Docker source env:
1. `OBS_DOCKER_CONTAINER` (container name selector; default `seminar-app`).
2. `OBS_DOCKER_BIN` (default `docker`).

Journald source env:
1. `OBS_JOURNALD_SERVICE` (default `seminar`).
2. `OBS_JOURNALCTL_BIN` (default `journalctl`).

## Docker Retrieval Contract
1. Retrieval выполняется через `docker logs` как args-array (без shell string interpolation).
2. Допустимые аргументы формируются только из allowlist (`--since`, `--until`, `--tail`, `--timestamps`, container selector).
3. Container selector:
   - by name via `OBS_DOCKER_CONTAINER`;
   - label selector не обязателен в v0.1.
4. Structured logs format сохраняется: retrieval возвращает NDJSON-совместимые JSON lines.

## Budgets / Caps
Budget model:
1. Soft line limit: запрошенный `limit` (после bounded clamp).
2. Hard cap lines: `OBS_LOG_HARD_CAP_LINES` (default `2000`).
3. Hard cap bytes: `OBS_LOG_HARD_CAP_BYTES` (default `1048576`, 1 MiB).

Behavior:
1. Retrieval MAY немного превысить soft line limit только в пределах hard caps.
2. При достижении hard cap lines/bytes поток MUST быть остановлен контролируемо.
3. При budget overflow retrieval MUST:
   - вернуть явный отказ (4xx/5xx на endpoint в зависимости от failure type);
   - зафиксировать structured event с причиной лимита.

## Security Requirements
1. Endpoint остаётся под существующей admin-auth моделью (`ADMIN_SECRET`).
2. Secrets MUST NOT быть выведены в retrieval output и service logs.
3. Shell injection MUST быть невозможен:
   - only args-array spawn;
   - no `shell=true` for docker retrieval path;
   - no raw command concatenation from query/env.

## Structured Decision Events
Retrieval implementation MUST писать self-diagnostics события:
1. source selection event (например `obs_log_source_selected`) с source + caps.
2. completion event (например `obs_log_retrieval_completed`) с source + emitted_lines + emitted_bytes.
3. failure event через существующий admin failure contract (`admin_action_failed`, `admin.obs_logs_failed`).

Все события MUST соответствовать `CONTRACT-OBS-001`.

## Compatibility
1. Journald path MUST оставаться рабочим и совместимым с legacy runbook.
2. Docker path добавляется без изменения публичного endpoint contract.
3. При запуске на legacy runtime рекомендованный source: `journald`.
4. При запуске на docker runtime рекомендованный source: `docker`.
