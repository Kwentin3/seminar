---
id: REPORT-2026-03-13.cabinet.auth.discovery
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/epics/EPIC-002.cabinet.auth-foundation/EPIC.md
  - docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
  - docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md
  - docs/prd/PRD-PHASE-1.LANDING.md
tags:
  - report
  - discovery
  - audit
  - cabinet
  - auth
---

# CABINET Auth Discovery Report

## Summary
1. Текущий runtime-код не содержит user auth, session layer, users/roles tables или materials library model.
2. Публичное приложение сейчас имеет только два SPA-маршрута: `/` и `/admin`.
3. Текущий admin access построен на shared `ADMIN_SECRET` через header `X-Admin-Secret`; это gate, а не полноценная авторизация.
4. Server-side admin-protected endpoints сейчас только два: `GET /api/admin/leads` и `GET /admin/obs/logs`.
5. SQLite schema содержит только `leads` и `schema_migrations`; в локальной БД обнаружено `30` лидов и `1` applied migration.
6. Materials domain уже существует фактически, но в виде repo-hosted markdown/PDF/JSON assets, а не как runtime-managed сущности.
7. В репозитории есть как минимум `15` seminar markdown docs, `2` PDF-файла в `content/`, `4` JSON content-файла, но нет materials table или materials API.
8. По repo search не найдено интегрированного внешнего material storage вроде Notion/Google Drive/S3. Это не доказывает их полного отсутствия вне репозитория, но подтверждает, что в текущей системе они не wired.
9. Phase 1 PRD и ADR явно исключали user cabinet; новый кабинет является отдельным продуктовым слоем.
10. В проекте есть подтверждённый контекстный конфликт по production baseline:
    - входной бриф и часть docs описывают live `systemd + nginx + SQLite`;
    - docs canon после `2026-03-01` считает canonical production baseline как `Docker + Traefik + GHCR pinned digest`.
11. Для first slice нет подтверждённых оснований начинать с client cabinet, speaker portal или full RBAC.
12. Наиболее уместный SVI: internal team materials cabinet внутри текущего приложения с app-native login и SQLite-backed sessions.

## Inventory: Routes, Env, Storage, Auth, Admin Surface

### 1. Existing Routes
#### SPA routes
| route | current purpose | auth model |
| --- | --- | --- |
| `/` | public landing | public |
| `/admin` | read-only leads UI | secret entered in UI, forwarded as header |

#### API / server routes
| route | method | current purpose | auth model |
| --- | --- | --- | --- |
| `/api/healthz` | `GET` | health check | public |
| `/api/leads` | `POST` | lead capture | public |
| `/api/admin/leads` | `GET` | leads list for admin page | `X-Admin-Secret` |
| `/admin/obs/logs` | `GET` | structured log retrieval | `X-Admin-Secret` |
| `/api/*` unknown | any | returns `404 invalid_input` | n/a |

### 2. Existing Env Inventory
#### Core runtime env found in code
1. `STATIC_DIR`
2. `MIGRATIONS_DIR`
3. `DATABASE_PATH`
4. `LANDING_CONTENT_MANIFEST_PATH`
5. `HOST`
6. `PORT`
7. `TURNSTILE_SECRET_KEY`
8. `ADMIN_SECRET`
9. `TURNSTILE_MODE`
10. `ALLOW_TURNSTILE_MOCK`

#### Observability/runtime env also present
1. `OBS_LOG_SOURCE`
2. `OBS_LOG_HARD_CAP_LINES`
3. `OBS_LOG_HARD_CAP_BYTES`
4. `OBS_JOURNALD_SERVICE`
5. `OBS_JOURNALCTL_BIN`
6. `OBS_DOCKER_CONTAINER`
7. `OBS_DOCKER_BIN`
8. `BUILD_ID`

#### Auth-specific observation
1. `ADMIN_SECRET` is the only access-control secret in the current app.
2. No env for users, password hashing, sessions or mail delivery exists today.

### 3. Existing Storage
| area | current state |
| --- | --- |
| DB engine | SQLite |
| repo-local dev DB | `data/seminar.sqlite` |
| live legacy prod DB | `/var/lib/seminar/seminar.sqlite` according to runbooks/live snapshot |
| migrations | only `migrations/0001_create_leads.sql` |
| schema tables | `leads`, `schema_migrations` |

### 4. Current Auth / Security Mechanisms
1. `/admin` UI asks for secret and sends it as `X-Admin-Secret` header to `/api/admin/leads`.
2. `authenticateAdminRequest()` compares incoming secret with env `ADMIN_SECRET`.
3. Wrong or missing secret returns `401 admin_unauthorized`.
4. Missing configured `ADMIN_SECRET` returns `500`, meaning admin surface can degrade to broken rather than locked at startup.
5. There is no session cookie, JWT, CSRF layer, password hashing or user revocation model.
6. Structured logs already record `admin_auth_failed` and `admin_auth_succeeded`.
7. No explicit admin brute-force throttling is implemented for `/api/admin/leads` or `/admin/obs/logs`.

### 5. Current Admin Surface
| surface | state |
| --- | --- |
| `/admin` page | read-only leads table, no CRUD |
| `/api/admin/leads` | read-only data retrieval |
| `/admin/obs/logs` | admin-only operational surface |

## Inventory: Existing Materials And Storage Locations

### 1. Confirmed in-repo materials
| location | material type | current use |
| --- | --- | --- |
| `docs/seminar/**/*.md` | seminar knowledge docs | knowledge domain, not app runtime |
| `content/Методические материалы семинара.pdf` | PDF | file in repo, not wired into UI |
| `content/Методические материалы семинара (1).pdf` | PDF | file in repo, not wired into UI |
| `content/landing/*.json` | landing content modules | actively consumed by landing runtime |
| `content/roles.json` | older role content | present in repo but currently unused by runtime |
| `docs/контент.md`, `docs/контент.txt` | content notes | repo docs, not runtime-integrated |

### 2. What is not present
1. No `materials` table.
2. No `materials` API.
3. No asset manifest for seminar PDFs/docs beyond landing JSON manifest.
4. No repo evidence of Notion/Google Drive/S3 integration.
5. No download/view audit trail for materials.

### 3. Interpretation
Current materials already exist in enough volume to justify a cabinet, but they are stored as repository assets and documentation, not as curated user-facing library objects.

## Gap Analysis

### 1. What already exists
1. Single-app Node + SPA baseline.
2. SQLite persistence and migration mechanism.
3. Existing admin-protected surface and structured logging.
4. Seminar knowledge corpus in docs and local files.
5. CI/build/smoke discipline already established.

### 2. What is missing for auth cabinet
1. Product decision on who the first cabinet user actually is.
2. User identity model.
3. Role model.
4. Session model.
5. Materials metadata model.
6. Cabinet routes and UI IA.
7. Bootstrap path for first admin.
8. Auth-specific smoke tests and CI gates.

### 3. What blocks clean implementation today
1. Runtime baseline conflict:
   - `README.md`, `docs/runbooks/ENV_MATRIX.md`, `docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md` still describe live `systemd + nginx`;
   - `docs/DOCS_CANON.md`, `docs/infra-ops/PRODUCTION_BASELINE_DOCKER_TRAEFIK.md`, `docs/ARCHITECTURE/NORTH_STAR.md` say canonical production is Docker-only.
2. No approved product scope:
   - internal-only vs mixed vs client cabinet remains unresolved.
3. No material normalization:
   - assets exist, but taxonomy and ownership are still implicit.

## Architectural Options

### Option A: Shared password gate for a new internal route
Description:
1. New route like `"/cabinet"` with one shared secret/password gate.
2. No user records or sessions.
3. Materials remain mostly file-based.

Pros:
1. Fastest to implement.
2. Minimal schema change.

Cons:
1. No individual identity, revocation or auditability.
2. Essentially repeats `/admin` limitations.
3. Weak foundation for future roles and client access.

Verdict:
- Too weak as auth foundation; not recommended except for throwaway stopgap.

### Option B: App-native login with SQLite users + server-side sessions
Description:
1. Keep cabinet inside current app under a new route space.
2. Add `users`, `sessions`, minimal `materials` metadata tables in SQLite.
3. Use username/email + password login and HttpOnly cookie session.
4. Preserve legacy `/admin` while cabinet matures.

Pros:
1. Fits current stack and monorepo-lite structure.
2. Creates real identity and role baseline.
3. Allows gradual evolution from internal-only to broader access control.

Cons:
1. Requires migrations, password hashing, bootstrap flow and auth tests.
2. Adds operational responsibility for session lifecycle.

Verdict:
- Recommended smallest viable increment.

### Option C: Magic link or reverse-proxy auth
Description:
1. Use email magic link or edge-level auth instead of app-native passwords.
2. Keep app lighter on password handling.

Pros:
1. Reduces password UX friction if email delivery exists.
2. Can centralize auth outside some app logic.

Cons:
1. Adds new dependency surface and secrets.
2. Not aligned with currently confirmed stack.
3. Harder to bootstrap quickly for internal-first use without more ops/product decisions.

Verdict:
- Viable later, but not first slice.

## Recommendation
### Recommended option
Take `Option B`: app-native cabinet inside current app with SQLite users + roles + server-validated sessions.

### Why
1. It is the smallest option that actually creates identity and access control instead of another shared gate.
2. It stays compatible with Node.js + SQLite + current repo shape.
3. It avoids managed services and preserves reversibility.
4. It keeps `/admin` intact until there is parity and migration confidence.

### Recommended first implementation slice
1. Route space:
   - add `"/cabinet/login"`;
   - add `"/cabinet"` as protected library home.
2. Roles:
   - `admin`;
   - `viewer`.
3. Tables:
   - `users`;
   - `sessions`;
   - `materials`;
   - `material_tags` optional, only if filtering cannot stay denormalized.
4. UX:
   - login form;
   - first screen = materials library, not empty dashboard.
5. Materials:
   - curated metadata records pointing to existing repo docs/PDF/external links.
6. Legacy:
   - keep `/admin` and `X-Admin-Secret` paths unchanged for now.

## Risks / Blind Spots
1. Product ambiguity:
   - if team later decides first users are seminar clients, the access model will widen.
2. Runtime ambiguity:
   - implementation may target wrong production contour if docker vs legacy conflict is not resolved first.
3. Materials curation debt:
   - files exist, but ownership, freshness and taxonomy are not yet normalized.
4. Security debt:
   - current admin gate has no brute-force guard and no per-user accountability.
5. Migration risk:
   - replacing `/admin` too early could break operational workflows like log retrieval.

## Proposed Next Step
1. Approve or adjust the recommended first-slice persona:
   - `internal team only` vs broader audience.
2. Resolve runtime target for implementation:
   - live legacy contour vs docker canonical contour.
3. If recommendation stands, open a separate implementation epic/PR prompt scoped only to:
   - schema;
   - auth routes;
   - protected cabinet UI;
   - materials metadata bootstrap;
   - tests and smoke checks.

## What To Do In The Next Message To The Agent
Send one short decision message covering exactly these points:

1. Confirm whether first slice is `internal team only`.
2. Confirm whether roles stay `admin + viewer` for v1.
3. Confirm whether cabinet UI can be `RU-first`.
4. Confirm which runtime to target first for implementation verification:
   - live legacy `systemd + nginx`
   - or canonical `Docker + Traefik`

If those four points are confirmed, the next agent step can produce a tightly scoped implementation plan without re-running discovery.

## Acceptance / Validation
This report is sufficient for the current step if:

1. Inventory is based on repository/runtime/docs evidence.
2. Assumptions and open questions are separated from confirmed facts.
3. Recommendation is explicit and bounded to a first slice.
4. No production auth implementation is included.

## Related
- docs/epics/EPIC-002.cabinet.auth-foundation/EPIC.md
- docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
- docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md
- docs/prd/PRD-PHASE-1.LANDING.md

## Open Questions / TODO
1. Есть ли вне репозитория дополнительные seminar materials, которые должны войти в initial library.
2. Должен ли `editor` появиться сразу после first slice или только после стабилизации viewer flow.
3. Нужен ли отдельный contract для auth/session endpoints уже на planning step, или это преждевременно.
