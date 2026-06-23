#!/usr/bin/env node
// drift-reserve-gen — build the BLIND stimulus + HELD key for the drifting-signal /
// novelty-reserve pressure (experiments/archive.jsonl exp-0002).
//
// SEED OF RECORD (inside-out + hard-problem cycle):
//   • code site .... src/core/surprise.js:21  `NOVELTY_RESERVE = 1.0`  (the constant hunt)
//   • hard problem .. "a continuously drifting signal, no stable background" — can the
//                     engine tell the drift from the genuine event on top.
//
// THE PHENOMENON. The one surprise (surpriseAt) reserves a fixed prior mass `novelty`
// for an as-yet-unseen atom. That reserve sets how EXPECTED a newcomer is, so it sets
// how much a newcomer moves belief. Fixed at 1.0, it is blind to whether newcomers have
// been ARRIVING: a newcomer after a long drought and a newcomer in the middle of a
// churn get the SAME reserve, so the reader "grows equally certain that nothing new will
// come whether it just saw three newcomers or none."
//
// THE STIMULUS is a modality-neutral atom stream with three phases:
//   STEADY  a small cast repeats, no newcomers — the recent novelty rate decays to ~0
//   EVENT   one brand-new atom arrives after the drought (the genuine event, E1)
//   CHURN   the cast turns over, one brand-new atom per line — a moving distribution
// and two planted controls inside the churn:
//   E2      one brand-new atom mid-churn — SURFACE-IDENTICAL to E1 (1 newcomer, same
//           active-cast size) but it is expected novelty, not an event
//   C_loud  THREE brand-new atoms at once — SURFACE-LOUDER than E1 (a magnitude/count
//           detector ranks it first), yet still expected novelty under a moving cast
//
// The SAME structure is instantiated in TWO senses with DISJOINT vocabularies — a
// LEXICAL stream (words) and a TONAL stream (interval moves) — so the omnimodal gate is
// baked into the stimulus: the core reads only atom→mass, so a real dissociation must
// appear in BOTH. No role labels live in the stimulus; the key holds them.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../data');

// ── The structural spec: per line, the roles of the deposited atoms. ──────────────
// 'S' = one of the 3 steady-cast slots; 'X' = the event newcomer; 'D' = a drift
// newcomer; 'B' = a loud-burst newcomer; an integer reuses a previously-named drift
// atom (the cast sliding). NO vocabulary here — just structure.
//
// roles per index drive both streams; newcomers are minted in first-seen order.
const SPEC = [
  // i  phase            atoms (slot tokens)        note
  { role: 'warmup',       atoms: ['S1', 'S2'] },   // 0  openings — S1,S2 enter
  { role: 'warmup',       atoms: ['S2', 'S3'] },   // 1  S3 enters
  { role: 'warmup',       atoms: ['S1', 'S3'] },   // 2  cast complete, no newcomers
  { role: 'steady',       atoms: ['S1', 'S2'] },   // 3  drought begins
  { role: 'steady',       atoms: ['S2', 'S3'] },   // 4
  { role: 'steady',       atoms: ['S1', 'S2', 'S3'] }, // 5
  { role: 'steady',       atoms: ['S1', 'S3'] },   // 6
  { role: 'steady',       atoms: ['S2', 'S3'] },   // 7
  { role: 'steady',       atoms: ['S1', 'S2'] },   // 8  novelty rate ~0
  { role: 'event',        atoms: ['X1', 'S1'] },   // 9  *** E1: 1 newcomer after drought
  { role: 'steady',       atoms: ['S2', 'S3'] },   // 10
  { role: 'steady',       atoms: ['S1', 'S2'] },   // 11
  { role: 'churn',        atoms: ['D1', 'S3'] },   // 12 drift begins
  { role: 'churn',        atoms: ['D2', 'D1'] },   // 13
  { role: 'churn',        atoms: ['D3', 'D2'] },   // 14
  { role: 'churn',        atoms: ['D4', 'D3'] },   // 15
  { role: 'churn',        atoms: ['D5', 'D4'] },   // 16
  { role: 'churn',        atoms: ['D6', 'D5'] },   // 17 rate high & steady
  { role: 'churn-newcomer', atoms: ['D7', 'D6'] }, // 18 *** E2: 1 newcomer, surface-identical to E1
  { role: 'churn',        atoms: ['D8', 'D7'] },   // 19
  { role: 'loud-control', atoms: ['B1', 'B2', 'B3'] }, // 20 *** C_loud: 3 newcomers at once
  { role: 'churn',        atoms: ['D9', 'B1'] },   // 21
  { role: 'settle',       atoms: ['D9', 'D8'] },   // 22
  { role: 'settle',       atoms: ['D8', 'D9'] },   // 23
];

// ── Two disjoint vocabularies — same slot tokens → different atoms per sense. ──────
// LEXICAL: words.  TONAL: interval-move tokens (the music organ's CON vocabulary).
const SLOTS = ['S1', 'S2', 'S3', 'X1',
  'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'B1', 'B2', 'B3'];

const LEXICAL = {
  S1: 'harbor', S2: 'tide', S3: 'gull', X1: 'comet',
  D1: 'ledger', D2: 'quartz', D3: 'marrow', D4: 'thistle', D5: 'cinder',
  D6: 'verdigris', D7: 'mistral', D8: 'fathom', D9: 'lichen',
  B1: 'anvil', B2: 'saffron', B3: 'cobalt',
};
const TONAL = {
  S1: 'mv:up2', S2: 'mv:down3', S3: 'mv:up5', X1: 'mv:up11',
  D1: 'mv:down7', D2: 'mv:up9', D3: 'mv:down1', D4: 'mv:up6', D5: 'mv:down10',
  D6: 'mv:up4', D7: 'mv:down8', D8: 'mv:up10', D9: 'mv:down5',
  B1: 'mv:down11', B2: 'mv:up8', B3: 'mv:down4',
};

const render = (vocab) => SPEC.map(s => s.atoms.map(a => vocab[a]));

// ── First-seen line per slot (for the key's "newcomers per line"). ────────────────
const firstSeen = {};
SPEC.forEach((s, i) => { for (const a of s.atoms) if (!(a in firstSeen)) firstSeen[a] = i; });
const newcomersPerLine = SPEC.map((s, i) => s.atoms.filter(a => firstSeen[a] === i));

// ── The BLIND stimulus — two raw streams, no roles, no labels. ────────────────────
const stimulus = {
  about: 'drifting-signal / novelty-reserve pressure — BLIND. Two senses, disjoint vocab, identical structure.',
  senses: {
    lexical: render(LEXICAL),
    tonal: render(TONAL),
  },
};

// ── The HELD key — roles, predicted dissociation, controls, mechanism. ────────────
const idx = {};
SPEC.forEach((s, i) => { (idx[s.role] ||= []).push(i); });
const E1 = idx.event[0];
const E2 = idx['churn-newcomer'][0];
const C  = idx['loud-control'][0];

const key = {
  about: 'HELD KEY for the drift / novelty-reserve pressure. The measure never reads this.',
  gamma: 0.7,                       // the figure-field horizon (reading.js GAMMA); the reserve tracks rate under it
  roles: SPEC.map((s, i) => ({ i, role: s.role, newcomers: newcomersPerLine[i].length })),
  items: {
    E1_event: E1,                   // genuine event: 1 newcomer after a drought
    E2_churn_newcomer: E2,          // control: 1 newcomer mid-churn, SURFACE-IDENTICAL to E1
    C_loud: C,                      // control: 3 newcomers at once, SURFACE-LOUDER than E1
    steady_baseline: idx.steady,    // quiet lines (no newcomers)
    churn_baseline: idx.churn,      // moving-cast lines (1 newcomer each)
  },
  mechanism: 'contextual-novelty-reserve: the reserved prior amplitude tracks the γ-decayed newcomer RATE (high after churn, low after a drought) under the same γ the figure field uses, then runs through the FIXED Born step (surpriseAt). A newcomer is surprising in proportion to how UNexpected novelty is right now.',
  predict: {
    // The dissociation. ctx = contextual reserve (the fix); fixed = NOVELTY_RESERVE=1.0 (today).
    ctx: {
      argmax_is: 'E1_event',        // the genuine event is the global spike
      'ctx(E1) >> ctx(E2)': true,   // separates the surface-identical pair via rate
      'ctx(E1) > ctx(C_loud)': true,// resists the magnitude trap: 1 unexpected newcomer beats 3 expected ones
      'ctx(E2) in churn_baseline': true, // the churn newcomer is NOT a spike — it sits in the moving-cast baseline
    },
    fixed: {
      argmax_is: 'C_loud',          // surface wins: most newcomers = most mass moved
      'fixed(E1) ~= fixed(E2)': true, // BLIND to rate: cannot separate the surface-identical pair
      'fixed does NOT argmax E1': true,
    },
  },
  controls: [
    'C_loud is surface-LOUDER than E1 (3 newcomers vs 1): a magnitude/count detector ranks it first. The mechanism must rank E1 first, or it is using magnitude.',
    'E2 is surface-IDENTICAL to E1 (1 newcomer, same active-cast size): a rate-blind channel scores them equal. The mechanism must score E1 >> E2, or it is not reading the rate.',
    'fixed-reserve channel IS the loud-surface control: it is the rate-blind method; its failure to separate E1 from E2 and its argmax on C_loud are the trap the mechanism must avoid.',
  ],
  omnimodal: 'The identical dissociation must hold in BOTH senses (lexical, tonal). The core reads only atom→mass; a result in one sense only would mean the harness, not the core, did the work.',
};

fs.writeFileSync(path.join(dataDir, 'drift-reserve-stimulus.json'), JSON.stringify(stimulus, null, 2) + '\n');
fs.writeFileSync(path.join(dataDir, 'drift-reserve-key.json'), JSON.stringify(key, null, 2) + '\n');
console.log('wrote data/drift-reserve-stimulus.json  (', SPEC.length, 'lines × 2 senses, BLIND )');
console.log('wrote data/drift-reserve-key.json        ( E1=', E1, ' E2=', E2, ' C_loud=', C, ')');
