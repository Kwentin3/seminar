# OBS.ADMIN.SEMANTICS.HARMONIZE.1.report

## 1. Executive summary
Устранён семантический дрейф admin-логирования: `admin_auth_failed` оставлен только для auth-ошибок (401 unauthorized), а internal/admin-handler ошибки переведены в `admin_action_failed` с `admin.*` error codes. Добавлены интеграционные тесты, которые фиксируют это поведение по `request_id`.

## 2. SPEC GUARD results
Проверены источники:
- `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md`
- `docs/reports/2026-02-28/OBS.LOGGING.BASELINE.AUDIT.1.report.md`
- `server/index.mjs`
- `server/obs/logger.mjs`
- `tests/obs/log-retrieval.integration.test.mjs`
- `tests/obs/logger.contract.test.mjs`

Admin endpoints в коде:
- `GET /api/admin/leads`
- `GET /admin/obs/logs`

Что было до правки:
- `admin_auth_failed` использовался не только для auth, но и в catch-ветках handler ошибок (`/api/admin/leads`, `/admin/obs/logs`).

Текущие admin события/коды:
- Auth failure: `admin_auth_failed` + `admin.unauthorized`
- Admin action/internal failure: `admin_action_failed` + `admin.secret_missing|admin.leads_query_failed|admin.obs_logs_failed`

## 3. What was wrong (before)
1. Внутренние 5xx/exception в admin handlers логировались как `admin_auth_failed`.
2. Это смешивало семантику auth (401/403) и action/internal failure (5xx), ломая диагностику по событиям.

## 4. What changed
Изменения в `server/index.mjs`:
1. `/api/admin/leads` catch:
- `event` изменён с `admin_auth_failed` на `admin_action_failed`.
- `error.code` изменён на `admin.leads_query_failed`.

2. `/admin/obs/logs` catch:
- `event` изменён с `admin_auth_failed` на `admin_action_failed`.
- `error.code` сохранён как `admin.obs_logs_failed`.

3. `authenticateAdminRequest` при отсутствии `ADMIN_SECRET`:
- `event` изменён с `admin_auth_failed` на `admin_action_failed` (это env/internal dependency failure, не 401/403 auth-case).
- `error.code` сохранён `admin.secret_missing`.

4. `/admin/obs/logs` streaming path:
- отправка 200+headers отложена до первого события (`ensureStreamingResponse()`), чтобы при early internal failure вернуть корректный 500 и не маскировать ошибку.
- интерфейс retrieval не менялся (те же query params, тот же NDJSON response contract).

5. Локальная синхронизация runbook:
- `docs/runbooks/OBS_INCIDENT_PLAYBOOK.md`: internal admin ошибки теперь ищутся через `admin_action_failed`, не через `admin_auth_failed`.

## 5. Tests added/updated
Обновлён `tests/obs/log-retrieval.integration.test.mjs`:
1. Добавлен тест `admin auth failure logs only admin_auth_failed with admin.unauthorized`:
- запрос на admin endpoint с неверным `X-Admin-Secret`;
- проверка HTTP 401;
- проверка события `admin_auth_failed` с `error.code=admin.unauthorized`;
- проверка отсутствия `admin_action_failed` для того же `request_id`.

2. Добавлен тест `admin internal failure logs admin_action_failed and not admin_auth_failed`:
- детерминированный internal failure `/admin/obs/logs` через несуществующий `OBS_JOURNALCTL_BIN`;
- проверка HTTP 500;
- проверка события `admin_action_failed` с `error.code=admin.obs_logs_failed`;
- проверка отсутствия `admin_auth_failed` для того же `request_id`.

## 6. Evidence (NDJSON samples, request_id traces)
Проверки выполнены в PowerShell:
1. `pnpm run test:obs` -> PASS (12/12)
2. `pnpm run lint` -> PASS
3. `pnpm run typecheck` -> PASS

Подтверждённые сигналы из интеграционных тестов:
- auth-case: `event=admin_auth_failed`, `error.code=admin.unauthorized`, статус 401, корреляция по `x-request-id`.
- internal-case: `event=admin_action_failed`, `error.code=admin.obs_logs_failed`, статус 500, для того же `request_id` отсутствует `admin_auth_failed`.

Дополнительно:
- `pnpm run test:smoke:leads` в текущем окружении FAIL по причине отсутствия поднятого dev-сервера на `http://127.0.0.1:8787` (контекст окружения, не регрессия по изменённой логике).

## 7. Strategic Gate verdict
1. Это не workaround, а устранение модели дрейфа: auth и internal теперь разведены детерминированно.
2. Нового implicit behavior не добавлено.
3. Нondeterminism не добавлен: событие выбирается по явным веткам auth-check/catch, тестами закреплено отсутствие смешения по одному `request_id`.

## 8. Verdict (PASS/FAIL)
PASS

## 9. Next minimal step (1 пункт)
1. Добавить отдельный contract-test для кода `admin.secret_missing`, чтобы зафиксировать семантику как `admin_action_failed` при старте без `ADMIN_SECRET`.
