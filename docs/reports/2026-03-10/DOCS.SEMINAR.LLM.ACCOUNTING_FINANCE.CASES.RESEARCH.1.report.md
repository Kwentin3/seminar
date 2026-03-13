---
id: REPORT.docs.seminar.llm-accounting-finance-cases-research-1
version: v0.1
status: draft
owner: @Kwentin3
approved_by:
  - @Kwentin3
last_updated: 2026-03-10
core_snapshot: n/a
related:
  - docs/seminar/LLM_OFFICE_WORK/ARCH-004.ai.office-work-taxonomy.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-010.ai.office-work-deep-research.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-012.ai.office-work-implementation-scenarios.v0.1.md
tags:
  - report
  - seminar
  - llm
  - accounting
  - finance
  - research
---

# Seminar Domain: LLM In Accounting And Finance

## Purpose / Scope
Краткий отчет по внешним кейсам, где LLM уже применяются или прямо встроены в workflow бухгалтеров, аудиторов, tax-специалистов и finance teams.

Фокус:
- 10 конкретных use cases;
- разнесение по `Seminar Domain`;
- краткие выводы без vendor-selection и без низкоуровневой реализации.

## Context
Для отбора использовались только внешние источники с прикладными finance/accounting сценариями: official case studies, product pages и implementation writeups. Я сознательно не включал pure OCR/ML кейсы без явного LLM layer.

## Main Section

### 1. Domain Split
Ниже кейсы разложены по двум осям:

1. `Finance subdomain`: где именно работает бухгалтер или финансист.
2. `Seminar mapping`: к какому solution / scenario cluster из `LLM_OFFICE_WORK` кейс ближе всего относится.

### 2. Cases
| # | Finance subdomain | Concrete case | How LLM is used | Seminar mapping | Status | Source |
|---|---|---|---|---|---|---|
| 1 | Shared finance ops | Finance mailbox triage | Классифицирует входящие письма и отправляет в нужный workflow | `Workflow integration` + `Structured outputs` | implementation pattern | `S1` |
| 2 | Shared finance ops | Attachment and document extraction | Извлекает поля из приложений к письмам: финансовые документы, формы, вложения | `Structured outputs` + `Spreadsheet / document intake` | implementation pattern | `S1` |
| 3 | Shared finance ops | Draft response and escalation recommendation | Готовит ответ, next step или escalation path по содержимому письма | `Document preparation` + `Workflow integration` | implementation pattern | `S1` |
| 4 | Technical accounting | Lease accounting assistant | Отвечает на вопросы по lease accounting policy и ведет специалиста к нужной норме/процедуре | `Knowledge base query` + `Governance` | already used | `S2` |
| 5 | Technical accounting | ARO assistant | Подсказывает по asset retirement obligation rules и связанным accounting policies | `Knowledge base query` + `Governance` | already used | `S2` |
| 6 | Tax | Tax research copilot | Находит ответы по tax вопросам и резко сокращает research time | `Knowledge base query` + `Prompt libraries` | already used | `S3` |
| 7 | Audit and assurance | Technical audit research | Дает citation-backed ответы по audit/accounting вопросам внутри audit workflow | `Knowledge base query` + `Human-in-the-loop` | already used | `S4` |
| 8 | Audit and assurance | Contract and document review | Разбирает сложные audit documents и вытаскивает ключевые terms / clauses | `Structured outputs` + `Workflow integration` | already used | `S4` |
| 9 | Tax prep | AI client briefing before return prep | Собирает предыдущую декларацию в briefing с 60+ ключевыми datapoints до начала работы | `Structured outputs` + `Document preparation` | already embedded in product | `S6` |
| 10 | Tax advisory | Tax planning insights and client reports | Генерирует tax-planning insights и клиентские отчеты на основе tax data | `Document preparation` + `Workflow integration` | already embedded in product | `S5` |

### 3. What These Cases Mean For The Seminar Domain
Самые сильные кластеры здесь не про "свободный чат", а про четыре повторяющихся доменных паттерна.

#### A. Knowledge Base Query
Сильнее всего LLM уже держатся там, где finance users задают bounded questions по policy, tax и audit knowledge:
- lease accounting;
- ARO;
- tax research;
- audit / accounting technical questions.

Это хорошо ложится в `ARCH-012 Scenario 6. Knowledge Base Query`, но только при двух условиях:
- approved context;
- human review в финальной точке.

#### B. Structured Outputs
Наиболее устойчивые кейсы не заканчиваются "красивым текстом". Они делают промежуточный слой:
- классификацию писем;
- извлечение полей из документов;
- structured briefing;
- key terms and clauses.

Это прямое подтверждение `ARCH-008`: finance/accounting use cases выигрывают, когда LLM генерирует не финальный документ, а проверяемую структуру.

#### C. Workflow Integration
Почти все найденные кейсы живут внутри существующего процесса:
- shared mailbox;
- tax prep;
- audit review;
- accounting policy support.

Это подтверждает `ARCH-009`: ценность появляется не в isolated chat, а в handoff к очереди, задаче, review step, memo, return prep или client report.

#### D. Governance And Human-In-The-Loop
В finance домене почти нет убедительных кейсов fully autonomous decision-making. Почти везде LLM:
- ускоряет поиск и подготовку;
- предлагает draft;
- выделяет структуру;
- но не снимает ответственность с бухгалтера, аудитора или tax specialist.

Это особенно важно для seminar framing: high-trust entry point здесь не "AI заменит учет", а "AI снимает clerical и research friction, не убирая контроль".

### 4. Main Findings
1. Самые зрелые кейсы находятся в `tax`, `audit`, `technical accounting` и `shared finance ops`, а не в полностью автономном closing или posting.
2. LLM чаще всего дают value в трех формах: `research`, `extraction`, `drafting`.
3. Наиболее убедительные сценарии в finance почти всегда bounded, repeatable и reviewable.
4. Если в сценарии нет structured intermediate layer, он быстро скатывается в недоверенный chat-first usage.
5. Для seminar domain это означает, что лучший вход в B2B-разговор не "общий AI для финансов", а узкий portfolio из 3-4 repeatable workflows.

### 5. Recommended Finance Entry Portfolio For Seminar
Если из этого корпуса собирать seminar-friendly стартовый набор, то наиболее сильный старт выглядит так:

1. `Tax research assistant`
2. `Audit / technical accounting Q&A`
3. `Finance email and document intake`
4. `Tax prep briefing and advisory draft generation`

Это хороший portfolio, потому что он:
- имеет понятный ROI;
- не требует полной process replacement;
- естественно допускает human review;
- хорошо демонстрирует `Structured outputs + Workflow integration`.

## Source List
`S1` AWS. Streamline financial workflows with generative AI for email automation.  
https://aws.amazon.com/blogs/machine-learning/streamline-financial-workflows-with-generative-ai-for-email-automation/

`S2` SAP Community. Revolutionizing Finance: How Vodafone Intelligent Solutions uses the AI Finance Advocate.  
https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/revolutionizing-finance-how-vodafone-intelligent-solutions-uses-the-ai/ba-p/13950406

`S3` Thomson Reuters. From hours to minutes: How CoCounsel reimagined tax workflow efficiency at Copeland Buhl.  
https://tax.thomsonreuters.com/en/insights/case-studies/from-hours-to-minutes-how-cocounsel-reimagined-tax-workflow-efficiency-at-copeland-buhl

`S4` Thomson Reuters. Transforming audit and accounting efficiency.  
https://tax.thomsonreuters.com/en/insights/case-studies/transforming-audit-and-accounting-efficiency

`S5` Intuit ProConnect. AI-powered tax prep tools.  
https://accountants.intuit.com/tax-software/tax-online/ai-features/

`S6` Intuit. How ProConnect Tax's AI integrations amplify your expertise.  
https://accountants.intuit.com/taxprocenter/wp-content/uploads/2025/08/AI-integrations-whitepaperFNL.pdf

## Acceptance / Validation
Результат достаточен, если:

1. Зафиксированы 10 concrete finance/accounting use cases из внешних источников.
2. Каждый кейс разнесен по `Seminar Domain`, а не просто перечислен.
3. В отчете есть краткий synthesis, а не только список ссылок.

## Open Questions / TODO
1. Нужен ли следующий отдельный note по `Tax / Audit / Accounting` как дочерний domain branch внутри `LLM_OFFICE_WORK`.
2. Стоит ли отдельно оформить `Finance AI Entry Scenarios` как seminar-specific sales/teaching artifact.
