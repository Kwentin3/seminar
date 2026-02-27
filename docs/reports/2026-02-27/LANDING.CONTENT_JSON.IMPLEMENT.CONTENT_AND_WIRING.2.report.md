# LANDING.CONTENT_JSON.IMPLEMENT.CONTENT_AND_WIRING.2

## 1) Executive summary
Выполнено внедрение контентного домена лендинга по `CONTRACT-001 v1.0`:
1. Контент в `content/landing/{manifest,step1.hero,step2.roles}.v1.json` создан и заполнен по заданному payload (RU/EN).
2. Валидатор контента реализован и подключен в CI/dev/runtime.
3. Step1 Hero и Step2 roles/stories переведены на JSON-контент (без хардкода контентных строк в компонентах Hero/Step2).
4. Выбор Hero variant идёт строго из `experiment.distribution` + `experiment.variants`, persist key `heroVariant` сохранён.
5. Runtime деградация реализована без white screen по уровням leaf/variant/structural.

## 2) SPEC GUARD results (contract compliance)
Прочитаны и учтены:
1. `docs/contracts/CONTRACT-001.landing.content-json.v1.0.md`
2. `docs/prd/PRD-PHASE-1.LANDING.md`

Обязательные поля/инварианты, реализованные в коде и контенте:
1. `schema_version` строго `1.0.0` (`MAJOR.MINOR.PATCH`) во всех 3 файлах.
2. `module` внутри module-файла совпадает с ключом из `manifest.modules`.
3. Step1:
   - `module = landing.step1.hero`;
   - `experiment.id`, `persist_key = heroVariant`;
   - `experiment.variants` фиксированный список `aggressive/rational/partner`;
   - `experiment.variants == keys(variants)`;
   - `distribution` keys match variants, веса `>0`, `abs(sum-1)<=1e-3`;
   - `body>=2` (фактически 4), `badges>=1` (фактически 2), `cta>=1`;
   - минимум один CTA на `#roles`;
   - `enabled` только на Step1 leaf (body/badges/cta), default=true, квоты проверяются после фильтра `enabled==true`.
4. Step2:
   - `module = landing.step2.roles`;
   - fixed role keys: `business_owner`, `operations_lead`, `it_lead`;
   - `roles_order` длина 3, без дублей, set equality с keys(roles);
   - `roles.<k>.label` (не `title`);
   - ровно 3 stories на роль;
   - `enabled` запрещен.
5. Типы:
   - `Locale` только `ru/en`;
   - `I18nText` только `{ i18n: { ru, en } }`, обе локали обязательны, `trim>0`;
   - `StableId` regex соблюден (dot.notation, lower-case, digits, underscore).

Error code protocol:
1. Формат: `{ file, json_pointer, error_code }`.
2. Для module mismatch выбран `error_code = content_invalid_type` (документировано в этой реализации; несовпадение `module` трактуется как типовой contract-shape конфликт поля `module`).

Runtime деградация (contract 7.2):
1. Leaf: leaf-элемент отбрасывается, логируется.
2. Variant: невалидный вариант Hero исключается; выбирается другой валидный.
3. Structural: невалидный модуль не рендерится; route продолжает работу.
4. Если оба модуля невалидны: рендерится только shell (header/footer), контентные секции не монтируются.

STOP_CONTRACT_CONFLICT: не зафиксирован.

## 3) What done (content files, validator, wiring)
1. Контент:
   - `content/landing/manifest.v1.json`
   - `content/landing/step1.hero.v1.json`
   - `content/landing/step2.roles.v1.json`
2. Валидатор:
   - `packages/contracts/src/landing-content.ts`
   - strict/runtime валидаторы
   - semver `expects` проверка
   - invariant checks (Step1/Step2)
   - runtime классификация ошибок по уровням `leaf|variant|structural`
3. CI/dev wiring:
   - local command: `pnpm run validate:content`
   - CI step: `Validate landing content` до build
4. UI wiring:
   - `apps/web/src/content/landing.ts` (runtime loading + logging)
   - `apps/web/src/routes/LandingPage.tsx` (Hero from JSON, variant assignment from distribution, memory fallback)
   - `apps/web/src/components/RoleTabs.tsx` (roles/stories from Step2 JSON)
5. Минимальные проверки валидатора:
   - `scripts/test-landing-content-validator.mjs`
   - кейсы: valid pass, `i18n_empty_string`, `distribution_sum_invalid`, `roles_key_mismatch`
   - CI step: `Test landing content validator`

## 4) Changed files
1. `.github/workflows/ci.yml`
2. `package.json`
3. `scripts/test-landing-content-validator.mjs`
4. `packages/contracts/src/landing-content.ts`
5. `apps/web/src/content/landing.ts`
6. `docs/reports/2026-02-27/LANDING.CONTENT_JSON.IMPLEMENT.CONTENT_AND_WIRING.2.report.md`

## 5) Proofs (CI output, validator output, runtime behavior notes)
Локальные прогоны:
1. `pnpm run validate:content` -> `Landing content validation passed.`
2. `pnpm run test:content:validator` -> `Landing content validator checks passed.`
3. `pnpm -r lint` -> PASS
4. `pnpm -r typecheck` -> PASS
5. `pnpm -r build` -> PASS
6. `pnpm run test:smoke:leads` -> PASS (`duplicate=409`, `rate_limited=429`)

Runtime behavior notes:
1. `heroVariant` persist key сохранён.
2. При ошибке `localStorage.setItem` используется in-memory fallback и лог `hero_variant_persist_fallback`.
3. Ошибки контента логируются как `content_validation_error` с `file + json_pointer + error_code + level`.
4. Step1 и Step2 остаются разделены в DOM (`#hero` и `#roles`).

## 6) Strategic Gate verdict
Решение системное, не workaround:
1. Контент вынесен в контрактный JSON layout v1.0.
2. Валидация формализована и встроена в CI/dev.
3. Runtime деградация реализована по контрактным уровням без silent fallback.
4. UI использует JSON как source of truth для Hero/roles/stories.

## 7) Verdict PASS/FAIL
PASS

## 8) Next minimal step (1 пункт)
1. Добавить проверку в e2e/smoke на runtime-сценарии деградации (`leaf/variant/structural`) с фиксацией ожидаемого UI-поведения.
