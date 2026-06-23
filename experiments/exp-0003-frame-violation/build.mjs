// Generate the blind stimulus + held key for exp-0003 (expectation-violation blindness).
//
// PRESSURE (outside-in orthogonal collision): two random Wikipedia draws —
//   • William E. Johnson (Nebraska politician): a Republican who first served under a
//     DEMOCRATIC governor, then a Republican — a party-context the frame did not expect.
//   • Tiger shrike: a small passerine SONGBIRD that is PREDATORY, "feeding on small
//     animals" — a category member that violates its category's typical property.
// Their shared deep structure, forced into one stimulus shape: a standing entity acquires
// a property that VIOLATES the frame its prior, confirmed predicates established. This is
// the thin EVA/REC cell — "evaluate frames" / "learn a rule when one breaks".
//
// CLAIM: a predication that VIOLATES a standing frame (a contradictory KIND on an entity
// whose kind was already confirmed) should move the reader's belief MORE than a fresh,
// frame-CONSISTENT predication of equal surface novelty.
//
// CONTROL (the loud surface, matched): the consistent line adds exactly one new predicate
// atom, the same surface novelty as the violating line. So mass/novelty cannot separate
// them — a channel that does is reading the contradiction, not the surface.
//
// POSITIVE CONTROL (instrument-live): a connectivity reveal where the bridge channel is
// known to fire (exp-0001), proving the measure can light up — so a flat V-vs-C result is
// a real blindness, not a dead instrument.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// Each frame is established by stating the entity's KIND twice (it confirms, building
// γ-mass), then a final line that VIOLATES it (a contradictory kind) or stays CONSISTENT
// (a fresh attribute of equal novelty). Measured at the final cursor.
const frame = ({ ent, kind, violation, consistent }) => ({
  violation:  [`${ent} is a ${kind}.`, `${ent} is a ${kind}.`, `${ent} is a ${violation}.`].join(' '),
  consistent: [`${ent} is a ${kind}.`, `${ent} is a ${kind}.`, `${ent} is ${consistent}.`].join(' '),
});

const pairs = [
  { id: 'shrike',   ent: 'Pim',  kind: 'songbird',   violation: 'predator', consistent: 'quiet' },   // Tiger shrike
  { id: 'johnson',  ent: 'Hale', kind: 'Republican', violation: 'Democrat', consistent: 'tall'  },   // W. E. Johnson
  { id: 'bird',     ent: 'Wren', kind: 'sparrow',    violation: 'hawk',     consistent: 'brown' },   // the probe seed
];

const stimulus = { items: [] };
const key = {
  capability: 'expectation-violation significance (the EVA/REC frame-break)',
  claim: 'A predication that contradicts an entity\'s established kind should move belief more than a fresh, frame-consistent predication of equal surface novelty.',
  dissociation: 'some significance channel (bayes/surprisal/bridge) ranks violation > consistent, per pair.',
  control: 'violation and consistent lines each add exactly one new predicate atom (matched surface novelty) → the mass channels cannot separate them by surface.',
  positiveControl: 'pc-bridge is a connectivity reveal where bridge>0 — proves the instrument is live.',
  mechanismTag: 'expectation violation / predicate contradiction (slotless predicates carry no contradiction marker)',
  items: {},
};

for (const p of pairs) {
  const f = frame(p);
  stimulus.items.push({ id: `${p.id}-V`, modality: 'text', input: f.violation });
  stimulus.items.push({ id: `${p.id}-C`, modality: 'text', input: f.consistent });
  key.items[`${p.id}-V`] = { role: 'violation',  pair: p.id };
  key.items[`${p.id}-C`] = { role: 'consistent', pair: p.id };
}

// Membrane (pure operator log): the SAME structure with no parser — INS then a confirmed
// predicate value, then a new value. At the operator level a "contradiction" and an
// "addition" are the identical event (a new value under the same key): the proof that the
// gap is in the REPRESENTATION, not the text front-end.
stimulus.items.push({ id: 'mem-V', modality: 'membrane', input: [
  { op: 'INS', id: 'x', label: 'x' }, { op: 'DEF', id: 'x', key: 'predicate', value: 'A' },
  { op: 'DEF', id: 'x', key: 'predicate', value: 'A' }, { op: 'DEF', id: 'x', key: 'predicate', value: 'B' } ] });
stimulus.items.push({ id: 'mem-C', modality: 'membrane', input: [
  { op: 'INS', id: 'x', label: 'x' }, { op: 'DEF', id: 'x', key: 'predicate', value: 'A' },
  { op: 'DEF', id: 'x', key: 'predicate', value: 'A' }, { op: 'DEF', id: 'x', key: 'predicate', value: 'C' } ] });
key.items['mem-V'] = { role: 'violation',  pair: 'mem' };
key.items['mem-C'] = { role: 'consistent', pair: 'mem' };

// Positive control: a connectivity reveal — two standing entities, then a bond joining them.
stimulus.items.push({ id: 'pc-bridge', modality: 'text',
  input: 'Ada studies. Ada studies. Ben travels. Ben travels. Ada knows Ben.' });
key.items['pc-bridge'] = { role: 'positive-control', pair: 'pc', expect: 'bridge>0' };

mkdirSync(HERE, { recursive: true });
writeFileSync(join(HERE, 'stimulus.json'), JSON.stringify(stimulus, null, 2) + '\n');
writeFileSync(join(HERE, 'key.json'), JSON.stringify(key, null, 2) + '\n');
console.log(`wrote stimulus.json (${stimulus.items.length} items, BLIND) and key.json (HELD)`);
