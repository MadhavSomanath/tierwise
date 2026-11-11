import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Stack, Inline, Heading, Text, Select, Label, DynamicTable, Link } from '@forge/react';
import { invoke } from '@forge/bridge';
import { TierLozenge, ReviewLozenge, Flags } from './ui';

const opts = (values) => values.map((v) => ({ label: v, value: v }));
const FILTERS = [
  { id: 'tier', label: 'Tier', options: opts(['Prohibited', 'High', 'Limited', 'Minimal', 'Incomplete']), match: (r, v) => r.tier === v },
  { id: 'review', label: 'Review status', options: opts(['pending', 'approved', 'rejected', 'not required']), match: (r, v) => r.status.review === v },
  { id: 'flag', label: 'Flag', options: [{ label: 'Overdue', value: 'overdue' }, { label: 'Needs input', value: 'needsInput' }, { label: 'Re-check needed', value: 'recheck' }], match: (r, v) => r.status[v] },
];

function App() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [f, setF] = useState({});
  useEffect(() => { invoke('getRegister').then(setRows, (e) => setErr(e.message)); }, []);

  if (!rows) return <Text>{err ?? 'Loading…'}</Text>;
  const shown = rows.filter((r) => FILTERS.every((x) => !f[x.id] || x.match(r, f[x.id])));
  const count = (pred) => rows.filter(pred).length;

  return (
    <Stack space="space.200">
      <Heading as="h2">AI Register</Heading>
      <Text>
        {rows.length} AI systems · {count((r) => r.tier === 'High' || r.tier === 'Prohibited')} High or Prohibited ·{' '}
        {count((r) => r.status.review === 'pending')} awaiting review · {count((r) => r.status.overdue)} overdue
      </Text>
      <Inline space="space.200">
        {FILTERS.map((x) => (
          <Stack key={x.id}>
            <Label labelFor={x.id}>{x.label}</Label>
            <Select inputId={x.id} isClearable options={x.options} onChange={(v) => setF({ ...f, [x.id]: v?.value })} />
          </Stack>
        ))}
      </Inline>
      <DynamicTable
        caption="AI systems"
        head={{ cells: ['System', 'Tier', 'Review', 'Review by', 'Flags', 'Tickets'].map((c) => ({ key: c, content: c, isSortable: c !== 'Flags' })) }}
        emptyView={<Text>No systems match these filters.</Text>}
        rows={shown.map((r) => ({
          key: r.id,
          cells: [
            { key: r.name, content: r.name },
            { key: r.tier, content: <TierLozenge tier={r.tier} /> },
            { key: r.status.review, content: r.needsSignoff ? <ReviewLozenge review={r.status.review} /> : '—' },
            { key: r.reviewBy ?? '', content: r.reviewBy ?? '—' },
            { key: 'flags', content: <Inline space="space.050"><Flags status={r.status} />{r.status.needsInput && <Text>Needs input</Text>}</Inline> },
            { key: String(r.issues.length), content: <Inline space="space.050">{r.issues.map((k) => <Link key={k} href={`/browse/${k}`}>{k}</Link>)}</Inline> },
          ],
        }))}
      />
    </Stack>
  );
}

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
