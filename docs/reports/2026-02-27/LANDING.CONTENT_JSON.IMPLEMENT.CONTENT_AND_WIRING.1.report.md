# LANDING.CONTENT_JSON.IMPLEMENT.CONTENT_AND_WIRING.1

## 1) Executive summary
Реализовано contract-first подключение контента лендинга из JSON по `CONTRACT-001`:
1. Добавлены `content/landing/manifest.v1.json`, `step1.hero.v1.json`, `step2.roles.v1.json`.
2. Добавлен общий валидатор контента (strict/runtime) в `@seminar/contracts`.
3. Включен CI/dev gate: `pnpm run validate:content` и шаг в GitHub CI до build.
4. Step1 Hero и Step2 Roles/Stories переведены на чтение из JSON.
5. A/B/C выбор Hero оставлен, но теперь строго по `experiment.distribution` из JSON, с persist `heroVariant` и in-memory fallback при ошибке `localStorage.setItem`.
6. Runtime деградация реализована без white screen по правилам контракта.

## 2) SPEC GUARD results (contract read confirmed)
Контракт прочитан и применён: `docs/contracts/CONTRACT-001.landing.content-json.v1.0.md`.

Обязательные поля/инварианты v1.0, учтённые в реализации:
1. `schema_version` строго `MAJOR.MINOR.PATCH` (`1.0.0`) у всех трех файлов.
2. `module` внутри каждого module-файла совпадает с ключом в `manifest.modules`.
3. Step1:
   - `module="landing.step1.hero"`;
   - `experiment.id`, `persist_key="heroVariant"`;
   - `experiment.variants=["aggressive","rational","partner"]`;
   - `experiment.variants == keys(variants)`;
   - `distribution` keys match variants, weights `>0`, `abs(sum-1)<=1e-3`;
   - `badges min 1`, `body min 2` (фактически 4), `cta min 1`, минимум один CTA на `#roles`;
   - `enabled` только на Step1 leaf (`body[]/badges[]/cta[]`), default `true`, квоты после фильтра `enabled==true`.
4. Step2:
   - `module="landing.step2.roles"`;
   - роли фиксированы: `business_owner`, `operations_lead`, `it_lead`;
   - `roles_order` длина 3, без дублей, set equality с keys(roles);
   - `roles.<k>.label` (не `title`);
   - ровно 3 story на роль;
   - `enabled` в Step2 запрещен.
5. Типы:
   - `Locale` только `ru/en`;
   - `I18nText` только `{ i18n: { ru, en } }`, обе локали обязательны, пустые строки запрещены;
   - `StableId` regex соблюдён для всех ids.

`error_code` и runtime деградация:
1. Формат ошибок валидатора: `{ file, json_pointer, error_code }`.
2. Использован набор кодов из контракта (включая `content_missing_field`, `content_invalid_type`, `schema_version_incompatible`, `distribution_*`, `anchor_*`, `roles_*`, `manifest_*`).
3. Runtime policy:
   - Level 1 Leaf Error: leaf не рендерится, ошибка логируется;
   - Level 2 Variant Error: вариант Hero исключается, выбирается другой валидный;
   - Level 3 Structural Error: модуль не рендерится, route не падает;
   - если оба модуля невалидны: рендерится только shell (Header из layout), контентные секции не монтируются.

STOP_CONTRACT_CONFLICT: не выявлен.

## 3) What changed
1. Добавлены новые content JSON файлы в `content/landing/*`.
2. Добавлен shared валидатор landing content в `packages/contracts/src/landing-content.ts` и экспорт из `packages/contracts/src/index.ts`.
3. Добавлен CLI-скрипт проверки контента: `scripts/validate-landing-content.mjs`.
4. Добавлен npm script `validate:content` в root `package.json`.
5. Добавлен шаг `Validate landing content` в `.github/workflows/ci.yml`.
6. Реализован runtime wiring:
   - `apps/web/src/content/landing.ts` (импорт JSON + strict/runtime validation + логирование ошибок контента);
   - `apps/web/src/routes/LandingPage.tsx` (Hero/roles wiring, variant selection по distribution, persist+memory fallback, деградация);
   - `apps/web/src/components/RoleTabs.tsx` (рендер labels/stories из Step2 JSON).

## 4) Changed files
1. `.github/workflows/ci.yml`
2. `package.json`
3. `scripts/validate-landing-content.mjs`
4. `packages/contracts/src/index.ts`
5. `packages/contracts/src/landing-content.ts`
6. `content/landing/manifest.v1.json`
7. `content/landing/step1.hero.v1.json`
8. `content/landing/step2.roles.v1.json`
9. `apps/web/src/content/landing.ts`
10. `apps/web/src/routes/LandingPage.tsx`
11. `apps/web/src/components/RoleTabs.tsx`

## 5) Proofs (CI run, validator output, key screenshots if available)
Локальные проверки:
1. `pnpm run validate:content` -> PASS (`Landing content validation passed.`).
2. `pnpm run lint` -> PASS.
3. `pnpm run typecheck` -> PASS.
4. `pnpm run build` -> PASS.
5. Smoke leads (existing script unchanged) -> PASS:
   - `pnpm run test:smoke:leads`
   - результат: `Smoke leads passed. lead_id=... duplicate=409 rate_limited=429`.

Контрактные доказательства:
1. `content/landing/*.json` валидны strict-валидатором.
2. `Step2` использует `roles.<k>.label` и `stories` как `TextItem[]`.
3. Hero variant assignment использует `experiment.distribution` в порядке `experiment.variants`.
4. Ошибки контента логируются как `content_validation_error` с `file/json_pointer/error_code`.

Скриншоты:
1. В рамках этого шага не собирались.

## 6) Strategic Gate verdict
Решение не является workaround:
1. Контент вынесен в контрактный JSON layout v1.0.
2. Валидация формализована и встроена в CI/dev.
3. Runtime деградация реализована по контрактным уровням, без silent fallback.
4. UI перестал зависеть от встроенных строк Hero/Step2 и рендерит контент из JSON как source of truth.

## 7) Verdict PASS/FAIL
PASS

## 8) Next minimal step (1 пункт)
1. Добавить unit/integration тесты для runtime-деградации (leaf/variant/structural) и распределения variant по `distribution`.
