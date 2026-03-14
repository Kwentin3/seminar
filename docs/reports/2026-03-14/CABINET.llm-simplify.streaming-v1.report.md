# CABINET LLM Simplify Streaming V1 Report

## Executive summary

Streaming simplify v1 реализован без расширения продуктового scope.

Теперь generation path больше не выглядит как немая загрузка:
- provider `DeepSeek -> server` читается streaming-режимом;
- `server -> browser` отдаёт SSE;
- reader показывает progressive output во время generation;
- в cache по-прежнему попадает только финальный успешно завершённый текст.

Синхронный cache/read path не ломался и остался базовым fast path:
- если есть valid cache, reader читает current simplify state обычным `GET /simplify`;
- streaming path используется только для generation и regenerate.

## What was wrong with the old sync UX

Старый simplify flow ждал whole completion целиком.

Из-за этого пользователь видел:
- долгую тишину без живого прогресса;
- слабое различие между `upstream still working` и `request already dying`;
- поздний fail без ощущения, что generation вообще жила;
- confusing gap между provider progress и browser UX.

Это особенно плохо выглядело на длинных markdown-документах, где generation могла идти заметно дольше обычного.

## Streaming contract

Выбран transport:
- provider -> server: `DeepSeek chat/completions` with `stream: true`
- server -> browser: `text/event-stream` (SSE)

Минимальный event contract:
- `open`
- `meta`
- `warning`
- `delta`
- `done`
- `error`

Назначение событий:
- `open`: stream path реально стартовал
- `meta`: provider/model/timeout/cache intent и другие safe runtime facts
- `warning`: oversized/truncation warning без раскрытия чувствительных данных
- `delta`: очередной кусок текста
- `done`: normal success или immediate cache-ready terminal
- `error`: typed terminal failure, с safe `error_code/error_message`

## Server-side stream path

Изменения на сервере:

1. В `server/llm/deepseek-client.mjs` добавлен streaming adapter `streamChatCompletion(...)`.
   Он:
   - читает SSE-чанки от DeepSeek;
   - собирает финальный текст из `delta.content`;
   - различает terminal outcomes;
   - возвращает redacted diagnostics вместо raw payload logging.

2. В `server/cabinet/material-simplify.mjs` добавлен `streamGenerate(slug, { force, onEvent })`.
   Он:
   - грузит current simplify context;
   - определяет `cache_intent` (`cache_miss`, `stale_refresh`, `regenerate`);
   - открывает generation stream;
   - ретранслирует incremental events вверх в HTTP layer;
   - пишет `ready` row только на normal success;
   - не превращает interrupted/truncated partial output в normal cached result.

3. В `server/index.mjs` добавлен endpoint:
   - `GET /api/cabinet/materials/:slug/simplify/stream`

Этот endpoint:
- не ломает existing sync simplify API;
- используется только в UI generation path;
- держит SSE открытым до terminal event;
- безопасно завершает stream и не пишет чувствительные данные в logs.

## Browser progressive render

Reader updated in `apps/web/src/routes/CabinetMaterialPage.tsx`.

Новые explicit UI states:
- `idle`
- `cache_ready`
- `stream_connecting`
- `streaming`
- `stream_complete`
- `stream_failed`
- `stream_truncated`

Поведение:
- при `ready/cache` reader показывает обычный simplify markdown без стрима;
- при cache miss/stale/failed и при `Перегенерировать` запускается streaming endpoint;
- во время потока UI показывает progressive text immediately;
- во время stream используется простой text rendering, чтобы не устраивать рваный live-markdown UX;
- после normal success reader возвращается к normal final markdown render;
- если stream прервался, UI честно показывает partial/transient text и fail state;
- если existing cached version была уже сохранена, UI прямо говорит, что прежняя сохранённая версия оставлена без изменений.

Это заметно улучшило generation phase:
- пользователь видит, что system жива;
- можно начинать читать ещё до финального commit в cache;
- fail/truncation перестали маскироваться под “долго думает”.

## Final-only cache discipline

Правило сохранено жёстко:
- `ready` row в `material_simplifications` пишется только после полного успешного завершения stream path.

Что не кэшируется как normal success:
- `stream_interrupted`
- `timeout_before_first_chunk`
- `timeout_mid_stream`
- `response_parse_error`
- `empty_response`
- `output_truncated` в streaming path

Важно:
- partial output живёт только как transient browser/session state;
- refresh/reopen page не обязан восстанавливать partial stream text;
- failed regenerate не затирает предыдущий valid cached result.

## Updated error taxonomy

Для streaming path теперь различаются:
- `stream_open_failed`
- `stream_interrupted`
- `timeout_before_first_chunk`
- `timeout_mid_stream`
- `upstream_http_error`
- `rate_limit`
- `response_parse_error`
- `empty_response`
- `output_truncated`
- `normal_success`

`finish_reason=length` больше не может тихо пройти как обычный success в streaming path.

## Diagnostics and logging

Добавлены redacted stream diagnostics:
- `time_to_first_chunk_ms`
- `stream_duration_ms`
- `first_chunk_at_ms`
- `last_chunk_at_ms`
- `streamed_chars`
- `finish_reason`
- `received_done`
- `cache_intent`
- `cache_write_success`
- `cache_write_skipped`

Не логируются:
- API key
- full prompt
- source markdown
- generated body
- raw provider response body in full

Новые server events:
- `cabinet_material_simplify_stream_started`
- `cabinet_material_simplify_first_chunk_detected`
- `cabinet_material_simplify_stream_completed`
- `cabinet_material_simplify_stream_failed`

## Tests and verification

### Automated checks run

Executed:
- `node --test tests/cabinet/deepseek-client.unit.test.mjs`
- `node --test tests/cabinet/cabinet-simplify.integration.test.mjs`
- `pnpm run test:cabinet`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run test:smoke:cabinet:browser`

### What the tests now verify

`deepseek-client.unit.test.mjs`:
- stream success
- timeout before first chunk
- timeout mid-stream
- interrupted stream
- malformed SSE JSON parse failure

`cabinet-simplify.integration.test.mjs`:
- stream endpoint emits progressive deltas
- successful stream writes final cache row
- reread after success is cache hit
- regenerate uses stream path and rewrites current ready row
- interrupted regenerate does not replace ready cache with partial output
- sync simplify flow remains intact

`test-smoke-cabinet-browser.mjs`:
- reader opens
- user sees first stream draft before final completion
- final simplify content appears
- regenerate works through stream path
- original/simplified navigation remains intact

## Readiness judgement

Streaming v1 is ready as an MVP-level UX improvement.

What is materially better now:
- generation no longer looks dead or silent;
- cache discipline stayed honest;
- truncation/interruption are more explicit;
- regenerate now follows the same progressive transport model as first generation.

## Remaining limitations

Still intentionally out of scope:
- chunking
- PDF
- background jobs
- chat mode
- resume after refresh
- persistent partial stream recovery

Operational caveat:
- streaming gives much better visibility, but it does not remove provider-side instability on very long documents.
- very long markdowns may still require the existing single-pass size guardrails or a later chunking design.

## Files changed

- `server/llm/deepseek-client.mjs`
- `server/cabinet/material-simplify.mjs`
- `server/index.mjs`
- `apps/web/src/routes/CabinetMaterialPage.tsx`
- `apps/web/src/app/messages.ts`
- `tests/cabinet/deepseek-client.unit.test.mjs`
- `tests/cabinet/cabinet-simplify.integration.test.mjs`
- `scripts/test-smoke-cabinet-browser.mjs`

## Final judgement

Streaming simplify v1 reached the requested boundary:
- generation path is visibly alive;
- progressive output is shown in reader;
- streaming is used only where generation is needed;
- cache still stores only final successful result;
- interrupted/truncated streams are no longer masked as ordinary success.
