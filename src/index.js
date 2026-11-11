import Resolver from '@forge/resolver';
import { kvs, WhereConditions } from '@forge/kvs';
import api, { route } from '@forge/api';
import * as R from './rules';

const resolver = new Resolver();
const sysKey = (id) => `system:${id}`;
const linkKey = (issueKey) => `issue:${issueKey}`;

// Free plan has no custom permissions, so the app keeps its own reviewer list:
// `forge variables set REVIEWERS <accountId>,<accountId>`. Empty = nobody can approve.
const isReviewer = (accountId) => (process.env.REVIEWERS ?? '').split(',').map((s) => s.trim()).includes(accountId);

function issueKeyOf(req) {
  // shortcut: falls back to the key the panel sends if the context lacks it; drop the fallback once confirmed on a live site.
  const key = req.context.extension?.issue?.key ?? req.payload?.issueKey;
  if (!/^[A-Z][A-Z0-9_]+-\d+$/.test(key ?? '')) throw new Error('No issue in context.');
  return key;
}

async function allSystems() {
  const out = [];
  let cursor;
  do {
    let q = kvs.query().where('key', WhereConditions.beginsWith('system:')).limit(100);
    if (cursor) q = q.cursor(cursor);
    const page = await q.getMany();
    out.push(...page.results.map((r) => r.value));
    cursor = page.nextCursor;
  } while (cursor);
  return out;
}

const linked = async (issueKey) => {
  const id = await kvs.get(linkKey(issueKey));
  return id ? kvs.get(sysKey(id)) : null;
};

function view(s) {
  return { ...s, evals: R.evalRows(s.tier, s.evals), status: R.statusOf(s), blockers: R.blockers(s), needsSignoff: R.needsSignoff(s.tier) };
}

async function save(s, by, action, detail = '', fromTier = s.tier) {
  s.updatedAt = new Date().toISOString();
  // shortcut: keeps the last 200 history entries to stay under the 240 KiB value limit; move to separate keys if audits need more.
  s.history = [...(s.history ?? []), { at: s.updatedAt, by, action, detail, fromTier, toTier: s.tier }].slice(-200);
  await kvs.set(sysKey(s.id), s);
}

// Any change after approval sends the system back for review.
function resetApproval(s) {
  if (s.review !== 'approved') return '';
  s.review = 'pending';
  return ' (approval reset)';
}

async function panel(req) {
  const issueKey = issueKeyOf(req);
  const system = await linked(issueKey);
  const systems = (await allSystems()).map(({ id, name, tier }) => ({ id, name, tier }));
  return { issueKey, system: system && view(system), systems, isReviewer: isReviewer(req.context.accountId), questions: R.QUESTIONS, rulesVersion: R.RULES_VERSION };
}

// Runs fn on the issue's linked system, then returns the fresh panel.
const onSystem = (fn) => async (req) => {
  const s = await linked(issueKeyOf(req));
  if (!s) throw new Error('Link this ticket to an AI system first.');
  await fn(s, req.payload ?? {}, req.context.accountId);
  return panel(req);
};

resolver.define('getPanel', panel);

resolver.define('createSystem', async (req) => {
  const name = String(req.payload?.name ?? '').trim().slice(0, 100);
  if (!name) throw new Error('Give the system a name.');
  const r = R.assess({});
  const s = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, issues: [], ...r, rulesVersion: R.RULES_VERSION, assessedAt: null, reviewBy: null };
  await save(s, req.context.accountId, 'Registered system');
  return linkTo(req, s.id);
});

resolver.define('linkSystem', (req) => linkTo(req, String(req.payload?.systemId ?? '')));

async function linkTo(req, systemId) {
  const issueKey = issueKeyOf(req);
  const s = await kvs.get(sysKey(systemId));
  if (!s) throw new Error('System not found.');
  const old = await linked(issueKey);
  if (old && old.id !== s.id) {
    old.issues = old.issues.filter((k) => k !== issueKey);
    await save(old, req.context.accountId, 'Unlinked ticket', issueKey);
  }
  if (!s.issues.includes(issueKey)) {
    s.issues.push(issueKey);
    await save(s, req.context.accountId, 'Linked ticket', issueKey);
  }
  await kvs.set(linkKey(issueKey), s.id);
  return panel(req);
}

resolver.define('saveAssessment', onSystem(async (s, p, by) => {
  const from = s.tier, now = new Date().toISOString();
  Object.assign(s, R.assess(p.answers), { rulesVersion: R.RULES_VERSION, assessedAt: now });
  s.reviewBy = R.reviewByDate(s.tier, now);
  await save(s, by, 'Assessed', `Rules ${R.RULES_VERSION}${resetApproval(s)}`, from);
}));

resolver.define('saveEvals', onSystem(async (s, p, by) => {
  s.evals = R.evalRows(s.tier, Array.isArray(p.evals) ? p.evals : []);
  await save(s, by, 'Updated evals', s.evals.map((e) => `${e.metric}: ${e.status}`).join('; ') + resetApproval(s));
}));

resolver.define('setException', onSystem(async (s, p, by) => {
  s.exception = String(p.reason ?? '').trim().slice(0, 1000);
  await save(s, by, s.exception ? 'Logged exception' : 'Cleared exception', s.exception + resetApproval(s));
}));

resolver.define('review', onSystem(async (s, p, by) => {
  if (!isReviewer(by)) throw new Error('Only listed reviewers can approve or reject.');
  if (!R.needsSignoff(s.tier)) throw new Error(`${s.tier} systems don't need sign-off.`);
  const approve = p.decision === 'approve';
  if (approve && R.blockers(s).length) throw new Error('Approval is blocked: ' + R.blockers(s).join(' '));
  s.review = approve ? 'approved' : 'rejected';
  if (approve) s.reviewBy = R.reviewByDate(s.tier, new Date());
  await save(s, by, approve ? 'Approved' : 'Rejected', String(p.note ?? '').trim().slice(0, 1000));
}));

resolver.define('getRegister', async () => (await allSystems()).map(view).map(({ history, answers, ...row }) => row));

export const handler = resolver.getDefinitions();

const isYes = (v) => (Array.isArray(v) ? v.some(isYes) : /^yes$/i.test(String(v?.value ?? v ?? '')));

// Workflow validator: attach to the "Done" transition of a company-managed workflow.
export async function validate(event) {
  const key = event.issue.key;
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${key}?fields=*all&expand=names`);
  if (!res.ok) return { result: false, errorMessage: `AI check couldn't read ${key} (${res.status}).` };
  const issue = await res.json();
  const usesAiField = Object.keys(issue.names ?? {}).find((id) => issue.names[id] === 'Uses AI?');
  const isAi = (issue.fields.labels ?? []).includes('ai') || (usesAiField && isYes(issue.fields[usesAiField]));
  if (!isAi) return { result: true };
  const error = R.closeError(await linked(key));
  return error ? { result: false, errorMessage: error } : { result: true };
}
