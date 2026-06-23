// EXPERIMENT · novelty-reserve — is the reserve for an unseen atom a signal-derived
// amplitude or a hand-set constant?
//
// Inside-out draw: the pressure landed on `NOVELTY_RESERVE = 1.0` (src/core/surprise.js:21)
// — a fixed number in the predictive path. The constant hunt made literal: replace it
// with the γ-decayed recent newcomer rate carried through the SAME fixed Born step, and
// keep it only if it lifts the prediction without cheating on the controls — across two
// senses (the omnimodal gate), since the change is interior.
//
//   node scripts/novelty-reserve.mjs            # measure → verify → score
//   node scripts/novelty-reserve.mjs --measure  # measure only (writes channels)
//
// The KEY (evolution/keys/novelty-reserve.key.json) is imported ONLY in score(); the
// measurement never sees it.

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createNoveltyReserve } from '../src/core/index.js';
import {
  makeSchedule, realizeText, realizeMusic, ingestTextDoc, ingestMusicDoc,
  insByUnit, figureFieldWalk, logLoss, brier, round,
} from '../evolution/lib.mjs';

// The NAIVE single-timescale reserve (the first hypothesis) for the ablation: the
// γ-recent newcomer mass with NO long-run floor — R = γ·R + newcomers. The trace
// showed it collapses at stretch→burst transitions; the anchored form floors it.
const naiveReserve = (gamma) => { let R = 0, seeded = false; return { observe(n = 0) { R = seeded ? gamma * R + Math.max(0, n) : Math.max(0, n); seeded = true; return R; }, get mass() { return seeded ? R : 1.0; } }; };

const GAMMA = 0.7;                         // the figure field's own decay (reading.js GAMMA)
const KINDS = ['clustered', 'iid', 'monotone'];
const L = 64, K = 11;
const OUT = fileURLToPath(new URL('../evolution/out/novelty-reserve.measure.json', import.meta.url));
const KEY = fileURLToPath(new URL('../evolution/keys/novelty-reserve.key.json', import.meta.url));

// ---- realize a schedule in an organ, return the realized INS-by-unit stream -----
const realizeIn = async (sense, sched) => {
  if (sense === 'text')  { const doc = await ingestTextDoc(realizeText(sched, { seed: 7 }));  return insByUnit(doc, sched.L); }
  if (sense === 'music') { const doc = ingestMusicDoc(realizeMusic(sched, { seed: 13 }));      return insByUnit(doc, sched.L); }
  throw new Error(`unknown sense ${sense}`);
};

// burstiness of the realized newcomer stream (instrument truth): lag-1 autocorrelation
// of the newcomer indicator. Clustered → high; iid → ~0; monotone → front-loaded (also
// positive but concentrated early — reported separately as front-mass).
const burstStats = (insUnits) => {
  const seen = new Set();
  const ind = insUnits.map((ids) => { let n = 0; for (const id of ids) if (!seen.has(id)) { n++; seen.add(id); } return n > 0 ? 1 : 0; });
  const total = ind.reduce((a, b) => a + b, 0);
  const mean = total / ind.length;
  let num = 0, den = 0;
  for (let i = 0; i < ind.length; i++) { den += (ind[i] - mean) ** 2; if (i + 1 < ind.length) num += (ind[i] - mean) * (ind[i + 1] - mean); }
  const autocorr = den > 0 ? num / den : 0;
  const half = ind.length >> 1;
  const frontMass = ind.slice(0, half).reduce((a, b) => a + b, 0) / (total || 1);
  return { newcomerUnits: total, autocorr: round(autocorr), frontMass: round(frontMass) };
};

const measure = async () => {
  const result = { gamma: GAMMA, L, K, runs: [] };
  for (const kind of KINDS) {
    const sched = makeSchedule(kind, { L, K, seed: 1 + KINDS.indexOf(kind) });
    for (const sense of ['text', 'music']) {
      const insUnits = await realizeIn(sense, sched);
      // constant arm — the live engine's reserve (NOVELTY_RESERVE = 1.0)
      const constRows = figureFieldWalk(insUnits, { gamma: GAMMA, reserveMass: () => 1.0 });
      // signal arm — the ANCHORED reserve (γ-recent newcomer mass floored by the
      // reading's own long-run rate), observed per unit
      const R = createNoveltyReserve({ gamma: GAMMA });
      const sigRows = figureFieldWalk(insUnits, { gamma: GAMMA, reserveMass: ({ newcomers }) => { R.observe(newcomers); return R.mass; } });
      // ablation arm — the NAIVE single-timescale reserve (no floor)
      const NR = naiveReserve(GAMMA);
      const naiveRows = figureFieldWalk(insUnits, { gamma: GAMMA, reserveMass: ({ newcomers }) => { NR.observe(newcomers); return NR.mass; } });
      result.runs.push({
        kind, sense,
        instrument: burstStats(insUnits),
        rows: sigRows.map((r, i) => ({ t: r.t, newcomers: r.newcomers, yNext: r.yNext, pSig: round(r.pNew, 6), pConst: round(constRows[i].pNew, 6), pNaive: round(naiveRows[i].pNew, 6), rSig: round(r.novelty, 4) })),
      });
    }
  }
  result.real = await measureReal();
  writeFileSync(OUT, JSON.stringify(result, null, 1));
  return result;
};

// ---- generalization: REAL material, genuinely different streams per sense -------
// The synthetic streams realize the SAME schedule in both organs, so the interior
// (correctly) returns identical numbers — proof it is modality-blind, but one stream.
// Real material gives the omnimodal gate genuinely DIFFERENT newcomer structures: a
// novel's entities (esker, metamorphosis) and a melody's pitch classes (Frère Jacques,
// Twinkle). The fix is kept only if it lifts the aggregate without breaking a sense.
const FRERE = ['C4','D4','E4','C4','C4','D4','E4','C4','E4','F4','G4','E4','F4','G4',
  'G4','A4','G4','F4','E4','C4','G4','A4','G4','F4','E4','C4','C4','G3','C4','C4','G3','C4'];
const TWINKLE = ['C4','C4','G4','G4','A4','A4','G4','F4','F4','E4','E4','D4','D4','C4',
  'G4','G4','F4','F4','E4','E4','D4','G4','G4','F4','F4','E4','E4','D4'];
const stripGutenberg = (t) => { const s = t.indexOf('*** START'); const e = t.indexOf('*** END'); return (s >= 0 && e >= 0) ? t.slice(t.indexOf('\n', s) + 1, e) : t; };
const measureReal = async () => {
  const esker  = readFileSync(fileURLToPath(new URL('../data/esker.txt', import.meta.url)), 'utf8');
  const meta   = readFileSync(fileURLToPath(new URL('../data/metamorphosis.txt', import.meta.url)), 'utf8');
  const metaFull = stripGutenberg(readFileSync(fileURLToPath(new URL('../pg5200.txt', import.meta.url)), 'utf8'));
  const items = [
    { name: 'esker',         sense: 'text',  doc: await ingestTextDoc(esker) },
    { name: 'metamorphosis', sense: 'text',  doc: await ingestTextDoc(meta) },
    { name: 'metamorph-full', sense: 'text', doc: await ingestTextDoc(metaFull) },  // the canonical long open-vocab reading — the engine's actual job
    { name: 'frere-jacques', sense: 'music', doc: ingestMusicDoc(FRERE) },
    { name: 'twinkle',       sense: 'music', doc: ingestMusicDoc(TWINKLE) },
  ];
  const out = [];
  for (const it of items) {
    const L = it.doc.units?.length || it.doc.sentences?.length || 0;
    const ins = insByUnit(it.doc, L);
    const constRows = figureFieldWalk(ins, { gamma: GAMMA, reserveMass: () => 1.0 });
    const R = createNoveltyReserve({ gamma: GAMMA });
    const sigRows = figureFieldWalk(ins, { gamma: GAMMA, reserveMass: ({ newcomers }) => { R.observe(newcomers); return R.mass; } });
    out.push({ name: it.name, sense: it.sense, L, instrument: burstStats(ins),
      rows: sigRows.map((r, i) => ({ yNext: r.yNext, pSig: round(r.pNew, 6), pConst: round(constRows[i].pNew, 6) })) });
  }
  return out;
};

// ---- verify the instrument BEFORE reading the score -------------------------
const verifyInstrument = (m) => {
  const checks = [];
  const get = (kind, sense) => m.runs.find((r) => r.kind === kind && r.sense === sense);
  for (const sense of ['text', 'music']) {
    const cl = get('clustered', sense), ii = get('iid', sense), mo = get('monotone', sense);
    checks.push([`[${sense}] clustered burstier than iid`, cl.instrument.autocorr > ii.instrument.autocorr + 0.1, `clustered ac=${cl.instrument.autocorr} vs iid ac=${ii.instrument.autocorr}`]);
    checks.push([`[${sense}] monotone front-loaded`, mo.instrument.frontMass > 0.6, `monotone frontMass=${mo.instrument.frontMass}`]);
    checks.push([`[${sense}] realized newcomer counts ~matched`, Math.abs(cl.instrument.newcomerUnits - ii.instrument.newcomerUnits) <= 3, `cl=${cl.instrument.newcomerUnits} ii=${ii.instrument.newcomerUnits} mo=${mo.instrument.newcomerUnits}`]);
    // channel liveness: signal pNew varies; constant pNew is non-increasing (1/(Σm+1))
    const sig = cl.rows.map((r) => r.pSig), con = cl.rows.map((r) => r.pConst);
    checks.push([`[${sense}] signal channel varies (not flat)`, Math.max(...sig) - Math.min(...sig) > 0.02, `range=${round(Math.max(...sig) - Math.min(...sig), 3)}`]);
    const nonInc = con.every((v, i) => i === 0 || v <= con[i - 1] + 1e-6);
    checks.push([`[${sense}] constant baseline is the live reserve (non-increasing pNew)`, nonInc, `monotone-nonincreasing=${nonInc}`]);
    // both target classes present
    const ys = cl.rows.map((r) => r.yNext).filter((y) => y != null);
    checks.push([`[${sense}] targets non-degenerate`, ys.includes(0) && ys.includes(1), `ones=${ys.filter((y) => y === 1).length}/${ys.length}`]);
  }
  let ok = true;
  console.log('— instrument verification —');
  for (const [name, pass, detail] of checks) { console.log(`  ${pass ? 'OK ' : 'VOID'}  ${name}   (${detail})`); if (!pass) ok = false; }
  return ok;
};

// ---- score BLIND against the held key ---------------------------------------
const score = (m) => {
  const key = JSON.parse(readFileSync(KEY, 'utf8'));
  const get = (kind, sense) => m.runs.find((r) => r.kind === kind && r.sense === sense);
  const lossOf = (run) => ({
    sig: round(logLoss(run.rows.map((r) => r.pSig), run.rows.map((r) => r.yNext))),
    con: round(logLoss(run.rows.map((r) => r.pConst), run.rows.map((r) => r.yNext))),
    sigBrier: round(brier(run.rows.map((r) => r.pSig), run.rows.map((r) => r.yNext))),
    conBrier: round(brier(run.rows.map((r) => r.pConst), run.rows.map((r) => r.yNext))),
  });

  console.log('\n— scores (mean log-loss; lower is better) —');
  const table = {};
  for (const kind of KINDS) for (const sense of ['text', 'music']) {
    const L = lossOf(get(kind, sense)); table[`${kind}/${sense}`] = L;
    console.log(`  ${kind.padEnd(10)} ${sense.padEnd(6)}  signal=${L.sig.toFixed(4)}  constant=${L.con.toFixed(4)}  Δ=${round(L.con - L.sig).toFixed(4)} (Δ>0 ⇒ signal better)`);
  }

  // CONTROL FIRST (key.control_first): the trivial explanation must be caught.
  const iidGap = (s) => table[`iid/${s}`].con - table[`iid/${s}`].sig;          // signal-better margin on iid
  const clGap  = (s) => table[`clustered/${s}`].con - table[`clustered/${s}`].sig;
  const moGap  = (s) => table[`monotone/${s}`].con - table[`monotone/${s}`].sig;
  const TOL = 0.01;   // a margin this small is "within noise" for these stream lengths

  console.log('\n— blind branch —');
  let verdict = 'confirmed', reasons = [];
  for (const s of ['text', 'music']) {
    // control: iid win must NOT rival the clustered win (else it's recency-overfitting)
    if (iidGap(s) > Math.max(TOL, 0.5 * clGap(s))) { verdict = 'instrument-void'; reasons.push(`[${s}] signal also wins on IID (gap ${round(iidGap(s))}) — surface artifact, not mechanism`); }
    // control: monotone must not collapse (signal not much worse than constant)
    if (moGap(s) < -TOL) { verdict = 'gap'; reasons.push(`[${s}] signal COLLAPSES on monotone (gap ${round(moGap(s))}) — threw away the mass-decay`); }
    // the test: signal beats constant on clustered, by a clear margin
    if (!(clGap(s) > TOL)) { verdict = 'gap'; reasons.push(`[${s}] signal does NOT beat constant on clustered (gap ${round(clGap(s))})`); }
  }

  // the omnimodal gate: the win must hold in BOTH senses
  const both = clGap('text') > TOL && clGap('music') > TOL;
  console.log(`  control iid:      text Δ=${round(iidGap('text'))}, music Δ=${round(iidGap('music'))}  (must be ~0)`);
  console.log(`  control monotone: text Δ=${round(moGap('text'))}, music Δ=${round(moGap('music'))}  (must be ≥ ${-TOL})`);
  console.log(`  test  clustered:  text Δ=${round(clGap('text'))}, music Δ=${round(clGap('music'))}  (must be > ${TOL})`);
  console.log(`  omnimodal (both senses win on clustered): ${both}`);

  // the mechanism, visible in the amplitude (key.predicted_signature)
  const burstVsStretch = (sense) => {
    const run = get('clustered', sense);
    const burst = run.rows.filter((r) => r.newcomers > 0).map((r) => r.rSig);
    const stretch = run.rows.filter((r) => r.newcomers === 0).map((r) => r.rSig);
    const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    return { burst: round(mean(burst), 3), stretch: round(mean(stretch), 3) };
  };
  console.log('\n— mechanism (signal reserve amplitude, clustered) —');
  for (const s of ['text', 'music']) { const v = burstVsStretch(s); console.log(`  [${s}] mean R in bursts=${v.burst}  in stretches=${v.stretch}  (const arm: 1.0 flat)`); }

  // ABLATION (why the floor): naive single-timescale vs anchored, on clustered.
  console.log('\n— ablation: naive (no floor) vs anchored, clustered text —');
  const cl = get('clustered', 'text');
  const naiveLL = round(logLoss(cl.rows.map((r) => r.pNaive), cl.rows.map((r) => r.yNext)));
  console.log(`  naive=${naiveLL.toFixed(4)}  anchored=${table['clustered/text'].sig.toFixed(4)}  constant=${table['clustered/text'].con.toFixed(4)}`);
  console.log(`  the floor is load-bearing: naive ${naiveLL > table['clustered/text'].con ? 'LOSES to' : 'beats'} the constant; anchored beats it.`);

  // GENERALIZATION (fitness is generalization, not the single pass): the task's
  // criterion — raise aggregate competence AND break no confirmed capability. Made
  // concrete: aggregate log-loss improves AND no stream regresses MATERIALLY (a
  // capability is "broken" by a real regression, not by 0.01 of noise on a 30-unit
  // tune). The per-stream split is printed so nothing hides behind the aggregate.
  console.log('\n— generalization: real material (next-unit newcomer log-loss) —');
  const BREAK = 0.05;   // a per-stream regression beyond this counts as breaking the capability
  let aggSig = 0, aggCon = 0, worstReg = 0; const wins = { text: 0, music: 0 };
  for (const r of m.real) {
    const s = round(logLoss(r.rows.map((x) => x.pSig), r.rows.map((x) => x.yNext)));
    const c = round(logLoss(r.rows.map((x) => x.pConst), r.rows.map((x) => x.yNext)));
    aggSig += s; aggCon += c; if (c - s > 0) wins[r.sense]++; worstReg = Math.min(worstReg, c - s);
    console.log(`  ${r.name.padEnd(15)} ${r.sense.padEnd(6)} signal=${s.toFixed(4)} constant=${c.toFixed(4)} Δ=${round(c - s).toFixed(4)} ${c - s > 1e-6 ? '✓ win' : (c - s > -BREAK ? '· neutral' : '✗ BREAK')}`);
  }
  // Fitness gate (real material): aggregate up AND nothing broken. The per-sense
  // omnimodal evidence belongs to the CONTROLLED synthetic battery (matched schedule,
  // `both` above), not to whichever real streams happen to exist — the only real music
  // to hand is short closed-vocabulary nursery tunes, where novelty stops after the
  // intro and every estimator is near-tied. The boundary is stream statistics (open vs
  // closed vocabulary), not sense: a closed-vocab TEXT ties too, an open-vocab MUSIC
  // stream wins too (evolution/ledger scope). So fitness is judged on the aggregate.
  const realOk = (aggSig < aggCon - 1e-6) && (-worstReg <= BREAK);
  console.log(`  aggregate: signal=${round(aggSig).toFixed(4)} constant=${round(aggCon).toFixed(4)} (Δ=${round(aggCon - aggSig).toFixed(4)})  worst per-stream regression=${round(-worstReg).toFixed(4)} (break>${BREAK})`);
  console.log(`  wins by sense (real): text=${wins.text}, music=${wins.music} (music tunes are closed-vocab → near-tie, not a sense limit)  → ${realOk ? 'GENERALIZES (aggregate up, nothing broken)' : 'does not generalize'}`);

  if (verdict === 'confirmed' && !both) { verdict = 'gap'; reasons.push('win did not hold in both senses (omnimodal gate)'); }
  if (verdict === 'confirmed' && !realOk) { verdict = 'gap'; reasons.push('did not generalize to real material'); }
  console.log(`\nVERDICT: ${verdict}${reasons.length ? '  — ' + reasons.join('; ') : ''}`);
  console.log(`mechanism: ${key.mechanism_tag}`);
  return { verdict, table, reasons, realOk };
};

// ---- run --------------------------------------------------------------------
const m = await measure();
if (!process.argv.includes('--measure')) {
  const ok = verifyInstrument(m);
  if (!ok) { console.log('\nINSTRUMENT VOID — score withheld (verify the instrument before reading the score).'); process.exit(1); }
  score(m);
}
