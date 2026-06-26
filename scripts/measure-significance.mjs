// measure-significance.mjs — the "measurement first" gates for the Significance column.
//
// The significance-column spec ships three passes behind a falsifiable gate each:
//   • Atmosphere — does the tone instrument recover a labelled Ground-grain cell, and
//                  does an interpretive (loaded) document depart the corpus prior more
//                  than a factual (neutral) one?
//   • Lens       — does the 27-cell projection SEPARATE frames that the raw embedding
//                  collapses (same site-kind, different operator = same topic, different
//                  reading)?
//   • Paradigm   — is a different cube ROW incommensurable past a within-row baseline?
//
// The honest material is clovenbradshaw-ctrl/eo-lexical-analysis-2.0. Its run dir ships
// `embeddings.npz` (a Google-Drive pointer) — 19,764 multilingual clauses, each LABELLED
// with its cube cell (operator + q1/q2/q3 axes) and carrying a real embedding. That is
// the corpus the gates want. Two modes:
//
//   node scripts/measure-significance.mjs                 # archetype grain: the 27
//        shipped MiniLM centroids (data/centroids-27.json) — one labelled point per cell,
//        no within-cell variance. Validates the instruments, runs with zero network.
//
//   node scripts/measure-significance.mjs --npz <dir>     # per-exemplar grain: a dir of
//        the extracted .npy members (operator/q1/q2/q3/vectors/...). Builds the 27-cell
//        significance basis FROM the labelled corpus and runs every gate with real
//        within-cell variance — the full spec measurement.
//
// To get <dir>: read the run's embeddings.npz (it contains a Google-Drive URL), download
// the .npz, `unzip` it. No huggingface needed — the vectors are already in the file.

import { readFileSync } from 'node:fs';
import {
  buildDensity, eigenLenses, vonNeumann, relEntropy, commutator, projectorFrom,
  deriveNull, terrainInfo, cellOf, aliasOperator,
} from '../src/core/index.js';
import { centroidBasis, projectUnit, corpusSigma, atmosphereFromActivations } from '../src/surfer/index.js';

const round = (x, n = 4) => Math.round(x * 10 ** n) / 10 ** n;
const cos = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12); };
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const normalize = (v) => { const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1; return v.map(x => x / n); };

// ── .npy readers (pure node — no numpy) ───────────────────────────────────────
const npyHead = (b) => { const major = b[6]; const hlen = major >= 2 ? b.readUInt32LE(8) : b.readUInt16LE(8); const off = (major >= 2 ? 12 : 10); return { head: b.slice(off, off + hlen).toString('latin1'), data: off + hlen }; };
const readStrNpy = (path) => {
  const b = readFileSync(path); const { head, data } = npyHead(b);
  const W = +/<U(\d+)/.exec(head)[1]; const N = +/shape': \((\d+)/.exec(head)[1];
  const out = []; for (let i = 0; i < N; i++) { let s = ''; for (let c = 0; c < W; c++) { const cp = b.readUInt32LE(data + (i * W + c) * 4); if (cp) s += String.fromCodePoint(cp); } out.push(s); } return out;
};
const readF4Npy = (path) => {
  const b = readFileSync(path); const { head, data } = npyHead(b);
  const m = /shape': \((\d+), (\d+)\)/.exec(head); const N = +m[1], D = +m[2];
  const arr = new Float32Array(b.buffer, b.byteOffset + data, N * D);
  return { N, D, row: (i) => arr.subarray(i * D, i * D + D) };
};

const GRAIN_OF_Q3 = { ENTITY: 'Figure', CONDITION: 'Ground', PATTERN: 'Pattern' };

// ── load `units` (each: cell, raw vector, terrain/domain) + the significance basis ──
let units, basis;
const npzArg = process.argv.indexOf('--npz');
if (npzArg >= 0 && process.argv[npzArg + 1]) {
  const dir = process.argv[npzArg + 1].replace(/\/$/, '');
  const op = readStrNpy(`${dir}/operator.npy`), q3 = readStrNpy(`${dir}/q3.npy`);
  const vec = readF4Npy(`${dir}/vectors.npy`);
  console.log(`grain: per-exemplar (${vec.N} labelled clauses, ${vec.D}-d, from ${dir})\n`);
  units = [];
  for (let i = 0; i < vec.N; i++) {
    const cellInfo = cellOf(aliasOperator(op[i]), GRAIN_OF_Q3[q3[i]]);
    if (!cellInfo) continue;
    const info = terrainInfo(cellInfo.terrain) || {};
    units.push({ cell: cellInfo.key, raw: Array.from(vec.row(i)), terrain: cellInfo.terrain, domain: info.domain, grain: info.grain });
  }
  // Build the 27-cell significance basis FROM the corpus: each cell's centroid is the
  // normalised mean of its clause vectors — the labelled cell geometry, in-space.
  const sums = new Map(), counts = new Map();
  for (const u of units) {
    if (!sums.has(u.cell)) { sums.set(u.cell, new Array(u.raw.length).fill(0)); counts.set(u.cell, 0); }
    const s = sums.get(u.cell); for (let j = 0; j < u.raw.length; j++) s[j] += u.raw[j]; counts.set(u.cell, counts.get(u.cell) + 1);
  }
  const keys = [...sums.keys()].sort();
  basis = { keys, vecs: keys.map(k => normalize(sums.get(k).map(x => x / counts.get(k)))) };
  console.log(`basis: ${keys.length} cell centroids built from corpus means (counts ${Math.min(...[...counts.values()])}–${Math.max(...[...counts.values()])} per cell)\n`);
} else {
  const bundle = JSON.parse(readFileSync(new URL('../data/centroids-27.json', import.meta.url)));
  basis = centroidBasis(bundle);
  const parse = (cell) => { const t = cell.split('_')[2]; const info = terrainInfo(t) || {}; return { terrain: t, domain: info.domain, grain: info.grain }; };
  units = Object.keys(bundle.vectors).map(k => ({ cell: k, raw: bundle.vectors[k], ...parse(k) }));
  console.log(`grain: per-centroid archetype (${units.length} labelled points; one per cell)`);
  console.log('note: per-exemplar gates need the corpus embeddings — pass --npz <dir> (see header).\n');
}
for (const u of units) u.act = projectUnit(u.raw, basis);
// MEASURED: the cosine projection has a large common offset; subtracting the mean
// activation (basis-derived, the corpus prior's own mean reading) exposes the
// frame-bearing deviation. The spread reads (lens separation, departure) use `cact`.
const gmean = new Array(basis.keys.length).fill(0);
for (const u of units) for (let j = 0; j < gmean.length; j++) gmean[j] += u.act[j] / units.length;
for (const u of units) u.cact = u.act.map((x, j) => x - gmean[j]);
const byTerrain = (t) => units.filter(u => u.terrain === t);
const byDomain  = (d) => units.filter(u => u.domain === d);

// ── GATE 1 — Atmosphere ────────────────────────────────────────────────────────
console.log('── GATE 1 · Atmosphere ────────────────────────────────────────────────');
{
  let hit = 0, tot = 0;
  for (const cell of [...new Set(byTerrain('Atmosphere').map(u => u.cell))].sort()) {
    const acts = units.filter(u => u.cell === cell).map(u => u.act);
    const atm = atmosphereFromActivations(acts, basis, { alpha: 0.05 });
    const ok = atm.tone?.cell === cell; hit += ok ? 1 : 0; tot += 1;
    console.log(`  ${cell.padEnd(28)} → tone ${String(atm.tone?.cell).padEnd(28)} ${ok ? 'OK' : 'MISS'}`);
  }
  console.log(`  tone recovery: ${hit}/${tot}`);
  // neutral (factual) vs loaded (interpretive): does the Significance-domain document
  // depart the corpus prior more than the Existence-domain one? On the CENTERED
  // activations (the uncentered KL collapses — see the Lens gate and atmosphere.js).
  const sigmaActs = basis.vecs.map(v => projectUnit(v, basis).map((x, j) => x - gmean[j]));
  const sigma = buildDensity(sigmaActs).rho;
  const dep = (d) => { const acts = byDomain(d).map(u => u.cact); return acts.length ? round(relEntropy(buildDensity(acts).rho, sigma)) : null; };
  const depSig = dep('Interpretation'), depExist = dep('Existence'), depStruct = dep('Structure');
  console.log(`  departure from corpus prior σ:  Interpretation(loaded) ${depSig}   Existence(factual) ${depExist}   Structure ${depStruct}`);
  console.log(`  verdict: ${hit === tot ? 'tone PASS' : 'tone PARTIAL'}; ` +
    `${depSig != null && depExist != null ? (depSig > depExist ? 'loaded departs further — separation PRESENT' : 'no loaded>neutral separation') : 'departure n/a'}\n`);
}

// ── GATE 2 — Lens (frame separation, raw vs projected) ─────────────────────────
console.log('── GATE 2 · Lens (frame separation: raw embedding vs 27-cell projection) ─');
{
  // Same-terrain / different-operator = same site-kind, different reading. The margin is
  // mean within-cell similarity − mean cross-cell similarity; positive and larger = more
  // separable. Measured in raw space and in the projected (27-cell) space.
  const sampleMargin = (space /* 'raw'|'act'|'cact' */) => {
    const vecOf = (u) => u[space];
    const terrains = ['Atmosphere', 'Lens', 'Paradigm', 'Entity', 'Link'];
    const within = [], cross = [];
    for (const t of terrains) {
      const us = byTerrain(t); if (us.length < 4) continue;
      const cells = [...new Set(us.map(u => u.cell))];
      // cap per cell for speed/determinism
      const cap = 40;
      const byCell = cells.map(c => us.filter(u => u.cell === c).slice(0, cap));
      for (let a = 0; a < byCell.length; a++) {
        for (let i = 0; i < byCell[a].length; i++) {
          for (let j = i + 1; j < byCell[a].length; j++) within.push(cos(vecOf(byCell[a][i]), vecOf(byCell[a][j])));
          for (let b = a + 1; b < byCell.length; b++)
            for (let j = 0; j < byCell[b].length; j++) cross.push(cos(vecOf(byCell[a][i]), vecOf(byCell[b][j])));
        }
      }
    }
    return { within: mean(within), cross: mean(cross), margin: mean(within) - mean(cross) };
  };
  const raw = sampleMargin('raw'), proj = sampleMargin('act'), cen = sampleMargin('cact');
  console.log(`  raw embedding:        within ${round(raw.within)}  cross ${round(raw.cross)}  margin ${round(raw.margin)}`);
  console.log(`  projected (uncentered): within ${round(proj.within)}  cross ${round(proj.cross)}  margin ${round(proj.margin)}`);
  console.log(`  projected (centered):   within ${round(cen.within)}  cross ${round(cen.cross)}  margin ${round(cen.margin)}`);
  console.log(`  verdict: ${cen.margin > raw.margin ? 'PASS — the CENTERED 27-cell projection amplifies frame separation over the raw embedding'
    : 'INCONCLUSIVE'}  (uncentered projection collapses — the common offset must be removed)\n`);
}

// ── GATE 3 — Paradigm (row incommensurability vs within-row null) ──────────────
console.log('── GATE 3 · Paradigm ──────────────────────────────────────────────────');
{
  const M = 3;
  const rows = ['Existence', 'Structure', 'Interpretation'].filter(d => byDomain(d).length >= 2 * M);
  const projOf = (acts) => projectorFrom(eigenLenses(buildDensity(acts).rho, { k: M }).map(l => l.lens));
  const rowProj = Object.fromEntries(rows.map(d => [d, projOf(byDomain(d).map(u => u.act))]));
  const cross = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++)
    cross.push({ pair: `${rows[i]}×${rows[j]}`, c: commutator(rowProj[rows[i]], rowProj[rows[j]]) });
  const within = [];
  for (const d of rows) {
    const acts = byDomain(d).map(u => u.act); if (acts.length < 2 * M) continue;
    const splits = [
      [acts.filter((_, i) => i % 2 === 0), acts.filter((_, i) => i % 2 === 1)],
      [acts.slice(0, acts.length >> 1), acts.slice(acts.length >> 1)],
      [acts.filter((_, i) => i % 3 !== 0), acts.filter((_, i) => i % 3 === 0)],
    ];
    for (const [h1, h2] of splits) if (h1.length >= M && h2.length >= M) within.push(commutator(projOf(h1), projOf(h2)));
  }
  for (const x of cross) console.log(`  cross-paradigm ${x.pair.padEnd(28)} ‖[Π,Π]‖ = ${round(x.c)}`);
  console.log(`  within-paradigm baseline (n=${within.length}): mean ${round(mean(within))}  max ${round(Math.max(...within))}`);
  const nul = deriveNull(within, { scale: 'linear', alpha: 0.05 });
  const beat = cross.filter(x => Number.isFinite(nul) && x.c > nul);
  console.log(`  within-row null (α=0.05): ${Number.isFinite(nul) ? round(nul) : 'abstain (thin)'}`);
  console.log(`  cross beating null: ${beat.length}/${cross.length}  ${beat.map(b => b.pair).join(', ')}`);
  console.log(`  verdict: ${cross.length && beat.length === cross.length ? 'PASS — distinct cube rows are incommensurable past the within-row baseline'
    : beat.length ? 'PARTIAL' : 'FAIL — not separable above baseline'}\n`);
}

// ── VALIDATION — held-out + permutation null (only meaningful at corpus scale) ──
// A fix that is correct and one that merely turned the verdict green look identical at
// the moment the number flips. Two cheap checks separate them: does the centering hold
// on data its mean never saw (held-out), and does the Atmosphere ordering clear a label-
// shuffle null? Run only with --npz (the 27-centroid archetype set is too thin).
if (npzArg >= 0 && units.length > 1000) {
  console.log('── VALIDATION · held-out + permutation null ───────────────────────────');
  const buildBasisFrom = (us) => {
    const sums = new Map(), cnt = new Map();
    for (const u of us) { if (!sums.has(u.cell)) { sums.set(u.cell, new Array(u.raw.length).fill(0)); cnt.set(u.cell, 0); } const s = sums.get(u.cell); for (let j = 0; j < u.raw.length; j++) s[j] += u.raw[j]; cnt.set(u.cell, cnt.get(u.cell) + 1); }
    const keys = [...sums.keys()].sort();
    return { keys, vecs: keys.map(k => normalize(sums.get(k).map(x => x / cnt.get(k)))) };
  };
  const frameMargin = (us, key) => {
    const ts = ['Atmosphere', 'Lens', 'Paradigm', 'Entity', 'Link']; const within = [], cross = [];
    for (const t of ts) { const g = us.filter(u => u.terrain === t); if (g.length < 4) continue; const cells = [...new Set(g.map(u => u.cell))]; const bc = cells.map(c => g.filter(u => u.cell === c).slice(0, 40)); for (let a = 0; a < bc.length; a++) for (let i = 0; i < bc[a].length; i++) { for (let j = i + 1; j < bc[a].length; j++) within.push(cos(bc[a][i][key], bc[a][j][key])); for (let b = a + 1; b < bc.length; b++) for (let j = 0; j < bc[b].length; j++) cross.push(cos(bc[a][i][key], bc[b][j][key])); } }
    return mean(within) - mean(cross);
  };
  // HELD-OUT: fit basis + centering mean on A (even), score the Lens margin on B (odd).
  const A = units.filter((_, i) => i % 2 === 0), B = units.filter((_, i) => i % 2 === 1);
  const basisA = buildBasisFrom(A);
  for (const u of A) u.actA = projectUnit(u.raw, basisA);
  const gmA = new Array(basisA.keys.length).fill(0);
  for (const u of A) for (let j = 0; j < gmA.length; j++) gmA[j] += u.actA[j] / A.length;
  for (const u of B) { u.actA = projectUnit(u.raw, basisA); u.cactA = u.actA.map((x, j) => x - gmA[j]); }
  const hoRaw = frameMargin(B, 'raw'), hoCen = frameMargin(B, 'cactA');
  console.log(`  held-out Lens margin on B (basis+mean fit on A):  raw ${round(hoRaw)}  centered ${round(hoCen)}`);
  console.log(`    ${hoCen > hoRaw ? 'HOLDS out-of-sample — real frame structure, not in-sample fitting' : 'SAGS toward raw — part of the win was in-sample fitting'}`);
  // PERMUTATION: does loaded(Interpretation) − factual(Existence) departure clear a
  // label-shuffle null? Deterministic mulberry32 (no Math.random — the workflow rule).
  const sigma = corpusSigma(basis);   // uncentered prior is fine as the shared reference for the statistic
  const sigActs = basis.vecs.map(v => projectUnit(v, basis).map((x, j) => x - gmean[j]));
  const sigmaC = buildDensity(sigActs).rho;
  const depSet = (ix) => relEntropy(buildDensity(ix.map(i => units[i].cact)).rho, sigmaC);
  const doms = units.map(u => u.domain);
  const ixOf = (arr, d) => { const o = []; for (let i = 0; i < arr.length; i++) if (arr[i] === d) o.push(i); return o; };
  const statOf = (arr) => depSet(ixOf(arr, 'Interpretation')) - depSet(ixOf(arr, 'Existence'));
  const obs = statOf(doms);
  let seed = 12345; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const N = 300; let ge = 0, mx = -Infinity;
  for (let p = 0; p < N; p++) { const sh = doms.slice(); for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [sh[i], sh[j]] = [sh[j], sh[i]]; } const s = statOf(sh); if (s > mx) mx = s; if (s >= obs) ge++; }
  console.log(`  permutation null (Atmosphere I−E): observed ${round(obs)}  max of ${N} shuffles ${round(mx)}  p ≈ ${round((ge + 1) / (N + 1))}`);
  console.log(`    ${ge / N < 0.05 ? 'CLEARS the permutation null (p<0.05) — the loaded>factual ordering is not chance' : 'does NOT clear — underpowered / no real ordering'}\n`);
  void sigma;
}
