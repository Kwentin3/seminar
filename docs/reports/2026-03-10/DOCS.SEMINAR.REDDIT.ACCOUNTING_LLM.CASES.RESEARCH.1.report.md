---
id: REPORT.docs.seminar.reddit-accounting-llm-cases-research-1
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
  - docs/reports/2026-03-10/DOCS.SEMINAR.LLM.ACCOUNTING_FINANCE.CASES.RESEARCH.1.report.md
tags:
  - report
  - seminar
  - reddit
  - llm
  - accounting
  - tax
  - research
---

# Seminar Domain: Reddit Cases On LLM In Accounting

## Purpose / Scope
Краткий Reddit-focused отчет по тому, как бухгалтеры, аудиторы, bookkeepers и tax professionals реально описывают использование LLM в работе.

Фокус:
- популярные Reddit threads;
- 10 повторяющихся рабочих кейсов;
- краткий synthesis по домену `Seminar`.

## Method
Я брал не любые Reddit посты, а threads, которые:

1. всплывают в `sort=top&t=all` поиске Reddit по `r/Accounting` и `r/Bookkeeping`;
2. либо регулярно появляются в web search по `r/taxpros` / `r/Accounting`;
3. содержат конкретные рабочие примеры, а не только мемы про "AI заменит бухгалтеров".

Важно:
- Reddit search page не всегда показывает точные vote counts в HTML;
- поэтому "популярные" здесь означает `top/all-time surfaced` плюс visible score snippets там, где они были доступны.

## Main Section

### 1. Popular Threads Used
| Code | Subreddit | Thread | Popularity signal | Link |
|---|---|---|---|---|
| `R1` | `r/Accounting` | `Anyone use ChatGPT at work and found a good use for it?` | surfaced in top/all-time search | https://www.reddit.com/r/Accounting/comments/113u79l/anyone_use_chatgpt_at_work_and_found_a_good_use/ |
| `R2` | `r/Accounting` | `Has anyone been using chatGPT for their work?` | long-lived high-visibility thread in accounting search/web results | https://www.reddit.com/r/Accounting/comments/10aat1a/has_anyone_been_using_chatgpt_for_their_work/ |
| `R3` | `r/Accounting` | `Are you using AI in your job yet?` | surfaced in web results with visible `+114` votes | https://www.reddit.com/r/Accounting/comments/1igyope/are_you_using_ai_in_your_job_yet/ |
| `R4` | `r/Accounting` | `Chat GPT in accounting?` | recurring accounting discussion thread | https://www.reddit.com/r/Accounting/comments/1erosz3/chat_gpt_in_accounting/ |
| `R5` | `r/Accounting` | `Use of chatgpt in accounting` | recurring accounting discussion thread | https://www.reddit.com/r/Accounting/comments/18rtej7/use_of_chatgpt_in_accounting/ |
| `R6` | `r/Bookkeeping` | `How are you using AI in bookkeeping?` | surfaced in top/all-time `r/Bookkeeping` search | https://www.reddit.com/r/Bookkeeping/comments/1htycu5/how_are_you_using_ai_in_bookkeeping/ |
| `R7` | `r/taxpros` | `Any tax professionals use AI or Chatgpt in their practices?` | strong use-case density in professional tax thread | https://www.reddit.com/r/taxpros/comments/1i93s1j/any_tax_professionals_use_ai_or_chatgpt_in_their/ |
| `R8` | `r/taxpros` | `Implementing AI for Tax Prep` | strong use-case density in tax workflow thread | https://www.reddit.com/r/taxpros/comments/1k0mzgg/implementing_ai_for_tax_prep/ |
| `R9` | `r/Accounting` | `Technical Accounting chatbot - would you guys use it?` | specialized but concrete enterprise-use discussion | https://www.reddit.com/r/Accounting/comments/1aq32eg/technical_accounting_chatbot_would_you_guys_use_it/ |

### 2. Ten Cases From Reddit
| # | Case | What people describe | Main Reddit evidence | Seminar mapping |
|---|---|---|---|---|
| 1 | Report summarization and first-draft paragraphs | В M&A / advisory используют LLM, чтобы сжать текст и превратить bullets в report paragraphs | `R3` | `Document preparation` |
| 2 | Email polishing and client communication | Самый массовый кейс: professional email drafts, apology emails, client letters, cleaner tone | `R1`, `R3`, `R4`, `R7` | `Email drafting` |
| 3 | Excel formulas | Часто используют как быстрый помощник по формулам и spreadsheet logic | `R2`, `R3`, `R6`, `R7` | `Spreadsheet support` |
| 4 | VBA / macro automation | Пишут VBA macros, formatting code, scripts that split reports, save PDFs, send emails | `R1`, `R2`, `R4`, `R7` | `Spreadsheet automation` |
| 5 | Power BI / DAX / Python / R help | Finance users просят у LLM DAX, Power BI visuals, Python/R scripts и refactor кода | `R3` | `Analytics support` |
| 6 | Technical accounting assistant | LLM используют как thinking partner по GAAP / FASB / accounting treatments, но не как final authority | `R3`, `R9` | `Knowledge base query` |
| 7 | Audit workpapers | Есть примеры генерации audit workpaper text по bank recs и search for unrecorded liabilities | `R2` | `Audit documentation` |
| 8 | Tax research and cross-checking | Tax pros используют LLM, Blue J, CoCounsel, Perplexity и похожие tools для initial research and double-checking instincts | `R7`, `R8` | `Knowledge base query` + `Human-in-the-loop` |
| 9 | IRS letters and notice responses | Draft IRS response letters, reasonable-cause abatement requests, notice replies, then manually review | `R5`, `R7` | `Document preparation` + `Governance` |
| 10 | Client-specific SOP / email knowledge bases | Bookkeepers создают custom GPTs по client SOPs, notes and email history; staff asks questions and finds old AJE / 1099 context faster | `R6` | `Workflow integration` + `Knowledge base query` |

### 3. Extra Cases That Also Appeared
Дополнительно в Reddit-корпусе всплыли еще несколько менее массовых, но ценных сценариев:

1. классификация vendor lists: отделить компании от физических лиц (`R2`);
2. proposal pricing and scoping from sales-call transcripts (`R6`);
3. поиск по старому inbox: кто присылал AJEs, кому нужны 1099, draft follow-up emails (`R6`);
4. AI file naming / tagging for uploaded tax docs (`R8`);
5. document auto-identification inside tax prep workflows (`R8`).

### 4. What Reddit Shows That Vendor Case Studies Usually Hide
Reddit дает более приземленную картину, чем official vendor materials.

#### A. People Use LLM Mostly As A Drafting And Lookup Layer
На Reddit почти нет рассказов про fully autonomous accounting. Реально повторяются:
- drafts;
- formula help;
- technical lookup;
- document prep;
- small automation.

#### B. Trust Is The Central Constraint
Практически в каждой ветке повторяется один и тот же паттерн:
- "helps me think";
- "saves time";
- "good first draft";
- "I still check everything".

Это особенно явно в `technical accounting`, `tax research` и `IRS letters`.

#### C. The Best Reddit Cases Are Narrow, Not Grand
Самые живые use cases не звучат как "AI закрывает месяц" или "AI делает учет вместо бухгалтера". Они звучат как:
- почистить email;
- написать macro;
- подсказать формулу;
- быстро найти направление tax answer;
- собрать first draft письма или workpaper.

#### D. Bookkeeping Community Is More Defensive
Есть заметный cultural signal: в `r/Bookkeeping` отношение к AI заметно жестче, чем в `r/Accounting`. Даже в текущих moderations there are removals for AI-related posts. Это важный seminar insight: perception gap между bookkeeping practice и broader accounting/finance experimentation уже существует.

### 5. Main Findings
1. Reddit подтверждает, что LLM уже используются в бухгалтерии, но mostly as assistant layer, not autonomous operator.
2. Самые повторяющиеся кейсы: `emails`, `Excel/VBA`, `tax research`, `technical accounting brainstorming`, `IRS/tax letters`.
3. У tax professionals и technical accountants доверие к LLM растет только там, где есть cross-check against source systems or human review.
4. Bookkeeping use cases смещены в `client SOP knowledge bases`, `email retrieval`, `operational memory`, а не в автоматическое ведение books.
5. Для `Seminar Domain` это сильный аргумент в пользу narrow workflow entry strategy, а не broad "AI for all accounting" messaging.

## Source Notes
Ключевые фрагменты, на которых держится synthesis:

1. `R3`: report summarization, email fluff, Excel/VBA help, technical accounting advisor, DAX/Python/R.
2. `R2`: vendor-list cleanup, audit workpapers, Excel macros, power automate flows, revenue recognition questions.
3. `R1`: client letters, apology emails, VBA macros, memo drafting, report-to-PDF/email automation.
4. `R6`: client-level custom GPTs, SOP knowledge bases, inbox search for AJEs and 1099s, follow-up emails.
5. `R7`: emails to clients, tax research cross-checking, abatement letters, IRS correspondence, translation for Spanish-speaking clients.
6. `R8`: AI file naming, tagging, tax-doc organization, AI-assisted tax prep integrations.
7. `R9`: internal technical-accounting chatbot already implemented inside company.

## Acceptance / Validation
Результат достаточен, если:

1. Использованы именно Reddit threads, а не vendor case studies.
2. Собраны 10 concrete cases, а не только общий opinion summary.
3. Есть domain synthesis, полезный для `Seminar`, а не просто список ссылок.

## Open Questions / TODO
1. Стоит ли собрать отдельный seminar note `Reddit Reality Check For Accounting AI Adoption`.
2. Нужно ли next step отдельно разложить `Reddit cases` на `safe`, `risky` и `not-ready` workflows.
