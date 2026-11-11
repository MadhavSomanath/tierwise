import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assess, evalRows, blockers, statusOf, closeError, reviewByDate, RULES_VERSION } from '../src/rules.js';

const base = { data: 'personal', affected: 'customers', oversight: 'human_decides', exposure: 'internal', source: 'vendor' };
const passing = (tier) => evalRows(tier).map((e) => ({ ...e, result: String(e.target), evidence: 'https://x.test/run', date: '2026-11-01' }));

test('hiring is High with the Annex III reason', () => {
  const r = assess({ ...base, use: ['hiring'] });
  assert.equal(r.tier, 'High');
  assert.ok(r.reasons.some((x) => x.includes('Annex III §4')));
});

test('Not sure or missing answers give Incomplete, never a low guess', () => {
  assert.equal(assess({ ...base, use: ['internal_tool'], data: 'unsure' }).tier, 'Incomplete');
  assert.equal(assess({ use: ['hiring'] }).tier, 'Incomplete');
  assert.equal(assess({}).tier, 'Incomplete');
  assert.ok(assess({ use: ['hiring'] }).reasons.includes('At least High once complete.'));
});

test('several uses: the highest tier wins', () => {
  assert.equal(assess({ ...base, use: ['internal_tool', 'chatbot', 'credit'] }).tier, 'High');
});

test('a known Prohibited use wins even with open questions', () => {
  assert.equal(assess({ use: ['social_scoring', 'unsure'] }).tier, 'Prohibited');
});

test('external exposure lifts Minimal to Limited', () => {
  assert.equal(assess({ ...base, use: ['recommendation'], exposure: 'external' }).tier, 'Limited');
  assert.equal(assess({ ...base, use: ['recommendation'] }).tier, 'Minimal');
});

test('unknown answer values are dropped', () => {
  const r = assess({ ...base, use: ['hiring', 'evil'], data: '<script>' });
  assert.deepEqual(r.answers.use, ['hiring']);
  assert.equal(r.tier, 'Incomplete');
});

test('fully automated High gets an oversight note', () => {
  assert.ok(assess({ ...base, use: ['hiring'], oversight: 'automated' }).notes.some((n) => n.includes('Art. 14')));
});

test('eval status: pass, fail, missing; targets only tighten', () => {
  const [acc, , bias] = evalRows('High', [
    { metric: 'Accuracy', result: '0.95', evidence: 'https://x.test', date: '2026-11-01', target: '0.5' },
    { metric: 'Bias: lowest ÷ highest group selection rate', result: '0.6', evidence: 'https://x.test', date: '2026-11-01' },
  ]);
  assert.equal(acc.target, 0.9); // loosening to 0.5 ignored
  assert.equal(acc.status, 'pass');
  assert.equal(bias.status, 'fail');
  assert.equal(evalRows('High')[1].status, 'missing');
  assert.equal(evalRows('High', [{ metric: 'Accuracy', result: '0.99', evidence: 'javascript:alert(1)', date: '2026-11-01' }])[0].status, 'missing');
  assert.equal(evalRows('High', [{ metric: 'Accuracy', target: '0.97', result: '0.95', evidence: 'https://x.test', date: '2026-11-01' }])[0].status, 'fail');
});

test('demo story: failing bias eval blocks approval until fixed', () => {
  const s = { name: 'Resume screener', tier: 'High', rulesVersion: RULES_VERSION, evals: passing('High') };
  s.evals[2].result = '0.6';
  assert.ok(blockers(s).some((b) => b.includes('Bias')));
  s.evals[2].result = '0.85';
  assert.deepEqual(blockers(s), []);
});

test('an exception unblocks failing evals; Prohibited needs one', () => {
  assert.deepEqual(blockers({ tier: 'High', rulesVersion: RULES_VERSION, exception: 'Pilot with 10 users, manual review of all outputs' }), []);
  assert.equal(blockers({ tier: 'Prohibited', rulesVersion: RULES_VERSION }).length, 1);
  assert.ok(blockers({ tier: 'High', rulesVersion: 'old', exception: 'x' })[0].startsWith('Re-check'));
});

test('status flags and review-by dates', () => {
  const st = statusOf({ tier: 'High', rulesVersion: 'old', reviewBy: '2026-01-01' }, new Date('2026-11-11'));
  assert.deepEqual(st, { review: 'pending', needsInput: false, recheck: true, overdue: true });
  assert.equal(statusOf({ tier: 'Minimal', rulesVersion: RULES_VERSION }).review, 'not required');
  assert.equal(reviewByDate('High', '2026-11-11T10:00:00Z'), '2027-05-11');
  assert.equal(reviewByDate('Limited', '2026-11-11T10:00:00Z'), '2027-11-11');
  assert.equal(reviewByDate('Minimal', '2026-11-11'), null);
});

test('workflow rule: AI ticket closes only when linked, assessed and (if High) approved', () => {
  assert.match(closeError(null), /link it/);
  assert.match(closeError({ name: 'A', tier: 'Incomplete' }), /finished/);
  assert.match(closeError({ name: 'A', tier: 'High', review: 'pending' }), /approval/);
  assert.equal(closeError({ name: 'A', tier: 'High', review: 'approved' }), null);
  assert.equal(closeError({ name: 'A', tier: 'Minimal' }), null);
});
