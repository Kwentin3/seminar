---
id: ARCH-005.ai.office-work-terminology
version: v0.1
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-10
core_snapshot: n/a
related:
  - docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/INDEX.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-004.ai.office-work-taxonomy.v0.1.md
tags:
  - architecture
  - terminology
  - glossary
  - llm
  - office-work
---

# LLM Office Work Terminology

## Purpose / Scope
Этот документ выравнивает базовый словарь домена. Его задача: дать короткие рабочие определения, notes и связи между понятиями, чтобы следующие research- и методологические документы не расходились в терминах.

## Context
Терминология опирается на `ARCH-003` и `ARCH-004` и покрывает только scope `LLM usage in office work`. Здесь не вводятся deep technical terms из областей `RAG`, `agent orchestration` и platform engineering.

## Main Section
| Term | Definition | Notes | Related concepts |
|---|---|---|---|
| LLM | Вероятностная языковая модель, генерирующая ответы по вероятностному распределению. | Не является гарантом истины или источником финального решения. | AI literacy, hallucination, context |
| Chat-first | Режим работы через свободный диалог без явной структуры процесса. | Удобен для входа, но слаб для повторяемой офисной работы. | workflow, prompt, trust gap |
| Prompt | Текстовая инструкция или запрос к модели. | Сам по себе не заменяет постановку задачи и контекст. | prompt literacy, self-prompting |
| Prompt literacy | Навык формулировать задачу, ограничения, критерии и формат выхода. | Базовая компетенция для не-технических пользователей. | prompt, task formulation, AI literacy |
| Self-prompting | Использование LLM для помощи в сборке лучшего промпта. | Хорошо работает как мост для новичков. | prompt, adaptive prompt, task formulation |
| Adaptive prompt | Промпт-шаблон, который меняется под сценарий, роль и доступные данные. | Полезен там, где статичные шаблоны быстро устаревают. | self-prompting, prompt library, workflow |
| Prompt library | Набор переиспользуемых шаблонов для типовых задач. | Полезен только при регулярном обновлении и привязке к workflow. | adaptive prompt, AI champions |
| Context | Набор входных данных, ограничений и условий задачи. | Главный фактор качества результата. | context engineering, structured data |
| Context engineering | Целенаправленная сборка и организация релевантного контекста. | Переводит работу из режима "поговорить" в режим "собрать результат". | context, workflow, output format |
| Task formulation | Явная постановка цели, входов, ограничений и ожидаемого результата. | Отличается от простого вопроса пользователю. | prompt literacy, validation |
| Output format | Форма ответа: текст, таблица, JSON, CSV, XML и т.д. | Определяет возможность проверки и интеграции. | structured output, document template |
| Structured output | Вывод по заданной структуре или схеме. | Снижает хаос свободного текста. | JSON, CSV, XML, schema-guided generation |
| Structured data | Данные, организованные по полям или схеме. | Нужны для интеграции в реальные процессы и системы. | structured output, data literacy |
| JSON | Текстовый формат структурированных данных с полями и вложенностью. | Удобен для схем, API и валидации. | structured output, schema-guided generation |
| CSV | Табличный текстовый формат с разделителями. | Полезен для офисных таблиц, BI и импорта/экспорта. | structured data, data workflow |
| XML | Разметочный формат структурированных данных. | Важен как пример формального машинно-обрабатываемого вывода. | structured output, document/data separation |
| Schema-guided generation | Генерация с опорой на заранее заданную структуру полей. | Делает вывод более предсказуемым. | schema, structured output, validation |
| Schema | Явное описание полей, типов и правил результата. | Помогает валидировать и интегрировать ответ. | validation, structured data |
| Draft | Черновой результат, предназначенный для доработки. | Не должен выдавать себя за финальный артефакт. | final artifact, human-in-the-loop |
| Final artifact | Итоговый корпоративный объект, пригодный к использованию или отправке. | Часто требует отдельной сборки из данных и шаблона. | document template, validation |
| Document | Оформленный артефакт в форме, шаблоне и регламенте. | Это форма представления, а не обязательно лучший объект генерации. | document template, data workflow |
| Document template | Нормированная форма документа или сообщения. | Должна оформлять, а не хранить весь смысл и логику. | final artifact, structured data |
| Data workflow | Процесс сбора, преобразования и передачи данных между системами. | Часто более естественная среда для LLM, чем финальный документ. | structured output, workflow integration |
| Document workflow | Процесс создания, согласования и выпуска документов. | Нуждается в separation между смыслом и оформлением. | document, template, review |
| Workflow | Повторяемая цепочка шагов от входа до результата. | Ключ к переходу от chat-first к управляемому использованию. | workflow integration, context |
| Workflow integration | Встраивание LLM в реальный рабочий процесс. | Убирает одноразовость и ручной copy-paste. | workflow, structured output |
| Human-in-the-loop | Человек, который проверяет, корректирует или утверждает результат. | Центральный механизм доверия и контроля. | validation, review, governance |
| Review | Человеческая проверка содержания, формы или рисков. | Может быть lightweight, но не должна исчезать полностью. | human-in-the-loop, quality control |
| Validation | Проверка полноты, формата, схемы и допустимости результата. | Может быть человеческой или формальной. | schema, quality control |
| Quality control | Система проверок, ролей и критериев качества. | Защищает от тихих ошибок и нестабильности. | validation, governance |
| Hallucination | Правдоподобный, но неверный или неподтвержденный вывод модели. | Один из главных источников кризиса доверия. | trust gap, AI literacy |
| Trust gap | Разрыв между ожиданиями пользователя и реальной надежностью результата. | Быстро накапливается после пары плохих кейсов. | hallucination, quality control |
| AI literacy | Понимание принципов работы, ограничений и рисков LLM. | Нужна шире, чем простое умение писать промпты. | prompt literacy, hallucination |
| Data literacy | Понимание роли данных, схем и структур в работе. | Критична для adoption structured outputs. | structured data, schema |
| Governance | Набор правил, ролей и ограничений для безопасного применения AI. | Не должен сводиться только к запретам. | safe usage, red lines |
| Safe usage | Практика безопасного использования AI в рабочей среде. | Включает data handling, review и scope restrictions. | governance, security |
| Red lines | Явные запреты по данным, сценариям или типам решений. | Нужны для защиты от рискованных use cases. | governance, sensitive data |
| Sensitive data | Контент, который нельзя свободно передавать в LLM-сценарии. | Требует явных правил обращения. | safe usage, red lines |
| Office automation | Автоматизация повторяемых офисных операций. | LLM здесь выступает частью процесса, а не только интерфейсом. | workflow integration, structured output |
| AI champion | Внутренний носитель практики, который помогает команде освоить рабочие паттерны. | Нужен для масштабирования знания внутри компании. | prompt library, AI literacy |
| Power user | Пользователь, который получает устойчиво лучшие результаты за счет навыка и практики. | Его опыт нужно переводить в общие артефакты, а не оставлять личным. | AI champion, prompt literacy |
| Negative user experience | Негативный практический опыт при работе с LLM в офисе. | Часто возникает из mismatch между ожиданием и процессом. | trust gap, chat-first |
| Office work | Повторяемая административная, аналитическая и документная работа в организации. | Домен фокусируется именно на этой рабочей среде. | workflow, document workflow |

## Acceptance / Validation
Документ достаточен, если:

1. Содержит не менее 30 терминов с краткими определениями.
2. Каждый термин имеет notes и related concepts.
3. Термины поддерживают текущий scope и не открывают лишние технические ветки.

## Related
- docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/INDEX.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-004.ai.office-work-taxonomy.v0.1.md

## Open Questions / TODO
1. Нужно ли позже вынести office-specific examples в отдельный annex, чтобы не раздувать glossary.
2. Следует ли добавить bilingual aliases терминов, если домен начнет использоваться в RU/EN mixed materials.
