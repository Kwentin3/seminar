# CABINET.llm-simplify-admin-config-surface.report

## 1. Executive summary

Admin surface для `Пересказать простым языком` расширен так, чтобы критичные runtime/product-настройки больше не прятались в неявном поведении сервиса.  
Теперь cabinet-admin страница показывает не только editable settings, но и `effective config`, `guardrails`, warnings и последний известный failure.  
API key по-прежнему остаётся `env-only` и не раскрывается в GUI или SQLite.

Итерация закрывает конкретную проблему прозрачности, которая стала явной после output truncation incident: администратор теперь видит, какие лимиты реально применяются, чем отличается editable config от hard safety envelope, и почему длинные документы могут быть заблокированы или работать нестабильно.

## 2. Hidden magic audit

### Что уже было вынесено до этой итерации

- `model`
- `feature_enabled`
- `system_prompt`
- `user_prompt_template`
- `temperature`
- `max_output_tokens`
- `test connection`

### Какая hidden magic оставалась

- `request_timeout_ms` реально влиял на UX и failure profile, но не был виден в admin GUI.
- `max_source_chars` / single-pass input budget реально влиял на успешность длинных markdown-документов, но не был управляем через GUI.
- `oversized_behavior` как product decision не был виден администратору.
- `effective config` вообще не показывался, поэтому админ видел только stored settings, но не понимал, какие значения реально применяются после fallback/guardrail logic.
- output cap incident уже показал, что неявные runtime defaults приводят к confusing UX, даже если feature формально “работает”.

### Что сознательно не считается hidden magic после этой итерации

- bootstrap default prompts в code/seed оставлены как one-time bootstrap, а не как runtime source of truth.
- absolute hard caps оставлены в config code как safety envelope.
- redaction/logging policy остаётся internal-only.

## 3. Что вынесено в admin GUI

На странице `/cabinet/admin/llm-simplify` теперь управляются:

- `feature_enabled`
- `model`
- `temperature`
- `max_output_tokens`
- `request_timeout_ms`
- `max_source_chars`
- `oversized_behavior`
- `system_prompt`
- `user_prompt_template`

Страница также показывает:

- `provider`
- `API key configured: yes/no`
- `prompt version`
- `updated_at`
- `updated_by`
- `effective timeout`
- `effective max output tokens`
- `effective single-pass limit`
- `effective oversized behavior`
- `hard timeout guardrail`
- `hard input-size guardrail`
- `recent_failure`

## 4. Что сознательно осталось guardrail-only

Следующие настройки/аспекты не вынесены в полноценное редактирование через GUI:

- `DEEPSEEK_API_KEY`
- raw secret values
- hard upper cap for timeout
- hard upper cap for input size
- runtime redaction/logging policy
- internal provider diagnostics payload

Причина:

- secret не должен попадать в UI или SQLite;
- hard caps ограничивают риск разрушительного admin input;
- diagnostics и redaction являются operational safety layer, а не product tuning;
- GUI должен оставаться admin surface, а не low-level debug console.

## 5. Effective config model

Server response `/api/cabinet/admin/llm-simplify/settings` теперь возвращает:

- `settings`
- `effective_config`
- `recent_failure`
- `key_configured`

`effective_config` позволяет администратору увидеть, что реально применится в runtime:

- `provider`
- `model`
- `key_configured`
- `request_timeout_ms`
- `max_output_tokens`
- `max_source_chars`
- `oversized_behavior`
- `hard_max_request_timeout_ms`
- `hard_max_source_chars`

Это убирает двусмысленность между “что сохранено” и “что реально действует”.

## 6. Warnings and validation

### Server-side validation

На save path добавлены/уточнены обязательные проверки:

- `feature_enabled`, `model`, `system_prompt`, `user_prompt_template`, `request_timeout_ms`, `max_source_chars`, `oversized_behavior` обязательны
- `user_prompt_template` должен содержать `{{source_markdown}}`
- `request_timeout_ms` должен быть внутри допустимого corridor
- `max_source_chars` должен быть внутри допустимого corridor

### UI warnings

Admin page теперь показывает contextual warnings для значений, которые обычно приводят к confusing UX:

- отсутствует API key
- слишком низкий `max_output_tokens`
- слишком высокий `request_timeout_ms`
- слишком высокий `max_source_chars`
- выбран `allow_with_warning`
- слишком короткий `system_prompt`
- в `user_prompt_template` отсутствует `{{source_markdown}}`

Warnings intentionally short и product-oriented: они объясняют риск, а не превращают страницу в ops-консоль.

## 7. Diagnostics/admin usefulness

Минимальная diagnostics value страницы после итерации:

- админ видит, подключена ли система к провайдеру;
- админ видит, какие лимиты реально активны;
- админ видит, что слишком длинный документ может быть заблокирован до provider call;
- админ видит последний известный simplify failure без показа чувствительного payload;
- connection test остаётся доступным и не сломан.

Это делает страницу полезной не только для “настроить prompt”, но и для быстрой operational sanity-check перед rollout или диагностикой пользовательского кейса.

## 8. Persistence model

Текущая модель после итерации:

- `API key` -> env-only
- working simplify settings -> `llm_simplify_settings`
- generated cache/failures -> `material_simplifications`
- hard guardrails -> code-level config entrypoint

Новая migration:

- `migrations/0008_extend_llm_simplify_settings_runtime_controls.sql`

Новые persisted admin-managed fields:

- `request_timeout_ms`
- `max_source_chars`
- `oversized_behavior`

## 9. Test and verification evidence

### Прогнаны проверки

- `pnpm run typecheck`
- `node --test tests/cabinet/cabinet-simplify.integration.test.mjs`
- `pnpm run build`
- `pnpm run test:smoke:cabinet:browser`

### Что подтверждено

- admin can open settings page
- viewer cannot access settings API
- settings save correctly with new fields
- effective config reflects saved values
- simplify flow respects updated runtime controls
- oversized document can be blocked before provider call
- recent failure is reflected in settings response
- test connection still works
- browser smoke confirms new settings page renders with visible runtime controls
- no secret value is rendered in UI

## 10. Product judgement

После этой итерации simplify system стала:

- заметно прозрачнее для администратора
- управляемее без деплоя
- менее магической в runtime behavior
- лучше подготовленной к operational troubleshooting

Важно при этом, что страница не превратилась в infra cockpit:

- у админа есть контроль над реально значимыми настройками,
- но safety envelope и secrets остаются вне GUI.

## 11. Что осталось следующим шагом

Логичный следующий шаг:

- live/stage verification именно нового admin config surface на реальном contour;
- отдельная проверка UX для long-document policy, чтобы admin видел понятную связь между `max_source_chars`, `oversized_behavior` и фактическим reader failure state;
- при необходимости later можно добавить compact “test simplify on short sample”, но это не требуется для текущего narrow scope.
