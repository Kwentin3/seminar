# UI.LANDING.HERO_ROLES_FLOW.AUDIT.1

## 1. Executive summary
Аудит выполнен на локальном URL `http://127.0.0.1:8787/` (build из текущего репозитория, desktop+mobile).
Переход Hero → Roles реализован внутри одного экрана без route/hash изменений: переключение ролей происходит inline через tab-state.
Ключевой наблюдаемый риск: плотность role-flow на mobile (1.12 экрана скролла только на контент одной роли до CTA формы).

## 2. SPEC GUARD results
- Landing page (Hero): найден (первый top-level section в `main > div > section`).
- Roles block: найден (`[role="tablist"]` + `[role="tabpanel"]` внутри Hero).
- Case expansion behavior: кейсы уже раскрыты в активной роли по умолчанию; при смене роли контент panel заменяется inline.
- Navigation behavior (anchors/routing/sticky):
  - Hero → Roles: не router и не anchor; inline state-switch.
  - Router используется на уровне хедера (`/` и `/admin`), но не в flow Hero → Roles.
  - Sticky/fixed в зоне Hero/Roles не зафиксированы.
- Lead form position: второй top-level section после Hero.

Ответы по п.2 SPEC GUARD:
- Какие UI-блоки участвуют в переходе Hero → Roles? `Header` (внешний контекст), Hero section card (title+summary), `tablist` ролей, `tabpanel` user stories.
- Используется ли router или якорная навигация? В переходе Hero → Roles: нет. Наблюдается inline switch без изменения `pathname/hash`.
- Есть ли sticky элементы? Нет (`position` не `sticky/fixed` у header и tablist).
- Есть ли смена контекста страницы? Нет (URL и scroll position при клике по роли не меняются).

## 3. Hero audit (desktop / mobile)
Скриншоты:
- Desktop viewport: `docs/reports/2026-02-27/assets/hero-desktop-viewport.png`
- Mobile viewport: `docs/reports/2026-02-27/assets/hero-mobile-viewport.png`
- Desktop hero element: `docs/reports/2026-02-27/assets/hero-desktop-element.png`
- Mobile hero element: `docs/reports/2026-02-27/assets/hero-mobile-element.png`

Метрики Hero:
- Desktop:
  - Высота Hero: `606 px`
  - Hero полностью без скролла: `да`
  - Кнопки ролей без скролла: `да`
  - Headline: `1` строка
  - Subheadline: `1` строка
  - Перегруз текста: `medium` (внутри Hero сразу рендерятся 3 кейса активной роли)
- Mobile:
  - Высота Hero: `1086 px`
  - Hero полностью без скролла: `нет`
  - Кнопки ролей без скролла: `да`
  - Headline: `1` строка
  - Subheadline: `2` строки
  - Перегруз текста: `high` (Hero > 1 viewport)

## 4. Transition mechanics
Пошаговое наблюдение (клик по второй роли `role-tab-analyst`):
1. Начальное состояние: URL `http://127.0.0.1:8787/`, `hash=""`, активна роль `role-tab-hr`.
2. Клик по табу роли.
3. URL/path/hash не изменяются.
4. Контент `tabpanel` обновляется inline.
5. Модальное окно не открывается.

Фиксация механики:
- Тип: `inline expand/replace`
- Anchor scroll: `нет`
- Route change: `нет`
- Modal: `нет`
- Scroll jump: `нет` (`scrollDelta = 0`)
- Ощущение «провала»: `нет` (скачок/перенос контекста не наблюдается)
- Потеря контекста: `нет`

## 5. Roles navigation
- Количество ролей: `3`
- Sticky tabs: `нет`
- Активное состояние роли видно: `да` (`aria-selected=true` + визуально выделенный tab)
- Кликов до раскрытия кейса:
  - для дефолтной активной роли при входе: `0`
  - для другой роли: `1` (клик по tab)
- Breadcrumb: `нет`
- Кнопка «назад»: `нет`

## 6. Role flow density
Для одной роли (активная по умолчанию `HR`, 3 кейса):
- Полный flow (tablist + panel):
  - Desktop: `488 px`
  - Mobile: `948 px`
- Экранов скролла:
  - Desktop: `0.54`
  - Mobile: `1.12`
- Первый CTA (submit формы) относительно старта роли:
  - Desktop: `+724 px`
  - Mobile: `+1286 px`
- Примерное время чтения role-flow: `~49 сек` (по объему текста panel)
- Риск перегруза: `medium` (desktop) / `high` (mobile)

## 7. Conversion path
- Количество кликов до lead form: `0` (достигается скроллом, без обязательных кликов)
- Видна ли форма без скролла:
  - Desktop: `частично` (карточка формы попадает во viewport, submit/основные поля ниже fold)
  - Mobile: `нет`
- Промежуточные отвлекающие элементы: `есть` (плотный stories-block между входом и CTA)
- Вторичные CTA: `есть` (навигация в header, включая переход в `/admin`)

## 8. Overall diagnosis
- Hero перегружен?: `да` (на mobile, по факту высоты `1086 px` и объема текстового panel в первом экране)
- Второй экран перегружен?: `да` (на mobile второй экран продолжает плотный story-flow до формы)
- Риск потери внимания: `medium`
- Главный UX-риск: высокая плотность role content до первого конверсионного CTA на mobile (`+1286 px` от начала role блока)

## 9. Verdict (PASS / ATTENTION / RISK)
`ATTENTION`

## 10. Next minimal step (1 пункт)
1. Подтвердить целевой production/stage URL и повторить этот же замер 1:1 на целевой среде для сверки с локальными значениями.

---
Артефакты измерений: `docs/reports/2026-02-27/assets/hero-roles-audit-metrics.json`.
