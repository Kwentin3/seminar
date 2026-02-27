# LANDING.CONTENT_JSON.CONTRACT.CREATE.1

## 1) Executive summary
Создан и интегрирован CONTRACT-документ для контентных JSON лендинга Phase 1: `Step1 Hero/Showcase` и `Step2 Roles`. Контракт фиксирует file layout, типы, версионирование, валидацию, деградацию в prod и error-code протокол без изменения кода.

## 2) SPEC GUARD results (какие документы использованы)
Использованные источники истины:
1. `docs/DOCS_CANON.md`
   - Определяет тип документа `CONTRACT`, путь `docs/contracts/`, формат имени и требования к шапке.
2. `docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md`
   - Определяет B-Light модель и ADR Trigger Rules; использован для решения, нужен ли ADR.
3. `docs/prd/PRD-PHASE-1.LANDING.md`
   - Фиксирует обязательные роли (`Business Owner`, `Operations Lead`, `IT Lead`) и 3 user stories на роль, а также RU/EN требование.
4. `docs/reports/2026-02-27/UI.LANDING.STEP1_STEP2_PROD_AUDIT.1.report.md`
   - Подтверждает production-факт разделения Step1/Step2 (`section#hero` отдельно от `section#roles`).

Почему это CONTRACT (а не PRD/ADR/REPORT):
1. Задача задает стабильный межслойный интерфейс данных (Producer JSON -> Consumer UI -> Validator), а не продуктовые цели или факт-репорт.
2. Документ описывает формальный data contract, compatibility и validation rules, что по канону относится к `CONTRACT`.

Почему изменение не требует ADR:
1. Не меняются стратегические границы между frontend/backend/functions.
2. Не вводится новая стратегия хранения/доступа к данным и не вводится CMS.
3. Не добавляется внешний интеграционный контракт.
4. Изменение укладывается в direct-documentation update по B-Light без стратегического сдвига.

## 3) Что сделано
1. Создан CONTRACT:
   - `docs/contracts/CONTRACT-001.landing.content-json.v1.0.md`
2. В контракте зафиксированы:
   - Parties/Consumers (Producer/Consumer/Validator).
   - File Layout v1.0 (`manifest`, `step1.hero`, `step2.roles`).
   - SemVer versioning + `manifest.expects` + правило `semver.satisfies(...)`.
   - Нормативные типы (`Locale`, `I18nText`, `TextItem`, `StableId`, `AnchorTarget`, `Link`).
   - Полные контракты Step1/Step2 и enabled-policy v1.0.
   - Validation policy для CI/Dev и runtime деградации в prod.
   - Error Code Contract с обязательным набором кодов v1.0.
3. Интеграция в docs:
   - Добавлена ссылка на CONTRACT в `related`:
     - `docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md`
     - `docs/prd/PRD-PHASE-1.LANDING.md`
   - Для `docs/DOCS_CANON.md` ссылка дана через `Related` в CONTRACT (у канона нет `related` в шапке, структурный формат файла не менялся).

## 4) Изменённые файлы (только docs)
1. `docs/contracts/CONTRACT-001.landing.content-json.v1.0.md` (new)
2. `docs/reports/2026-02-27/LANDING.CONTENT_JSON.CONTRACT.CREATE.1.report.md` (new)
3. `docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md` (updated `related`)
4. `docs/prd/PRD-PHASE-1.LANDING.md` (updated `related`)

## 5) Доказательства
1. Созданный CONTRACT:
   - `docs/contracts/CONTRACT-001.landing.content-json.v1.0.md`
2. Краткая самопроверка валидности примеров JSON:
   - `manifest.v1.json` пример содержит `schema_version`, `module`, оба модуля и `expects`.
   - `step1.hero.v1.json` пример содержит ровно 3 требуемых варианта (`aggressive/rational/partner`), корректный `persist_key=heroVariant`, положительные веса распределения с суммой `1.00`, `cta` с anchor на `#roles`, валидные `StableId`, RU/EN без пустых строк.
   - `step2.roles.v1.json` пример содержит фиксированные ключи ролей v1.0, `roles_order` длиной 3 без дублей и ровно 3 stories на каждую роль.
   - enabled-политика ограничена Step1 leaf-элементами; Step2 в v1.0 без enabled-флагов (новый layout не вводится).
3. Непротиворечивость PRD + production audit:
   - Step2 role keys и 3 stories соответствуют `PRD-PHASE-1.LANDING`.
   - Разделение Step1/Step2 соответствует факту из `UI.LANDING.STEP1_STEP2_PROD_AUDIT.1.report.md`.

## 6) Strategic Gate verdict
Решение не является временным workaround: документ задаёт формальный contract-first baseline v1.0 для реализации загрузки контента и валидатора, фиксирует совместимость и error-protocol, и предотвращает silent fallback. Это устойчивый источник истины, пригодный для CI/Dev enforcement и runtime деградации по правилам.

## 7) Verdict: PASS/FAIL
PASS

## 8) Next minimal step
1. Имплементировать `content/*.json` + валидатор + подключить Hero к JSON.

## TODO / OPEN QUESTION
1. GAP: в `docs/contracts/` отсутствует `INDEX.md`; минимальный следующий шаг после текущей задачи — создать `docs/contracts/INDEX.md` (`id | path | status | last_updated`).
