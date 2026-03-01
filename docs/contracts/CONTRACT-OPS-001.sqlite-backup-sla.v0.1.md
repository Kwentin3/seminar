---
id: CONTRACT-OPS-001.sqlite-backup-sla
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-01
core_snapshot: n/a
related:
  - docs/adr/ADR-001.infrastructure.baseline.v1.md
  - docs/runbooks/SEMINAR_MIGRATION_DOCKER.md
  - docs/reports/2026-03-01/VPS.PLATFORM.DOCKER.TRAEFIK.BASELINE.1.report.md
tags:
  - contract
  - ops
  - sqlite
  - backup
  - restore
---

# CONTRACT-OPS-001: SQLite Backup/Restore SLA v0.1

## Purpose / Scope
Контракт задаёт минимальный обязательный backup/restore baseline для production SQLite (`seminar`) перед cutover и в регулярной эксплуатации.

Scope:
1. Production runtime на VPS.
2. SQLite в WAL-режиме.
3. Локальные backup/restore процедуры без внешних backup SaaS.

## SLA Targets (Baseline)
1. RPO: `24h`.
2. RTO: `30m`.
3. Backup frequency: nightly (`1` backup в сутки).
4. Retention: `14 days`.
5. Restore drill: quarterly, manual, с фиксацией результата в runbook/report.

## Storage Policy
1. Primary backup location: локальный каталог на VPS (например `/opt/seminar/backups`).
2. Optional secondary copy: отдельный локальный каталог/диск на том же VPS/хосте.
3. Внешние сервисы хранения в этом контракте не требуются.

## Backup Procedure (Normative)
Допустимы только два способа:
1. `sqlite3 .backup` на активной БД.
2. Файловый snapshot только при остановленном writer.

Writer concurrency rule:
1. Одновременный активный writer и файловое копирование `.sqlite` FORBIDDEN.
2. Для файлового snapshot writer MUST быть остановлен до копирования.

Minimal backup command (example):
```bash
sqlite3 /opt/seminar/data/seminar.sqlite ".backup '/opt/seminar/backups/seminar-20260301T010000Z.sqlite'"
```

## Restore Procedure (Normative)
1. Остановить writer процесса приложения.
2. Восстановить файл БД из backup в data path.
3. Проверить права доступа runtime user/group.
4. Запустить приложение.
5. Выполнить smoke и подтвердить функционал.

Restore success criteria (MUST):
1. `GET /api/healthz` возвращает `200` и `{"ok":true}`.
2. Admin leads retrieval работает под корректным `ADMIN_SECRET`.
3. Lead submit flow проходит штатно (создание заявки/валидный ответ).

## Retention and Pruning
1. Хранятся только backup за последние `14` дней.
2. Удаление старше retention выполняется только после успешного создания нового nightly backup.
3. Ошибка удаления старых backup не должна удалять свежий backup.

## Drill Policy
1. Restore drill проводится не реже одного раза в квартал.
2. Drill фиксирует:
   - timestamp;
   - использованный backup;
   - фактический RTO;
   - результат smoke checks;
   - verdict PASS/FAIL.

## Security Constraints
1. Backup файлы не содержат отдельные секреты, но содержат production данные и MUST считаться чувствительными.
2. Права на backup директорию SHOULD быть ограничены (`750` для каталога, `640` или строже для файлов).
3. В логах и отчётах FORBIDDEN выводить секреты env.

## Failure Handling
1. Если nightly backup не выполнен -> MUST быть зарегистрирован ops-инцидент.
2. Если restore не укладывается в RTO (`30m`) -> MUST быть зарегистрирован SLA breach.
3. При SLA breach production cutover на новый runtime блокируется до анализа причины и корректирующих действий.
