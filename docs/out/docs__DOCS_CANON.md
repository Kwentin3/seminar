# Documentation Canon

## A) Purpose / Scope
Этот документ фиксирует канон документационного домена проекта "Семинары". Цель: каждый новый артефакт (PRD/ADR/EPIC/CONTRACT/REPORT/RUNBOOK/ARTIFACT/TEMPLATE) сразу получает предсказуемый путь, имя и минимальный мета-контракт без переобъяснения контекста в каждом чате.

Границы шага: только docs-структура и правила документооборота. Продуктовый код не затрагивается.

Базовый контекст проекта, на который опираются документы:

1. Домены: `seminar-ai.ru` и `ai-work.pro`, без редиректов; RU/EN переключается через UI.
2. UX-направление: mobile-first, минималистичный "цифровой детокс", мягкие эффекты.
3. Инженерный подход: слои, контракты, изоляция, тестируемые модули, минимизация расползания контекста.
4. Процесс: обсуждение -> промпт агенту -> отчет агента -> аудит -> следующий шаг.

## B) Narrow Context Core
Короткое ядро контекста (держать 3-6 позиций):

1. `docs/DOCS_CANON.md` - текущий канон классификации и раскладки.
2. `docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md` - правила изменения контекста и B-Light.
3. `docs/prd/PRD-PHASE-1.LANDING.md` - продуктовый источник истины для текущей фазы.
4. `docs/ARCHITECTURE/NORTH_STAR.md` - стратегические инварианты проекта.
5. `docs/templates/DOC_TEMPLATE.md` - универсальный шаблон с обязательной шапкой.

## C) Document Types (Taxonomy)
| Type | Назначение | Обязательные секции (минимум) |
|---|---|---|
| PRD | Продуктовые требования и рамки результата. | Header, Purpose/Scope, User/Business Goals, Functional Requirements, Non-Functional Requirements, Acceptance Criteria, Risks/TODO |
| ADR | Архитектурное решение с обоснованием. | Header, Context, Decision, Alternatives, Consequences, Related |
| EPIC | Крупный инкремент разработки с границами. | Header, Goal/Outcome, In Scope, Out of Scope, Milestones, DoD, Context Snapshot Link, Risks/TODO |
| CONTRACT | Стабильный контракт между слоями/сервисами. | Header, Parties, Interface/Data Contract, Versioning/Compatibility, Validation Rules, Change Policy |
| REPORT | Фактический отчет по выполненной работе агента. | Header, Summary, Changed Files, Checks Performed, Issues/Limitations, Next Step |
| RUNBOOK | Операционная инструкция повторяемого процесса. | Header, Trigger, Preconditions, Step-by-step Procedure, Verification, Rollback/Escalation |
| ARTIFACT | Описание сгенерированного артефакта (схема, экспорт, пакет). | Header, Origin, Location, Format/Checksum, Consumer, Retention/Expiry |
| TEMPLATE | Переиспользуемая заготовка документа. | Header, Intended Use, Required Fields, Section Skeleton, Usage Notes |

## D) Folder Map
| Type | Папка | Пример имени/пути |
|---|---|---|
| PRD | `docs/prd/` | `docs/prd/PRD-001.landing.core.v0.1.md` |
| ADR | `docs/adr/` | `docs/adr/ADR-003.arch.domain-switch.v1.0.md` |
| EPIC | `docs/epics/` | `docs/epics/EPIC-001.landing.detox-ui/EPIC.md` |
| CONTRACT | `docs/contracts/` | `docs/contracts/CONTRACT-002.ai.llm-gateway.v0.3.md` |
| REPORT | `docs/reports/YYYY-MM-DD/` | `docs/reports/2026-02-26/DOCS.canon.bootstrap.report.md` |
| RUNBOOK | `docs/runbooks/` | `docs/runbooks/RUNBOOK-001.ops.release-check.v1.0.md` |
| ARTIFACT | `docs/artifacts/` | `docs/artifacts/ARTIFACT-2026-02-26.search-schema.v1.json` |
| TEMPLATE | `docs/templates/` | `docs/templates/DOC_TEMPLATE.md` |

## E) Naming Rules
Общий формат для markdown-документов:

`<TYPE>-<index>.<domain>.<slug>.v<major>.<minor>.md`

Примеры:

1. `ADR-004.arch.layer-boundaries.v1.0.md`
2. `CONTRACT-001.web.locale-switcher.v0.2.md`
3. `RUNBOOK-002.ops.rollback-preview.v1.1.md`

Правило для эпиков (папка):

`EPIC-<index>.<domain>.<slug>/`

Примеры:

1. `EPIC-001.landing.detox-ui/`
2. `EPIC-002.cabinet.auth-foundation/`
3. `EPIC-003.ai.prompt-orchestration/`

Версионирование:

1. `v0.x` - черновик/не утверждено.
2. `v1.0` - утвержденная базовая версия.
3. `v1.x` - обратно совместимые уточнения.
4. `v2.0+` - несовместимые изменения (breaking).

Правило снимка ядра для эпика:

1. Перед стартом каждого эпика создать `docs/epics/EPIC-<index>.<domain>.<slug>/CONTEXT_SNAPSHOT.md`.
2. В эпике и связанных документах указывать `core_snapshot: docs/epics/.../CONTEXT_SNAPSHOT.md`.
3. Примеры:
   - `docs/epics/EPIC-001.landing.detox-ui/CONTEXT_SNAPSHOT.md`
   - `docs/epics/EPIC-002.cabinet.auth-foundation/CONTEXT_SNAPSHOT.md`
   - `docs/epics/EPIC-003.ai.prompt-orchestration/CONTEXT_SNAPSHOT.md`

## F) Header Metadata Standard
Каждый документ обязан начинаться с мета-шапки:

```yaml
---
id: <TYPE-INDEX.domain.slug>
status: draft # draft | review | stable | deprecated | archived
owner: <github-handle>
approved_by:
  - <github-handle>
last_updated: YYYY-MM-DD
core_snapshot: <path-or-n/a>
related:
  - <path-or-id>
tags:
  - <tag>
---
```

## G) Agent Filing Protocol
1. Определи тип результата: PRD/ADR/EPIC/CONTRACT/REPORT/RUNBOOK/ARTIFACT/TEMPLATE.
2. Выбери папку строго по разделу D.
3. Сформируй имя по разделу E (для REPORT дополнительно дата-папка `YYYY-MM-DD`).
4. Если создается EPIC - сначала создай `CONTEXT_SNAPSHOT.md` и заполни `core_snapshot`.
5. Создай/обнови документ через `docs/templates/DOC_TEMPLATE.md`, заполни всю шапку из раздела F.
6. Для перехода в `stable` добавь минимум одного утверждающего в `approved_by` (не равного `owner`).
7. Добавь `related` ссылки на EPIC/ADR/CONTRACT, которые затронуты.
8. После завершения EPIC выполни drift-check по ADR Trigger Rules; если триггер сработал, создай/обнови ADR до выставления `stable`.
9. Обнови индекс выбранного домена (`docs/<domain>/INDEX.md`); если его нет, создай минимальный индекс с колонками `id | path | status | last_updated`.
10. Для артефактов с бинарными/не-md файлами добавь рядом `.md`-описание происхождения и проверки.

## H) Open Questions / TODO
1. Утвердить базовый набор github-handle для `owner/approved_by` по доменам (`landing`, `cabinet`, `ai`, `ops`).
2. Зафиксировать политику RU/EN для docs (когда двуязычность обязательна, когда нет).
3. Ввести стартовые `INDEX.md` по доменам (`adr/prd/contracts/...`) для единообразного шага G.9.
