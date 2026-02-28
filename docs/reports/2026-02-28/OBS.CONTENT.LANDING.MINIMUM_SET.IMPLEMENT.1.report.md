# OBS.CONTENT.LANDING.MINIMUM_SET.IMPLEMENT.1.report

## 1. Executive summary
Закрыт GAP по minimum set доменов `content` и `landing` из `CONTRACT-OBS-001 v0.4` в production-path лендинга.

Реализованы события:
- `content_bundle_loaded`
- `content_bundle_failed`
- `content_schema_violation_detected`
- `hero_variant_selected`
- `landing_render_degraded`

События пишутся backend logger-ом (journald NDJSON), коррелируются по `request_id` (ALS), доступны через существующий retrieval (CLI и `/admin/obs/logs`).

## 2. SPEC GUARD results
Прочитаны и сверены:
- `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md`
- `docs/contracts/CONTRACT-001.landing.content-json.v1.0.md`
- `docs/prd/PRD-PHASE-1.LANDING.md`
- `server/index.mjs`
- `apps/web/src/content/landing.ts`
- `apps/web/src/routes/LandingPage.tsx`
- `server/obs/logger.mjs`
- `tests/obs/*`

Инвентаризация runtime path:
1. Где загружается content bundle:
- server path: `server/landing/content-observability.mjs` -> `loadLandingBundle(...)`.
- frontend path (существующий): `apps/web/src/content/landing.ts`.

2. Где выбирается hero variant:
- server observability path: `server/landing/content-observability.mjs` -> `selectHeroVariant(...)`.
- frontend render path (существующий): `apps/web/src/routes/LandingPage.tsx` -> `getOrAssignHeroVariant(...)`.

3. Где формируется HTML/ответ лендинга:
- `server/index.mjs` -> catch-all `app.get("*")` + `response.sendFile(index.html)`.

4. Где деградации уже моделируются:
- контрактная классификация runtime ошибок: `packages/contracts/src/landing-content.ts` -> `classifyRuntimeError(...)` (`leaf|variant|structural`).
- frontend runtime behavior: `apps/web/src/content/landing.ts` + `apps/web/src/routes/LandingPage.tsx`.
- backend observability деградация (новое): `landing_render_degraded`/`content_schema_violation_detected` в `server/landing/content-observability.mjs`.

## 3. What changed
1. Добавлен server-side landing observability module:
- файл: `server/landing/content-observability.mjs`
- функции:
  - загрузка bundle (`manifest + modules`)
  - runtime validation (контрактный validator, fallback validator)
  - логирование `content_bundle_loaded|failed`
  - логирование `content_schema_violation_detected`
  - выбор hero варианта и логирование `hero_variant_selected`
  - логирование `landing_render_degraded` при деградации

2. Добавлен shared deterministic hashing util:
- файл: `server/obs/canonical-json.mjs`
- функции:
  - `canonicalJsonStringify(...)` (stable key ordering)
  - `hashCanonicalJson(...)` (SHA-256 base64url)

3. Wiring в landing response path:
- `server/index.mjs`:
  - импорт `observeLandingRequest`
  - env override `LANDING_CONTENT_MANIFEST_PATH` (для controlled runtime tests)
  - вызов observability pipeline на `GET /` перед `sendFile`.

4. Logger alignment для minimum-set landing events:
- `server/obs/logger.mjs`:
  - `event` policy расширена на suffix `_degraded` (для `landing_render_degraded`)
  - `error.code` namespace allowlist включает `landing.`

5. Тесты:
- `tests/obs/canonical-json.unit.test.mjs` (new): deterministic hashing unit tests.
- `tests/obs/log-retrieval.integration.test.mjs`:
  - chain test для `GET /`: `content_bundle_loaded` + `hero_variant_selected` + request correlation.
  - деградационный test (invalid content): `content_schema_violation_detected` + `landing_render_degraded`.
  - load-failure test: `content_bundle_failed` + `landing_render_degraded`.
- `tests/obs/logger.contract.test.mjs`:
  - добавлен тест accept-case для `landing_render_degraded` и `landing.*` namespace.

6. Playbook update:
- `docs/runbooks/OBS_INCIDENT_PLAYBOOK.md`:
  - добавлена процедура диагностики `content/landing`.
  - обновлён раздел GAP/limitations.
  - добавлены one-liners для `content_bundle_failed` и `landing_render_degraded`.

## 4. Files changed
- `server/landing/content-observability.mjs` (new)
- `server/obs/canonical-json.mjs` (new)
- `server/index.mjs`
- `server/obs/logger.mjs`
- `tests/obs/canonical-json.unit.test.mjs` (new)
- `tests/obs/log-retrieval.integration.test.mjs`
- `tests/obs/logger.contract.test.mjs`
- `package.json`
- `docs/runbooks/OBS_INCIDENT_PLAYBOOK.md`
- `docs/_index/redirects.md`

## 5. Evidence (NDJSON samples + request_id chain)
Проверки в PowerShell:
1. `pnpm run test:obs` -> PASS (18/18).
2. `pnpm run lint` -> PASS.
3. `pnpm run typecheck` -> PASS.
4. `pnpm -r build` -> PASS.
5. `pnpm run test:smoke:leads` -> PASS.

Подтверждённая chain для `GET /` (integration):
- `http_request_started`
- `content_bundle_loaded` (с `duration_ms`, `payload.content_bundle_hash`)
- `hero_variant_selected` (с `payload.variant_id|reason|content_unit_hash`)
- `http_request_completed`

Подтверждённые деградации:
- invalid bundle -> `content_schema_violation_detected` + `landing_render_degraded`
- missing manifest -> `content_bundle_failed` + `landing_render_degraded`

## 6. Determinism check (hash tests)
Покрытие deterministic hashing:
- `tests/obs/canonical-json.unit.test.mjs`
  - одинаковые данные при разном порядке ключей -> одинаковый `canonicalJsonStringify`/`hashCanonicalJson`
  - одинаковый content unit payload -> одинаковый `content_unit_hash`

Hash rules:
- canonical serialization: stable key ordering, UTF-8 JSON, no whitespace variance
- hashing: SHA-256 base64url

## 7. Strategic Gate verdict
1. Решение модельное, не workaround:
- логирование встроено в существующий server landing-path (`GET /`) и использует текущий OBS baseline.

2. Hidden fallback не добавлен:
- fallback/degradation логируются явно (`content_bundle_failed`, `content_schema_violation_detected`, `landing_render_degraded`).

3. Implicit behavior не добавлен:
- причины деградации и source выбора варианта фиксируются событиями и payload.

4. Nondeterminism в hash отсутствует:
- canonical serializer + unit tests.

## 8. Verdict (PASS/FAIL)
PASS

## 9. Next minimal step (1 пункт)
1. Добавить e2e-smoke по retrieval (`/admin/obs/logs`) на production-like окружении с проверкой полной landing chain по одному `request_id`.
