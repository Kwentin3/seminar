# UI.LANDING.HERO_AB3.I18N_REFACTOR.1

## 1. Executive summary
Hero A/B/C copy вынесен из локального объекта `LandingPage.tsx` в централизованный i18n-слой `messages`.
Логика назначения/персиста варианта не изменена: используется тот же `localStorage` ключ `heroVariant` и тот же random-алгоритм выбора.
Layout Hero, кнопки ролей, scroll+activate tab, второй экран и JSON-контракт ролей не изменялись.

## 2. SPEC GUARD results
- Найдено:
  - `apps/web/src/routes/LandingPage.tsx`
  - локальный hero copy-объект (до рефактора) в `LandingPage`
  - централизованный i18n слой: `apps/web/src/app/messages.ts`
  - locale-механизм: `useAppContext()` + `messages` по `locale`.
- Подтверждено:
  - variant назначается и читается через `localStorage.heroVariant`.
  - рендер Hero до рефактора читал строки из локального объекта в `LandingPage`.
- Проверка контракта экранов:
  - `#hero` и `#roles` остаются изолированными.
  - inline-переключение ролей сохранено.

## 3. Что изменено
- `messages.ts`:
  - добавлена централизованная структура ключей Hero-вариантов:
    - `landing.hero.variant.aggressive.headline|subheadline|fomo`
    - `landing.hero.variant.rational.headline|subheadline|fomo`
    - `landing.hero.variant.partner.headline|subheadline|fomo`
  - ключи добавлены и для `ru`, и для `en` (структура готова к дальнейшему переводу).
- `LandingPage.tsx`:
  - удален локальный объект `HERO_TEXT`.
  - добавлен resolver `resolveHeroVariantCopy(messages, variant)` для чтения строк из `messages`.
  - добавлена защита от отсутствующих ключей:
    - DEV: явные placeholder-строки вида `[MISSING landing.hero.variant....]`
    - PROD: `throw new Error(...)` (без silent fallback).
- Не изменено:
  - random/persist алгоритм и ключ `heroVariant`.
  - layout Hero.
  - `Roles/RoleTabs/LeadForm`, маршрутизация, API.

## 4. Изменённые файлы
- `apps/web/src/routes/LandingPage.tsx`
- `apps/web/src/app/messages.ts`

## 5. Подтверждение эквивалентности текстов (до/после)
Источник: `docs/reports/2026-02-27/assets/hero-ab3-i18n-verify.json` (`variantEquivalenceRu`).

Для каждого варианта `aggressive/rational/partner`:
- `headlineMatch = true`
- `subheadlineMatch = true`
- `fomoMatch = true`

Это подтверждает, что после рефактора отображаются те же строки, что и до рефактора (RU).

## 6. Проверка RU/EN
Источник: `docs/reports/2026-02-27/assets/hero-ab3-i18n-verify.json` (`localeCheck`).

Для каждого варианта `aggressive/rational/partner`:
- `enRendered = true`
- все три поля (`headline/subheadline/fomo`) присутствуют и рендерятся.

## 7. Verification (lint/typecheck/build)
- `lint`: PASS
- `typecheck`: PASS
- `build:web`: PASS
- persist check (`heroVariant`): PASS (`stableAfterRefresh = true`)
- console errors: PASS (`[]`)

## 8. Verdict (PASS / FAIL)
PASS

## 9. Next minimal step (1 пункт)
1. Заполнить EN-ветку `landing.hero.variant.*` отдельным английским copy (сейчас структура готова, значения оставлены эквивалентными RU для сохранения поведения).
