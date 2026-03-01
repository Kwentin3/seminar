# OBS.LOGGING.CODE.ANCHOR.1.report

## Executive summary
Добавлены минимальные архитектурные якоря-комментарии для OBS без изменения runtime поведения.

## SPEC GUARD results
Проверены:
- `server/obs/logger.mjs`
- `server/obs/request-context.mjs`
- `server/landing/content-observability.mjs`
- `server/index.mjs`
- `scripts/obs/logs.mjs`

Ответы:
1. Где должен стоять `OBS ENTRYPOINT` комментарий:
- в начале `server/obs/logger.mjs` (единая точка runtime structured logging).

2. Где указать инварианты:
- в banner-комментарии `server/obs/logger.mjs` (never throw, redaction, 4KB cap, namespaced code, no implicit fallback).
- модульный комментарий `server/landing/content-observability.mjs` (minimum-set events по контракту).

3. Где указать `DO NOT USE console.log`:
- в runtime entrypoint `server/index.mjs`.
- в runtime-модуле `server/landing/content-observability.mjs`.
- CLI `scripts/obs/logs.mjs` не менялся: это утилита retrieval, не runtime event pipeline.

## What changed
1. В `server/obs/logger.mjs` добавлен banner:
- `OBS BASELINE (CONTRACT-OBS-001 v0.4)`
- инварианты и требование использовать единый logger.

2. В `server/index.mjs` добавлен комментарий:
- запрет `console.log` для runtime events;
- ссылка на `server/obs/logger.mjs`.

3. В `server/landing/content-observability.mjs` добавлены комментарии:
- роль модуля для minimum-set `content/landing` событий;
- запрет `console.log` в runtime path.

4. Лёгкий lint-guard:
- Не внедрён, чтобы не менять CI/lint policy в этой задаче.
- Решение задокументировано здесь, без scope drift.

## Files changed
- `server/obs/logger.mjs`
- `server/index.mjs`
- `server/landing/content-observability.mjs`
- `docs/_index/redirects.md`

## Verification
- `pnpm run lint` -> PASS

## Verdict
PASS

## Next minimal step
1. В отдельной задаче обсудить и зафиксировать ESLint policy по запрету `console.log` в runtime backend (с whitelist для CLI).
