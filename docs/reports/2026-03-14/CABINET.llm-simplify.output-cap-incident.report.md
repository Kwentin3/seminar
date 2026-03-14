# CABINET LLM Simplify Output Cap Incident Report

- Date: 2026-03-14
- Scope: cabinet `Пересказать простым языком` incident, runtime diagnosis, live verification
- Status: partial fix deployed; original incident root cause confirmed; one separate long-document runtime issue remains

## 1. Executive Summary

Инцидент начался с пользовательского симптома:

1. в cabinet simplify для некоторых материалов пересказ визуально обрывался;
2. текст заканчивался посреди фразы;
3. внешне это было похоже на timeout или прерванное получение ответа.

По итогам диагностики подтвердилось:

1. первичная проблема действительно существовала;
2. это был не `timeout` на стороне cabinet runtime;
3. это был скрытый output cap на generation path:
   - runtime подставлял `max_tokens` даже тогда, когда в admin settings явного лимита не было;
   - обрезанный по `finish_reason=length` ответ считался обычным успешным `ready`, без warning;
4. этот дефект был исправлен и выкачен в production.

После исправления выяснилось ещё одно отдельное ограничение:

1. короткие markdown документы на live now generate successfully;
2. один очень длинный markdown документ всё ещё падает примерно на `75s`;
3. это уже другой failure class:
   - не скрытый output cap;
   - не cached stale response;
   - не UI bug;
   - а long-request provider/transport runtime issue.

Итоговый статус:

1. инцидент с “тихо обрезанным успешным пересказом” закрыт;
2. simplify стал честнее диагностировать truncation;
3. production now runs without implicit output cap;
4. readiness для длинных single-pass markdown документов всё ещё не полная.

## 2. How It Started

Первый сигнал был пользовательский:

1. “краткий пересказ режется”;
2. затем уточнение:
   - “сам текст пересказа обрывается, видно что получение прервалось”.

Изначальная рабочая гипотеза была:

1. runtime timeout;
2. либо `AbortController`;
3. либо provider path схлопывается по времени.

Эта гипотеза казалась правдоподобной, потому что ранее simplify уже имел live/runtime instability на провайдере.

## 3. First Diagnostic Pivot

Ключевое наблюдение:

1. при настоящем runtime timeout текущая simplify-логика не должна показывать частичный `ready`;
2. на timeout runtime сохраняет `failed`, а не частичный контент.

Это следовало из текущей server logic:

1. timeout и provider failures normalise into `failed`;
2. persisted row при timeout не хранит частичный `generated_markdown`;
3. UI получает `failed`, а не “успех с оборванным текстом”.

Из этого был сделан важный вывод:

1. если пользователь видит именно частично готовый текст;
2. и simplify state при этом не `failed`;
3. то проблема, скорее всего, не в timeout ветке.

## 4. Evidence Collection Strategy

Чтобы не гадать, был выбран прямой comparison path:

1. взять один реальный production markdown материал;
2. прогнать его через live runtime simplify path;
3. отдельно прогнать тот же input напрямую через DeepSeek;
4. сравнить:
   - длину ответа;
   - `finish_reason`;
   - визуальный конец текста;
   - поведение при разных `max_tokens`.

Был выбран длинный live markdown:

1. slug:
   - `docs-seminar-llm-office-work-arch-010-ai-office-work-deep-research-v0-1-922f6a420d`
2. title:
   - `Deep Research: LLM In Office Work`
3. source markdown length:
   - `17,484` chars

## 5. What The Comparison Showed

### 5.1. Runtime result before the fix

Live runtime simplify gave:

1. `status=ready`
2. `delivery_mode=generated`
3. response length:
   - `2934` chars
4. text tail ended mid-thought:
   - literally at `Встраивать ИИ в`

Это уже выглядело как классическое output truncation.

### 5.2. Direct provider call with `max_tokens=900`

Direct DeepSeek call with same prompt/input and `max_tokens=900` gave:

1. response length:
   - `3007` chars
2. `finish_reason=length`
3. `output_truncated=true`

То есть прямой provider path с `900` токенами дал почти ту же длину, что и live runtime.

### 5.3. Direct provider call with `max_tokens=1600`

Direct DeepSeek call with `max_tokens=1600` gave:

1. response length:
   - `5341` chars
2. `finish_reason=length`
3. `output_truncated=true`

Это подтвердило сразу две вещи:

1. текущий runtime path действительно выглядел как capped generation;
2. даже `1600` output tokens для этого документа всё ещё мало.

## 6. Confirmed Root Cause

Подтверждённая причина первого инцидента:

1. simplify runtime имел скрытый fallback на output cap;
2. при отсутствии явного значения в admin settings runtime всё равно подставлял `max_tokens`;
3. провайдер возвращал обрезанный ответ с `finish_reason=length`;
4. runtime не сохранял этот факт как warning;
5. UI показывал его как обычный `ready/generated`.

То есть реальный дефект состоял из двух частей:

1. hidden limit injection;
2. missing truncation visibility.

## 7. Why This Was Misleading

Симптом выглядел как “получение прервалось”, потому что:

1. текст реально заканчивался на середине фразы;
2. пользователь не видел ни timeout, ни error badge;
3. UI не показывал, что ответ был обрезан по длине;
4. state выглядел как обычный успешный пересказ.

Именно поэтому инцидент визуально маскировался под network/runtime abort, хотя источник проблемы был другой.

## 8. Code Fixes Applied

### 8.1. Removed implicit output cap

Изменение:

1. пустой `Max output tokens` теперь означает:
   - не отправлять `max_tokens` провайдеру вообще
2. runtime больше не подставляет скрытый fallback, если explicit cap отсутствует

Файлы:

1. [config.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/server/llm/config.mjs)
2. [material-simplify.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/server/cabinet/material-simplify.mjs)

### 8.2. Added truncation diagnostics

Изменение:

1. DeepSeek client теперь читает `finish_reason`;
2. successful completion now carries:
   - `finish_reason`
   - `output_truncated`

Файл:

1. [deepseek-client.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/server/llm/deepseek-client.mjs)

### 8.3. Persisted ready-with-warning state

Изменение:

1. если provider completion successful, but `finish_reason=length`;
2. state остаётся `ready`;
3. но дополнительно сохраняется:
   - `error_code=output_truncated`
   - safe warning message

Это честно отражает реальность:

1. текст действительно был получен;
2. но он был обрезан по лимиту длины.

### 8.4. UI warning added

Изменение:

1. simplified panel теперь показывает отдельный warning, если `error_code=output_truncated`;
2. пользователь получает явную подсказку:
   - текст обрезан;
   - нужно увеличить `Max output tokens` и перегенерировать.

Файлы:

1. [CabinetMaterialPage.tsx](/d:/Users/Roman/Desktop/Проекты/seminar/apps/web/src/routes/CabinetMaterialPage.tsx)
2. [messages.ts](/d:/Users/Roman/Desktop/Проекты/seminar/apps/web/src/app/messages.ts)

## 9. Test Evidence Added

Были добавлены и прогнаны тесты, которые закрывают именно этот класс дефекта.

### 9.1. Provider unit coverage

Файл:

1. [deepseek-client.unit.test.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/tests/cabinet/deepseek-client.unit.test.mjs)

Покрыто:

1. `finish_reason=stop`
2. `finish_reason=length`
3. `output_truncated=true/false`

### 9.2. Simplify integration coverage

Файл:

1. [cabinet-simplify.integration.test.mjs](/d:/Users/Roman/Desktop/Проекты/seminar/tests/cabinet/cabinet-simplify.integration.test.mjs)

Покрыто:

1. runtime does not send `max_tokens` when no explicit cap is configured;
2. truncated provider completion becomes `ready-with-warning`;
3. cached row persists truncation metadata.

### 9.3. Test execution

Passed:

1. `node --test tests/cabinet/deepseek-client.unit.test.mjs`
2. `node --test tests/cabinet/cabinet-simplify.integration.test.mjs`
3. `pnpm run typecheck`
4. `pnpm run build`

## 10. Deploy And Production Rollout

### 10.1. Git / CI

Fix commit:

1. `d1758a2`

Workflow run:

1. `23091652433`
2. result:
   - `success`

Published image:

1. `ghcr.io/kwentin3/seminar@sha256:f7a8ba22ed4a3678f4201df5418190b1f7db7630d635607445deff3b23590a7c`

### 10.2. Production deploy

Production runtime was updated to:

1. image:
   - `ghcr.io/kwentin3/seminar@sha256:f7a8ba22ed4a3678f4201df5418190b1f7db7630d635607445deff3b23590a7c`
2. `BUILD_ID`:
   - `d1758a275ee5462a069f22827c709ef76332ab47`

Backup created before deploy:

1. `/opt/seminar/backups/simplify-cap-fix-20260314T162530Z`

Post-deploy parity and smoke:

1. root:
   - `200`
2. health:
   - `200`
3. obs:
   - `200`
4. `enoent_journalctl=0`
5. `enoent_docker=0`

## 11. Production Verification After The Fix

### 11.1. Admin settings fact check

Live admin settings on production after deploy:

1. `max_output_tokens = null`
2. model:
   - `deepseek-chat`
3. prompt version:
   - `v20260314153835`

Это важно:

1. live contour действительно больше не был capped скрытым explicit setting;
2. значит дальнейшие результаты уже нельзя объяснить “в админке всё ещё стояло 900”.

### 11.2. Short markdown success

Был проверен более короткий live markdown:

1. slug:
   - `docs-seminar-llm-office-work-arch-006-ai-office-work-research-directions-v0-1-3e4183bd2b`
2. source markdown:
   - `3794` chars
3. simplify regenerate:
   - `ready/generated`
4. output length:
   - `5583` chars
5. elapsed:
   - about `64.6s`

Это подтвердило:

1. fix не сломал simplify path;
2. production now works for at least one real markdown material without hidden cap;
3. current live issue is not “simplify broken globally”.

### 11.3. Long markdown still failing

После deploy тот же длинный markdown был проверен ещё раз:

1. slug:
   - `docs-seminar-llm-office-work-arch-010-ai-office-work-deep-research-v0-1-922f6a420d`
2. elapsed:
   - about `75.9s`
3. result:
   - `status=failed`
   - `error_code=provider_error`

Server logs showed:

1. `cabinet_material_simplify_provider_call_started`
2. then after ~`75000ms`
3. `cabinet_material_simplify_provider_call_failed`

Diagnostic context:

1. `abort_fired=false`
2. `provider_http_status=null`
3. `provider_duration_ms=null`
4. `provider_message=null`
5. `error_stage=null`

## 12. What We Eventually Uncovered

Финальный разбор выглядит так:

### Incident A: silent truncation

Было:

1. hidden output cap
2. provider returned `finish_reason=length`
3. runtime treated it as normal success
4. UI gave no warning

Статус:

1. confirmed
2. fixed
3. deployed

### Incident B: long single-pass runtime/provider failure

После устранения Incident A осталось:

1. very long markdown document still fails on live
2. failure happens around `75s`
3. diagnostics do not indicate:
   - local abort
   - upstream HTTP error
   - parse error
   - empty response

Статус:

1. confirmed
2. not fixed in this slice
3. likely separate transport/provider budget issue for long single-pass generation

## 13. Why This Matters Product-Wise

До расследования пользователь видел один нечестный UX:

1. система показывала “успешный пересказ”;
2. но фактически пересказ был неполным.

После исправления пользовательская модель стала честнее:

1. если ответ обрезан по лимиту длины, это видно;
2. если лимита нет, он больше не подставляется secretly;
3. короткие документы проходят без этого искусственного ограничения.

Но product boundary MVP now clearer:

1. длинные single-pass markdown документы всё ещё ненадёжны;
2. либо нужен явный size budget / “слишком длинный документ”;
3. либо later-stage chunking;
4. либо отдельная работа по long provider timeout/transport behavior.

## 14. Final Technical Judgement

Что сломалось изначально:

1. hidden `max_tokens` fallback
2. missing truncation visibility

Что реально исправлено:

1. implicit output cap removed
2. truncation surfaced in diagnostics/state/UI
3. production updated to the fixed runtime
4. short live markdown verified successfully

Что осталось:

1. one long live markdown still fails after ~`75s`
2. this is no longer the same incident
3. next slice should target long-request provider/transport reliability or explicit long-document scope boundary

## 15. Recommended Next Step

Следующий implementation/ops slice лучше брать так:

1. не возвращаться к output-cap diagnosis;
2. считать его закрытым;
3. отдельно диагностировать long single-pass simplify on production-like contour;
4. принять одно из решений:
   - explicit hard size limit for MVP
   - increased request budget with better transport diagnostics
   - later chunking as non-MVP extension

Самый честный short-term product recommendation:

1. для MVP ввести явную single-pass length boundary;
2. не обещать надёжную simplify generation для очень длинных markdown документов до следующего runtime fix.
