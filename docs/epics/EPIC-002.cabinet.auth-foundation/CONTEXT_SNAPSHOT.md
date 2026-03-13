---
id: SNAPSHOT-EPIC-002.cabinet.auth-foundation
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: n/a
related:
  - docs/DOCS_CANON.md
  - docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md
  - docs/ARCHITECTURE/NORTH_STAR.md
  - docs/prd/PRD-PHASE-1.LANDING.md
  - docs/adr/ADR-001.infrastructure.baseline.v1.md
  - docs/infra-ops/PRODUCTION_BASELINE_DOCKER_TRAEFIK.md
  - docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md
tags:
  - snapshot
  - epic
  - cabinet
  - auth
---

# EPIC-002 Context Snapshot

## Purpose / Scope
Снимок фиксирует минимальный контекст, с которым стартует `EPIC-002.cabinet.auth-foundation`, чтобы discovery и последующая реализация опирались на проверяемые документы и не переизобретали baseline проекта.

## Context
Snapshot date: `2026-03-13`

Snapshot commit:
- `1a994ab7190141d6a520e41314f1565774e0bbb6`

Важное напряжение контекста:
1. Входной бриф для discovery описывает текущий production как `systemd + nginx + SQLite`.
2. Документационный canon с `2026-03-01` уже считает canonical production baseline как `Docker + Traefik + GHCR pinned digest`.
3. В репозитории одновременно есть и live snapshot legacy-контура, и новые docker/traefik контракты. Это подтверждённый конфликт контекста, а не догадка.

## Main Section

### 1. Core Documents Frozen For This Epic
| document | role in epic | snapshot note |
| --- | --- | --- |
| `docs/DOCS_CANON.md` | Канон путей, metadata header, related links и snapshot discipline | Использовать как основное правило оформления документов |
| `docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md` | Правила, когда обязателен ADR | Trigger rules срабатывают для cabinet/auth |
| `docs/ARCHITECTURE/NORTH_STAR.md` | Стратегический вектор проекта | Проект не превращается в SaaS-платформу; приоритет у SVI |
| `docs/prd/PRD-PHASE-1.LANDING.md` | Источник истины для завершённой Phase 1 | Phase 1 исключала полноценный user cabinet |
| `docs/adr/ADR-001.infrastructure.baseline.v1.md` | Исторический Phase 1 infra baseline | Фиксирует `ADMIN_SECRET` gate для `/admin` |
| `docs/infra-ops/PRODUCTION_BASELINE_DOCKER_TRAEFIK.md` | Canonical runtime model после `2026-03-01` | Production по canon = Docker-only |

### 2. Additional Evidence Used In Discovery
| document | why it matters |
| --- | --- |
| `docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md` | Redacted snapshot живого legacy-контура: `systemd`, `nginx`, `/etc/seminar/seminar.env` |
| `docs/runbooks/ENV_MATRIX.md` | Текущая env-матрица всё ещё описывает production как `systemd` |
| `docs/runbooks/GITHUB_GUARDRAILS.md` | Guardrails и branch discipline |
| `docs/runbooks/DEPLOY_DOCKER_CONTRACT.md` | Требования для docker deploy/smoke/parity |

### 3. Confirmed Runtime Facts At Snapshot Time
1. Runtime code lives in `server/index.mjs` and serves SPA + API from one Node process.
2. Public SPA routes currently are only `/` and `/admin`.
3. API/admin surface currently is `POST /api/leads`, `GET /api/admin/leads`, `GET /admin/obs/logs`, `GET /api/healthz`.
4. Auth today is not user auth; it is a shared `ADMIN_SECRET` header gate.
5. SQLite schema currently contains only `leads` and `schema_migrations`.
6. Internal seminar knowledge exists mostly as repo-hosted markdown/PDF files, not as runtime-managed materials entities.

## Acceptance / Validation
Snapshot достаточен, если:

1. Все связанные документы эпика ссылаются на него через `core_snapshot`.
2. Конфликт runtime baseline явно зафиксирован до начала реализации.
3. Из snapshot видно, какие источники считать frozen core, а какие являются дополнительной операционной фактурой.

## Related
- docs/DOCS_CANON.md
- docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md
- docs/ARCHITECTURE/NORTH_STAR.md
- docs/prd/PRD-PHASE-1.LANDING.md
- docs/adr/ADR-001.infrastructure.baseline.v1.md
- docs/infra-ops/PRODUCTION_BASELINE_DOCKER_TRAEFIK.md
- docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md

## Open Questions / TODO
1. Какой runtime считать implementation target для first slice: live legacy baseline или уже canonical docker baseline.
2. Нужна ли отдельная redacted env inventory for docker runtime before implementation start.
