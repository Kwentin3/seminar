---
id: ARCH-010.ai.office-work-deep-research
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
  - docs/seminar/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-006.ai.office-work-research-directions.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-008.ai.office-work-structured-outputs.v0.1.md
  - docs/seminar/LLM_OFFICE_WORK/ARCH-009.ai.office-work-workflow-integration.v0.1.md
tags:
  - architecture
  - research
  - synthesis
  - llm
  - office-work
---

# Deep Research: LLM In Office Work

## Purpose / Scope
Этот документ собирает и синтезирует внешний корпус наблюдений по теме использования LLM в офисной работе. Его задача: расширить knowledge domain не новой теорией, а реальными кейсами, практиками, типовыми сбоями и подходами к обучению сотрудников.

Фокус документа:
- реальные use cases в офисной среде;
- негативный пользовательский опыт и adoption friction;
- best practices для prompt literacy, structured outputs и workflow integration;
- методы обучения сотрудников и масштабирования навыков.

Границы:
- только `LLM usage in office work`;
- без ухода в PRD, vendor selection и tutorial sections;
- без глубокого product-specific implementation detail.

## Context
Ранее домен уже был разложен в связку `Problem -> Solution -> Process` через `ARCH-007`, `ARCH-008` и `ARCH-009`. Этот документ нужен, чтобы проверить эти гипотезы на внешнем материале: workplace reports, enterprise surveys, practical implementation notes, community evidence и field studies.

## Main Section

### A. Research Method
Корпус был собран из четырех типов источников:

1. Enterprise reports and surveys: Microsoft, McKinsey, Deloitte, NBER, ISACA, LinkedIn Learning, WRITER.
2. Practical implementation writeups: AWS and Microsoft case materials.
3. Community evidence: Reddit и Hacker News threads, где люди описывают реальный повседневный опыт.
4. Research and field studies: academic work on workplace augmentation and AI literacy.

Критерии отбора:
- явная связь с офисной, информационной или административной работой;
- наличие конкретных use cases, проблем, практик или training patterns;
- предпочтение первичным или близким к первичным источникам.

Для компактности ниже используются source codes:
- `R1` [Microsoft Research, Generative AI in Real-World Workplaces](https://www.microsoft.com/en-us/research/publication/generative-ai-in-real-world-workplaces/)
- `R2` [Microsoft Work Trend Index / Copilot earliest users](https://www.microsoft.com/en-us/worklab/work-trend-index/copilots-earliest-users-teach-us-about-generative-ai-at-work)
- `R3` [McKinsey, The state of AI in early 2024](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-2024)
- `R4` [McKinsey, Gen AI adoption: the next inflection point](https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights/gen-ais-next-inflection-point-from-employee-experimentation-to-organizational-transformation)
- `R5` [McKinsey, Superagency in the workplace](https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/superagency-in-the-workplace-empowering-people-to-unlock-ais-full-potential-at-work)
- `R6` [Deloitte, State of Generative AI in the Enterprise 2024 Q4 / press release](https://www2.deloitte.com/us/en/pages/about-deloitte/articles/press-releases/state-of-generative-ai.html)
- `R7` [NBER, Workplace Adoption of Generative AI](https://www.nber.org/digest/202412/workplace-adoption-generative-ai)
- `R8` [Microsoft, Investing in Training Opportunities to Close the AI Skills Gap](https://techcommunity.microsoft.com/blog/microsoftvivablog/research-drop-investing-in-training-opportunities-to-close-the-ai-skills-gap/4389566)
- `R9` [LinkedIn Learning, 2025 Workplace Learning Report](https://learning.linkedin.com/resources/workplace-learning-report)
- `R10` [ISACA, 2025 AI Pulse Poll](https://www.isaca.org/ai-pulse-poll)
- `R11` [WRITER, 2025 enterprise AI adoption report](https://writer.com/blog/enterprise-ai-adoption-survey-press-release/)
- `R12` [AWS, financial workflows with generative AI for email automation](https://aws.amazon.com/blogs/machine-learning/streamline-financial-workflows-with-generative-ai-for-email-automation/)
- `R13` [AWS, account planning assistant in AWS Sales](https://aws.amazon.com/blogs/machine-learning/how-aws-sales-uses-generative-ai-to-streamline-account-planning/)
- `R14` [Lessons for GenAI Literacy From a Field Study of Human-GenAI Augmentation in the Workplace](https://arxiv.org/abs/2502.00567)
- `C1` [Reddit /r/humanresources: Anyone used ChatGPT for work?](https://www.reddit.com/r/humanresources/comments/1afp579/anyone_used_chatgpt_for_work/)
- `C2` [Reddit /r/ChatGPT: meeting workflow hack](https://www.reddit.com/r/ChatGPT/comments/1gqzzhz/whats_your_chatgpt_meeting_workflow_hack/)
- `C3` [Reddit /r/ChatGPT: workplace blocked ChatGPT](https://www.reddit.com/r/ChatGPT/comments/1jspodw/my_workplace_blocked_chatgpt_and_ive_never_felt/)
- `C4` [Hacker News: summarization limitations discussion](https://news.ycombinator.com/item?id=41027658)

### B. Real Use Cases
| Use Case | Context / Task | How LLM is used | Outcome | Sources |
|---|---|---|---|---|
| Email drafting and rewrite | Routine internal and external email writing | Drafting, tone shifting, shortening, polishing | Faster communications, but proofreading remains necessary | `C1` |
| Bilingual corporate communication | Multilingual office environments | Drafting the same message in two languages | Time savings and broader internal reach | `C1` |
| Policy and handbook rewrite | HR communications | Rewriting policies to a target reading level | Faster first drafts and simplification of formal text | `C1` |
| Newsletters and announcements | Internal comms | Drafting articles, announcements, newsletters | Less blank-page effort and quicker publication cycles | `C1` |
| Business cases and memos | Managerial communication | Structuring thoughts and drafting business cases | Better first-pass structure | `C1` |
| RFP response drafting | Sales and operations support | Drafting response sections and boilerplate | Faster turnaround on proposals | `C1` |
| Job postings and interview guides | HR and recruiting | Creating job ads, interview questions, candidate prompts | Higher drafting speed and broader option generation | `C1` |
| Presentation outlines and scripts | Office presentations | Outline generation, script shaping, time estimates | Better preparation speed | `C1` |
| Meeting summarization | Knowledge work and collaboration | Summarizing meetings and extracting key points | Faster recap work; still needs review for completeness | `R2`, `C4` |
| Meeting follow-ups | Team coordination | Turning transcripts into actions, summaries, follow-up emails | Cleaner handoffs after meetings | `C2`, `R2` |
| Customer service agent assist | Service operations | Drafting or assisting case resolution steps | Lower handling time and more independent resolution | `R2` |
| Information retrieval across work artifacts | Mail, files, calendars | Searching and retrieving work information | Faster finding and triage of information | `R2` |
| Writing and instructions | General knowledge work | Help with writing, searching, detailed instructions | Common mass-market use at work | `R7` |
| Spreadsheet support | Excel-heavy office tasks | Communications plus spreadsheet-oriented help | Useful for tabular or clerical support tasks | `C1` |
| Email attachment triage | Back-office document workflows | Extracting, classifying, summarizing emailed documents | Faster intake and routing | `R12` |
| Financial document extraction | Regulated document-heavy work | Extracting key values from large document sets | Reduced manual handling and better downstream readiness | `R12` |
| Sales account planning | Enterprise sales | Drafting account plans from internal and external sources | Large time savings on research-heavy planning | `R13` |
| CRM and deal workflow support | Sales operations | Updating records, recapping meetings, generating briefs from CRM context | Better flow-of-work inside CRM and Outlook/Teams | `R13`, `R2` |

### C. Negative Experiences
| Negative Experience | What breaks | Why it matters | Sources |
|---|---|---|---|
| Hallucinated summaries | Meeting or document summaries omit or distort key details | Trust collapses quickly in office settings | `C4`, `R3` |
| Copy-paste workflow | AI output lives only in chat and must be manually transferred | Users experience extra friction, not automation | `C2`, `ARCH-007` |
| Template mismatch | Draft looks plausible but does not fit the required form | Near-miss outputs create rework and frustration | `C1`, `R2` |
| Overformal or wrong tone | Corporate style comes out too stiff or misaligned | Users still need manual editing | `C1` |
| Weak policy/FAQ bots | Routine handbook questions still fail in practice | Teams stop trusting the bot for operational answers | `C1` |
| Shadow AI and blocked access | Employees use personal tools because approved tools are absent or blocked | Governance and actual practice drift apart | `R11`, `C3` |
| Regulated-work bans | Some workplaces or contractors prohibit open tools | Adoption stalls or moves underground | `C1` |
| Poor ROI from patchwork tools | Expensive rollouts still disappoint | Organizations lose patience before scale | `R11`, `R6` |
| Siloed adoption | IT and business teams move separately | Internal conflict slows value capture | `R11`, `R4` |
| Inaccuracy as recognized enterprise risk | Organizations see incorrect output as the most common negative consequence | Risk management becomes adoption-critical | `R3` |
| Low repeatability | Individual experimentation produces isolated wins only | The organization never gets a stable workflow | `R4`, `R6` |
| User overreliance or skill atrophy concerns | Some workers worry they stop brainstorming or writing independently | Adoption generates ambivalence, not only enthusiasm | `C1` |

### D. Best Practices
| Practice | Why it appears repeatedly | Sources |
|---|---|---|
| Start with narrow repeatable workflows | Easier to scale than open-ended experimentation | `R4`, `R6` |
| Integrate into existing systems | Better integration is repeatedly cited as a scaling enabler | `R4` |
| Use structured outputs | Makes validation and downstream handling easier | `R12`, `R13` |
| Separate data from final document | Reduces template mismatch and manual cleanup | `R12`, `R13` |
| Put validation after generation | Keeps workflows from collapsing into blind trust | `R12`, `R3` |
| Add human-in-the-loop for low-confidence cases | Especially important in regulated and high-risk processes | `R12` |
| Use role-based prompting | Different workflows need different task framing | `R14`, `R13` |
| Save prompt templates by scenario | Community users report better consistency across meeting types | `C2` |
| Chunk large documents | Helps mitigate summary drift on long inputs | `C4` |
| Use approved enterprise tools where possible | Reduces shadow AI and security drift | `R11`, `R10` |
| Build a formal AI strategy | Clear organizational strategy correlates with stronger adoption | `R11` |
| Activate AI champions | Champion networks repeatedly appear as adoption accelerators | `R11`, `R13` |
| Align with business value, not novelty | Adoption for its own sake does not create value | `R4` |
| Shift risk review earlier | High performers involve legal and risk functions early | `R3`, `R6` |
| Measure adoption and impact with dashboards | Data-backed adoption programs adjust faster | `R13` |
| Use internal data and context carefully | Customization raises relevance when governance is in place | `R13`, `R3` |
| Keep employees in the flow of work | Tools embedded in Outlook, Teams, CRM or email workflows stick better | `R2`, `R13` |
| Use training plus process redesign together | Training alone is weaker than training tied to real workflows | `R8`, `R9` |

### E. Training Methods
| Method | What it teaches | Why it matters | Sources |
|---|---|---|---|
| Enterprise-wide AI literacy programs | Baseline understanding of AI risks, limits and use | Higher confidence and better value realization | `R8` |
| Role-specific upskilling | Different roles get different depth of training | Workplace use varies by function, so training should too | `R14`, `R5` |
| Prompt engineering classes for functional teams | Practical prompting around real work tasks | Bridges generic AI literacy and daily use | `R5`, `R13` |
| Technical bootcamps for builders | Libraries, tooling, model customization | Needed for technical teams, not all users | `R5` |
| Scenario-based training | Real workflows, prompts and expected outputs | Ties learning to day-to-day work | `R13` |
| Hands-on skilling sessions | Guided experimentation with approved tools | Increases fluency and early wins | `R13` |
| AI champions / influencer networks | Peer support, local help, grassroots adoption | Makes practice visible and transferable | `R11`, `R13` |
| Manager-sponsored adoption | Leadership endorsement and time allocation | Reduces fear and increases legitimacy | `R13`, `R9` |
| Gamified campaigns and competitions | Skill-building through low-friction engagement | Helps adoption feel safe and practical | `R13` |
| Equitable access to training time | Time to learn, not just content to consume | Employees cannot adopt what they are not equipped to use | `R8` |
| Continuous learning plus career mobility | AI learning tied to growth and internal moves | Stronger retention and motivation | `R9` |
| Safe-sandbox practice | Rehearsal without production risk | Useful for sales, communication and prompt iteration | `R9`, `R13` |

### F. Patterns and Insights
Из корпуса повторяются несколько устойчивых паттернов.

1. Большинство массовых use cases все еще chat-first. Наиболее распространенные сценарии связаны с письмом, поиском информации, инструкциями и первым черновиком, а не с end-to-end automation. Это хорошо согласуется с `ARCH-007`: офисный пользователь обычно начинает с чата, а не с workflow. `R7`, `C1`

2. Наиболее зрелые пользователи смещаются от текста к процессу. Enterprise examples из Microsoft и AWS показывают, что устойчивую ценность дают не "умные ответы", а встроенные процессы: account planning, customer service assist, document intake, CRM-connected work. Это подтверждает `ARCH-009`. `R2`, `R12`, `R13`

3. Structured outputs и workflow integration реально снижают хаос. Практические implementation notes снова и снова показывают, что extraction, classification, summarization, JSON-like field generation и human review работают лучше, чем попытка сразу получить идеальный документ. Это подтверждает `ARCH-008`. `R12`, `R13`

4. Adoption часто опережает governance. Исследования McKinsey, Writer и ISACA показывают разрыв между реальным использованием и зрелостью политики, обучения и формального управления. Это объясняет, почему работники одновременно используют AI и не доверяют ей организационно. `R3`, `R10`, `R11`

5. Power users и ordinary users действительно живут в разных режимах. Microsoft и community evidence показывают разницу между людьми, которые строят шаблоны, workflows и champion networks, и теми, кто просто пишет короткие запросы в чат. Это подтверждает исходную доменную гипотезу про gap между power users и массовым офисным пользователем. `R2`, `R4`, `C2`

6. Обучение влияет не только на skill, но и на adoption. Несколько источников прямо связывают training с частотой использования, уверенностью и ощущаемой ценностью. Корпоративная AI literacy оказывается не nice-to-have, а частью operational design. `R8`, `R9`, `R13`, `R14`

### G. Implications for the Domain
Для текущего домена это дает несколько прямых следствий.

Во-первых, `ARCH-007` подтверждается внешним материалом: negative UX чаще связан не с "плохой моделью", а с workflow mismatch, отсутствием training, плохой task formulation и слабой интеграцией.

Во-вторых, `ARCH-008` получает сильную эмпирическую опору: реальные практики чаще идут через extraction, classification, summaries, CRM fields, account-plan sections и other structured intermediates, чем через final-document generation.

В-третьих, `ARCH-009` подтверждается особенно явно: устойчивые кейсы почти всегда имеют процессный контур с context, structured output, validation, downstream system и human review.

В-четвертых, следующий слой домена уже просматривается достаточно отчетливо:
- `Office AI Adoption Playbook`;
- `Adaptive Prompting Systems`;
- `Seminar Teaching Model`.

## Acceptance / Validation
Документ достаточен, если:

1. Содержит внешний research synthesis, а не повтор существующих внутренних notes.
2. Опирается на реальные workplace reports, practical writeups и community evidence.
3. Покрывает use cases, negative experiences, best practices и training methods.
4. Остается в границах `LLM usage in office work`.
5. Укрепляет существующую доменную связку `Problem -> Solution -> Process`.

## Related
- docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/INDEX.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-004.ai.office-work-taxonomy.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-006.ai.office-work-research-directions.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-008.ai.office-work-structured-outputs.v0.1.md
- docs/seminar/LLM_OFFICE_WORK/ARCH-009.ai.office-work-workflow-integration.v0.1.md

## Open Questions / TODO
1. Какие use cases действительно устойчивы для массового office adoption, а какие пока удерживаются только power users.
2. Какие training methods дают лучший эффект в коротком корпоративном формате: scenario-based practice, champions model или role-specific bootcamps.
3. Нужен ли следующим шагом `Office AI Adoption Playbook` или сначала стоит оформить `Adaptive Prompting Systems`.
