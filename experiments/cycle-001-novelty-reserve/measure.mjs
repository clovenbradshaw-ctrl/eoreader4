// READ-ONLY measurement instrument for cycle-001-novelty-reserve.
//
// Touches no production code (imports the genome's surprise core and the reading path as a
// reader; runs parseText/readingAt, both read-only). Does NOT read key.json and does NOT
// branch on condition identity. For each opaque condition it emits per-channel numbers over
// PRIOR context only, causally; the probe atom (delivered at the final step) is scored under
// the forward distribution the prior built. Both amplitudes — the CONSTANT reserve and the
// signal-derived TRACKED reserve — are run through the SAME law (forwardDist/surpriseAt), so
// the only thing that varies is the amplitude. Output: out.json.
//
// Run: node experiments/cycle-001-novelty-reserve/measure.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { forwardDist, surpriseAt, noveltyAmplitude } from '../../src/core/surprise.js';
import { parseText } from '../../src/perceiver/parse/index.js';
import { readingAt } from '../../src/perceiver/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const stim = JSON.parse(readFileSync(join(here, 'stimulus.json'), 'utf8'));
const γ = stim.gamma, now = stim.probeStep;

// Build the gamma-decayed profile and the first-seen map from a step sequence, exactly as the
// reading path does: an atom deposited at step s contributes gamma^(now-1-s) to the profile,
// and is a "newcomer" at the first step it appears.
const fieldOf = (steps) => {
  const profile = new Map(), firstSeen = new Map();
  steps.forEach((atoms, s) => {
    for (const a of atoms) {
      profile.set(a, (profile.get(a) || 0) + Math.pow(γ, now - 1 - s));
      if (!firstSeen.has(a)) firstSeen.set(a, s);
    }
  });
  return { profile, firstSeen };
};

const items = stim.conditions.map((c) => {
  const { profile, firstSeen } = fieldOf(c.steps);
  const totalMass = [...profile.values()].reduce((x, y) => x + y, 0);
  const nuTracked = noveltyAmplitude(firstSeen, now, { gamma: γ });

  // SAME law (forwardDist), two amplitudes.
  const rConst   = forwardDist(profile, { novelty: 1.0 }).reserve;        // the live engine
  const rTracked = forwardDist(profile, { novelty: nuTracked }).reserve;  // the candidate

  // The probe newcomer arrives: its surprise is -log2(reserve) (it lands on the reserve), and
  // the belief-shift it causes is the KL of the posterior over the prior — both under each law.
  const probeDeposit = new Map([[c.probe, 1]]);
  const klConst   = surpriseAt(profile, probeDeposit, { gamma: γ, novelty: 1.0 }).bayesBits;
  const klTracked = surpriseAt(profile, probeDeposit, { gamma: γ, novelty: nuTracked }).bayesBits;

  return {
    id: c.id, sense: c.sense,
    surface: { totalMass: round(totalMass), distinctCount: firstSeen.size },
    reserve_const: round6(rConst),
    reserve_tracked: round6(rTracked),
    nu_tracked: round6(nuTracked),
    newcomerSurprise_const: round(-Math.log2(rConst)),
    newcomerSurprise_tracked: round(-Math.log2(rTracked)),
    bayes_const: round(klConst),
    bayes_tracked: round(klTracked),
  };
});

// --- INSTRUMENT VERIFICATION (run before any score is trusted). ----------------------------
const reserves = items.flatMap((i) => [i.reserve_const, i.reserve_tracked]);
const instrument = {
  reserves_in_open_interval: reserves.every((r) => r > 0 && r < 1),
  not_all_zero: reserves.some((r) => r > 0),
  tracked_varies: new Set(items.map((i) => i.reserve_tracked)).size > 1,
  const_mass_is_flat_within_sense: ['A', 'B'].every((sense) => {
    const rs = items.filter((i) => i.sense === sense).map((i) => i.reserve_const);
    return Math.max(...rs) - Math.min(...rs) < 1e-9;
  }),
};

// --- PRODUCTION-PATH LIVENESS (the wiring is real, not just the helper). --------------------
// The same RECENT-vs-EARLY contrast through the real text organ: parseText -> readingAt. With
// the reserve wiring OFF the two reorderings give an identical reserve (blind); ON, the recent
// one reserves more. Proves the patch changed the events on the production reading path.
const RECENT = parseText('Ada Long spoke. Ada paused. Ada Long spoke. Ada paused. Ben Cole came. Cara Mell ran. Dax Pell sat.', { docId: 'rec' });
const EARLY  = parseText('Ben Cole came. Cara Mell ran. Dax Pell sat. Ada Long spoke. Ada paused. Ada Long spoke. Ada paused.', { docId: 'erl' });
const probeOf = (d) => (d.units || d.sentences).length - 1;
const reserveOfDoc = (d, on) => readingAt(d, probeOf(d), { forward: true, signalReserve: on }).pNext.reserve;
const liveness = {
  off: { RECENT: round6(reserveOfDoc(RECENT, false)), EARLY: round6(reserveOfDoc(EARLY, false)) },
  on:  { RECENT: round6(reserveOfDoc(RECENT, true)),  EARLY: round6(reserveOfDoc(EARLY, true)) },
};

const out = { experiment: stim.experiment, gamma: γ, probeStep: now, items, instrument, liveness };
writeFileSync(join(here, 'out.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));

function round(x)  { return Math.round(x * 100) / 100; }
function round6(x) { return Math.round(x * 1e6) / 1e6; }
