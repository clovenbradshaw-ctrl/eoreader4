#!/usr/bin/env node
// novelty-reserve — a blind falsifiable experiment against the predictive engine's RESERVE.
//
// READ-ONLY. Touches no production code, changes no rules, mutates no state outside this
// process. It reads the BLIND stimulus (data/novelty-pressure/stimulus.json — opaque item
// ids, no labels), emits every relevant surprise channel per line over PRIOR CONTEXT ONLY,
// then scores against the HELD key (data/novelty-pressure/key.json) it loads only in the
// final phase. The measurement phase never consults the key.
//
// THE PRESSURE (the constant hunt, made literal — docs/novelty-reserve.md).
//   src/core/surprise.js carries `NOVELTY_RESERVE = 1.0`, a hand-rolled constant: the prior
//   mass the Born step reserves for an as-yet-unseen atom. Being a constant, the reserve
//   probability ν/(sumPrior+ν) is blind to whether newcomers have actually been arriving —
//   the reader grows equally certain nothing new will come whether it just saw six newcomers
//   or none. The fix is not a better number; it is to feed the reserve the signal's own recent
//   NOVELTY RATE (ν, the γ-decayed first-appearance mass) through the SAME fixed Born step.
//   readingAt does this under { signalReserve:true } (default off → byte-identical).
//
// THE DISSOCIATION. A newcomer after a long confirmation stretch (DROUGHT) vs the same
// newcomer after a flurry of newcomers (FLURRY), with standing mass MATCHED. Surface is
// matched too (every line is 'Name entered.' / one note — same length, same verb). Predicted:
//   OFF (constant reserve): bayes(drought) ≈ bayes(flurry)  — blind to the rate
//   ON  (signal  reserve): bayes(drought) ≫ bayes(flurry)  — the rate is tracked
// The CONTROL re-confirms an incumbent at the test line (byte-identical surface, NO newcomer):
// bayes ≈ 0 under both reserves — a method that fired on surface activity would trip here.
//
// THE CHANNELS, per item, at every line, causally (line k sees only lines < k for its prior):
//   bayesOff   readingAt(doc, k).bayesBits                       — D_KL with the CONSTANT reserve
//   bayesOn    readingAt(doc, k, {signalReserve:true}).bayesBits — D_KL with the SIGNAL  reserve
//   surprisal  readingAt(doc, k).surprisalBits                   — the surface −log p channel
//   newcomer   did an INS first-appear at k (does a newcomer draw the reserve)
// The tonal items drive the SAME core (src/core/surprise.js surpriseAt) over a PITCH basis,
// threading ν via the core's own `noveltyNext` return — the omnimodal check that the reserve
// is interior, not a text fact.
//
// Run: node scripts/novelty-reserve.mjs

import { readFileSync } from 'node:fs';
import { surpriseAt } from '../src/core/surprise.js';
import { parseText }  from '../src/perceiver/parse/index.js';
import { readingAt }  from '../src/perceiver/index.js';

const here = (p) => new URL(p, import.meta.url);
const stimulus = JSON.parse(readFileSync(here('../data/novelty-pressure/stimulus.json'), 'utf8'));
const key      = JSON.parse(readFileSync(here('../data/novelty-pressure/key.json'), 'utf8'));

const GAMMA = 0.7;
const r3 = (x) => Math.round(x * 1000) / 1000;

// --- The TEXT front-end: read every line of a text item over prior context only. ---------
function measureText(units) {
  const doc = parseText(units.join(' '), { docId: 'np' });
  const rows = [];
  for (let k = 0; k < units.length; k++) {
    const off = readingAt(doc, k);
    const on  = readingAt(doc, k, { signalReserve: true });
    rows.push({
      k,
      bayesOff: off.bayesBits,
      bayesOn:  on.bayesBits,
      surprisal: off.surprisalBits,
      newcomer: on.surprises.some(s => s.op === 'INS'),
    });
  }
  return rows;
}

// --- The TONAL front-end (the SECOND SENSE): pitch atoms, the SAME core, ν threaded. ------
// Front-end only — it builds the (prior, arrival) maps and threads the reserve scalar the
// core returns. The Born law inside surpriseAt is identical to the text path.
function measureTonal(notes) {
  const rows = [];
  let prior = new Map(), nu = 0;
  for (let k = 0; k < notes.length; k++) {
    const arrival = new Map([[`n:${notes[k]}`, 1]]);
    const newcomer = !prior.has(`n:${notes[k]}`);
    const off = surpriseAt(prior, arrival, { gamma: GAMMA, novelty: 1.0 });
    const on  = surpriseAt(prior, arrival, { gamma: GAMMA, novelty: nu });
    rows.push({ k, bayesOff: off.bayesBits, bayesOn: on.bayesBits, surprisal: null, newcomer });
    // advance the profile (posterior → next prior) and thread ν via the core's noveltyNext
    const post = new Map();
    for (const key2 of new Set([...prior.keys(), ...arrival.keys()]))
      post.set(key2, GAMMA * (prior.get(key2) || 0) + (arrival.get(key2) || 0));
    prior = post;
    nu = on.noveltyNext;
  }
  return rows;
}

// === MEASURE (blind) ====================================================================
const measured = {};
for (const item of stimulus.items) {
  measured[item.id] = item.basis === 'tonal' ? measureTonal(item.units) : measureText(item.units);
}

// === VERIFY THE INSTRUMENT (before reading any score) ===================================
console.log('=== INSTRUMENT CHECK ===');
let instrumentOk = true;
for (const item of stimulus.items) {
  const rows = measured[item.id];
  const anyBayes = rows.some(r => r.bayesOn > 0 || r.bayesOff > 0);
  const onDiffers = rows.some(r => Math.abs(r.bayesOn - r.bayesOff) > 1e-9);
  // A non-control item must show the channel computing AND signalReserve actually changing it.
  const isControl = key.items[item.id].condition === 'control';
  const ok = anyBayes && (isControl || onDiffers);
  if (!ok && !isControl) instrumentOk = false;
  console.log(`  ${item.id} (${item.basis}): channel ${anyBayes ? 'LIVE' : 'FLAT'}, signalReserve ${onDiffers ? 'moves it' : 'no-op'} ${ok ? 'OK' : (isControl ? '(control)' : 'VOID')}`);
}
if (!instrumentOk) { console.log('\nINSTRUMENT VOID — channel starved or reserve inert. Score withheld.'); process.exit(2); }

// === SCORE (blind: control first, then the per-item split) ==============================
const testRow = (id) => measured[id].find(r => r.k === key.items[id].testIndex);

console.log('\n=== CONTROL FIRST (did the trivial explanation get caught) ===');
for (const id of [key.control_id, 't3']) {
  const row = testRow(id), spec = key.items[id];
  const caught = row.bayesOff < 0.01 && row.bayesOn < 0.01 && row.newcomer === false;
  console.log(`  ${id} (${spec.condition}, ${stimulus.items.find(i=>i.id===id).basis}): bayesOff=${r3(row.bayesOff)} bayesOn=${r3(row.bayesOn)} newcomer=${row.newcomer} → ${caught ? 'HELD (no surface leak)' : 'LEAK'}`);
}

console.log('\n=== THE SPLIT (per item, at the test line) ===');
const report = (dId, fId, basis) => {
  const d = testRow(dId), f = testRow(fId);
  const splitOff = r3(d.bayesOff - f.bayesOff);
  const splitOn  = r3(d.bayesOn  - f.bayesOn);
  console.log(`  [${basis}] drought(${dId}) vs flurry(${fId}):`);
  console.log(`     OFF (constant): drought ${r3(d.bayesOff)}  flurry ${r3(f.bayesOff)}  split ${splitOff}`);
  console.log(`     ON  (signal):   drought ${r3(d.bayesOn)}  flurry ${r3(f.bayesOn)}  split ${splitOn}`);
  if (basis === 'text')
    console.log(`     surprisal (surface, OFF=ON): drought ${r3(d.surprisal)}  flurry ${r3(f.surprisal)}  ${d.surprisal===f.surprisal?'IDENTICAL → surface cannot split':'differ'}`);
  return { splitOff, splitOn };
};
const txt = report('s1', 's2', 'text');
const ton = report('t1', 't2', 'tonal');

console.log('\n=== VERDICT (blind, against the held key) ===');
const conf = (label, ok) => console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}`);
const offBlind  = Math.abs(txt.splitOff) < 0.02 && Math.abs(ton.splitOff) < 0.02;
const onSplits   = txt.splitOn > 0.2 && ton.splitOn > 0.2;
const twoSenses  = onSplits && ton.splitOn > 0.2;        // the split appears on BOTH bases
conf('OFF constant reserve is BLIND to the novelty rate (drought ≈ flurry on both bases)', offBlind);
conf('ON signal reserve TRACKS the rate (drought ≫ flurry on text)', txt.splitOn > 0.2);
conf('OMNIMODAL: the same split appears on the tonal basis (interior, not a text fact)', ton.splitOn > 0.2);
console.log(`\n  capability "${key.capability}" — ${offBlind && onSplits && twoSenses ? 'CONFIRMED in two senses (interior)' : 'NOT confirmed'}`);
