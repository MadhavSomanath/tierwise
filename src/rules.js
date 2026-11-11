// All governance rules live here. Bump RULES_VERSION on any change: systems assessed
// under an older version get a "Re-check needed" flag.
export const RULES_VERSION = '2026-11-01';

export const UNSURE = 'unsure';
const RANK = { Minimal: 0, Limited: 1, High: 2, Prohibited: 3 };
const notSure = { value: UNSURE, label: 'Not sure' };

export const QUESTIONS = [
  {
    id: 'use', label: 'What is the AI used for? (pick all that apply)', multi: true,
    options: [
      { value: 'social_scoring', label: 'Scoring people on social behaviour', tier: 'Prohibited', why: 'social scoring (Art. 5(1)(c))' },
      { value: 'manipulation', label: 'Manipulating behaviour or exploiting vulnerabilities', tier: 'Prohibited', why: 'manipulative AI (Art. 5(1)(a)-(b))' },
      { value: 'emotion_work', label: 'Emotion recognition at work or school', tier: 'Prohibited', why: 'emotion recognition at work/school (Art. 5(1)(f))' },
      { value: 'hiring', label: 'Hiring, promotion or firing decisions', tier: 'High', why: 'employment decisions (Annex III §4)' },
      { value: 'education', label: 'Admissions or grading students', tier: 'High', why: 'education and training (Annex III §3)' },
      { value: 'credit', label: 'Credit scoring or life/health insurance pricing', tier: 'High', why: 'access to essential services (Annex III §5)' },
      { value: 'biometric', label: 'Identifying or categorising people by biometrics', tier: 'High', why: 'biometrics (Annex III §1)' },
      { value: 'infrastructure', label: 'Safety component of critical infrastructure', tier: 'High', why: 'critical infrastructure (Annex III §2)' },
      { value: 'chatbot', label: 'Chatbot or assistant that talks to people', tier: 'Limited', why: 'people must be told they are talking to AI (Art. 50(1))' },
      { value: 'generated_content', label: 'Generating images, audio, video or text to publish', tier: 'Limited', why: 'AI-generated content must be marked (Art. 50(2), 50(4))' },
      { value: 'internal_tool', label: 'Internal productivity (summaries, code help, search)', tier: 'Minimal', why: 'no specific obligations' },
      { value: 'recommendation', label: 'Recommendations, ranking or spam filtering', tier: 'Minimal', why: 'no specific obligations' },
      notSure,
    ],
  },
  {
    id: 'data', label: 'What data does it use?',
    options: [
      { value: 'none', label: 'No personal data' },
      { value: 'personal', label: 'Personal data' },
      { value: 'special', label: 'Sensitive data (health, biometrics, ethnicity…)', note: 'Sensitive personal data (GDPR Art. 9): a privacy impact assessment is needed outside this tool.' },
      notSure,
    ],
  },
  {
    id: 'affected', label: "Who is affected by its outputs?",
    options: [
      { value: 'staff', label: 'Our staff only' },
      { value: 'customers', label: 'Customers or the public' },
      { value: 'vulnerable', label: 'Children or other vulnerable groups' },
      notSure,
    ],
  },
  {
    id: 'oversight', label: 'How much does a human check its outputs?',
    options: [
      { value: 'human_decides', label: 'A human makes every final decision' },
      { value: 'human_samples', label: 'A human reviews samples' },
      { value: 'automated', label: 'Fully automated' },
      notSure,
    ],
  },
  {
    id: 'exposure', label: 'Do people outside the company interact with it directly?',
    options: [
      { value: 'internal', label: 'No, internal only' },
      { value: 'external', label: 'Yes', tier: 'Limited', why: 'external users interact with it, so it must disclose it is AI (Art. 50(1))' },
      notSure,
    ],
  },
  {
    id: 'source', label: 'Where does the model come from?',
    options: [
      { value: 'inhouse', label: 'Built in-house' },
      { value: 'vendor', label: 'Third-party API', note: 'Vendor model: we are the deployer; get the provider\'s instructions for use (Art. 13, 26).' },
      { value: 'open', label: 'Open-source model we host' },
      notSure,
    ],
  },
];

export const REVIEW_MONTHS = { High: 6, Limited: 12 };

// dir: '>=' means higher is better. Targets can be tightened per system, never loosened.
export const EVALS = {
  High: [
    { metric: 'Accuracy', dir: '>=', target: 0.9 },
    { metric: 'Hallucination rate', dir: '<=', target: 0.02 },
    { metric: 'Bias: lowest ÷ highest group selection rate', dir: '>=', target: 0.8 },
    { metric: 'Human-override rate', dir: '<=', target: 0.15 },
  ],
  Limited: [
    { metric: 'AI disclosure shown (1 = yes)', dir: '>=', target: 1 },
    { metric: 'Harmful-output rate', dir: '<=', target: 0.01 },
  ],
};

export const needsSignoff = (tier) => tier === 'High' || tier === 'Prohibited';

// Returns cleaned answers, the tier and the "why". Never guesses low: any "Not sure"
// or missing answer gives Incomplete, unless a Prohibited use is already known.
export function assess(input = {}) {
  const answers = {}, reasons = [], notes = [];
  let tier = 'Minimal', unsure = false;
  for (const q of QUESTIONS) {
    const vals = [].concat(input?.[q.id] ?? []).filter((v) => q.options.some((o) => o.value === v));
    answers[q.id] = q.multi ? vals : vals[0];
    if (!vals.length || vals.includes(UNSURE)) { unsure = true; reasons.push(`Needs input: ${q.label}`); }
    for (const o of q.options.filter((o) => vals.includes(o.value))) {
      if (o.tier) {
        reasons.push(`${o.tier}: ${o.why}`);
        if (RANK[o.tier] > RANK[tier]) tier = o.tier;
      }
      if (o.note) notes.push(o.note);
    }
  }
  if (tier === 'High' && answers.oversight === 'automated') notes.push('High risk needs effective human oversight (Art. 14): fully automated is a gap.');
  if (tier === 'High' && answers.affected === 'vulnerable') notes.push('Affects vulnerable groups: weigh this in the bias eval and the review.');
  if (unsure && tier !== 'Prohibited') {
    if (tier !== 'Minimal') reasons.push(`At least ${tier} once complete.`);
    tier = 'Incomplete';
  }
  return { answers, tier, reasons, notes };
}

export function reviewByDate(tier, from) {
  const months = REVIEW_MONTHS[tier];
  if (!months) return null;
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

const str = (v, max) => String(v ?? '').trim().slice(0, max);

// Merges saved values onto the tier's eval template, sanitised, with pass/fail.
export function evalRows(tier, saved = []) {
  return (EVALS[tier] ?? []).map((t) => {
    const s = saved.find((e) => e?.metric === t.metric) ?? {};
    const own = str(s.target, 20) === '' ? NaN : Number(s.target);
    const target = Number.isFinite(own) ? (t.dir === '>=' ? Math.max(t.target, own) : Math.min(t.target, own)) : t.target;
    const evidence = /^https?:\/\/\S+$/.test(str(s.evidence, 500)) ? str(s.evidence, 500) : '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(str(s.date, 10)) ? str(s.date, 10) : '';
    const row = { metric: t.metric, dir: t.dir, target, result: str(s.result, 20), evidence, date };
    return { ...row, status: evalStatus(row) };
  });
}

export function evalStatus({ dir, target, result, evidence, date }) {
  const r = Number(result);
  if (result === '' || !Number.isFinite(r) || !evidence || !date) return 'missing';
  return (dir === '>=' ? r >= target : r <= target) ? 'pass' : 'fail';
}

// Reasons a reviewer can't approve yet. Empty = approvable.
export function blockers(s) {
  const b = [];
  if (s.tier === 'Incomplete') b.push('Finish the assessment: some answers are "Not sure" or missing.');
  if (s.rulesVersion !== RULES_VERSION) b.push('Re-check the assessment: the rules changed since it was done.');
  if (s.exception) return b;
  if (s.tier === 'Prohibited') b.push('Prohibited use: only a logged exception with a legal basis can unblock this.');
  for (const e of evalRows(s.tier, s.evals)) if (e.status !== 'pass') b.push(`Eval ${e.status}: ${e.metric}`);
  return b;
}

export function statusOf(s, now = new Date()) {
  return {
    review: needsSignoff(s.tier) ? s.review ?? 'pending' : 'not required',
    needsInput: s.tier === 'Incomplete',
    recheck: s.rulesVersion !== RULES_VERSION,
    overdue: !!s.reviewBy && new Date(s.reviewBy) < now,
  };
}

// Workflow rule: error message if an AI ticket can't move to Done, else null.
export function closeError(s) {
  if (!s) return 'This is an AI ticket: link it to an AI system in the "AI Risk Assessment" panel first.';
  if (s.tier === 'Incomplete') return `AI system "${s.name}" needs its assessment finished first.`;
  if (needsSignoff(s.tier) && s.review !== 'approved') return `AI system "${s.name}" is ${s.tier} risk and needs reviewer approval first.`;
  return null;
}
