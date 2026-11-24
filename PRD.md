# Tierwise: Product Requirements

**Status:** Draft · **Updated:** 2026-11-24 · **Stage:** working Forge app, not yet tested with a real team

## 1. Summary

- **Problem:** teams track AI risk in a spreadsheet that gets filled in once and never opened again. The work happens in Jira, so the risk check is disconnected from the tickets that ship the system.
- **Idea:** put the EU AI Act risk check inside Jira, attach it to the AI *system* rather than the ticket, and make it block work instead of just recording it.
- **Product:** a Jira app. Six questions give each AI system a risk tier with the article or annex behind it. High-risk and prohibited systems can't close a ticket until the evals pass and a reviewer signs off.
- **North-star metric:** share of AI systems in active development that have a current, approved assessment. Target: 90% within 8 weeks of install (proposed, not measured).

## 2. Problem and evidence

| Finding | Source | What it means |
|---|---|---|
| AI risk lives in a spreadsheet nobody reopens | My own observation from risk work | The check must sit where the work happens |
| An existing Marketplace app rates risk per ticket with a questionnaire | Jira Marketplace | Per-ticket rating gives one model several ratings. Track systems instead |
| One model can touch twenty tickets | Product reasoning | A register of systems, linked to tickets |
| A rating with no consequence gets clicked through | Product reasoning | The sign-off has to block the Done transition |

Evidence so far is one practitioner's view plus one competitor. Section 9 lists what needs validating.

## 3. Users

| User | Job | What they need from Tierwise |
|---|---|---|
| Product or engineering lead | Ship the AI feature | Know early if it's high risk and what evidence is needed |
| Compliance or risk reviewer | Approve or block | A tier with a reason they can disagree with, eval evidence with links, a history |
| Head of risk or audit | Prove control | One register of every AI system, its tier and its review dates |

## 4. Goals and metrics

| Type | Metric | Target (proposed) |
|---|---|---|
| North star | AI systems in development with a current approved assessment | ≥ 90% by week 8 |
| Activation | Team assesses its first system within 7 days of install | ≥ 70% |
| Quality | Assessments left on Needs input for more than 14 days | ≤ 10% |
| Guardrail | Approvals made through a logged exception, not passing evals | ≤ 15% |
| Guardrail | Median time from "evals pass" to sign-off | ≤ 3 working days |

The guardrails stop the product from turning into a rubber stamp (too many exceptions) or a bottleneck (slow sign-off).

## 5. Scope

| Priority | Requirement |
|---|---|
| Must | Register page: one row per AI system with tier, review status, next review date and linked tickets |
| Must | Six-question assessment that returns a tier and names the Article 5, Annex III or Article 50 basis |
| Must | "Not sure" or blank gives Needs input, shown as "at least High once complete" where that applies |
| Must | Eval checklist per tier. High risk needs accuracy, hallucination rate, bias across groups and human override rate, each with a value, an eval-run link and a date |
| Must | Approve stays disabled until every eval passes. The only bypass is a logged exception with a reason |
| Must | Workflow validator: an AI ticket can't move to Done until its system is assessed, and approved if High or Prohibited |
| Must | Any change after approval (answers, evals, exception) sends it back to review, recorded in history |
| Should | Review cycle: High every 6 months, Limited every 12. Each assessment stores its rules version, and rule changes flag older ones |
| Should | Teams can make an eval target stricter, never looser |
| Could | Email reminders, CSV export, search by tier, automatic eval import |
| Won't (now) | AI autofill of answers, detecting AI tickets from text, non-EU rules, a rules-editing screen |

## 6. Tier rules

| If the system is used for | Tier | Basis |
|---|---|---|
| Social scoring, manipulation, emotion recognition at work or school | Prohibited | Article 5 |
| Hiring, education, credit or insurance, biometrics, critical infrastructure | High | Annex III |
| Chatbots, generated content, anything users talk to directly | Limited | Article 50 |
| Internal tools, recommendations, spam filtering | Minimal | None specific |
| Any "Not sure" or blank answer | Needs input | |

A system with several uses takes the highest tier. All rules live in `src/rules.js`, short enough for a compliance reviewer to read.

## 7. Key decisions and trade-offs

| Decision | Why | Cost |
|---|---|---|
| Track systems, not tickets | One model, one rating | Teams have to link tickets to a system |
| "Not sure" blocks progress | A visible gap beats a false Minimal | More friction early on |
| Evals need a link and a date | A bare number proves nothing | More work for the team |
| No AI autofill | A person must own the assessment | Slower first assessment |
| A label marks AI tickets, no text detection | Clear and auditable | Relies on people adding the label |
| EU AI Act only | Do one framework properly | No value yet for non-EU teams |

## 8. Launch and rollback criteria

**Pilot:** one company-managed Jira space, one reviewer, 3-5 real AI systems, 4 weeks.

Move from pilot to wider rollout when all of these hold:
- Every pilot system has an assessment, and at least one went through a full eval and sign-off.
- The reviewer agrees with the tier on at least 4 of 5 systems.
- No ticket was blocked by a bug rather than a real rule.

Roll back (turn off the Done validator and keep the register read-only) if:
- The validator blocks a release that the reviewer says should have passed, twice in the pilot.
- Exceptions exceed 30% of approvals, a sign the evals are too strict or the process is being worked around.

## 9. Risks and open questions

| Risk or question | Mitigation or next step |
|---|---|
| Answers and eval numbers are self-reported. The app checks that a link exists, not what it shows | Reviewer spot-checks links. Automatic eval import is a later Could |
| The Jira free plan has no custom permissions | The app keeps its own reviewer list |
| AI Act guidance keeps changing | Rules are versioned, and older assessments get flagged on change. Needs a named owner |
| Is a blocking validator acceptable to engineering teams? | Test in the pilot, with the roll-back rule above |
| Who pays, risk or engineering? | Interview 3 risk leads and 3 engineering leads before pricing |
| It's guidance, not legal advice | Say so in the app and the listing |

## 10. Build notes

Atlassian Forge, no separate server, data in Forge storage. Backend in `src/index.js`, rules in `src/rules.js`, 12 tests in `test/rules.test.js`, including the resume screener end to end. See the README for setup.
