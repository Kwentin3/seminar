# OBS Implementation Pattern

## Purpose
Этот документ фиксирует единый паттерн внедрения observability baseline (CONTRACT-OBS-001 v0.4) для backend-фич проекта «Семинары».

Цель:
- чтобы разработчик логировал одинаково во всех модулях;
- чтобы кодовый агент быстро находил правильный шаблон;
- чтобы инварианты контракта было сложно обойти случайно.

## When to log
Логируйте события в трех точках:
- `started`: старт значимого шага (вход в handler/операцию).
- `completed`: успешный operational result (добавляйте `duration_ms`).
- `failed`/`degraded`: неуспех или деградация с `error.code`.

Не логируйте:
- каждую внутреннюю строку исполнения;
- дублирующие события без операционного смысла.

## How to log (Object API Only)
Используйте только объектный API logger:

```js
logger.info({
  event: "lead_submit_started",
  domain: "leads",
  module: "leads/submit-handler",
  payload: { source: "landing" }
});
```

С ошибкой:

```js
logger.error({
  event: "lead_submit_failed",
  domain: "leads",
  module: "leads/submit-handler",
  duration_ms: elapsedMs(startedAt),
  payload: { status_code: 500, reason: "internal_error" },
  error: {
    code: "leads.internal_error",
    category: "internal",
    retryable: true,
    origin: "infra",
    message: "lead submit failed"
  }
});
```

## How to choose event name
Правила:
- `snake_case` только.
- прошедшее/результатное имя: `*_started`, `*_completed`, `*_failed`, `*_selected`, `*_degraded`.

Примеры:
- `content_bundle_loaded`
- `hero_variant_selected`
- `landing_render_degraded`

## How to choose domain/module
`domain` отвечает на вопрос «что произошло»:
- `runtime`, `content`, `landing`, `leads`, `admin`, `cabinet`, `obs`.

`module` отвечает на вопрос «где произошло»:
- `kebab-case/path`, например `landing/ab-selector`, `content/loader`, `runtime/http-middleware`.

## How to structure error.code
`error.code` всегда namespaced:
- `content.*`
- `landing.*`
- `leads.*`
- `admin.*`
- `cabinet.*`
- `runtime.*`
- `obs.*`

Примеры:
- `content.bundle_load_failed`
- `landing.render_degraded`
- `admin.unauthorized`
- `cabinet.unauthorized`

## How to log degradations
Если операция не упала полностью, но поведение ухудшилось:
- используйте `level=warn`;
- логируйте отдельное событие деградации (`*_degraded`);
- добавляйте `error.code` + минимальный `payload` с причиной.

Пример:

```js
logger.warn({
  event: "landing_render_degraded",
  domain: "landing",
  module: "landing/render",
  payload: { reason: "hero_unavailable", affected_block: "hero" },
  error: {
    code: "landing.render_degraded",
    category: "validation",
    retryable: false,
    origin: "domain",
    message: "hero block is unavailable"
  }
});
```

## How to log operational result (duration_ms)
Для operational result событий `duration_ms` обязателен:

```js
const startedAt = Date.now();
// ...work...
logger.info({
  event: "content_bundle_loaded",
  domain: "content",
  module: "content/loader",
  duration_ms: Math.max(0, Date.now() - startedAt),
  payload: { content_bundle_hash }
});
```

## Common mistakes (DON'T)
- не используйте `console.log` для runtime событий.
- не логируйте PII/секреты в payload/error.
- не пишите `error.code` без namespace.
- не используйте позиционные аргументы вместо object API.
- не добавляйте новые event naming-паттерны вне контракта.
- не пропускайте `duration_ms` у result-событий.

## Checklist before PR
- [ ] События добавлены в `started/completed/failed|degraded` точках.
- [ ] `event` соответствует `snake_case` + policy суффиксов.
- [ ] `domain/module` выбраны по контракту.
- [ ] `error.code` namespaced.
- [ ] `duration_ms` добавлен для operational results.
- [ ] В логах нет PII/секретов.
- [ ] Есть тесты на новые события и request_id correlation.
- [ ] Проверена retrieval-цепочка через `pnpm run obs:logs`.
