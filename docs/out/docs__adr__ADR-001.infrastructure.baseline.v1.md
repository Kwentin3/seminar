---
id: ADR-001.infrastructure.baseline
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-02-27
core_snapshot: n/a
related:
  - docs/prd/PRD-PHASE-1.LANDING.md
  - docs/ARCHITECTURE/NORTH_STAR.md
  - docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md
  - docs/runbooks/GO_LIVE.md
tags:
  - adr
  - infrastructure
  - phase-1
---

# ADR-001: Infrastructure Baseline (Phase 1)

## 1) Context
- Фаза 1: `Landing + Lead Engine + Minimal Admin`.
- Нужен управляемый production baseline без зависимости от Cloudflare runtime.
- Цель: минимализм, быстрый деплой и операционная предсказуемость.

## 2) Decision

### 2.1 Runtime and Hosting
- Production размещается на одном JustHost VPS.
- Приложение работает как Node.js процесс (`server/index.mjs`) под `systemd`.
- Внешний трафик обслуживает `nginx` (reverse proxy на локальный порт приложения).

### 2.2 Storage
- Используется SQLite файл на VPS (`/var/lib/seminar/seminar.sqlite`).
- Миграции применяются из `migrations/*.sql` на старте backend.
- Обоснование: минимальная операционная сложность и достаточность для объема Phase 1.

### 2.3 Admin Protection
- Для `/admin` используется header token gate через env secret (`ADMIN_SECRET`).
- Полноценная auth-система в Phase 1 не внедряется.
- `ADMIN_SECRET` хранится только в env и не размещается в коде/репозитории.
- Ротация `ADMIN_SECRET` выполняется вручную (минимум раз в 30 дней).

### 2.4 Anti-Bot
- Turnstile поддерживается как опциональный механизм.
- При недоступности Cloudflare в целевом регионе допускается режим без Turnstile:
  - widget не показывается в UI при отсутствии `TURNSTILE_SITE_KEY`;
  - backend принимает лиды без проверки Turnstile при отсутствии `TURNSTILE_SECRET_KEY`.
- Ограничение злоупотреблений обеспечивается rate-limit и duplicate checks на backend.

### 2.5 Edge Security and Operations
- Fail2ban обязателен для production:
  - `sshd`
  - `nginx-http-auth`
  - `nginx-botsearch`
- TLS реализуется через Let's Encrypt (`certbot` + `nginx`).

### 2.6 Phone Normalization
- Телефон хранится только в формате `E.164`.
- Нормализация выполняется на backend до записи в storage.
- Если номер нельзя нормализовать автоматически, API возвращает `country_required`, а frontend запрашивает явный выбор страны.

### 2.7 Performance Baseline
- `Lighthouse mobile >= 85`.
- `TTI < 3s` на средних мобильных устройствах.
- Контроль и минимизация bundle size как обязательное ограничение при изменениях UI.

## 3) Consequences

Плюсы:
- Упрощенный и полностью контролируемый runtime.
- Независимость от внешней платформы для production-serving.
- Прозрачная операционная схема (systemd + nginx + fail2ban + certbot).

Минусы:
- Больше ответственности на команду за серверные обновления и hardening.
- Нет managed DB уровня D1; backup/retention нужно поддерживать вручную.
- При выключенном Turnstile backend защита полагается на rate-limit и валидацию, что повышает требования к мониторингу.
