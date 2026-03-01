1. Executive summary

- Аудит production `https://seminar-ai.ru` на `2026-02-27` показал: фактического дублирования `RoleTabs` нет.
- Runtime DOM содержит ровно один `section#hero`, один `section#roles`, один `tablist`, один `tabpanel`.
- `RoleTabs` не рендерится внутри Hero; он рендерится один раз в отдельном Step 2.
- Production bundle совпадает с локальным build (`index-CHDSPSAN.js`, `index-C9KrtWKp.css`), признаков старого бандла/кэш-рассинхрона не обнаружено.

2. Production DOM structure

- Источник runtime DOM: `docs/reports/2026-02-27/assets/ui-landing-step1-step2-prod-runtime-dom.html`
- Факты (runtime, после исполнения JS):
  - `section#hero`: `1`
  - `section#roles`: `1`
  - `[role="tablist"]`: `1`
  - `[role="tabpanel"]`: `1`
  - Внутри `section#hero`:
    - `[role="tablist"]`: `0`
    - `[role="tabpanel"]`: `0`
- Скриншоты:
  - Hero: `docs/reports/2026-02-27/assets/ui-landing-step1-step2-prod-hero.png`
  - Блок ниже Hero: `docs/reports/2026-02-27/assets/ui-landing-step1-step2-prod-below-hero.png`
  - Место, где ожидался бы второй Roles (фактически стартует lead form): `docs/reports/2026-02-27/assets/ui-landing-step1-step2-prod-roles-second-start.png`

3. Количество рендеров RoleTabs

- В production runtime по DOM: `1` (`tablist=1`, `tabpanel=1`).
- В локальном исходнике: один вызов `RoleTabs` в `LandingPage`:
  - `apps/web/src/routes/LandingPage.tsx:153`
- Повторного вызова `RoleTabs` в других route/layout файлах не найдено.

4. Где происходит дублирование (файл + строка)

- Дублирование `RoleTabs` не обнаружено.
- Подтверждённый единственный вызов:
  - `apps/web/src/routes/LandingPage.tsx:153`
- Hero содержит только CTA-ссылки на роли (не `RoleTabs`):
  - `apps/web/src/routes/LandingPage.tsx:131`
  - `apps/web/src/routes/LandingPage.tsx:139`
- Сама таб-структура (`tablist`/`tabpanel`) определяется только в:
  - `apps/web/src/components/RoleTabs.tsx:61`
  - `apps/web/src/components/RoleTabs.tsx:85`

5. Отличие от ожидаемой архитектуры

- Ожидаемая архитектура Step1 → Step2 в текущем production соблюдается:
  - Step 1 (`section#hero`): headline/subheadline/fomo + кнопки перехода к `#roles`, без `tabpanel`, без user stories.
  - Step 2 (`section#roles`): `tablist` + `tabpanel` + user stories, затем lead form.
- Несоответствия архитектуре не зафиксированы.

6. Root cause

- Root cause инцидента “Roles отображается дважды” в текущем production не подтверждён как техническое дублирование компонента.
- Фактическая причина наблюдаемого эффекта: в Hero есть отдельный CTA-блок с подписью “Роли” и кнопками ролей, а ниже расположен полноценный Step 2 “Роли” с tabpanel. Это два разных блока с разной функцией, не двойной рендер `RoleTabs`.

7. Verdict (ARCH_MISMATCH / CACHE / CODE_DUPLICATION / OTHER)

- `OTHER`
- Расшифровка: `NOT_REPRODUCED_AS_DUPLICATION` (дублирование `RoleTabs` и смешение Step1/Step2 на уровне DOM/рендера не подтверждено).

8. Next minimal step (1 пункт)

1. Проверить конкретную проблемную сессию пользователя (HAR + скрин + `ETag`/asset hash) и сопоставить с текущим `index-CHDSPSAN.js`, если жалоба о “двойном Roles” сохраняется.

Дополнительные артефакты:

- Сводные факты аудита: `docs/reports/2026-02-27/assets/ui-landing-step1-step2-prod-audit-facts.json`
- Полный скрин viewport/fullpage: `docs/reports/2026-02-27/assets/ui-landing-step1-step2-prod-fullpage.png`
