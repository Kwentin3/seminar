# OBS.LOGGING.BASELINE.HARDEN.1.report

## 1. Executive summary
Закрыты блокеры из `OBS.LOGGING.BASELINE.AUDIT.1.report.md` без расширения scope: добавлен strict enforcement для namespace `error.code`, реализован hard 4KB cap на весь сериализованный event, убраны implicit fallback для `level` и `domain` (с явной schema-violation сигнализацией), добавлены MUST-тесты.  
Интерфейсы retrieval (CLI/HTTP) и доменные события не менялись.

## 2. SPEC GUARD results
Прочитано и проверено:
- `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md`
- `docs/reports/2026-02-28/OBS.LOGGING.BASELINE.AUDIT.1.report.md`
- `server/obs/logger.mjs`
- `tests/obs/logger.contract.test.mjs`
- `tests/obs/log-retrieval.integration.test.mjs`

Нарушения из аудита и минимальные фиксы:
- Namespaced `error.code` не enforce-ился -> добавлена валидация prefix и замена на `obs.invalid_error_code_namespace`.
- 4KB cap был только на payload/error -> добавлен deterministic fallback `obs.event_size_exceeded` для полного event.
- Implicit fallback `level/domain` -> заменён на явный schema-enforcement (`level -> error`, `domain -> obs`, оба с `meta.schema_violation=true` + `obs.schema_violation_detected`).
- Не хватало MUST-тестов -> добавлены 3 теста на fail-safe/namespace/strict cap.

## 3. What was broken
- `error.code` принимался как произвольная строка (без namespace enforcement).
- При adversarial oversized `event/module/request_id` не было жёсткой гарантии верхней границы 4KB для всего JSON event.
- Некорректные/пустые `level` и `domain` обрабатывались неявно, без явного schema contract violation.
- Не было прямых тестов на `logger never throws`, namespace enforcement и strict full-event cap.

## 4. Fix implementation details
- Namespace enforcement:
  - добавлены whitelist prefixes: `server/obs/logger.mjs:11`
  - проверка и замена invalid code: `server/obs/logger.mjs:507-523`
  - при нарушении: `meta.schema_violation=true` + `obs.schema_violation_detected` (`field=error.code`): `server/obs/logger.mjs:508-514`
- Strict full-event 4KB cap:
  - deterministic hard fallback `obs.event_size_exceeded`: `server/obs/logger.mjs:309-355`
  - emergency request_id normalization для fallback: `server/obs/logger.mjs:66-75`, `315`
  - fallback выставляет `meta.payload_truncated=true` и `meta.logger_error=true`: `server/obs/logger.mjs:324-353`
- Implicit fallback removal:
  - level enforcement (invalid/missing -> `error` + schema violation): `server/obs/logger.mjs:425-437`
  - domain enforcement (invalid/missing -> `obs` + schema violation): `server/obs/logger.mjs:463-474`
  - правила явно задокументированы комментариями в коде.

## 5. Tests added
Добавлены MUST-тесты в `tests/obs/logger.contract.test.mjs`:
- `logger never throws on forced error paths` (circular payload + invalid error getter + invalid level): `179-209`
- `invalid error namespace is replaced and marked as schema violation`: `211-239`
- `strict 4KB cap applies to full serialized event for adversarial input`: `241-272`

Существующие OBS integration тесты (CLI/endpoint/async correlation) не изменены и продолжают проходить.

## 6. Determinism check
- Truncation/size fallback детерминированы:
  - stable transformations + fixed fallback shape (`obs.event_size_exceeded`)
  - fixed meta flags
  - bounded request_id normalization для emergency path.
- Random/sampling в logger не добавлялись.
- Retrieval contract и NDJSON интерфейсы не менялись.

## 7. Strategic Gate verdict
PASS:
- Logger не бросает наружу (подтверждено fail-safe тестом + defensive try/catch path).
- Нет implicit semantic fallback для `level/domain` без маркировки нарушения схемы.
- Full serialized event upper-bound 4KB enforced детерминированным fallback.
- No scope drift: только hardening logger + tests, без новых публичных API/feature expansion.

## 8. Verdict (PASS / FAIL)
PASS

## 9. Next minimal step (1 пункт)
1. Отдельной задачей harmonize-ить семантику admin runtime failures (сейчас часть внутренних ошибок логируется как `admin_auth_failed`) без изменения текущего hardening-пакета.
