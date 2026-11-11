import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Stack, Inline, Heading, Text, Strong, Select, Button, Label, SectionMessage, DynamicTable, User,
  Tabs, TabList, Tab, TabPanel, useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { TierLozenge, ReviewLozenge, EvalLozenge, Flags, Field } from './ui';

function App() {
  const ctx = useProductContext();
  const issueKey = ctx?.extension?.issue?.key;
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [picking, setPicking] = useState(false);

  const call = async (name, payload = {}) => {
    setErr(null);
    try {
      setD(await invoke(name, { issueKey, ...payload }));
      setPicking(false);
    } catch (e) {
      setErr(e.message);
    }
  };
  useEffect(() => { if (issueKey) call('getPanel'); }, [issueKey]);

  if (!d) return err ? <Text>{err}</Text> : <Text>Loading…</Text>;
  return (
    <Stack space="space.200">
      {err && <SectionMessage appearance="error"><Text>{err}</Text></SectionMessage>}
      {d.system && !picking ? <SystemView d={d} call={call} onChange={() => setPicking(true)} /> : <Picker d={d} call={call} />}
    </Stack>
  );
}

function Picker({ d, call }) {
  const [pick, setPick] = useState(null);
  const [name, setName] = useState('');
  return (
    <Stack space="space.100">
      <Text>Which AI system does this ticket build or change? The ticket inherits that system's risk tier.</Text>
      <Label labelFor="sys">Existing AI system</Label>
      <Select inputId="sys" options={d.systems.map((s) => ({ label: `${s.name} (${s.tier})`, value: s.id }))} onChange={setPick} />
      <Button isDisabled={!pick} onClick={() => call('linkSystem', { systemId: pick.value })}>Link</Button>
      <Field id="new" label="Or register a new AI system" value={name} onChange={setName} />
      <Button isDisabled={!name.trim()} onClick={() => call('createSystem', { name })}>Register and link</Button>
    </Stack>
  );
}

function SystemView({ d, call, onChange }) {
  const s = d.system;
  return (
    <Stack space="space.150">
      <Inline space="space.100" alignBlock="center">
        <Heading as="h3">{s.name}</Heading>
        <TierLozenge tier={s.tier} />
        {s.needsSignoff && <ReviewLozenge review={s.status.review} />}
        <Flags status={s.status} />
      </Inline>
      <Inline space="space.100">
        {s.reviewBy && <Text>Review by {s.reviewBy}</Text>}
        <Text>Rules {s.rulesVersion}</Text>
        <Button appearance="subtle" onClick={onChange}>Change system</Button>
      </Inline>
      <Stack>
        <Strong>Why this tier</Strong>
        {s.reasons.map((r) => <Text key={r}>• {r}</Text>)}
        {s.notes.map((n) => <Text key={n}>⚠ {n}</Text>)}
      </Stack>
      <Tabs id="tabs">
        <TabList>
          <Tab>Assessment</Tab>
          <Tab>Evals</Tab>
          <Tab>Sign-off</Tab>
          <Tab>History</Tab>
        </TabList>
        {/* key remounts each form with fresh server data after every save */}
        <TabPanel><Assessment key={s.updatedAt} d={d} call={call} /></TabPanel>
        <TabPanel><Evals key={s.updatedAt} s={s} call={call} /></TabPanel>
        <TabPanel><SignOff key={s.updatedAt} d={d} call={call} /></TabPanel>
        <TabPanel><History s={s} /></TabPanel>
      </Tabs>
    </Stack>
  );
}

function Assessment({ d, call }) {
  const [a, setA] = useState(d.system.answers ?? {});
  return (
    <Stack space="space.100">
      {d.questions.map((q) => {
        const opts = q.options.map(({ label, value }) => ({ label, value }));
        const cur = [].concat(a[q.id] ?? []);
        const value = q.multi ? opts.filter((o) => cur.includes(o.value)) : opts.find((o) => o.value === cur[0]) ?? null;
        return (
          <Stack key={q.id}>
            <Label labelFor={q.id}>{q.label}</Label>
            <Select inputId={q.id} isMulti={q.multi} options={opts} value={value}
              onChange={(v) => setA({ ...a, [q.id]: q.multi ? (v ?? []).map((o) => o.value) : v?.value })} />
          </Stack>
        );
      })}
      <Button appearance="primary" onClick={() => call('saveAssessment', { answers: a })}>Save assessment</Button>
    </Stack>
  );
}

function Evals({ s, call }) {
  const [rows, setRows] = useState(s.evals);
  if (!rows.length) return <Text>{s.tier === 'Incomplete' ? 'Finish the assessment to see which evals apply.' : `No evals required for ${s.tier}.`}</Text>;
  const set = (i, k) => (v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <Stack space="space.200">
      <Text>Enter results from your eval runs. A row passes only with a result, an evidence link and a date. Targets can be tightened, not loosened.</Text>
      {rows.map((r, i) => (
        <Stack key={r.metric} space="space.050">
          <Inline space="space.100" alignBlock="center">
            <Strong>{r.metric}</Strong>
            <Text>must be {r.dir} {s.evals[i].target}</Text>
            <EvalLozenge status={s.evals[i].status} />
          </Inline>
          <Inline space="space.100">
            <Field id={`t${i}`} label="Target" value={String(r.target)} onChange={set(i, 'target')} />
            <Field id={`r${i}`} label="Result" value={r.result} onChange={set(i, 'result')} />
            <Field id={`e${i}`} label="Evidence link" value={r.evidence} onChange={set(i, 'evidence')} />
            <Field id={`d${i}`} label="Run date" type="date" value={r.date} onChange={set(i, 'date')} />
          </Inline>
        </Stack>
      ))}
      <Button appearance="primary" onClick={() => call('saveEvals', { evals: rows })}>Save evals</Button>
    </Stack>
  );
}

function SignOff({ d, call }) {
  const s = d.system;
  const [note, setNote] = useState('');
  const [exception, setException] = useState(s.exception ?? '');
  if (!s.needsSignoff) return <Text>{s.tier === 'Incomplete' ? 'Finish the assessment first.' : `${s.tier} systems don't need reviewer sign-off.`}</Text>;
  return (
    <Stack space="space.150">
      <Inline space="space.100"><Text>Status:</Text><ReviewLozenge review={s.status.review} /></Inline>
      {s.blockers.length > 0 && (
        <SectionMessage appearance="warning" title="Can't be approved yet">
          {s.blockers.map((b) => <Text key={b}>• {b}</Text>)}
        </SectionMessage>
      )}
      <Field id="exception" label="Exception: why approval can go ahead despite failing evals" value={exception} onChange={setException} />
      <Button onClick={() => call('setException', { reason: exception })}>{exception.trim() ? 'Log exception' : 'Clear exception'}</Button>
      {d.isReviewer ? (
        <Stack space="space.100">
          <Field id="note" label="Reviewer note" value={note} onChange={setNote} />
          <Inline space="space.100">
            <Button appearance="primary" isDisabled={s.blockers.length > 0} onClick={() => call('review', { decision: 'approve', note })}>Approve</Button>
            <Button appearance="danger" onClick={() => call('review', { decision: 'reject', note })}>Reject</Button>
          </Inline>
        </Stack>
      ) : (
        <Text>Only listed reviewers (compliance/legal) can approve or reject.</Text>
      )}
    </Stack>
  );
}

function History({ s }) {
  return (
    <DynamicTable
      caption="Change history"
      head={{ cells: ['When', 'Who', 'What', 'Tier'].map((c) => ({ key: c, content: c })) }}
      rows={[...(s.history ?? [])].reverse().map((h, i) => ({
        key: String(i),
        cells: [
          { key: 'at', content: h.at.slice(0, 16).replace('T', ' ') },
          { key: 'by', content: <User accountId={h.by} /> },
          { key: 'what', content: h.detail ? `${h.action}: ${h.detail}` : h.action },
          { key: 'tier', content: h.fromTier === h.toTier ? h.toTier : `${h.fromTier} → ${h.toTier}` },
        ],
      }))}
    />
  );
}

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
