# UI.LANDING.HERO_SEPARATION.IMPLEMENT.1

## 1. Executive summary
Landing разделен на 2 логических уровня: отдельный `#hero` (без user stories) и отдельный `#roles` ниже него.
`tablist`/`tabpanel` сохранены в прежней интерактивной модели inline state (без route/hash изменений).
JSON-контракт ролей не изменялся; stories продолжают рендериться из `content/roles.json`.

## 2. SPEC GUARD results
- Компонент Landing: `apps/web/src/routes/LandingPage.tsx`.
- Hero container: найден и реализован как `<section id="hero">`.
- Roles container: найден и реализован как `<section id="roles">`.
- Tablist / Tabpanel: `apps/web/src/components/RoleTabs.tsx` (`role="tablist"`, `role="tabpanel"`) сохранены.
- Lead form: `apps/web/src/components/LeadForm.tsx`, размещение без изменений (после roles).
- Подтверждение исходного состояния до изменений: roles ранее были внутри hero-card (`LandingPage` рендерил `RoleTabs` в первой `SectionCard`).
- Подтверждение механики tab switching: inline state через `useState` + click handler, без router/hash.
- GAP (факт): структура JSON ролей используется в Hero напрямую для подписей role-кнопок (`ROLE_CONTENT.map(... role.title[locale])`), контракт JSON не менялся.

## 3. Что изменено
- Добавлен отдельный стратегический Hero: headline, subheadline, `heroFomoLine`, role-кнопки.
- Роли вынесены в отдельный блок `#roles` ниже Hero.
- Role-кнопки в Hero реализованы как anchor (`href="#roles"`) с `preventDefault()`:
  - скролл к `#roles` через `scrollIntoView`
  - одновременная активация выбранной роли
  - без route change
  - без hash change
- `RoleTabs` расширен до controlled/uncontrolled режима для внешней активации роли из Hero; aria-атрибуты tablist/tabpanel не менялись.

## 4. Изменённые файлы
- `apps/web/src/routes/LandingPage.tsx`
- `apps/web/src/components/RoleTabs.tsx`
- `apps/web/src/app/messages.ts`

## 5. Метрики Hero (до/после)
Источник "до": `docs/reports/2026-02-27/assets/hero-roles-audit-metrics.json`.
Источник "после": `docs/reports/2026-02-27/assets/hero-separation-verify.json`.

| Metric | Desktop (before) | Desktop (after) | Mobile (before) | Mobile (after) |
|---|---:|---:|---:|---:|
| Hero height, px | 606 | 670 | 1086 | 730 |
| Hero <= viewport | yes | yes | no | yes |

Артефакты скриншотов после реализации:
- `docs/reports/2026-02-27/assets/hero-separation-desktop-viewport.png`
- `docs/reports/2026-02-27/assets/hero-separation-mobile-viewport.png`
- `docs/reports/2026-02-27/assets/hero-separation-desktop-hero.png`
- `docs/reports/2026-02-27/assets/hero-separation-mobile-hero.png`

## 6. Проверка mobile/desktop
- lint: PASS
- typecheck: PASS
- build: PASS
- Desktop:
  - Hero <= 1 viewport: PASS
  - CTA роли видны без скролла: PASS
- Mobile:
  - Hero <= 1 viewport: PASS
  - Roles начинаются ниже fold: PASS (`roles.top = 919`, `viewport.height = 844`)
  - scroll-jump при tab switch: PASS (`scrollDelta = 0`)
- Интерактивность:
  - Hero role-click активирует нужный tab: PASS
  - route change: PASS (не происходит)
  - hash change: PASS (не происходит)
- Console errors: PASS (`0` desktop, `0` mobile)

## 7. Verdict (PASS / FAIL)
PASS

## 8. Next minimal step
1. Повторить тот же verify-прогон на stage/production URL для подтверждения метрик вне локальной среды.
