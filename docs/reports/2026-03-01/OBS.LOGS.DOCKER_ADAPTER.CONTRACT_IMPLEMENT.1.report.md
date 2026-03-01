# OBS.LOGS.DOCKER_ADAPTER.CONTRACT_IMPLEMENT.1.report

## 1. Executive summary
- Закрыт `STOP_CONTRACT_REQUIRED` для OBS/backup контуров: добавлены минимальные контракты SQLite backup/restore SLA и OBS log retrieval sources.
- Реализован минимальный docker adapter для `/admin/obs/logs` через `docker logs` (args-array, без shell fallback), при сохранении journald path.
- Добавлен явный выбор источника `OBS_LOG_SOURCE=journald|docker` без silent fallback.
- Добавлены тесты на source selection, docker command args, budget overflow и совместимость journald.
- Проверки `lint`, `typecheck`, `test:obs` прошли успешно.

## 2. SPEC GUARD results
### Проверенные SoT
- `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md`
- `docs/runbooks/OBS_LOG_RETRIEVAL.md`
- `server/obs/log-retrieval.mjs`
- `docs/reports/2026-03-01/VPS.PLATFORM.DOCKER.TRAEFIK.BASELINE.1.report.md`
- `docs/runbooks/SEMINAR_MIGRATION_DOCKER.md`
- `docs/adr/ADR-001.infrastructure.baseline.v1.md`

### Инварианты, которые нельзя нарушать
1. Structured logging contract v0.4 (schema/event naming/error namespace/redaction/budget) сохраняется.
2. `/admin/obs/logs` остаётся под admin auth (`ADMIN_SECRET`) и не раскрывает секреты.
3. Legacy journald retrieval path остаётся рабочим.
4. Никаких silent fallback между источниками логов.

### Минимально допустимый интерфейс log retrieval
1. Query: `since` (required), `until` (optional), `level` (optional endpoint), `request_id` (optional), `limit` (bounded).
2. Env source selector: `OBS_LOG_SOURCE=journald|docker` (explicit).
3. Source-specific env:
   - journald: `OBS_JOURNALD_SERVICE`, `OBS_JOURNALCTL_BIN`
   - docker: `OBS_DOCKER_CONTAINER`, `OBS_DOCKER_BIN`
4. Budget caps: `OBS_LOG_HARD_CAP_LINES`, `OBS_LOG_HARD_CAP_BYTES`.

### Граница “без оверинжиниринга”
1. Использован только системный CLI (`journalctl`/`docker`) и spawn args-array.
2. Не добавлялись внешние observability системы (Loki/ELK и т.д.).
3. Публичный API endpoint не изменён; изменено внутреннее поведение retrieval.

## 3. Что сделано
1. Добавлены контракты:
   - `docs/contracts/CONTRACT-OPS-001.sqlite-backup-sla.v0.1.md`
   - `docs/contracts/CONTRACT-OBS-002.log-retrieval-sources.v0.1.md`
2. Обновлены runbooks:
   - `docs/runbooks/OBS_LOG_RETRIEVAL.md` (docker source + explicit source policy)
   - `docs/runbooks/SEMINAR_MIGRATION_DOCKER.md` (ссылка на контракты, OBS gate rules)
3. Реализован source-aware retrieval:
   - `streamObsEvents` с выбором `journald|docker`
   - `streamDockerEvents` через `docker logs` args-array
   - budget caps и явная ошибка `obs_budget_exceeded` (413)
   - отсутствие fallback при invalid/missing source
4. Обновлён `/admin/obs/logs`:
   - structured events: `obs_log_source_selected`, `obs_log_retrieval_completed`
   - budget-limited event: `obs_log_retrieval_limited`
   - сохранён `admin_action_failed` / `admin.obs_logs_failed` при ошибках
5. Обновлён CLI `scripts/obs/logs.mjs`:
   - поддержка source-aware retrieval
   - параметры `--source`, `--container`
6. Добавлены тесты:
   - `tests/obs/log-retrieval.source.unit.test.mjs`
   - расширен `tests/obs/log-retrieval.integration.test.mjs` (docker path + structured diagnostics)

## 4. Изменённые файлы
- `docs/contracts/CONTRACT-OPS-001.sqlite-backup-sla.v0.1.md`
- `docs/contracts/CONTRACT-OBS-002.log-retrieval-sources.v0.1.md`
- `docs/runbooks/OBS_LOG_RETRIEVAL.md`
- `docs/runbooks/SEMINAR_MIGRATION_DOCKER.md`
- `server/obs/log-retrieval.mjs`
- `server/index.mjs`
- `scripts/obs/logs.mjs`
- `tests/obs/log-retrieval.source.unit.test.mjs`
- `tests/obs/log-retrieval.integration.test.mjs`
- `package.json`

## 5. Доказательства (tests/logs)
### Команды
1. `pnpm run lint` -> PASS
2. `pnpm run typecheck` -> PASS
3. `pnpm run test:obs` -> PASS (`24 passed, 0 failed`)

### Поведенческие доказательства
1. Docker source endpoint path покрыт интеграционным тестом:
   - `admin /admin/obs/logs supports docker source via docker logs adapter`
2. Structured diagnostics подтверждены тестом:
   - `obs_log_source_selected` с `payload.source=docker`
   - `obs_log_retrieval_completed` с `payload.emitted_count` и `payload.emitted_bytes`
3. Journald path не сломан:
   - существующие интеграционные тесты journald-запросов проходят
   - unit test `streamObsEvents keeps journald source path available` проходит
4. Budget overflow path покрыт:
   - unit test `streamObsEvents returns explicit budget error on hard cap overflow` -> `ObsLogRetrievalError(code=obs_budget_exceeded, status=413)`

## 6. Strategic Gate verdict
- `STOP_CONTRACT_REQUIRED`: PASS
  - Добавлен backup/restore SLA контракт.
  - Добавлен OBS sources контракт.
  - Docker log retrieval adapter реализован и верифицирован.
- `STOP_CONTRACT_CONFLICT`: not triggered
  - OBS event-model invariants сохранены, journald path остаётся доступным.

## 7. Verdict (PASS / FAIL)
`PASS`

## 8. Next minimal step (1 пункт)
1. На production runtime явно задать `OBS_LOG_SOURCE` (`journald` для legacy, `docker` для контейнера) и прогнать post-deploy smoke `/admin/obs/logs` по runbook.
