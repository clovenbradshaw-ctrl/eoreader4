// MEASURE (read-only) — the novelty-reserve pressure.
//
// For each blind item, build the doc through its sense's organ, read the FINAL unit, and
// emit per-item channels under BOTH reserves: the fixed constant (the live default) and the
// signal-derived reserve (RULES_REV). Emits instrument diagnostics too (is the final a
// newcomer? what decayed newcomer mass did the reading carry?) so the instrument can be
// verified before the score is read. Touches no production code; never reads the key.
//
//   node scripts/novelty-reserve.mjs            → writes data/novelty-reserve-out.jsonl
//   node scripts/novelty-reserve.mjs --print    → also prints a table

import { readFileSync, writeFileSync } from 'node:fs';
import { createLog, noveltyReserveMass } from '../src/core/index.js';
import { parseText } from '../src/perceiver/parse/index.js';
import { readingAt } from '../src/perceiver/index.js';

const GAMMA = 0.7;   // the default reading horizon (reading.js GAMMA), for the diagnostic only
const STIM  = JSON.parse(readFileSync(new URL('../data/novelty-reserve-stimulus.json', import.meta.url)));
const round = (x) => Math.round(x * 1000) / 1000;

// The two front-ends — the ONLY modality-specific code. Both yield a doc the one reader reads.
const buildText = (item) => parseText(item.units.join(' '), { docId: item.id });
const buildTone = (item) => {
  const log = createLog({ docId: item.id });
  item.steps.forEach((p, i) => log.append({ op: 'INS', id: p, label: p, sentIdx: i }));
  return { docId: item.id, modality: 'tone', units: item.steps.slice(), log };
};

const out = [];
for (const item of STIM.items) {
  const doc   = item.sense === 'tone' ? buildTone(item) : buildText(item);
  const units = doc.units || doc.sentences;
  const at    = units.length - 1;

  const fixed  = readingAt(doc, at, { signalReserve: false });
  const signal = readingAt(doc, at, { signalReserve: true  });

  // --- instrument diagnostics (NOT scored) -------------------------------------------
  // Replay the prior to recover: the decayed newcomer mass the signal reserve saw, and
  // whether the final unit's atoms were genuinely unseen before (a real newcomer).
  const events = typeof doc.log.snapshot === 'function' ? doc.log.snapshot() : doc.log.events;
  const firstAtomStep = new Map();
  const seeAtom = (k, s) => { const p = firstAtomStep.get(k); if (p == null || s < p) firstAtomStep.set(k, s); };
  const atomsAt = new Map();   // sentIdx → Set(atoms deposited)
  for (const e of events) {
    if (e.sentIdx == null) continue;
    const keys = [];
    if (e.op === 'INS') keys.push(`f:${e.id}`);
    else if (e.op === 'CON' || e.op === 'SIG') { keys.push(`f:${e.src}`, `f:${e.tgt}`, `p:${e.src}|${e.via || ''}|${e.tgt}`); }
    else if (e.op === 'DEF' && e.key === 'predicate') { keys.push(`f:${e.id}`, `d:${e.id}|${e.value}`); }
    if (!atomsAt.has(e.sentIdx)) atomsAt.set(e.sentIdx, new Set());
    for (const k of keys) { atomsAt.get(e.sentIdx).add(k); if (e.sentIdx < at) seeAtom(k, e.sentIdx); }
  }
  const priorAtoms = new Set([...firstAtomStep.keys()]);
  const finalAtoms = [...(atomsAt.get(at) || new Set())];
  const finalIsNewcomer = finalAtoms.length > 0 && finalAtoms.some(k => !priorAtoms.has(k));
  const decayedNoveltyMass = noveltyReserveMass(firstAtomStep.values(), { at, gamma: GAMMA });

  out.push({
    id: item.id,
    sense: item.sense,
    at,
    bayes_fixed:  round(fixed.bayesBits),
    bayes_signal: round(signal.bayesBits),
    // diagnostics
    final_is_newcomer: finalIsNewcomer,
    decayed_novelty_mass: round(decayedNoveltyMass),
    prior_atom_count: priorAtoms.size,
  });
}

const path = new URL('../data/novelty-reserve-out.jsonl', import.meta.url);
writeFileSync(path, out.map(o => JSON.stringify(o)).join('\n') + '\n');

if (process.argv.includes('--print')) {
  console.log('id   sense  newcomer  decNov  priorAtoms   bayes_fixed  bayes_signal');
  for (const o of out) {
    console.log(
      `${o.id}  ${o.sense.padEnd(5)}  ${String(o.final_is_newcomer).padEnd(7)}  ` +
      `${String(o.decayed_novelty_mass).padStart(5)}  ${String(o.prior_atom_count).padStart(9)}   ` +
      `${String(o.bayes_fixed).padStart(10)}  ${String(o.bayes_signal).padStart(11)}`);
  }
}
console.error(`wrote ${out.length} items → data/novelty-reserve-out.jsonl`);
