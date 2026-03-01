# OBS.LOGGING.BASELINE.AUDIT.1.report

## 1. Executive summary
Аудит выполнен против `CONTRACT-OBS-001.logging.event-model.v0.4.md` без изменений кода.  
Итог: базовый слой observability в целом рабочий (logger/ALS/retrieval/tests), но выявлены контрактные расхождения и непокрытые MUST-инварианты.  
Формальный статус: `FAIL` (см. `STOP_CONTRACT_CONFLICT`, `STOP_SCOPE_DRIFT`, `STOP_TESTS_REQUIRED`).

## 2. SPEC GUARD results
Проверенные источники:
- `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md`
- `server/obs/logger.mjs`
- `server/obs/request-context.mjs`
- `server/obs/log-retrieval.mjs`
- `server/index.mjs`
- `scripts/obs/logs.mjs`
- `tests/obs/logger.contract.test.mjs`
- `tests/obs/log-retrieval.integration.test.mjs`

Обязательные OBS-инварианты по контракту:
- fail-safe logger (`MUST NEVER throw`)
- redaction-by-default до сериализации
- bounded payload 4KB + `meta.payload_truncated`
- info rate limiting per request + `obs.info_rate_limited.meta.suppressed_info_count`
- ALS correlation + `x-request-id`
- NDJSON retrieval (CLI + SHOULD endpoint)

Где реализовано:
- logger core: `server/obs/logger.mjs`
- ALS/request-id middleware: `server/obs/request-context.mjs`, wiring в `server/index.mjs:45-47`
- CLI retrieval: `scripts/obs/logs.mjs`
- journald streaming: `server/obs/log-retrieval.mjs`
- HTTP endpoint: `server/index.mjs:337-410`

## 3. Logger audit
Проверено:
- Fail-safe по основным путям: `server/obs/logger.mjs:240-245`, `480-519` (ошибки перехватываются).
- Redaction до сериализации: `server/obs/logger.mjs:420-438`, затем `serializeWithBudget` (`259+`).
- Рекурсивная redaction: `server/obs/logger.mjs:58-110`.
- Fail-closed при redaction error: `server/obs/logger.mjs:421-428`, `435-442`.
- Budget 4KB: `MAX_EVENT_BYTES` и проверка размера в `server/obs/logger.mjs:259-307`.
- Детерминированный truncation payload/error: `server/obs/logger.mjs:112-139`, `265-287`.
- `obs.payload_truncated` rate-limited: `server/obs/logger.mjs:507-513` + rate window `248-257`.
- Info rate limiting per request: `server/obs/logger.mjs:466-478`; emission `obs.info_rate_limited` через `flushRequestDiagnostics` (`358-372`).
- Event/module regex enforcement: `server/obs/logger.mjs:379-400`.
- В runtime сервере `console.*` не используется (логирование через logger).

Найденные расхождения:
- `STOP_CONTRACT_CONFLICT`: namespaced `error.code` не enforce-ится централизованно.
  - `server/obs/logger.mjs:167` принимает любой строковый `inputError.code` без проверки префикса.
- `STOP_SCOPE_DRIFT`: implicit fallback, не описанный в контракте:
  - invalid/unknown `level` -> `"info"` (`server/obs/logger.mjs:376`);
  - missing `domain` -> `"obs"` (`server/obs/logger.mjs:403`).
- `STOP_CONTRACT_CONFLICT`: 4KB budget гарантирован только за счёт сокращения `payload/error`; поля `domain/event/module/request_id` не ограничиваются.
  - `server/obs/logger.mjs:292-306` использует исходные `event/domain/module/request_id` в `minimal` записи.

## 4. Correlation audit
Проверено:
- ALS используется: `server/obs/request-context.mjs:1-42`.
- `request_id` создаётся до первого lifecycle-лога:
  - middleware порядок: `server/index.mjs:45-47`.
- `x-request-id` возвращается: `server/obs/request-context.mjs:36`.
- Явной ручной передачи `request_id` по коду нет (берётся из ALS в logger).
- Missing request_id детектируется: `server/obs/logger.mjs:404-413`.

Риски:
- Emission `obs.info_rate_limited` зависит от вызова `flushRequestDiagnostics` (`server/obs/logger.mjs:358-372`); в HTTP это вызывается (`server/index.mjs:860`), но за пределами HTTP это контрактно не гарантировано.

## 5. Retrieval audit
CLI:
- `--since` обязателен: `scripts/obs/logs.mjs:58-66`.
- `--level` обязателен: `scripts/obs/logs.mjs:60-66`.
- `--limit` обязателен: `scripts/obs/logs.mjs:59`, `68-74`.
- Output NDJSON (`1 line = 1 JSON`): `scripts/obs/logs.mjs:84-86`.
- Streaming journald без загрузки всего в память: `server/obs/log-retrieval.mjs:94-135`.
- Фильтрация `level`/`request_id` — точное равенство (не `>=`): `server/obs/log-retrieval.mjs:121-126`.

HTTP endpoint `/admin/obs/logs`:
- `since` обязателен: `server/index.mjs:344-350`.
- streaming: `flushHeaders` + `response.write`: `server/index.mjs:375`, `384-386`.
- `limit` default 200 max 2000: `server/index.mjs:361-364`.
- Auth через текущий admin механизм (`X-Admin-Secret`/`ADMIN_SECRET`): `server/index.mjs:340`, `899-947`.
- Response type NDJSON: `server/index.mjs:373`.

Риски:
- Потенциальный дорогой scan при широком `since` + строгих фильтрах (скан до EOF), хотя `emitted` ограничен `limit`.

## 6. Verification coverage audit
Наличие тестов:
- redaction: `tests/obs/logger.contract.test.mjs:22-49`
- naming enforcement: `tests/obs/logger.contract.test.mjs:51-73`
- payload truncation: `tests/obs/logger.contract.test.mjs:75-98`
- info rate limiting: `tests/obs/logger.contract.test.mjs:100-127`
- async correlation: `tests/obs/logger.contract.test.mjs:129-177`
- CLI + endpoint NDJSON: `tests/obs/log-retrieval.integration.test.mjs:95-192`
- smoke leads flow (существующий): `scripts/test-smoke-leads.mjs`

Пробелы покрытия:
- `STOP_TESTS_REQUIRED`: нет отдельного теста на MUST-инвариант `logger MUST NEVER throw` (прямой fail-safe assertion на throwing writer/serialization edge-path отсутствует).
- `STOP_TESTS_REQUIRED`: нет теста на namespaced `error.code` enforcement (и enforcement в коде тоже отсутствует).
- Smoke не валидирует лог-цепочку по `request_id` (только бизнес API результат), хотя в контракте это SHOULD.

## 7. Strategic Gate verdict
1. Может ли logger уронить сервис?  
По основному пути риск низкий (широкие `try/catch`, `writeLineSafe`) — `server/obs/logger.mjs:240-245`, `480-519`.  
Но строгой контрактной гарантии тестом нет (`STOP_TESTS_REQUIRED`).

2. Есть ли скрытые implicit default?  
Да: `level -> info` (`server/obs/logger.mjs:376`), `domain -> obs` (`server/obs/logger.mjs:403`) -> `STOP_SCOPE_DRIFT`.

3. Есть ли nondeterminism?  
- payload truncation: детерминированный (stable key sort, fixed slices).  
- rate limiting: детерминированный в request context, но зависит от вызова `flushRequestDiagnostics`.  
- correlation: ALS-путь детерминирован в проверенном сценарии.

4. Риск разъезда event/module/domain?  
Да. В `server/index.mjs` не-auth ошибки endpoint/admin обработчиков логируются как `admin_auth_failed` (`390-398`, `323-330`), что семантически смешивает auth и internal failure.

5. Это workaround или устойчивый слой?  
Слой структурно устойчивый (есть единый logger + ALS + retrieval + tests), но в текущем виде не полностью контрактно замкнут.

6. Придётся ли переписывать через 2–4 недели?  
Полный rewrite не нужен; нужны точечные корректировки инвариантов/тестов и семантики событий.

## 8. Identified risks (ranked: High/Medium/Low)
High:
- Не enforce-ится namespaced `error.code` (`server/obs/logger.mjs:167`).
- 4KB ceiling не гарантирован для oversized non-payload полей (`server/obs/logger.mjs:292-306`).
- Implicit defaults `level/domain` без явной нормы в контракте (`server/obs/logger.mjs:376`, `403`).

Medium:
- Семантический drift событий: internal admin failures записываются как `admin_auth_failed` (`server/index.mjs:323-330`, `390-398`).
- `obs.info_rate_limited` зависит от explicit flush (`server/obs/logger.mjs:358-372`, `server/index.mjs:860`).
- Retrieval scan cost при широком временном окне и строгой фильтрации.

Low:
- Over-redaction phone pattern может маскировать безопасные технические поля (например IP/host-строки), снижая диагностичность.

## 9. Contract deviations (если есть)
Обнаружены:
- `STOP_CONTRACT_CONFLICT`:
  - namespaced `error.code` не enforce-ится.
  - строгий 4KB upper-bound не доказан для всех входов (ограничение фактически на payload/error).
- `STOP_SCOPE_DRIFT`:
  - implicit fallback `level/domain`, не оговорённый контрактом.
- `STOP_TESTS_REQUIRED`:
  - нет прямых тестов для MUST-инвариантов `logger never throws` и namespaced `error.code`.

## 10. Verdict (PASS / FAIL / PASS_WITH_RISKS)
FAIL

## 11. Next minimal corrective step (1 пункт)
1. Закрыть три блокера одним небольшим hardening-пакетом: enforce namespaced `error.code`, убрать/нормативно зафиксировать implicit fallback `level/domain`, и добавить MUST-тесты (`never throws`, `error.code namespace`, strict 4KB bound для adversarial non-payload input).
