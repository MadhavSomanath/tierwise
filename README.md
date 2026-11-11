# Tierwise: AI risk register for Jira (Forge app)

Portfolio demo. Each AI **system** gets a 6-question EU AI Act risk assessment, a tier, an evals checklist and a reviewer sign-off. Tickets link to a system and inherit its tier. A workflow rule stops AI tickets from closing until their system is assessed (and approved, if High risk).

| Piece | File |
|---|---|
| Rules, tiers, eval templates, review-by periods (versioned) | `src/rules.js` |
| Rules tests | `test/rules.test.js` (`npm test`) |
| Backend: storage, sign-off, history, workflow validator | `src/index.js` |
| Ticket panel | `src/frontend/panel.jsx` |
| Site-wide AI Register page | `src/frontend/register.jsx` |

## Set up (you do these: they need your login)

1. Create a free Atlassian Cloud site at atlassian.com/software/jira/free. You are site admin.
2. Create a **company-managed** Scrum or Kanban project, e.g. key `HR`.
3. Create an API token at id.atlassian.com/manage-profile/security/api-tokens.
4. Install the CLI and log in:
   ```bash
   npm install -g @forge/cli
   ```
   ```bash
   forge login
   ```
5. In this folder, register the app (writes the real `app.id` into `manifest.yml`), then deploy and install:
   ```bash
   forge register
   ```
   ```bash
   forge deploy
   ```
   ```bash
   forge install --site <your-site>.atlassian.net --product jira
   ```
6. Name the reviewers. Find an accountId from your profile URL (`/jira/people/<accountId>`):
   ```bash
   forge variables set REVIEWERS <accountId1>,<accountId2>
   ```
   ```bash
   forge deploy
   ```
7. Add the workflow rule: Project settings → Workflows → edit the workflow (new editor) → select the transition into **Done** → Rules → Add rule → **AI ticket has an assessed AI system**. Publish.
8. Optional: add a "Uses AI?" select field (Yes/No) to the project. Tickets count as AI if they have the label `ai` **or** that field is Yes.

The AI Register page is under **Apps → AI Register**.

## Demo script (2 min)

1. Ticket `HR-1` "Resume screener", label `ai`. Try to move it to Done: blocked, "link it to an AI system".
2. Panel → register system "Resume screener" → answer: Hiring, Personal data, Customers or the public, Human reviews samples, Internal only, Third-party API → **High**, "employment decisions (Annex III §4)".
3. Evals tab: enter results with evidence links; bias = 0.6 → **fail**. Sign-off tab: Approve is disabled, "Eval fail: Bias…".
4. "Fix and re-run": bias = 0.85 → pass. Reviewer approves with a note. History shows who, what, when.
5. Move `HR-1` to Done: allowed. Open AI Register, filter Tier = High.

To show "Re-check needed": bump `RULES_VERSION` in `src/rules.js` and `forge deploy`.

## Known limits

- Answers and eval numbers are self-reported. Evidence links are required, but nobody checks what they point to.
- On the Free plan the app enforces reviewer permissions itself (`REVIEWERS` variable), not Jira.
- The rules need an owner to keep them current with the AI Act and its guidance. This is a guide, not legal advice.
- `jira:workflowValidator` is a Forge Preview module.
- History keeps the last 200 entries per system.
