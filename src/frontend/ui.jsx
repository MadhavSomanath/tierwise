import React from 'react';
import { Lozenge, Label, Textfield, Stack } from '@forge/react';

const TIER = { Prohibited: 'removed', High: 'moved', Limited: 'inprogress', Minimal: 'success', Incomplete: 'default' };
export const TierLozenge = ({ tier }) => <Lozenge appearance={TIER[tier]} isBold>{tier === 'Incomplete' ? 'Needs input' : tier}</Lozenge>;

const REVIEW = { approved: 'success', rejected: 'removed', pending: 'moved', 'not required': 'default' };
export const ReviewLozenge = ({ review }) => <Lozenge appearance={REVIEW[review]}>{review}</Lozenge>;

const EVAL = { pass: 'success', fail: 'removed', missing: 'default' };
export const EvalLozenge = ({ status }) => <Lozenge appearance={EVAL[status]}>{status}</Lozenge>;

export const Flags = ({ status }) => (
  <>
    {status.overdue && <Lozenge appearance="removed">Overdue</Lozenge>}
    {status.recheck && <Lozenge appearance="moved">Re-check needed</Lozenge>}
  </>
);

export const Field = ({ id, label, value, onChange, type }) => (
  <Stack>
    <Label labelFor={id}>{label}</Label>
    <Textfield id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
  </Stack>
);
