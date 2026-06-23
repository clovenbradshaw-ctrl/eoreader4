// READ-ONLY measurement for P001. Touches no production code; the test suite stays
// byte-identical. It folds each item, in each sense, into the proposition basis through
// that sense's FRONT-END map, then runs the SHARED interior (surpriseAt / forwardDist /
// noveltyRate) at the probe under two reserves:
//
//   • const  — the status quo: novelty = NOVELTY_RESERVE (1.0), the 1/(mass+1) reserve.
//   • rate   — the candidate: novelty = noveltyRate(priorArrivals), the γ-decayed
//              first-appearance rate (signal-derived amplitude, same Born step).
//
// Both senses run IDENTICAL interior code; only the front-end (text = the parser; freq =
// a pitch-identity map over the organ's own frequency grain) differs. That is the
// omnimodal test: if the rate reserve helps both, the change is interior, not a text fact.
//
// Per item it emits: streamMass, reserveProb (const|rate), probeSurpriseBits (const|rate).
// It does NOT read key.json. Verdict is the scorer's job.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { surpriseAt, forwardDist, noveltyRate, NOVELTY_RESERVE } from '../../../src/core/index.js';
import { parseText } from '../../../src/perceiver/parse/index.js';
import { readingAt } from '../../../src/perceiver/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAMMA = 0.7;                                   // the default reading horizon (reading.js)
const stim = JSON.parse(readFileSync(join(HERE, 'stimulus.json'), 'utf8'));
const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

// ---- the shared interior, run at the probe (sense-agnostic) ----------------
// arrivalSets: one Set<atom> per unit, the LAST being the probe. Causal: the profile
// is the γ-decayed sum of the prior units; the probe is scored against it.
function channelsAtProbe(arrivalSets) {
  const N = arrivalSets.length - 1;                  // prior length; probe at index N
  const prior = arrivalSets.slice(0, N);
  const probe = arrivalSets[N];
  const profile = new Map();                         // priorProp at cursor N: weight γ^(N-1-s)
  for (let s = 0; s < N; s++) {
    const w = Math.pow(GAMMA, (N - 1) - s);
    for (const a of prior[s]) profile.set(a, (profile.get(a) || 0) + w);
  }
  const probeDeposit = new Map();
  for (const a of probe) probeDeposit.set(a, (probeDeposit.get(a) || 0) + 1);

  const R = noveltyRate(prior, { gamma: GAMMA });
  const rateAmp = R > 0 ? R : NOVELTY_RESERVE;       // opening (no prior) keeps the constant; result is 0 there anyway
  const streamMass = [...profile.values()].reduce((s, m) => s + m, 0);

  return {
    streamMass: round(streamMass),
    noveltyRateAmp: round(R),
    reserveConst: round(forwardDist(profile, { novelty: NOVELTY_RESERVE }).reserve),
    reserveRate: round(forwardDist(profile, { novelty: rateAmp }).reserve),
    probeSurpriseConst: round(surpriseAt(profile, probeDeposit, { gamma: GAMMA, novelty: NOVELTY_RESERVE }).bayesBits),
    probeSurpriseRate: round(surpriseAt(profile, probeDeposit, { gamma: GAMMA, novelty: rateAmp }).bayesBits),
    profileAtoms: profile.size,
  };
}

// ---- front-end maps: raw signal → proposition-basis atoms per unit ---------

// TEXT — the parser organ. Fold its events exactly as reading.js builds its deposit.
function textArrivals(units, probe) {
  const all = [...units, probe];
  const doc = parseText(all.join(' '), { docId: 'p001' });
  const ev = doc.log.snapshot ? doc.log.snapshot() : doc.log.events;
  const sets = Array.from({ length: all.length }, () => new Set());
  for (const e of ev) {
    if (e.sentIdx == null || e.sentIdx >= all.length) continue;
    const S = sets[e.sentIdx];
    if (e.op === 'INS') S.add(`f:${e.id}`);
    else if (e.op === 'CON' || e.op === 'SIG') { S.add(`f:${e.src}`); S.add(`f:${e.tgt}`); S.add(`p:${e.src}|${e.via || ''}|${e.tgt}`); }
    else if (e.op === 'DEF' && e.key === 'predicate') { S.add(`f:${e.id}`); S.add(`d:${e.id}|${e.value}`); }
  }
  const sentCount = (doc.units || doc.sentences || []).length;
  const insCount = ev.filter(e => e.op === 'INS').length;
  return { sets, doc, organLive: insCount > 0 && sentCount === all.length, sentCount, insCount };
}

// FREQUENCY — a pitch-identity adapter over the organ's own frequency grain (TOL 0.5%,
// the finest distinction the reader is asked to make; NOT a scale). Same Hz → same bin →
// confirmation; a new Hz → new bin → newcomer. A unit deposits its pitch atom and, after
// the first, the bare frequency-ratio bond to the previous pitch — INS + CON, as the text
// fold does. This is the only modality-specific code; the interior is shared.
const TOL = 0.005;
const pitchBin = (hz) => `h${Math.round(Math.log(hz) / Math.log(1 + TOL))}`;
function freqArrivals(hzList, probeHz) {
  const all = [...hzList, probeHz];
  const sets = all.map(() => new Set());
  let prevBin = null;
  all.forEach((hz, i) => {
    const b = pitchBin(hz);
    sets[i].add(`f:${b}`);
    if (prevBin !== null) sets[i].add(`p:${prevBin}|x${(hz / all[i - 1]).toFixed(3)}|${b}`);
    prevBin = b;
  });
  const distinctBins = new Set(all.map(pitchBin)).size;
  return { sets, organLive: distinctBins > 1, distinctBins };
}

// ---- run + instrument verification -----------------------------------------
const out = { pressure: 'P001', gamma: GAMMA, generatedAt: new Date().toISOString(), text: {}, frequency: {}, instrument: {} };
const issues = [];

for (const item of stim.text) {
  const fe = textArrivals(item.units, item.probe);
  if (!fe.organLive) issues.push(`text ${item.id}: organ not live (sent ${fe.sentCount}/${item.units.length + 1}, INS ${fe.insCount})`);
  const ch = channelsAtProbe(fe.sets);
  // INSTRUMENT CROSS-CHECK: the front-end fold must reproduce the production reading's
  // const-reserve bayes channel byte-for-byte, or the instrument — not the engine — is wrong.
  const prod = round(readingAt(fe.doc, item.units.length).bayesBits, 2);
  const mine = round(ch.probeSurpriseConst, 2);
  ch.matchesReadingAt = prod === mine;
  if (!ch.matchesReadingAt) issues.push(`text ${item.id}: fold≠readingAt (${mine} vs ${prod})`);
  if (ch.profileAtoms === 0) issues.push(`text ${item.id}: profile empty (channel starved)`);
  out.text[item.id] = ch;
}

for (const item of stim.frequency) {
  const fe = freqArrivals(item.hz, item.probe);
  if (!fe.organLive) issues.push(`freq ${item.id}: organ not live (distinct bins ${fe.distinctBins})`);
  const ch = channelsAtProbe(fe.sets);
  if (ch.profileAtoms === 0) issues.push(`freq ${item.id}: profile empty (channel starved)`);
  out.frequency[item.id] = ch;
}

out.instrument = {
  ok: issues.length === 0,
  issues,
  note: 'organLive = the intended organ emitted structure; matchesReadingAt = the text front-end reproduces the production reading const channel; a non-empty profile = the channel was fed, not starved.',
};

writeFileSync(join(HERE, 'out.json'), JSON.stringify(out, null, 2));
console.log(issues.length ? `INSTRUMENT ISSUES:\n  ${issues.join('\n  ')}` : 'instrument OK — organs live, fold matches production, channels fed.');
console.log('wrote out.json');
