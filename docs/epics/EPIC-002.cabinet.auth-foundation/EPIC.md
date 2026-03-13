---
id: EPIC-002.cabinet.auth-foundation
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-13
core_snapshot: docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
related:
  - docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
  - docs/reports/2026-03-13/CABINET.auth.discovery.report.md
  - docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
  - docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md
tags:
  - epic
  - cabinet
  - auth
  - materials
---

# EPIC-002: Cabinet Auth Foundation

## Goal / Outcome
Подготовить и затем реализовать smallest viable internal materials area с авторизацией, не ломая текущую Phase 1 и не превращая проект в избыточную платформу. Результат эпика должен дать команде удобный и безопасный доступ к seminar-материалам и создать минимальный фундамент для дальнейшего role-based access.

## Context
Discovery показал, что сейчас в проекте есть только:
1. публичный SPA-лендинг;
2. read-only `/admin` под shared `ADMIN_SECRET`;
3. SQLite для лидов;
4. материалы семинара как markdown/PDF/JSON в репозитории, без runtime-модели пользователей и материалов.

Это означает, что новый кабинет не является «маленьким хвостом Phase 1», а открывает отдельный слой identity/access/content navigation. Поэтому эпик начинается с discovery + product framing + draft ADR/PRD, а не с немедленной реализации.

## In Scope
1. Discovery и документирование текущего состояния проекта.
2. Формулировка product scope для internal materials area.
3. Выбор recommended auth baseline для first slice.
4. Выбор recommended IA/UX baseline для первого кабинета.
5. Определение минимального набора сущностей, маршрутов, миграций и smoke checks.
6. Решение, как coexist будут жить новый cabinet и legacy `/admin`.

## Out of Scope
1. Production implementation auth flow в этом шаге.
2. Полноценный client cabinet для внешних пользователей.
3. Full RBAC matrix с granular permissions на первом инкременте.
4. Внешние managed auth providers без подтверждённой необходимости.
5. Перенос project runtime на новый infra baseline в рамках этого discovery.

## Milestones
1. Discovery complete:
   - inventory routes/env/storage/materials/admin surface;
   - gap analysis;
   - architectural options;
   - recommended first slice.
2. Decision package ready:
   - draft PRD;
   - draft ADR;
   - explicit open questions for product/ops decision.
3. Implementation epic handoff:
   - confirmed runtime target;
   - approved first-slice scope;
   - task breakdown for schema/routes/UI/tests/ops.

## Dependencies
1. `docs/ARCHITECTURE/NORTH_STAR.md`
2. `docs/prd/PRD-PHASE-1.LANDING.md`
3. `docs/adr/ADR-001.infrastructure.baseline.v1.md`
4. `docs/infra-ops/PRODUCTION_BASELINE_DOCKER_TRAEFIK.md`
5. `docs/infra-ops/VPS_LIVE_BASELINE_2026-03-01.md`

## Risks
1. Неустранённый конфликт между live legacy runtime и canonical docker runtime может утащить реализацию в неправильный deploy target.
2. Слишком ранняя попытка строить client cabinet или full RBAC раздует scope и задержит value.
3. Попытка заменить legacy `/admin` сразу может создать needless regression для существующего ops/admin surface.
4. Materials domain пока не нормализован как runtime data model; часть материалов живёт только в docs/PDF и потребует curatorial decisions.

## Definition of Done
### Discovery Phase DoD
1. Есть discovery report с фактической инвентаризацией проекта.
2. Есть `CONTEXT_SNAPSHOT.md`.
3. Есть draft PRD для internal materials area.
4. Есть draft ADR по auth/access baseline.
5. Recommended first implementation slice описан и ограничен.
6. Все assumptions и open questions явно помечены.
7. Нет production-code реализации auth/cabinet в этом шаге.

## Related
- docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md
- docs/reports/2026-03-13/CABINET.auth.discovery.report.md
- docs/prd/PRD-002.cabinet.materials-auth.v0.1.md
- docs/adr/ADR-002.cabinet.auth-baseline.v0.1.md

## Open Questions / TODO
1. Подтверждаем ли first-slice persona как internal team only, без seminar clients и speakers.
2. Какой production target брать для implementation PR: live legacy runtime или canonical docker runtime.
3. Нужен ли отдельный contract-документ уже на implementation planning step или пока достаточно ADR + PRD.
