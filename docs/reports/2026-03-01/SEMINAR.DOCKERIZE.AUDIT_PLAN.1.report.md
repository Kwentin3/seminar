# SEMINAR.DOCKERIZE.AUDIT_PLAN.1.report

## 1. Executive summary
- Текущий production baseline подтвержден по репозиторию: `Node.js server/index.mjs` под `systemd`, edge через `nginx`, storage через SQLite, deploy через GitHub Actions + SSH на VPS (`docs/runbooks/GO_LIVE.md:7`, `docs/runbooks/GO_LIVE.md:8`, `docs/runbooks/GO_LIVE.md:22`, `.github/workflows/ci.yml:98`).
- Runtime-код использует локальный SQLite и structured logging в stdout; health endpoint только `GET /api/healthz` (`server/index.mjs:30`, `server/index.mjs:53`, `server/obs/logger.mjs:254`).
- Для миграции под Docker+Traefik выявлены P0-риски: bind-host drift (`HOST=127.0.0.1` в текущем runbook), зависимость `/admin/obs/logs` от `journalctl/journald`, отсутствие versioned фактических `systemd/nginx` конфигов и формализованного backup/restore runbook (`docs/runbooks/GO_LIVE.md:103`, `server/obs/log-retrieval.mjs:65`, `docs/adr/ADR-001.infrastructure.baseline.v1.md:78`).
- По условиям SPEC GUARD зафиксирован `STOP_REQUIRE_CONTEXT` (подробно в разделе 2.3). Итоговый статус: `NEEDS_CONTEXT`.

## 2. SPEC GUARD results

### 2.1 Документы и источники, регулирующие текущий prod runtime
1. Runtime/entrypoint: `server/index.mjs`.
2. Package scripts: `package.json` (`start:vps`, smoke, obs scripts).
3. Deployment baseline/runbook: `docs/runbooks/GO_LIVE.md`.
4. Env spec: `docs/runbooks/ENV_MATRIX.md`.
5. Prod guardrails/CI-deploy: `docs/runbooks/GITHUB_GUARDRAILS.md`, `.github/workflows/ci.yml`.
6. Infra invariants: `docs/adr/ADR-001.infrastructure.baseline.v1.md`.
7. Logging/observability contract: `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md`.
8. Health/admin/log retrieval runbooks: `docs/runbooks/LEADS_SMOKE_LOCAL.md`, `docs/runbooks/OBS_LOG_RETRIEVAL.md`.

### 2.2 Обязательные письменные ответы
- Какие документы регулируют текущий prod runtime?
  - Основные: `docs/runbooks/GO_LIVE.md`, `docs/runbooks/ENV_MATRIX.md`, `docs/runbooks/GITHUB_GUARDRAILS.md`, `docs/adr/ADR-001.infrastructure.baseline.v1.md`, `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md`, плюс фактическая реализация в `server/index.mjs`.
- Где описан deployment baseline?
  - Процедурно: `docs/runbooks/GO_LIVE.md`.
  - Автоматизированный путь deploy: `.github/workflows/ci.yml` (job `deploy`).
- Какой слой затрагивается?
  - `infra` (VPS runtime, systemd/nginx, CI deploy).
  - `runtime` (Node process env/bind/logging/health).
  - `storage` (SQLite файл + WAL).
  - `proxy` (nginx сейчас, Traefik как target).
- Есть ли архитектурные инварианты, которые нельзя нарушать?
  - Да:
    - production runtime на VPS с reverse proxy и SQLite (`docs/adr/ADR-001.infrastructure.baseline.v1.md:30-37`);
    - `ADMIN_SECRET` только в env (`docs/adr/ADR-001.infrastructure.baseline.v1.md:40-43`);
    - structured logs в stdout и journald как source of truth (`docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md:55`);
    - `/admin` защищен header-secret (`server/index.mjs:921-968`).

### 2.3 Stop checks
- `STOP_REQUIRE_CONTEXT` (triggered): прод-контур в репозитории неполный для фактической верификации.
  - В repo нет versioned фактических файлов `/etc/systemd/system/seminar.service` и `/etc/nginx/sites-available/seminar`; есть только runbook-шаблоны (`docs/runbooks/GO_LIVE.md:122`, `docs/runbooks/GO_LIVE.md:153`).
  - Нет формального backup/restore runbook для SQLite (только указание, что backup/retention нужно поддерживать вручную: `docs/adr/ADR-001.infrastructure.baseline.v1.md:78`).
- Скрытый state:
  - Cron/sidecar не обнаружены в repo.
  - Есть явные system-level зависимости (`systemd`, `nginx`, `fail2ban`, `certbot`, `journalctl`) и они документированы.
- `STOP_CONTRACT_CONFLICT`:
  - Прямого runbook↔code конфликта, блокирующего аудит, не зафиксировано.
  - Зафиксированы расхождения уровня риска (не стоп): `HOST` fallback в коде (`0.0.0.0`) vs production env в runbook (`127.0.0.1`).

## 3. Runtime baseline inventory

### 3.1 TASK 1 — Runtime Baseline Inventory (infra layer)

| Component | Current State | Source | Risk for Docker |
| --- | --- | --- | --- |
| Server start | `pnpm run start:vps` -> `node server/index.mjs` | `package.json:25` | Нужно гарантировать prebuilt frontend в image, иначе старт упадет из-за `staticDir` проверки. |
| HTTP bind | `host = HOST ?? 0.0.0.0`; `port = PORT ?? 8787`; в prod runbook: `HOST=127.0.0.1`, `PORT=8787` | `server/index.mjs:33-34`, `docs/runbooks/GO_LIVE.md:102-103` | P0 drift: `127.0.0.1` внутри контейнера недоступен из Traefik-контейнера. |
| Static assets | `STATIC_DIR` или `apps/web/dist`; отсутствие директории = crash on start | `server/index.mjs:28`, `server/index.mjs:40-42` | Нужен deterministic build-stage и копирование `apps/web/dist` в runtime image. |
| Migrations | `MIGRATIONS_DIR` или `migrations`; миграции применяются на старте | `server/index.mjs:29`, `server/index.mjs:45`, `server/index.mjs:540-575` | При readonly FS или отсутствии migration files контейнер не стартует. |
| SQLite path | `DATABASE_PATH` или `repo/data/seminar.sqlite`; при prod baseline: `/var/lib/seminar/seminar.sqlite` | `server/index.mjs:30`, `docs/runbooks/GO_LIVE.md:105` | Нужен persistent volume + сохранение `.sqlite`, `-wal`, `-shm`. |
| DB mode | `PRAGMA journal_mode=WAL;` + `foreign_keys=ON` | `server/index.mjs:535-536` | При неправильном volume/storage lock contention или data-loss риск выше. |
| Admin auth secret | `ADMIN_SECRET` читается из env; без него сервер стартует, но admin endpoints дают `500` | `server/index.mjs:36`, `server/index.mjs:512-529`, `server/index.mjs:921-941` | Нужен startup/preflight check на секрет до cutover. |
| Turnstile env | `TURNSTILE_SECRET_KEY` optional; `TURNSTILE_MODE`, `ALLOW_TURNSTILE_MOCK` управляют mock | `server/index.mjs:35`, `server/index.mjs:37-38`, `server/index.mjs:674-681` | Ошибка env может включить нежелательный режим; mock в prod должен быть явно запрещен. |
| Content manifest env | `LANDING_CONTENT_MANIFEST_PATH` optional override | `server/index.mjs:31`, `server/landing/content-observability.mjs:497-510` | При некорректном пути деградация landing+obs событий. |
| Log output | Structured JSON в stdout (`process.stdout.write`) | `server/obs/logger.mjs:254`, `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md:55` | Для Docker это плюс, но journald-specific retrieval надо адаптировать. |
| Write paths | DB file + WAL/SHM; логи в stdout; других runtime file writes не найдено | `server/index.mjs:533-537`, `server/obs/logger.mjs:254` | Volume обязателен только для SQLite; uploads/tmp/cache не задействованы. |
| Upload/tmp/cache | Не обнаружены runtime handlers для upload/cache/tmp | `server/index.mjs` (поиск fs write handlers) | Низкий риск; отдельные volume для upload не требуются на текущем этапе. |

#### Полный перечень runtime ENV (по фактическому коду)
- Core server:
  - `HOST` (`server/index.mjs:33`)
  - `PORT` (`server/index.mjs:34`)
  - `DATABASE_PATH` (`server/index.mjs:30`)
  - `STATIC_DIR` (`server/index.mjs:28`)
  - `MIGRATIONS_DIR` (`server/index.mjs:29`)
  - `LANDING_CONTENT_MANIFEST_PATH` (`server/index.mjs:31`)
  - `ADMIN_SECRET` (`server/index.mjs:36`)
  - `TURNSTILE_SECRET_KEY` (`server/index.mjs:35`)
  - `TURNSTILE_MODE` (`server/index.mjs:37`)
  - `ALLOW_TURNSTILE_MOCK` (`server/index.mjs:38`)
- Observability runtime:
  - `OBS_INFO_EVENTS_PER_REQUEST_MAX` (`server/obs/logger.mjs:246`)
  - `HOSTNAME` (`server/obs/logger.mjs:256`)
  - `BUILD_ID` (`server/obs/logger.mjs:257`)
  - `OBS_JOURNALD_SERVICE` (`server/obs/log-retrieval.mjs:65`)
  - `OBS_JOURNALCTL_BIN` (`server/obs/log-retrieval.mjs:72`)

Классификация обязательности (фактическая):
- Hard-required for process start: ни один из env формально не обязателен для старта процесса.
- Required for expected production behavior:
  - `ADMIN_SECRET` (иначе admin paths работают с `500`)
  - `DATABASE_PATH` должен указывать на persistent volume (иначе ephemeral storage)
  - `HOST` должен быть согласован с сетевой топологией (для Docker: не `127.0.0.1`)

### 3.2 TASK 2 — Proxy & Networking Audit (edge layer)
- Текущий reverse proxy: `nginx` (runbook template), proxy на `127.0.0.1:8787` (`docs/runbooks/GO_LIVE.md:153-169`).
- Домены/роутинг:
  - Указан только `seminar-ai.ru` (+ `_` как catch-all в `server_name`).
  - Канонический публичный домен в docs: `https://seminar-ai.ru/` (`README.md:7`, `docs/README.md:6`).
- Redirects:
  - HTTPS redirect предусмотрен через `certbot --nginx --redirect` (`docs/runbooks/GO_LIVE.md:241`).
  - Явный `www -> apex` policy не найден (GAP).
- `X-Forwarded-*` зависимость:
  - `nginx` пробрасывает `X-Forwarded-For`, `X-Forwarded-Proto` (`docs/runbooks/GO_LIVE.md:168-169`).
  - Приложение использует `trust proxy=true` и `x-forwarded-for` для IP-based logic (`server/index.mjs:48`, `server/index.mjs:789-799`).
- Hardcoded localhost:
  - В runtime-коде нет hardcoded `localhost` endpoint для serving.
  - В runbook/CI/smoke присутствуют `127.0.0.1:8787` как текущий internal entrypoint (`docs/runbooks/GO_LIVE.md:20`, `.github/workflows/ci.yml:61-64`).

Риски при переносе под Traefik:
- Потеря корректного client IP для rate-limit, если не настроены forwarded headers.
- Если оставить `HOST=127.0.0.1`, Traefik не достучится до app в отдельном контейнере.
- Текущий catch-all подход nginx (`server_name ... _`) нельзя переносить в multi-project edge без строгих host rules.

### 3.3 TASK 3 — Data & Persistence Risk Audit (storage layer)
- SQLite location:
  - runtime default: `./data/seminar.sqlite` (repo-local) (`server/index.mjs:30`)
  - prod baseline: `/var/lib/seminar/seminar.sqlite` (`docs/runbooks/GO_LIVE.md:22`, `docs/runbooks/GO_LIVE.md:105`)
- Права доступа:
  - Runbook требует `chown -R seminar:seminar /var/lib/seminar` (`docs/runbooks/GO_LIVE.md:92`).
  - Env file permissions зафиксированы (`640`) (`docs/runbooks/GO_LIVE.md:116-117`).
- File locks / WAL:
  - WAL mode включен (`server/index.mjs:535`), значит критично переносить и `-wal/-shm` состояние при cutover.
- Параллельный доступ:
  - Текущая модель: один Node процесс + один SQLite connection (`const db = openDatabase(...)`) (`server/index.mjs:44`).
  - Горизонтальное масштабирование в несколько app-replicas с одним SQLite volume нецелевое.
- Backup стратегия:
  - Формальная процедура backup/restore в runbooks отсутствует (GAP).
  - В ADR есть явная пометка, что backup/retention поддерживается вручную (`docs/adr/ADR-001.infrastructure.baseline.v1.md:78`).

Оценка рисков:
- Volume mapping: высокий риск при неправильном fs/permission профиле.
- Migration: средний риск, если migrations/sql не попадут в runtime image.
- Lock contention: высокий риск при попытке scale-out >1 replica.
- Future scaling: SQLite ограничивает безопасный горизонтальный рост без смены storage модели.

### 3.4 TASK 4 — Observability & Health
- `GET /api/healthz` есть (`server/index.mjs:53-55`).
- Readiness vs liveness: отдельного readiness endpoint нет (только один health).
- Structured logs: есть, JSON schema-driven, redaction, bounded payload (`server/obs/logger.mjs`, `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md:55`).
- Trace/correlation id:
  - `request_id` генерируется на каждый request (`server/obs/request-context.mjs:33`).
  - Возвращается клиенту в `x-request-id` (`server/obs/request-context.mjs:36`).
- Куда пишутся логи сейчас:
  - В stdout процесса -> journald/systemd в baseline (`server/obs/logger.mjs:254`, `docs/contracts/CONTRACT-OBS-001.logging.event-model.v0.4.md:55`).
- Влияние Docker stdout:
  - Для базового logging pipeline совместимо.
  - Текущий retrieval (`/admin/obs/logs` и `pnpm run obs:logs`) зависит от `journalctl` (`server/obs/log-retrieval.mjs:74`, `scripts/obs/logs.mjs:77`), что не соответствует контейнерному runtime без доп. адаптации (P0).

## 4. Risks (P0 / P1 / P2)

### P0
1. `STOP_REQUIRE_CONTEXT`: отсутствует versioned фактический снимок live `systemd/nginx` конфигов и backup/restore процедуры SQLite.
2. Bind-host drift: production runbook фиксирует `HOST=127.0.0.1`; для Traefik->container нужен listen не на loopback.
3. Observability retrieval hard dependency on journald/journalctl (`/admin/obs/logs`, `obs:logs`) не готова к чистому Docker stdout-runtime.
4. Backup strategy gap для SQLite (нет RPO/RTO/restore drill в документах).

### P1
1. Edge routing policy incomplete for multi-project: явный `www` policy не зафиксирован; текущий nginx template использует catch-all `_`.
2. SQLite WAL state migration risk (`.sqlite`, `-wal`, `-shm`) при cutover.
3. CI deploy pipeline жёстко ориентирован на `systemctl restart seminar` и SSH release-symlink; для Docker нужен отдельный deploy contract.
4. `@seminar/contracts` runtime import имеет fallback path в content-observability; риск тихой деградации при ошибках упаковки image.

### P2
1. Нет разделения readiness/liveness endpoint.
2. Нет явного лимита/политики retention для Docker log-driver (вместо journald policy из контракта).
3. Нет explicit resource profile (CPU/RAM) для app/edge контейнеров.

## 5. Target Docker architecture (описательная)
- `traefik` как единственный edge reverse proxy для VPS:
  - публикует только `:80/:443` на host;
  - ACME/Let's Encrypt хранит состояние в отдельном persistent volume;
  - каждый проект подключается через labels/routers по точным host rules.
- `seminar-app` как отдельный service-container:
  - подключен к shared external network `edge`;
  - host ports не публикует;
  - healthcheck через `GET /api/healthz`.
- Storage:
  - отдельный persistent volume для SQLite (`DATABASE_PATH` внутри контейнера в volume-mounted директории);
  - учитывается trio файлов: `.sqlite`, `.sqlite-wal`, `.sqlite-shm`.
- Logging:
  - приложение продолжает писать structured logs в stdout;
  - edge и app логи централизуются через Docker logging pipeline.
- Domain/TLS:
  - router для `seminar-ai.ru`;
  - опционально отдельный router+middleware для `www` -> apex redirect.
- Multi-project readiness:
  - shared `edge` network используется повторно для других проектов;
  - каждый новый проект добавляет только свой service + host rule, без изменения публичного портового контура VPS.
- Observability compatibility constraint:
  - текущий journald-based `/admin/obs/logs` требует адаптации (docker log source или отдельный retrieval adapter).

## 6. Deterministic migration plan

| Step | Atomic action | Verification gate | Rollback trigger |
| --- | --- | --- | --- |
| 1. Подготовка VPS | Зафиксировать фактические live-конфиги (`systemd`, `nginx`, env redacted), текущие DNS записи, текущие порты и статус сервисов. | Подписанный baseline snapshot в docs + сверка с runbook без пробелов. | Любая несходимость baseline без объяснения. |
| 2. Установка Docker | Установить Docker Engine/CLI/Compose plugin и включить автозапуск docker service. | `docker version`, `docker info` успешны; reboot-persistence проверена. | Docker daemon нестабилен или конфликтует с текущим runtime. |
| 3. Развёртывание Traefik | Поднять Traefik в изолированном режиме с `edge` network и ACME storage, без переключения прод-домена на seminar. | Traefik отвечает на test host rule/entrypoint; cert storage writable. | Traefik не поднимается стабильно или не получает сертификаты в тесте. |
| 4. Контейнеризация seminar | Собрать и запустить `seminar-app` контейнер в `edge` сети, без публикации host-порта; задать docker-совместимые env (включая `HOST` не loopback). | Внутрисетевой запрос через Traefik router возвращает `200` на `/` и `/api/healthz`. | App container crash-loop или healthcheck нестабилен. |
| 5. Volume migration SQLite | Остановить legacy `seminar.service`; выполнить консистентный перенос `.sqlite` + `-wal` + `-shm` в Docker volume; выставить владельца/права. | После старта контейнера данные доступны, `/api/admin/leads` возвращает исторические записи. | Любая потеря/повреждение данных, mismatch количества записей. |
| 6. Smoke test | Прогнать smoke matrix: `/`, `/api/healthz`, `POST /api/leads`, duplicate=409, admin auth 401/200, obs log retrieval (или зафиксированный temporary fallback). | Все smoke checks green, статус-коды и contract body соответствуют runbook. | Любой P0 сценарий red. |
| 7. DNS switch | Переключить DNS/edge routing на Traefik (если нужен switch), проверить TLS chain и canonical domain behavior. | Публично `https://seminar-ai.ru/` стабильно, без mixed routing на legacy nginx. | Рост 5xx/4xx выше baseline или TLS errors. |
| 8. Закрытие миграции | Зафиксировать post-cutover runbook/ops-contract, обновить CI deploy flow под Docker, перевести legacy service в standby. | Новый ops baseline принят и воспроизводим end-to-end. | Невозможность штатного redeploy/rollback по новому контракту. |

## 7. Rollback strategy
1. До DNS switch:
   - legacy `systemd+nginx` контур держать нетронутым и готовым к `systemctl restart seminar`.
2. После switch при деградации:
   - остановить docker route для seminar;
   - вернуть legacy nginx upstream/route и перезапустить `seminar.service`;
   - восстановить DNS/edge rule на pre-cutover state.
3. Data rollback:
   - использовать pre-migration SQLite snapshot;
   - не запускать одновременно legacy и docker app на одном SQLite файле.
4. Контрольный критерий rollback done:
   - legacy smoke checklist из `GO_LIVE` снова green (`/`, `/api/healthz`, lead flow, admin flow).

## 8. Open questions
1. Нужен фактический экспорт live `nginx` и `systemd` конфигов (не только runbook templates) для закрытия `STOP_REQUIRE_CONTEXT`.
2. Нужен утвержденный backup/restore контракт SQLite: RPO, RTO, frequency, restore drill.
3. Нужна целевая политика для `/admin/obs/logs` в Docker runtime (источник логов вместо journald).
4. Нужно решение по доменам: только apex `seminar-ai.ru` или `www` тоже должен обслуживаться/редиректиться.
5. Нужен целевой deploy contract для CI (взамен `systemctl restart seminar`).

## 9. Verdict
`NEEDS_CONTEXT`.

Основание: активирован `STOP_REQUIRE_CONTEXT` из-за неполной фактической production картины (live configs + backup/restore contract отсутствуют в versioned источниках).

## 10. Next minimal step
1. Снять и добавить в docs redacted snapshot фактических файлов `/etc/systemd/system/seminar.service`, `/etc/nginx/sites-available/seminar`, текущего env набора (только имена ключей и non-secret значения), плюс утвержденный SQLite backup/restore procedure.
