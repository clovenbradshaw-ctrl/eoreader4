// Generate the blind stimulus and the held key for EXP-001 (novelty reserve).
//
// THE PRESSURE (inside-out, the constant hunt): src/core/surprise.js:21 holds
// NOVELTY_RESERVE = 1.0 — a hand-set constant in the predictive path. The reserve
// probability the reader holds for an as-yet-unseen atom is novelty/(mass+novelty):
// a "one over mass plus one" that tracks only TOTAL accumulated mass and is blind to
// whether newcomers have recently been ARRIVING. The reader grows equally certain
// that nothing new will come whether it just saw a burst of newcomers or none.
//
// THE CONTRAST, planted: each item is a stream measured at its final cursor. A
// "burst" stream ends its prior window with several first-time atoms; a "plateau"
// stream front-loads the same newcomers and ends in pure recurrence. Crucially, a
// burst/plateau pair shares the SAME atom multiset and the SAME length, so the
// γ-decayed TOTAL mass of the prior is identical — hence the constant reserve is
// identical (membrane, text) or even anti-correlated (music, via interval bonds).
// The loud surface signal (total mass) therefore CANNOT separate the labels: that
// is the control. A reserve that separates them is reading novelty RATE, not mass.
//
// Three senses, three organs: a bare INS-only "membrane" stream (the mechanism
// proof), the music organ (sense #1), the text organ (sense #2) — the omnimodal gate.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const L = 8;   // stream length; the reserve is measured at the final cursor (L-1),
               // so the prior is steps 0..L-2 and the contrast lives entirely there.

// Build the ordered atom sequence. burst → anchor recurs early, newcomers at the END
// of the prior; plateau → newcomers early, anchor recurs to the END. Both modes yield
// the SAME multiset {anchor × (L-k), n1..nk} and the same length, so total mass matches.
const seq = ({ anchor, newcomers, mode }) => {
  const k = newcomers.length;
  const prior = [];
  if (mode === 'burst') {
    for (let i = 0; i < (L - 1) - k; i++) prior.push(anchor);   // anchor settles first
    for (const n of newcomers) prior.push(n);                   // burst at the prior's end
  } else {
    prior.push(anchor);                                         // anchor's first sighting
    for (const n of newcomers) prior.push(n);                   // newcomers early
    while (prior.length < L - 1) prior.push(anchor);            // then pure recurrence
  }
  return [...prior, anchor];                                    // step L-1: neutral recurrence (measured, not prior)
};

// Specs: 3 burst + 3 plateau per sense. Newcomer-count k varies so the win is not a
// single lucky contrast.
const specs = [
  // membrane (bare INS-only stream)
  { id: 'm-b1', modality: 'membrane', anchor: 'A', newcomers: ['B', 'C', 'D'], mode: 'burst' },
  { id: 'm-b2', modality: 'membrane', anchor: 'P', newcomers: ['Q', 'R'],      mode: 'burst' },
  { id: 'm-b3', modality: 'membrane', anchor: 'X', newcomers: ['Y', 'Z', 'W'], mode: 'burst' },
  { id: 'm-p1', modality: 'membrane', anchor: 'A', newcomers: ['B', 'C', 'D'], mode: 'plateau' },
  { id: 'm-p2', modality: 'membrane', anchor: 'P', newcomers: ['Q', 'R'],      mode: 'plateau' },
  { id: 'm-p3', modality: 'membrane', anchor: 'X', newcomers: ['Y', 'Z', 'W'], mode: 'plateau' },
  // music (pitch classes; a new pitch class is a newcomer figure)
  { id: 'mu-b1', modality: 'music', anchor: 'C4', newcomers: ['D4', 'E4', 'F4'], mode: 'burst' },
  { id: 'mu-b2', modality: 'music', anchor: 'G4', newcomers: ['A4', 'B4'],       mode: 'burst' },
  { id: 'mu-b3', modality: 'music', anchor: 'E4', newcomers: ['F4', 'G4', 'A4'], mode: 'burst' },
  { id: 'mu-p1', modality: 'music', anchor: 'C4', newcomers: ['D4', 'E4', 'F4'], mode: 'plateau' },
  { id: 'mu-p2', modality: 'music', anchor: 'G4', newcomers: ['A4', 'B4'],       mode: 'plateau' },
  { id: 'mu-p3', modality: 'music', anchor: 'E4', newcomers: ['F4', 'G4', 'A4'], mode: 'plateau' },
  // text (matched template — equal mass per sentence — only newcomer timing differs)
  { id: 't-b1', modality: 'text', anchor: 'Mara', newcomers: ['Tomas', 'Yusuf', 'Priya'], mode: 'burst' },
  { id: 't-b2', modality: 'text', anchor: 'Ines', newcomers: ['Bao', 'Caleb'],            mode: 'burst' },
  { id: 't-b3', modality: 'text', anchor: 'Omar', newcomers: ['Vera', 'Nadia', 'Kofi'],   mode: 'burst' },
  { id: 't-p1', modality: 'text', anchor: 'Mara', newcomers: ['Tomas', 'Yusuf', 'Priya'], mode: 'plateau' },
  { id: 't-p2', modality: 'text', anchor: 'Ines', newcomers: ['Bao', 'Caleb'],            mode: 'plateau' },
  { id: 't-p3', modality: 'text', anchor: 'Omar', newcomers: ['Vera', 'Nadia', 'Kofi'],   mode: 'plateau' },
];

const SENT = (name) => `${name} entered the hall.`;

const stimulus = { items: [] };
const key = {
  capability: 'context-sensitive novelty reserve',
  claim: 'The mass the reader reserves for an unseen atom tracks the RECENT RATE of newcomer arrivals (high after a burst, low after a confirmation plateau), not merely total accumulated mass. Under the live engine the reserve is the constant NOVELTY_RESERVE=1.0, so it is blind to newcomer recency.',
  cursor: L - 1,
  dissociation: 'reserveContext(burst) > reserveContext(plateau), within each sense.',
  control: 'burst/plateau pairs share atom multiset and length, so total prior mass is identical → reserveConstant CANNOT separate the labels (membrane/text exactly tied; music anti-correlated via interval bonds). A channel that separates is reading novelty rate, not mass.',
  mechanismTag: 'gamma-decayed newcomer amplitude through the fixed Born step',
  senses: ['music', 'text'],
  items: {},
};

for (const s of specs) {
  const atoms = seq(s);
  let input;
  if (s.modality === 'text') input = atoms.map(SENT).join(' ');
  else input = atoms;                       // membrane: atom array; music: note array
  stimulus.items.push({ id: s.id, modality: s.modality, input });
  key.items[s.id] = {
    mechanism: s.mode,
    anchor: s.anchor,
    newcomers: s.newcomers,
    // distinct-atom first-appearance steps in the prior (0..L-2), for the instrument check
    distinctOrder: atoms.slice(0, L - 1).reduce((m, a, i) => (a in m ? m : { ...m, [a]: i }), {}),
  };
}

mkdirSync(HERE, { recursive: true });
writeFileSync(join(HERE, 'stimulus.json'), JSON.stringify(stimulus, null, 2) + '\n');
writeFileSync(join(HERE, 'key.json'), JSON.stringify(key, null, 2) + '\n');
console.log(`wrote stimulus.json (${stimulus.items.length} items, BLIND) and key.json (HELD)`);
