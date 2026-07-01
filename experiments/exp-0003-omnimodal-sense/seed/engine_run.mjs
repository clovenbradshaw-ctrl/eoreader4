// Read each sensory stream with the REAL eoreader4 engine. Nothing here is
// reimplemented — buildDensity/eigenLenses/vonNeumann/deriveNull are imported.
import { buildDensity, eigenLenses, vonNeumann } from './eoreader4/src/core/spectral.js';
import { deriveNull } from './eoreader4/src/core/voidnull.js';
import { readFileSync, writeFileSync } from 'node:fs';

const norm = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));

// salience-weighted direction density: weight_k = ||v_k||, direction = v_k/||v_k||
// (the eoreader shape: salient units weigh more, the reading is the direction).
function toDirWeights(units, center) {
  const D = units[0].length, T = units.length;
  let U = units;
  if (center) {                                  // remove the common-mode (per-dim mean)
    const mean = new Array(D).fill(0);
    for (const u of units) for (let i = 0; i < D; i++) mean[i] += u[i] / T;
    U = units.map(u => u.map((x, i) => x - mean[i]));
  }
  const dirs = [], w = [];
  for (const u of U) { const n = norm(u); w.push(n); dirs.push(n > 1e-9 ? u.map(x => x / n) : u.map(() => 0)); }
  return { dirs, w };
}

// greedy boundary match with tolerance -> precision/recall/F1
function boundaryScore(detected, truth, tol) {
  const used = new Array(truth.length).fill(false); let m = 0;
  for (const d of detected) {
    let bi = -1, best = tol + 1;
    for (let i = 0; i < truth.length; i++) if (!used[i] && Math.abs(d - truth[i]) <= best) { best = Math.abs(d - truth[i]); bi = i; }
    if (bi >= 0) { used[bi] = true; m++; }
  }
  const P = detected.length ? m / detected.length : 0;
  const R = truth.length ? m / truth.length : 0;
  const F1 = (P + R) ? 2 * P * R / (P + R) : 0;
  return { P, R, F1, matched: m, nDet: detected.length, nTrue: truth.length };
}

const medianFilter = (a, w) => a.map((_, i) => {
  const lo = Math.max(0, i - (w >> 1)), hi = Math.min(a.length, i + (w >> 1) + 1);
  const seg = a.slice(lo, hi); const cnt = {}; let best = seg[0], bc = 0;
  for (const x of seg) { cnt[x] = (cnt[x] || 0) + 1; if (cnt[x] > bc) { bc = cnt[x]; best = x; } }
  return best;
});

function run(file) {
  const D = JSON.parse(readFileSync(file));
  const trueBounds = D.boundaries, tol = D.tol;
  const nReadings = new Set(D.labels).size;
  const res = { modality: D.modality, dim: D.dim, T: D.units.length, nReadings, tol,
                trueBounds, labels: D.labels, names: D.names, units: D.units, modes: {} };

  for (const center of [false, true]) {
    const { dirs, w } = toDirWeights(D.units, center);
    const { rho } = buildDensity(dirs, w);
    const lenses = eigenLenses(rho);
    const ev = lenses.map(l => l.weight);
    const S = vonNeumann(ev), eff = Math.exp(S);
    const floor = deriveNull(ev, { scale: 'linear', alpha: 0.05, N: ev.length });
    const abstain = !Number.isFinite(floor);
    const above = abstain ? 0 : ev.filter(x => x > floor).length;

    // top-K lenses covering 90% Born mass (cap 12) = the readings to assign among
    let cum = 0, K = 0, tot = ev.filter(x => x > 0).reduce((a, b) => a + b, 0) || 1;
    while (K < ev.length && cum < 0.9 * tot && K < 12) { cum += Math.max(0, ev[K]); K++; }
    const top = lenses.slice(0, Math.max(1, K));

    const assign = dirs.map(u => {
      let bi = 0, best = -1;
      for (let i = 0; i < top.length; i++) {
        let d = 0; for (let c = 0; c < u.length; c++) d += u[c] * top[i].lens[c];
        if (d * d > best) { best = d * d; bi = i; }
      }
      return bi;
    });
    const sm = medianFilter(assign, 5);
    const sm9 = medianFilter(assign, 9);
    const det = (arr) => arr.map((x, i) => (i && x !== arr[i - 1]) ? i : -1).filter(i => i > 0);
    const segRaw = det(assign), segSm = det(sm), segSm9 = det(sm9);

    res.modes[center ? 'centered' : 'raw'] = {
      topEig: ev.slice(0, 6).map(x => +x.toFixed(4)),
      effParts: +eff.toFixed(3), floor: abstain ? null : +floor.toFixed(5), abstain,
      aboveFloor: above, K: top.length,
      assignSmoothed: sm,
      nSegRaw: segRaw.length + 1, nSegSm: segSm.length + 1, nSegSm9: segSm9.length + 1,
      boundRaw: boundaryScore(segRaw, trueBounds, tol),
      boundSm: boundaryScore(segSm, trueBounds, tol),
      boundSm9: boundaryScore(segSm9, trueBounds, tol),
    };
  }
  return res;
}

const files = ['text_units.json', 'audio_units.json', 'vision_units.json', 'imu_units.json'];
const all = files.map(run);
writeFileSync('sense_results.json', JSON.stringify(all));

// ---- console verdict table -------------------------------------------------
const pct = (x) => (100 * x).toFixed(0).padStart(3) + '%';
console.log('\n' + '='.repeat(92));
console.log('MODALITY | true# | RAW exp(S)  DCdom | CEN exp(S) | voidNull | CEN boundary F1 (smoothed) | segs vs true');
console.log('='.repeat(92));
for (const r of all) {
  const R = r.modes.raw, C = r.modes.centered;
  const dcDom = (R.topEig[0]).toFixed(2);
  console.log(
    `${r.modality.padEnd(8)} |  ${String(r.nReadings).padStart(2)}   | ` +
    `${R.effParts.toFixed(2).padStart(5)}  ${dcDom.padStart(4)} | ` +
    `${C.effParts.toFixed(2).padStart(5)}      | ` +
    `${(C.abstain ? 'ABSTAIN' : 'flr>' + C.aboveFloor).padStart(7)} | ` +
    `F1=${pct(C.boundSm.F1)} (w9 ${pct(C.boundSm9.F1)}) | ` +
    `${C.nSegSm}/${C.nSegSm9} vs ${r.trueBounds.length + 1}`);
}
console.log('='.repeat(92));
console.log('DCdom = fraction of Born mass in the top eigenlens on RAW (finding #1: ~1.0 = common-mode swamps all).');
console.log('CEN exp(S) vs true# : finding #2 — eigenvalue-count vs number of readings (rarely equal).');
console.log('voidNull flr>k : deriveNull returns a floor; k eigenlenses clear it (finding #3 revised — it does NOT abstain at real dims).');
console.log('boundary F1 : assignment-switching segmentation vs known boundaries, median-smooth width 5 (w9 = width 9).');
console.log('segs w5/w9 vs true : over-segmentation shrinks toward truth as smoothing widens (the flicker is smoothable).');
