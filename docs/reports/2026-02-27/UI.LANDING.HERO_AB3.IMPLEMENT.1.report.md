# UI.LANDING.HERO_AB3.IMPLEMENT.1

## 1. Executive summary
Реализован A/B/C Hero-тест с вариантами `aggressive`, `rational`, `partner`.
Вариант назначается равновероятно при первом визите и сохраняется в `localStorage` (`heroVariant`), затем стабилен при refresh.
Изменяется только текст Hero (`headline`, `subheadline`, `fomo`); layout, кнопки ролей, переход к `#roles`, второй экран, API и маршрутизация не изменялись.

## 2. SPEC GUARD results
- Найдено:
  - LandingPage: `apps/web/src/routes/LandingPage.tsx`
  - Hero: `<section id="hero">`
  - Roles: `<section id="roles">`
  - Hero text render: `h1` + 2 параграфа внутри `#hero`
  - Логика клика по ролям: `onHeroRoleClick(...)`
- Подтверждено:
  - Hero отделён от Roles (`section#hero` и `section#roles`).
  - Переключение ролей работает inline (state change, без route/hash change).
- GAP (зафиксирован): тексты Hero не централизованы в i18n/messages, а локализованы в объекте внутри `LandingPage.tsx` (реализация выполнена локально по задаче).

## 3. Реализация варианта распределения
- Введен enum/tuple:
  - `heroVariants = ['aggressive', 'rational', 'partner']`
- Реализована функция `getOrAssignHeroVariant()`:
  - читает `localStorage.heroVariant`
  - если значение валидно — использует его
  - иначе выбирает `Math.floor(Math.random() * 3)` и сохраняет в `localStorage`
- Распределение: равновероятный выбор между 3 вариантами (целевая модель 33/33/33).
- Событие:
  - `console.log('hero_variant_assigned', { variant, source })`

## 4. Подтверждение persist механизма
Источник проверки: `docs/reports/2026-02-27/assets/hero-ab3-verify.json`
- `storageKey`: `heroVariant`
- `firstLoadVariant`: `partner`
- `secondLoadVariant`: `partner`
- `stableAfterRefresh`: `true`

## 5. Скриншоты трёх вариантов (desktop + mobile)
- aggressive:
  - `docs/reports/2026-02-27/assets/hero-ab3-aggressive-desktop-viewport.png`
  - `docs/reports/2026-02-27/assets/hero-ab3-aggressive-mobile-viewport.png`
- rational:
  - `docs/reports/2026-02-27/assets/hero-ab3-rational-desktop-viewport.png`
  - `docs/reports/2026-02-27/assets/hero-ab3-rational-mobile-viewport.png`
- partner:
  - `docs/reports/2026-02-27/assets/hero-ab3-partner-desktop-viewport.png`
  - `docs/reports/2026-02-27/assets/hero-ab3-partner-mobile-viewport.png`

Дополнительно: hero-crop снимки для каждого варианта также сохранены в `assets/`.

## 6. Проверка интерактивности
Источник проверки: `docs/reports/2026-02-27/assets/hero-ab3-verify.json`

- lint: PASS
- typecheck: PASS
- build: PASS
- Hero высота:
  - desktop: `670px` (`<= 900px` viewport) PASS
  - mobile: `730px` (`<= 844px` viewport) PASS
- Вариантный рендер текста:
  - aggressive/rational/partner: headline/subheadline/fomo совпадают с заданными строками PASS
- Role flow:
  - hero role click: route/hash не меняются (`pathChanged=false`, `hashChanged=false`) PASS
  - tab switch: inline без route/hash change и без scroll jump (`scrollDelta=0`) PASS
- События:
  - `hero_variant_assigned`: logged PASS
  - `role_clicked`: logged PASS
  - `lead_submitted`: logged PASS
- Console errors: none PASS
- Наблюдаемая выборка назначения вариантов (`n=120`):
  - aggressive: 34
  - rational: 46
  - partner: 40

## 7. Verdict (PASS / FAIL)
PASS

## 8. Next minimal step
1. Вынести hero copy-варианты в централизованный слой контента/i18n без изменения текущей логики назначения variant.
