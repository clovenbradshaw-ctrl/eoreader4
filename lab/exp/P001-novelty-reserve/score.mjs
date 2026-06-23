// BLIND scorer for P001. Reads the stimulus, the held key, and the measured channels.
// It applies the key's verdict rule; it does not re-measure. Order is fixed by the
// discipline: verify the instrument, read the CONTROL first (did the trivial mass/
// diversity explanation get caught), then the per-item SPLIT (not just the aggregate).
//
// Decision policy (the judge's, not the engine's): two channels "dissociate" when the
// smaller is ≤ DISSOC_BAND × the larger in the predicted direction; they "collapse"
// (are blind) when they are equal within EQ_EPS. These are stated so the read is
// reproducible; they are not tuned to the data.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const stim = JSON.parse(readFileSync(join(HERE, 'stimulus.json'), 'utf8'));
const key = JSON.parse(readFileSync(join(HERE, 'key.json'), 'utf8'));
const out = JSON.parse(readFileSync(join(HERE, 'out.json'), 'utf8'));

const DISSOC_BAND = 0.7;   // smaller ≤ 0.7 × larger to count as a clear separation
const EQ_EPS = 1e-6;       // |a−b| < EQ_EPS counts as "blind / collapsed"

const ch = (sense, id) => out[sense][id];
const dissociates = (lo, hi) => lo < hi && lo <= DISSOC_BAND * hi;   // lo predicted below hi
const collapses = (a, b) => Math.abs(a - b) < EQ_EPS;

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

say(`=== P001 · novelty-reserve · blind score ===`);
say(`claim: ${key.claim}`);
say(`mechanism: ${key.mechanismTag}\n`);

// 0 — instrument gate. A score off a dead organ or a starved channel is void.
if (!out.instrument?.ok) {
  say(`INSTRUMENT NOT OK — score VOID. issues: ${(out.instrument?.issues || []).join('; ')}`);
  writeFileSync(join(HERE, 'verdict.json'), JSON.stringify({ verdict: 'VOID', reason: 'instrument', issues: out.instrument?.issues }, null, 2));
  process.exit(0);
}
say(`instrument OK (organs live, text fold reproduces production reading, channels fed)\n`);

const results = { control: {}, mechanism: {}, perSense: {} };

// 1 — CONTROL FIRST. recent vs stale: matched mass+diversity, only newcomer timing differs.
say(`--- CONTROL (read first): recency, mass & diversity matched ---`);
let controlRatePass = true, controlConstBlind = true;
for (const [sense, pairs] of [['text', [['t3', 't4']]], ['frequency', [['f3', 'f4']]]]) {
  for (const [recent, stale] of pairs) {
    const r = ch(sense, recent), s = ch(sense, stale);
    const constBlind = collapses(r.probeSurpriseConst, s.probeSurpriseConst);
    const rateSplit = dissociates(r.probeSurpriseRate, s.probeSurpriseRate);
    controlConstBlind &&= constBlind;
    controlRatePass &&= rateSplit;
    say(`  ${sense}: recent(${recent}) vs stale(${stale})`);
    say(`    const: ${r.probeSurpriseConst} vs ${s.probeSurpriseConst}  → ${constBlind ? 'BLIND (collapsed — mass/diversity surface caught)' : 'moved'}`);
    say(`    rate : ${r.probeSurpriseRate} vs ${s.probeSurpriseRate}  → ${rateSplit ? 'recent < stale (γ-recency, mechanism)' : 'NOT separated'}`);
    results.control[`${sense}:${recent}/${stale}`] = { constBlind, rateSplit, r: r.probeSurpriseRate, s: s.probeSurpriseRate };
  }
}

// 2 — MECHANISM PAIR, per-item split. novel-rich vs confirm-rich at matched mass.
say(`\n--- MECHANISM PAIR: novel-rich vs confirm-rich, mass matched ---`);
let mechRatePass = true, mechConstBlind = true;
for (const [sense, novel, confirm] of [['text', 't1', 't2'], ['frequency', 'f1', 'f2']]) {
  const n = ch(sense, novel), c = ch(sense, confirm);
  const constBlind = collapses(n.probeSurpriseConst, c.probeSurpriseConst);
  const rateSplit = dissociates(n.probeSurpriseRate, c.probeSurpriseRate);
  mechConstBlind &&= constBlind;
  mechRatePass &&= rateSplit;
  say(`  ${sense}: novel-rich(${novel}, mass ${n.streamMass}) vs confirm-rich(${confirm}, mass ${c.streamMass})`);
  say(`    const: ${n.probeSurpriseConst} vs ${c.probeSurpriseConst}  → ${constBlind ? 'BLIND (the GAP — identical on matched mass)' : 'moved'}`);
  say(`    rate : ${n.probeSurpriseRate} vs ${c.probeSurpriseRate}  → ${rateSplit ? 'novel-rich << confirm-rich (newcomer expected after newcomers)' : 'NOT separated'}`);
  results.mechanism[sense] = { constBlind, rateSplit, novel: n.probeSurpriseRate, confirm: c.probeSurpriseRate };
}

// 3 — BRANCH.
const gapReal = mechConstBlind && controlConstBlind;      // status quo is blind on both
const fixWorks = mechRatePass && controlRatePass;         // rate separates on both, both senses
const verdict = (gapReal && fixWorks) ? 'CONFIRMED' : (fixWorks ? 'CONFIRMED-WEAK' : 'GAP-OPEN');

say(`\n--- VERDICT ---`);
say(`  status-quo (const) blind on mechanism pair: ${mechConstBlind}; blind on control: ${controlConstBlind}  → gap real: ${gapReal}`);
say(`  candidate (rate) separates mechanism pair: ${mechRatePass}; separates control: ${controlRatePass}  → fix works: ${fixWorks}`);
say(`  VERDICT: ${verdict}`);
say(verdict === 'CONFIRMED'
  ? `  → The constant reserve is blind to novelty rate AND recency (it tracks only the matched mass). The γ-decayed first-appearance rate, fed through the SAME Born step, recovers both — in TEXT and FREQUENCY. Interior capability confirmed across two senses.`
  : `  → see split above.`);

writeFileSync(join(HERE, 'verdict.json'), JSON.stringify({ verdict, gapReal, fixWorks, results, band: DISSOC_BAND }, null, 2));
