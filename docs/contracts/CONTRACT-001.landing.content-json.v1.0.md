---
id: CONTRACT-001.landing.content-json
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-02-27
core_snapshot: n/a
related:
  - docs/DOCS_CANON.md
  - docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md
  - docs/prd/PRD-PHASE-1.LANDING.md
  - docs/reports/2026-02-27/UI.LANDING.STEP1_STEP2_PROD_AUDIT.1.report.md
tags:
  - contract
  - landing
  - content
  - json
  - i18n
---

# CONTRACT-001: Landing Content JSON v1.0

## Purpose / Scope
Этот контракт фиксирует единый источник истины для контента лендинга Phase 1 (`Step1 Hero/Showcase`, `Step2 Roles`) в JSON-файлах. Контракт обязателен для producer (контент), consumer (Web UI) и validator (контент-валидатор).

Границы:
1. Только проект "СЕМИНАРЫ", только лендинг Phase 1.
2. Только контентный контракт и правила валидации/деградации.
3. Реализация загрузки/рендера/валидации в коде не входит.

## 1) Parties / Consumers
1. Producer: JSON-файлы контента в `content/landing/*.json`.
2. Consumer: Web UI (`LandingPage` и его компоненты).
3. Validator: контент-валидатор (CI/Dev и runtime проверка).

Норматив:
1. UI рендерит тексты строго из контента.
2. Тексты/строки из кода как fallback запрещены.
3. Ошибки контента не должны приводить к white screen.

## 2) File Layout v1.0
Обязательные файлы:
1. `content/landing/manifest.v1.json`
2. `content/landing/step1.hero.v1.json`
3. `content/landing/step2.roles.v1.json`

Пример `manifest.v1.json` (валидный):
```json
{
  "schema_version": "1.0.0",
  "module": "landing.manifest",
  "modules": {
    "landing.step1.hero": {
      "path": "content/landing/step1.hero.v1.json",
      "expects": "^1.0.0"
    },
    "landing.step2.roles": {
      "path": "content/landing/step2.roles.v1.json",
      "expects": "^1.0.0"
    }
  }
}
```

## 3) Versioning / Compatibility
1. Каждый файл обязан иметь поле `schema_version` строго в формате `MAJOR.MINOR.PATCH`.
2. Для контракта v1.0 каноническое значение версии схемы: `1.0.0`.
3. Значение вида `1.0` невалидно.
4. `manifest.v1.json` хранит `expects` для каждого модуля.
5. Совместимость проверяется правилом:
`semver.satisfies(module.schema_version, manifest.modules[module_name].expects)`.
6. Для каждого module-файла значение `module` внутри файла обязано совпадать с ключом соответствующей записи в `manifest.modules`.
7. Совместимость модулей независима: несовместимость одного модуля не легализует пропуск валидации другого.

## 4) Normative Types v1.0
### 4.1 Locale
1. Разрешены только `ru` и `en`.

### 4.2 I18nText
Только форма:
```json
{
  "i18n": {
    "ru": "Текст",
    "en": "Text"
  }
}
```

Норматив:
1. `ru` и `en` обязательны.
2. Пустые строки запрещены (`trim(value).length > 0`).
3. Альтернативные поля (`text_ru`, `text_en`, plain string) запрещены.

### 4.3 TextItem
Для списков (`body`, `badges`, `stories`) используется:
```json
{
  "id": "hero.aggressive.body.value_speed",
  "text": {
    "i18n": {
      "ru": "Запуск без многомесячной подготовки",
      "en": "Launch without months of preparation"
    }
  }
}
```

### 4.4 StableId
Regex:
`^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`

Правила:
1. Минимум 2 сегмента через точку.
2. Только lower-case латиница, цифры, `_`.

### 4.5 AnchorTarget
Regex:
`^#[a-z][a-z0-9_-]{0,49}$`

### 4.6 Link v1.0
Только:
```json
{
  "kind": "anchor",
  "target": "#roles"
}
```

Правило:
валидация `AnchorTarget` и membership в `values(anchors)` применяется только когда `link.kind === "anchor"`.

## 5) Step1 Hero Contract
Файл: `content/landing/step1.hero.v1.json`

Нормативные поля:
1. `module` обязан быть `landing.step1.hero`.
2. `anchors` обязан быть объектом разрешенных target-ов.
3. В v1.0 единственный нормативно обязательный anchor-target: `#roles`.
4. Дополнительные anchors (включая `#lead-form`) допустимы, но не обязательны.
5. `experiment` обязателен.
6. `variants` обязан содержать контент для `aggressive`, `rational`, `partner`.
7. Канонический идентификатор варианта задается ключом в объекте `variants` (`aggressive`, `rational`, `partner`).
8. Поле `id` на уровне варианта (`variants.<name>.id`) в v1.0 запрещено.

### 5.1 Experiment
`experiment` содержит:
1. `id` (`StableId`).
2. `persist_key` строго равен `heroVariant`.
3. `variants` строго `["aggressive", "rational", "partner"]`.
4. `distribution` обязателен:
   - все веса `> 0`;
   - `keys(distribution)` совпадают с `variants`;
   - `abs(sum(weights) - 1.0) <= 1e-3`.
5. `experiment.variants` обязан совпадать с `keys(variants)` (одинаковый состав ключей, без пропусков и лишних значений).

Нормативный алгоритм выбора:
1. Если есть persisted значение по `heroVariant` и оно валидно в `variants`, использовать его.
2. Иначе взять `r in [0,1)` и выбрать вариант по кумулятивной вероятности в порядке `experiment.variants`.
3. Порядок элементов в `experiment.variants` нормативно определяет порядок кумулятивного расчета; его изменение меняет поведение распределения и запрещено без обновления контракта.
4. Persist выбранного значения выполняется best-effort.
5. Порядок ключей объекта `distribution` не используется для выбора варианта.

`localStorage` политика:
1. `getItem/setItem` выполняются best-effort.
2. При `setItem` ошибке (`QuotaExceededError`, `SecurityError`) использовать in-memory fallback на текущую сессию.
3. Ошибка логируется, приложение не падает.

### 5.2 Hero Variant Payload
Идентификатор варианта задается ключом в `variants` (например `variants.aggressive`).
Отдельное поле `id` у варианта в v1.0 не используется (запрещено; при наличии валидатор считает это ошибкой контракта).

Для каждого варианта обязательны:
1. `headline`: `I18nText`.
2. `subheadline`: `I18nText`.
3. `body`: массив `TextItem` с `minItems=2`.
4. `badges`: массив `TextItem` с `minItems=1` (пустой массив запрещен).
5. `cta`: массив `CTAItem` с `minItems=1`.

`CTAItem`:
```json
{
  "id": "hero.aggressive.cta.roles_primary",
  "text": {
    "i18n": {
      "ru": "Смотреть роли",
      "en": "View roles"
    }
  },
  "link": {
    "kind": "anchor",
    "target": "#roles"
  }
}
```

Дополнительный норматив:
1. В `cta` должен быть минимум один элемент с `link.target == "#roles"`.
2. Для `link.kind === "anchor"`: `link.target` обязан входить в `values(anchors)`.
3. Если target-anchor отсутствует в DOM из-за деградации `landing.step2.roles`, соответствующий CTA не рендерится.

### 5.3 Enabled Flags Policy (Step1 only)
1. `enabled` допускается только на leaf-элементах Step1:
   - `variants.<name>.body[]`
   - `variants.<name>.badges[]`
   - `variants.<name>.cta[]`
2. `enabled` опционален; отсутствие трактуется как `true`.
3. После фильтра `enabled == true` квоты обязаны сохраняться:
   - `body >= 2`
   - `badges >= 1`
   - `cta >= 1`
4. Квоты проверяются валидатором строго после фильтра `enabled == true`.
5. `enabled` не ослабляет структурную валидацию: даже при `enabled=false` элемент обязан проходить полную проверку структуры (`id`, `text`, типы, regex, i18n).
6. UI не монтирует пустые контейнеры списков.
7. В v1.0 Step2 не использует `enabled` (без нового layout).

Пример `step1.hero.v1.json` (валидный):
```json
{
  "schema_version": "1.0.0",
  "module": "landing.step1.hero",
  "anchors": {
    "roles": "#roles",
    "lead_form": "#lead-form"
  },
  "experiment": {
    "id": "landing.hero.experiment_phase1",
    "persist_key": "heroVariant",
    "variants": ["aggressive", "rational", "partner"],
    "distribution": {
      "aggressive": 0.34,
      "rational": 0.33,
      "partner": 0.33
    }
  },
  "variants": {
    "aggressive": {
      "headline": {
        "i18n": {
          "ru": "Семинар, который убирает дорогие ошибки в процессах",
          "en": "A seminar that removes costly process mistakes"
        }
      },
      "subheadline": {
        "i18n": {
          "ru": "Показываем, где теряются деньги и как исправить это за 30 дней",
          "en": "We show where money is lost and how to fix it in 30 days"
        }
      },
      "body": [
        {
          "id": "hero.aggressive.body.value_speed",
          "enabled": true,
          "text": {
            "i18n": {
              "ru": "Запуск с фокусом на окупаемость и скорость",
              "en": "Launch focused on payback and speed"
            }
          }
        },
        {
          "id": "hero.aggressive.body.value_control",
          "text": {
            "i18n": {
              "ru": "Прозрачный план действий без лишней теории",
              "en": "A transparent plan without extra theory"
            }
          }
        }
      ],
      "badges": [
        {
          "id": "hero.aggressive.badges.focus_roi",
          "text": {
            "i18n": {
              "ru": "Фокус на ROI",
              "en": "ROI-focused"
            }
          }
        }
      ],
      "cta": [
        {
          "id": "hero.aggressive.cta.roles_primary",
          "text": {
            "i18n": {
              "ru": "Смотреть роли",
              "en": "View roles"
            }
          },
          "link": {
            "kind": "anchor",
            "target": "#roles"
          }
        }
      ]
    },
    "rational": {
      "headline": {
        "i18n": {
          "ru": "Системный подход к внедрению ИИ без хаоса",
          "en": "A systematic AI rollout without chaos"
        }
      },
      "subheadline": {
        "i18n": {
          "ru": "Четкая методология, метрики и границы применимости",
          "en": "A clear methodology, metrics, and limits of applicability"
        }
      },
      "body": [
        {
          "id": "hero.rational.body.value_method",
          "text": {
            "i18n": {
              "ru": "Пошаговая рамка от диагностики до пилота",
              "en": "A step-by-step path from diagnosis to pilot"
            }
          }
        },
        {
          "id": "hero.rational.body.value_metrics",
          "text": {
            "i18n": {
              "ru": "Измеримые критерии успеха для команды",
              "en": "Measurable success criteria for the team"
            }
          }
        }
      ],
      "badges": [
        {
          "id": "hero.rational.badges.no_magic",
          "text": {
            "i18n": {
              "ru": "Без магии",
              "en": "No magic"
            }
          }
        }
      ],
      "cta": [
        {
          "id": "hero.rational.cta.roles_primary",
          "text": {
            "i18n": {
              "ru": "Выбрать свою роль",
              "en": "Choose your role"
            }
          },
          "link": {
            "kind": "anchor",
            "target": "#roles"
          }
        }
      ]
    },
    "partner": {
      "headline": {
        "i18n": {
          "ru": "Партнерский формат: бизнес, операции и IT в одной рамке",
          "en": "A partner format: business, operations, and IT in one frame"
        }
      },
      "subheadline": {
        "i18n": {
          "ru": "Согласуем общий язык и план внедрения на уровне лидеров",
          "en": "Align leaders around a shared language and rollout plan"
        }
      },
      "body": [
        {
          "id": "hero.partner.body.value_alignment",
          "text": {
            "i18n": {
              "ru": "Синхронизация ожиданий между функциями",
              "en": "Alignment of expectations across functions"
            }
          }
        },
        {
          "id": "hero.partner.body.value_execution",
          "text": {
            "i18n": {
              "ru": "Переход от дискуссий к согласованным действиям",
              "en": "From discussions to aligned execution"
            }
          }
        }
      ],
      "badges": [
        {
          "id": "hero.partner.badges.cross_function",
          "text": {
            "i18n": {
              "ru": "Кросс-функционально",
              "en": "Cross-functional"
            }
          }
        }
      ],
      "cta": [
        {
          "id": "hero.partner.cta.roles_primary",
          "text": {
            "i18n": {
              "ru": "Перейти к ролям",
              "en": "Go to roles"
            }
          },
          "link": {
            "kind": "anchor",
            "target": "#roles"
          }
        }
      ]
    }
  }
}
```

## 6) Step2 Roles Contract
Файл: `content/landing/step2.roles.v1.json`

Нормативные поля:
1. `module` обязан быть `landing.step2.roles`.
2. Ключи ролей в v1.0 строго фиксированы:
   - `business_owner`
   - `operations_lead`
   - `it_lead`
3. `roles_order`:
   - длина строго `3`;
   - без дублей;
   - `set(roles_order) == set(keys(roles))`.
4. Для каждой роли `stories` содержит ровно `3` элемента `TextItem`.
5. В v1.0 `enabled` в Step2 запрещен.
6. `roles.<role_key>.label` обязателен как `I18nText` для названия роли (текст на вкладке/в заголовке).

Пример `step2.roles.v1.json` (валидный):
```json
{
  "schema_version": "1.0.0",
  "module": "landing.step2.roles",
  "roles_order": ["business_owner", "operations_lead", "it_lead"],
  "roles": {
    "business_owner": {
      "label": {
        "i18n": {
          "ru": "Владелец бизнеса",
          "en": "Business Owner"
        }
      },
      "stories": [
        {
          "id": "roles.business_owner.story.value_effect",
          "text": {
            "i18n": {
              "ru": "Хочу быстро понять бизнес-эффект семинара для оценки окупаемости",
              "en": "I want to quickly understand seminar business impact to assess ROI"
            }
          }
        },
        {
          "id": "roles.business_owner.story.value_cases",
          "text": {
            "i18n": {
              "ru": "Хочу увидеть реальные кейсы ошибок и результатов для снижения риска решения",
              "en": "I want real failure and outcome cases to reduce decision risk"
            }
          }
        },
        {
          "id": "roles.business_owner.story.value_contact",
          "text": {
            "i18n": {
              "ru": "Хочу оставить контакт за минуту и быстро перейти к разговору",
              "en": "I want to leave contact details in under a minute and move to a call"
            }
          }
        }
      ]
    },
    "operations_lead": {
      "label": {
        "i18n": {
          "ru": "Руководитель операций",
          "en": "Operations Lead"
        }
      },
      "stories": [
        {
          "id": "roles.operations_lead.story.value_scenarios",
          "text": {
            "i18n": {
              "ru": "Хочу увидеть типовые сценарии внедрения и соотнести их с моей болью",
              "en": "I want typical rollout scenarios mapped to my pain points"
            }
          }
        },
        {
          "id": "roles.operations_lead.story.value_format",
          "text": {
            "i18n": {
              "ru": "Хочу понять формат семинара и ожидаемый результат для обоснования участия",
              "en": "I want the seminar format and expected outcome to justify participation"
            }
          }
        },
        {
          "id": "roles.operations_lead.story.value_phone",
          "text": {
            "i18n": {
              "ru": "Хочу оставить телефон без сложной регистрации и не терять время",
              "en": "I want to leave a phone number without complex signup and save time"
            }
          }
        }
      ]
    },
    "it_lead": {
      "label": {
        "i18n": {
          "ru": "IT-руководитель",
          "en": "IT Lead"
        }
      },
      "stories": [
        {
          "id": "roles.it_lead.story.value_practical",
          "text": {
            "i18n": {
              "ru": "Хочу видеть практический подход и ограничения для оценки применимости",
              "en": "I want a practical approach and constraints to assess applicability"
            }
          }
        },
        {
          "id": "roles.it_lead.story.value_methodology",
          "text": {
            "i18n": {
              "ru": "Хочу понимать, что это методология внедрения, а не магия",
              "en": "I want to see this as implementation methodology, not magic"
            }
          }
        },
        {
          "id": "roles.it_lead.story.value_followup",
          "text": {
            "i18n": {
              "ru": "Хочу связаться через форму и получить follow-up по техническим рамкам",
              "en": "I want to reach out via form and get technical follow-up"
            }
          }
        }
      ]
    }
  }
}
```

## 7) Validation Policy
### 7.1 CI/Dev
1. Любая ошибка контента = `FAIL` pipeline/локальной проверки.
2. Неполная загрузка модулей считается ошибкой.

### 7.2 Runtime (Production)
Допустима только формализованная деградация без падения приложения:
1. Level 1 Leaf Error: скрыть конкретный leaf-элемент, залогировать.
2. Level 2 Variant Error: вариант Hero невалиден, выбрать другой валидный; если валидных нет, Hero не рендерить.
3. Level 3 Structural Error: модуль не рендерить, приложение продолжает работу; логировать `critical`.
4. Фиксированное поведение UI при Level 3:
   - если невалиден `landing.step1.hero`, а `landing.step2.roles` валиден: Hero не рендерится, страница начинается с блока Roles (Step2), приложение не падает; цель: сохранить возможность оставить заявку;
   - если невалиден `landing.step2.roles`, а `landing.step1.hero` валиден: Step2 отсутствует, CTA на отсутствующие anchors не рендерятся;
   - если оба модуля невалидны: отображается только статическая оболочка страницы (header/footer), без контентных секций; route остается смонтированным без white screen.
5. В v1.0 запрещен вывод пользователю технических fallback-текстов при деградации (в том числе дефолтных сообщений из кода).

Запрещено:
1. Подстановка дефолтных текстов.
2. Генерация контента из кода как fallback.

## 8) Error Code Contract v1.0
Формат ошибки:
```json
{
  "file": "content/landing/step1.hero.v1.json",
  "json_pointer": "/variants/aggressive/body/1/text/i18n/en",
  "error_code": "i18n_empty_string"
}
```

Обязательный набор `error_code`:
1. `content_missing_field`
2. `content_invalid_type`
3. `schema_version_incompatible`
4. `i18n_missing_locale`
5. `i18n_empty_string`
6. `invalid_id_format`
7. `duplicate_id`
8. `distribution_sum_invalid`
9. `distribution_key_mismatch`
10. `persist_key_invalid`
11. `anchor_target_not_allowed`
12. `anchor_invalid_format`
13. `roles_key_mismatch`
14. `roles_invalid_count`
15. `stories_invalid_count`
16. `manifest_module_missing`
17. `manifest_version_mismatch`

## 9) Change Policy
1. Contract-first: любые изменения формата контента сначала в этом CONTRACT, затем в коде.
2. Backward-compatible изменения в пределах `v1.x` допускаются только без нарушения правил v1.0.
3. Breaking изменения требуют новой основной версии (`v2.0+`) и отдельного документа контракта.
4. Если изменения затрагивают стратегию хранения/доступа данных, внешние интеграции или границы доменов, требуется ADR по `CONTEXT_GOVERNANCE`.

## Related
1. `docs/DOCS_CANON.md`
2. `docs/ARCHITECTURE/CONTEXT_GOVERNANCE.md`
3. `docs/prd/PRD-PHASE-1.LANDING.md`
4. `docs/reports/2026-02-27/UI.LANDING.STEP1_STEP2_PROD_AUDIT.1.report.md`

## Open Questions / TODO
1. GAP: в `docs/contracts/` отсутствует `INDEX.md`; минимальный следующий шаг вне текущей задачи: создать `docs/contracts/INDEX.md` с колонками `id | path | status | last_updated`.
2. Уточнить целевой формат логирования ошибок контента (единый transport/sink) для runtime observability.
