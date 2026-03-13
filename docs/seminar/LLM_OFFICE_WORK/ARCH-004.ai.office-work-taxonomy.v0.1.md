---
id: ARCH-004.ai.office-work-taxonomy
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
  - docs/seminar/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-006.ai.office-work-research-directions.v0.1.md
tags:
  - architecture
  - taxonomy
  - llm
  - office-work
---

# LLM Office Work Taxonomy

## Purpose / Scope
Этот документ систематизирует knowledge domain на уровне таксономии. Его задача: разделить проблемное поле, решение и концептуальный слой так, чтобы новые документы можно было привязывать к конкретному кластеру, а не расширять домен хаотично.

## Context
`ARCH-003` зафиксировал high-level карту домена. Текущий документ переводит ее в более управляемую структуру с тремя осями:
- problem taxonomy;
- solution taxonomy;
- concept taxonomy.

## Main Section

### 1. Taxonomy Model
Ветка домена держится на трех типах узлов:

1. Problem nodes: почему пользователь получает плохой опыт и где возникают системные разрывы.
2. Solution nodes: какие практики снижают хаос, повышают повторяемость и встраивают LLM в работу.
3. Concept nodes: какие базовые понятия должны быть общими для всех дальнейших документов.

### 2. Problem Taxonomy
| Problem Cluster | Core Question | Typical Failure Pattern | Related Solution Domains |
|---|---|---|---|
| Incorrect mental model | Как пользователь понимает природу LLM | Воспринимает LLM как "умного сотрудника" или чат-бота с готовыми ответами | AI literacy, prompt literacy |
| Poor task formulation | Насколько четко сформулирована задача | Есть вопрос, но нет цели, ограничений, структуры выхода и критериев качества | Prompt literacy, self-prompting |
| Chat-first limitation | Можно ли решить задачу простым диалогом | Диалог остается одноразовым и не превращается в повторяемый рабочий сценарий | Workflow integration, adaptive prompts |
| Document vs data conflict | Что именно генерируется: текст, данные или документ | Ожидается финальный документ, хотя LLM надежнее генерирует структуру и данные | Structured outputs, data literacy |
| Hallucinations and trust | Как поддерживается доверие | Ошибочный или непроверенный вывод ломает доверие ко всему инструменту | AI literacy, human-in-the-loop, validation |
| Lack of workflow integration | Куда встраивается результат | Ответ нельзя встроить в процесс, систему или шаблон | Workflow integration, structured outputs |
| Security and data risks | Что происходит с чувствительным контентом | Пользователь передает неподходящие данные или игнорирует red lines | Governance, safe usage |
| Quality control gap | Кто и как проверяет результат | Нет схемы проверки, чек-листа или ответственного review | Human-in-the-loop, validation, governance |
| Power users vs regular users | Как знание масштабируется внутри компании | Лучшие практики остаются у немногих и не переходят в массовый стандарт | AI champions, prompt libraries, AI literacy |

Рабочая интерпретация:
- первые три кластера в основном про когнитивную рамку пользователя;
- средние кластеры про несовместимость LLM-выхода с офисной средой;
- последние кластеры про организационную зрелость и масштабирование практики.

### 3. Solution Taxonomy
| Solution Cluster | Primary Role | What It Fixes | Limits |
|---|---|---|---|
| Prompt literacy | Учит ставить задачу и формулировать требования | Poor task formulation, incorrect mental model | Не решает интеграцию без process layer |
| Adaptive prompts | Подстраивает шаблон под конкретный сценарий | Chat-first limitation, poor task formulation | Без domain rules быстро вырождается |
| Self-prompting | Помогает пользователю собрать лучший запрос вместе с LLM | Poor task formulation, novice entry barrier | Требует базового понимания цели |
| Prompt libraries | Дает стартовые шаблоны для повторяемых задач | Power users vs regular users, speed of adoption | Статичные библиотеки быстро устаревают |
| Structured outputs | Отделяет данные и смысл от свободного текста | Document vs data conflict, workflow integration | Требует схемы и downstream consumer |
| Workflow integration | Встраивает LLM в повторяемый процесс | Chat-first limitation, lack of workflow integration | Требует организационной дисциплины |
| AI literacy | Объясняет природу модели, ограничения и риски | Incorrect mental model, trust issues | Без практических сценариев остается абстрактной |
| Data literacy | Учит работать со структурой, полями и форматами | Document vs data conflict, structured output adoption | Требует минимальной привычки к данным |
| Governance | Фиксирует safe usage, red lines и контроль доступа | Security risks, quality control gap | Может стать чисто запретительной без методики |
| AI champions | Делает практику переносимой внутри команды | Power users vs regular users, adoption gap | Нуждается в поддержке и артефактах |

### 4. Concept Taxonomy
| Concept Cluster | Short Definition | Why It Matters |
|---|---|---|
| Context | Рабочий набор входных данных, ограничений и условий задачи | Определяет качество и релевантность результата |
| Prompt | Формулировка запроса к LLM | Является интерфейсом, но не заменяет process design |
| Output format | Целевая форма ответа: free text, table, JSON, CSV, XML | Определяет, можно ли результат проверить и использовать дальше |
| Structured data | Данные, организованные по схеме или полям | Делают интеграцию и валидацию реалистичными |
| Workflow | Повторяемая цепочка шагов от контекста до артефакта | Убирает одноразовость chat-first usage |
| Document template | Нормированная форма финального представления | Отделяет оформление от генерации смысла |
| Human-in-the-loop | Человек как проверяющий или утверждающий слой | Нужен для качества, доверия и безопасности |
| Hallucination | Недостоверный, но правдоподобный вывод | Является центральным источником кризиса доверия |
| Context engineering | Целенаправленная сборка и организация контекста | Позволяет перейти от хаотичного чата к управляемому результату |

### 5. Taxonomy Use Rules
1. Каждый новый документ knowledge-ветки должен быть привязан минимум к одному taxonomy cluster.
2. Если документ нельзя связать ни с одним из кластеров, он, вероятно, вне границ текущего домена.
3. Problem и solution документы должны быть двусторонне связаны: проблема без практики решения и решение без проблемы одинаково снижают полезность домена.

## Acceptance / Validation
Документ достаточен, если:

1. Таксономия покрывает problem, solution и concept space без явных дыр в текущем scope.
2. Кластеры различимы и не дублируют друг друга.
3. Документ помогает понять, куда относить будущие дочерние документы.

## Related
- docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/INDEX.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-006.ai.office-work-research-directions.v0.1.md

## Open Questions / TODO
1. Нужен ли позднее отдельный документ с более детальной problem taxonomy level-2.
2. Следует ли отдельно формализовать relationship map между solution clusters и teaching formats.
