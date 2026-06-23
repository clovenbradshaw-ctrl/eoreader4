#!/usr/bin/env node
// reserve-rate — READ-ONLY measurement, the one-cursor pattern.
//
// Touches no production code, changes no rules, reads no key. For each item in
// stimulus.json it emits, at the probe (the last unit), every reserve channel the
// engine computes over PRIOR CONTEXT ONLY. It selects nothing and scores nothing; the
// scorer reads the held key separately, against this output.
//
// THE TWO SENSES ROUTE THROUGH ONE CORE. Text (proposition-field atoms, via the lexical
// parser) and frequency (overtone-bin atoms, via the frequency organ) both build the
// same kind of per-step deposit sets, and both feed the SAME modality-agnostic Born step
// (surpriseAt). That is the omnimodal claim made operational: the interior cannot tell
// which sense it is reading. The text reconstruction is cross-checked against readingAt's
// own reserve path (instrument verification) — they must match to rounding.
//
// CHANNELS, per item at the probe:
//   reserveAmp   the SIGNAL reserve amplitude (noveltyRateProfile) — the γ-decayed
//                newcomer rate of the item's own prior history.
//   sumPrior     the γ-decayed total prior mass (the confound the control matches).
//   newBins      number of probe atoms unseen before the probe (the surface novelty).
//   constBayes   bayesBits with the CONSTANT reserve (novelty=1) — the blind control.
//   signalBayes  bayesBits with the SIGNAL reserve (novelty=reserveAmp) — the mechanism.
//   surprisal    text only: surprisalBits at the probe (the −log p surface channel).
//   engConst/engSignal  text only: readingAt's own const/signal bayesBits (cross-check).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseText } from '../../../src/perceiver/parse/index.js';
import { readingAt } from '../../../src/perceiver/index.js';
import { ingestFrequencies } from '../../../src/organs/in/frequency.js';
import { surpriseAt, noveltyRateProfile } from '../../../src/core/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const stim = JSON.parse(readFileSync(join(HERE, 'stimulus.json'), 'utf8'));
const GAMMA = stim.gamma ?? 0.7;
const round = (x) => (x == null ? null : Math.round(x * 100) / 100);

// The proposition-field deposits per step, exactly as src/perceiver/reading.js builds them.
function textDeposits(doc, upto) {
  const events = doc.log.snapshot();
  const dep = [];
  for (let s = 0; s <= upto; s++) dep.push([]);
  for (const e of events) {
    const s = e.sentIdx;
    if (s == null || s > upto) continue;
    if (e.op === 'INS') dep[s].push(`f:${e.id}`);
    else if (e.op === 'CON' || e.op === 'SIG') dep[s].push(`f:${e.src}`, `f:${e.tgt}`, `p:${e.src}|${e.via || ''}|${e.tgt}`);
    else if (e.op === 'DEF' && e.key === 'predicate') dep[s].push(`f:${e.id}`, `d:${e.id}|${e.value}`);
  }
  return dep;
}

// The ONE Born step, plus the diagnostic confound terms, from a deposit sequence.
function bornChannels(deposits, probe) {
  const prior = new Map();
  for (let j = 0; j < probe; j++) {
    const w = Math.pow(GAMMA, probe - 1 - j);
    for (const a of deposits[j]) prior.set(a, (prior.get(a) || 0) + w);
  }
  const arrival = new Map();
  for (const a of deposits[probe]) arrival.set(a, (arrival.get(a) || 0) + 1);
  const sumPrior = [...prior.values()].reduce((s, m) => s + m, 0);
  const newBins = [...arrival.keys()].filter((k) => !prior.has(k)).length;
  const reserveAmp = noveltyRateProfile(deposits, GAMMA)[probe];
  const constBayes = surpriseAt(prior, arrival, { gamma: GAMMA, novelty: 1.0 }).bayesBits;
  const signalBayes = surpriseAt(prior, arrival, { gamma: GAMMA, novelty: reserveAmp }).bayesBits;
  return { reserveAmp, sumPrior, newBins, constBayes, signalBayes };
}

const records = [];
for (const item of stim.items) {
  let deposits, probe, surprisal = null, engConst = null, engSignal = null, organLive = true;
  if (item.sense === 'text') {
    const doc = parseText(item.units.join(' '), { docId: item.id });
    probe = doc.units.length - 1;
    deposits = textDeposits(doc, probe);
    surprisal = readingAt(doc, probe, { reserve: 'const' }).surprisalBits;
    engConst = readingAt(doc, probe, { reserve: 'const' }).bayesBits;
    engSignal = readingAt(doc, probe, { reserve: 'signal' }).bayesBits;
    organLive = doc.units.length === item.units.length;     // the parser segmented as expected
  } else if (item.sense === 'frequency') {
    const doc = ingestFrequencies({ name: item.id, notes: item.notes, partials: item.partials ?? 4 });
    probe = doc.tokensBySentence.length - 1;
    deposits = doc.tokensBySentence.map((s) => [...s]);     // the organ's real atoms (overtone bins)
    organLive = doc.modality === 'frequency' && deposits[probe].length > 0;
  } else {
    continue;
  }
  const ch = bornChannels(deposits, probe);
  records.push({
    id: item.id, sense: item.sense, probe, organLive,
    reserveAmp: round(ch.reserveAmp), sumPrior: round(ch.sumPrior), newBins: ch.newBins,
    constBayes: round(ch.constBayes), signalBayes: round(ch.signalBayes),
    surprisal: round(surprisal),
    // Instrument cross-check (text): the reconstructed Born step vs readingAt's own path.
    engConst, engSignal,
    crosscheck: item.sense === 'text' ? (round(ch.constBayes) === engConst && round(ch.signalBayes) === engSignal) : null,
  });
}

const OUT = join(HERE, 'out.jsonl');
writeFileSync(OUT, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`# reserve-rate measurement — ${records.length} items → out.jsonl (γ=${GAMMA})`);
for (const r of records) {
  console.log(`  ${r.id} ${r.sense.padEnd(9)} amp=${String(r.reserveAmp).padStart(7)} sumPrior=${String(r.sumPrior).padStart(7)} newBins=${String(r.newBins).padStart(2)} const=${String(r.constBayes).padStart(5)} signal=${String(r.signalBayes).padStart(5)}${r.crosscheck === false ? '  *** CROSSCHECK MISMATCH ***' : ''}`);
}
