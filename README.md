# Tierwise

**An EU AI Act risk register that lives inside Jira.** Engineers and PMs answer six questions about an AI system. Tierwise gives it a risk tier and explains why. High-risk systems can't ship until their evals pass and a reviewer signs off.

Built on Atlassian Forge and running on a live Jira Cloud site. It's a portfolio project on AI governance, evals and product design.

<img src="docs/screens/register.png" alt="AI Register page in Jira listing five AI systems: Resume Screener High approved, Customer support chatbot Limited, Meeting notes summariser Minimal, Credit limit model Needs input, Staff mood monitor Prohibited pending">

*The site-wide AI Register: one row per AI system, with its tier, review status, review-by date, flags and linked tickets.*

---

## The demo in five screens

A team is building a **resume screener**. Six questions put it in the **High** tier, citing Annex III §4. Here's what happens next.

| | |
|---|---|
| **1. Evals for the tier.** High risk needs accuracy, hallucination rate, bias across groups and human-override rate. A row only passes with a result, an evidence link and a date. The bias ratio is 0.6, under the 0.8 target. | <img src="docs/screens/1-evals-bias-fails.png" width="380" alt="Eval checklist with three passes and the bias row failing"> |
| **2. The reviewer can't approve.** Approve stays disabled until every eval passes or an exception is logged with a reason. Changing an eval also reset the earlier approval to pending. | <img src="docs/screens/2-approval-blocked.png" width="380" alt="Sign-off tab: can't be approved yet, eval fail on bias, Approve disabled"> |
| **3. Fixed, re-run, approved.** The bias ratio is now 0.85. The reviewer approves with a note, and the change history records who did what and when, including the reset. | <img src="docs/screens/3-approved-history.png" width="380" alt="Resume Screener High, approved, with change history entries"> |
| **4. "Not sure" never becomes a low tier.** For the credit model, one oversight answer is missing, so it's **Needs input**, with "at least High once complete" so nobody mistakes it for low risk. | <img src="docs/screens/4-needs-input.png" width="380" alt="Credit limit model: Needs input, High under Annex III section 5, at least High once complete"> |
| **5. Jira enforces it.** A workflow rule stops AI tickets from moving to Done until their system is assessed, and approved if it's High or Prohibited. | <img src="docs/screens/5-workflow-blocked.png" width="380" alt="Jira ticket Staff mood monitor rated Prohibited, with toast: Transition failed, needs reviewer approval first"> |

---

## How a tier is decided

| Answer | Tier | Basis |
|---|---|---|
| Social scoring, manipulation, emotion recognition at work/school | **Prohibited** | Art. 5 |
| Hiring, education, credit/insurance, biometrics, critical infrastructure | **High** | Annex III |
| Chatbot, generated content, or external users interact directly | **Limited** | Art. 50 (disclosure) |
| Internal productivity, recommendations, spam filtering | **Minimal** | none specific |
| Any "Not sure" or missing answer | **Needs input** | never guess low |

- **Several uses:** the highest tier wins.
- **Re-check needed:** every assessment stores the rules version it was made under. Changing the rules flags old assessments for a re-check.
- **Review-by dates:** High systems are due for review after 6 months and Limited after 12. Past that date they show as **Overdue** in the register.

## Design decisions

- **Systems, not tickets.** One AI system spans many tickets. Assessing each ticket would produce conflicting tiers for the same model.
- **"Not sure" is a valid answer, and it blocks.** It's better to surface a gap than to let someone guess Minimal to get past the form.
- **Explain every tier.** Each result names the article or annex behind it, so a reviewer can disagree with something specific.
- **Evidence over checkboxes.** An eval doesn't pass on a number alone: it also needs a link and a run date. Teams can make targets stricter, never looser.
- **Any change sends it back to review.** Editing answers, evals or an exception after approval resets the system to pending.
- **One rules file, versioned.** All the policy lives in [`src/rules.js`](src/rules.js), which a compliance owner can read in one sitting.

## What I cut, and why

| Cut | Why |
|---|---|
| AI-suggested answers | The point is a human owning the assessment. Autofill invites rubber-stamping. |
| Detecting AI tickets from their text | A label or field is explicit and auditable. Guessing isn't. |
| Multi-jurisdiction rules | EU AI Act only. One clear rule set beats a shallow many. |
| Rule-editing screen | The rules are code with tests. A UI can come once there's a rules owner. |
| **v2:** email reminders, CSV export, JQL search by tier, pulling eval results from CI | Useful, but not needed to prove the workflow. |

## Known limits

- Answers and eval numbers are self-reported. Evidence links are required, but nobody checks what they point to.
- On Jira's Free plan the reviewer list is enforced by the app, not by Jira permissions.
- The rules need an owner to keep them in step with the AI Act and its guidance.
- **A guide, not legal advice.**

---

## How it's built

| Piece | File |
|---|---|
| Rules: questions, tiers, eval templates, review periods | [`src/rules.js`](src/rules.js) |
| Tests (12, incl. the demo story end to end) | [`test/rules.test.js`](test/rules.test.js) |
| Backend: storage, sign-off, history, workflow validator | [`src/index.js`](src/index.js) |
| Ticket panel (UI Kit) | [`src/frontend/panel.jsx`](src/frontend/panel.jsx) |
| Site-wide AI Register page | [`src/frontend/register.jsx`](src/frontend/register.jsx) |

Forge modules: `jira:issuePanel`, `jira:globalPage`, `jira:workflowValidator`. Storage is Forge KVS, with no external servers.

```bash
npm test
```

<details>
<summary><b>Run it on your own Jira site</b></summary>

1. Create a free Jira Cloud site and a **company-managed** Scrum space (key `HR`).
2. Create an API token at id.atlassian.com/manage-profile/security/api-tokens.
3. Install the CLI and log in:
   ```bash
   npm install -g --allow-scripts=@forge/cli,cloudflared,keytar @forge/cli
   ```
   ```bash
   forge login
   ```
4. Register, deploy and install:
   ```bash
   forge register
   ```
   ```bash
   forge deploy
   ```
   ```bash
   forge install --site <your-site>.atlassian.net --product jira
   ```
5. Name the reviewers (accountIds, comma-separated), then deploy again:
   ```bash
   forge variables set REVIEWERS <accountId>
   ```
6. Add the rule: **Space settings → Workflows → edit → "Done" transition → Validate details → + → "AI ticket has an assessed AI system"**, then **Update workflow**.
7. Tickets count as AI if they have the label `ai`, or if an optional "Uses AI?" field is set to Yes.

</details>
