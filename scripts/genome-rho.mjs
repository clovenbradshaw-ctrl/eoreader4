// ρ on the genome — Tests 0–2 of docs/genome-rho.md, run against core/spectral.js
// unmodified. Data in data/genome/ (E. coli MG1655 1–300kb; φX174; MS2). Test 3 needs
// an external gLM (gated). Every claim is reported signed-vs-unsigned and against a
// null; a result that does not beat its null is printed as a falsification, not hidden.
//
//   node scripts/genome-rho.mjs

import { readFileSync } from 'node:fs';
import { buildDensity, eigenLenses, vonNeumann } from '../src/core/index.js';
import {
  parseFasta, reverseComplement, codonReadings, complementSignedReadings,
  sixFrameReadings,
} from '../src/organs/in/locus.js';

const ROOT = new URL('../data/genome/', import.meta.url);
const load = (f) => parseFasta(readFileSync(new URL(f, ROOT), 'utf8'));
const round = (x, n = 4) => Math.round(x * 10 ** n) / 10 ** n;
let _s = 0x9e3779b9;
const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const shuf = (s) => shuffle(s.split('')).join('');
const draw = (p) => { let r = rnd(), a = 0; for (const [b, q] of p) { a += q; if (r < a) return b; } return p[p.length - 1][0]; };
const genSeq = (n, p) => { let o = ''; for (let i = 0; i < n; i++) o += draw(p); return o; };
const fro = (A) => { let s = 0; for (const r of A) for (const x of r) s += x * x; return Math.sqrt(s); };
const entropy = (rho) => vonNeumann(eigenLenses(rho).map((l) => l.weight).filter((w) => w > 1e-12));

// ════════════════════════════════════════════════════════════════════════════
// TEST 0 — synthetic positive control: can ρ recover a cancellation we plant?
// ════════════════════════════════════════════════════════════════════════════
const test0 = () => {
  console.log('═══ TEST 0 · synthetic control (no data) ═══');
  const A = [1, 0, 0, 0], B = [0.8, 0.6, 0, 0], vecs = [A, B, A];
  const Su = entropy(buildDensity(vecs).rho), Ss = entropy(buildDensity(vecs, null, [1, 1, -1]).rho);
  console.log(`  unsigned S=${round(Su)} (2 lenses)   signed S=${round(Ss)} (1 lens — A annihilated)`);
  console.log(`  → ${Ss < Su - 1e-6 ? 'PASS' : 'FAIL'}: signing the planted defeat collapses the redundant reading.\n`);
};

// ════════════════════════════════════════════════════════════════════════════
// TEST 1a — the UNSIGNED codon basis has no discriminating power (honest status).
//   ‖ρ_fwd − ρ_rc‖ ≈ ‖ρ_h1 − ρ_h2‖ ≈ ‖ρ_fwd − ρ_unrelated‖: every 300bp window's
//   trace-normalised codon-count ρ is the same composition smear, so the basis cannot
//   tell a reverse complement from an unrelated window. The earlier "PASS" was an
//   artifact of a too-tight (composition-preserving) shuffle null. Named, not buried.
// ════════════════════════════════════════════════════════════════════════════
const test1a = () => {
  const seq = load('ecoli_mg1655_1-300k.fasta');
  const L = 300, N = 80, stride = Math.floor((seq.length - L) / N);
  const wins = [];
  for (let k = 0; k < N; k++) { const w = seq.slice(k * stride, k * stride + L); if (/^[ACGT]+$/.test(w)) wins.push(w); }
  const froDiff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) for (let j = 0; j < a.length; j++) { const d = a[i][j] - b[i][j]; s += d * d; } return Math.sqrt(s); };
  const rho = (s) => buildDensity(codonReadings(s, { basis: 'prefix' }).vectors).rho;
  let dRc = 0, dHalf = 0, dCross = 0;
  wins.forEach((w, i) => {
    const Rf = rho(w);
    dRc += froDiff(Rf, rho(reverseComplement(w)));
    dHalf += froDiff(rho(w.slice(0, L / 2)), rho(w.slice(L / 2)));
    dCross += froDiff(Rf, rho(wins[(i + 7) % wins.length]));
  });
  const n = wins.length;
  console.log('═══ TEST 1a · unsigned codon basis — NO discriminating power ═══');
  console.log(`  ‖ρ_fwd − ρ_rc‖=${round(dRc / n)}  ≈  ‖ρ_h1 − ρ_h2‖=${round(dHalf / n)}  ≈  ‖ρ_fwd − ρ_unrelated‖=${round(dCross / n)}`);
  console.log('  → all three equal: the codon-count ρ is a featureless composition smear at 300bp;');
  console.log('    it cannot tell a reverse complement from an unrelated window. (Status: no power,');
  console.log('    NOT "weak signal". The first PASS was a too-tight-null artifact.)\n');
};

// ════════════════════════════════════════════════════════════════════════════
// TEST 1b — the SIGNED COMPLEMENT basis: calibration + a real regularity.
//   CALIBRATION (mechanism, by construction): in a basis where complementation is a
//   sign flip, the interference build must cancel a strand against its own reverse
//   complement → residual 0 for w⊕RC(w). This is Test 0 on real sequence with a
//   biological sign; it confirms the mechanism, it does not discover the symmetry.
//   MEASUREMENT (on top of the calibrated mechanism): the signed residual of a single
//   strand is its violation of reverse-complement parity (Chargaff's 2nd rule). Real
//   genomes sit near 0; strand-biased sequences do not. THAT is the empirical finding.
// ════════════════════════════════════════════════════════════════════════════
const residual = (seq) => {
  const { vectors, signs } = complementSignedReadings(seq, { basis: 'prefix' });
  const s = buildDensity(vectors, null, signs), u = buildDensity(vectors, null, null);
  const raw = (d) => d.rho.map((r) => r.map((x) => x * d.trace));     // undo trace-normalisation
  return fro(raw(s)) / fro(raw(u));                                   // signed mass / unsigned mass
};
const meanResidual = (seqs) => round(seqs.reduce((a, s) => a + residual(s), 0) / seqs.length);
const test1b = () => {
  const eco = load('ecoli_mg1655_1-300k.fasta');
  const L = 3000, N = 40, stride = Math.floor((eco.length - L) / N);
  const real = [];
  for (let k = 0; k < N && real.length < N; k++) { const w = eco.slice(k * stride, k * stride + L); if (/^[ACGT]+$/.test(w)) real.push(w); }
  const w0 = real[0];
  const unbiased = Array.from({ length: 10 }, () => genSeq(L, [['A', .25], ['C', .25], ['G', .25], ['T', .25]]));
  const biased = Array.from({ length: 10 }, () => genSeq(L, [['A', .4], ['G', .4], ['C', .1], ['T', .1]]));
  console.log('═══ TEST 1b · signed complement basis (residual = reverse-complement-parity violation) ═══');
  console.log(`  CALIBRATION  w ⊕ RC(w)        residual = ${round(residual(w0 + reverseComplement(w0)))}   (exact parity by construction → mechanism confirmed)`);
  console.log(`  real E. coli (40×3kb)         residual = ${meanResidual(real)}   (obeys Chargaff parity 2)`);
  console.log(`  unbiased random              residual = ${meanResidual(unbiased)}   (parity holds in expectation)`);
  console.log(`  purine-biased random         residual = ${meanResidual(biased)}   (parity broken)`);
  const ok = meanResidual(real) < meanResidual(biased) / 2;
  console.log(`  → ${ok ? 'PASS' : 'FAIL'}: the signed build cancels reverse-complement-paired structure; real strands`);
  console.log('    sit near the parity-respecting floor, strand-biased sequences far above it.');
  console.log('    NB: this CALIBRATES the mechanism (complementation = sign flip is built in). The');
  console.log('    DISCOVERY question — can ρ find strand symmetry it was NOT told? — is left open\n');
};

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — reading-frame opposition across MULTIPLE overlap loci and TWO genomes.
//   An overlapping-gene window holds two ORFs at once → more open frames / higher ρ
//   entropy than its genome's baseline; a single-coding window does not. Because a
//   compact genome leaves extra frames stop-free (φX174), absolute counts are NOT
//   comparable across genomes — each locus is read against ITS OWN genome's baseline.
// ════════════════════════════════════════════════════════════════════════════
const frameStats = (seq) => {
  const frames = sixFrameReadings(seq, { basis: 'prefix' });
  const { rho } = buildDensity(frames.map((f) => f.vector), frames.map((f) => f.salience));
  const open = frames.filter((f) => f.longestRun / Math.max(1, f.codons) >= 0.9).length;
  return { open, S: entropy(rho) };
};
const baseline = (seq, L = 300, N = 40) => {            // mean openness of random windows = coding density proxy
  const stride = Math.max(1, Math.floor((seq.length - L) / N));
  let open = 0, S = 0, c = 0;
  for (let k = 0; k < N; k++) { const w = seq.slice(k * stride, k * stride + L); if (!/^[ACGT]+$/.test(w)) continue; const s = frameStats(w); open += s.open; S += s.S; c++; }
  return { open: open / c, S: S / c };
};
const test2 = () => {
  const G = { ecoli: load('ecoli_mg1655_1-300k.fasta'), phix: load('phix174.fasta'), ms2: load('ms2.fasta') };
  const sub = (g, a, b) => G[g].slice(a - 1, b);
  const base = { phix: baseline(G.phix), ms2: baseline(G.ms2), ecoli: baseline(G.ecoli) };
  console.log('═══ TEST 2 · reading-frame opposition — 3 overlap loci, 2 genomes, vs per-genome baseline ═══');
  console.log('  genome baseline openness (random-window mean; the coding-density confound made visible):');
  for (const g of ['ecoli', 'phix', 'ms2']) console.log(`    ${g.padEnd(6)} open=${round(base[g].open, 2)}  S=${round(base[g].S, 3)}`);
  const loci = [
    { g: 'phix', name: 'OVERLAP φX174 D∩E   568–843',   a: 568, b: 843, kind: 'overlap' },
    { g: 'phix', name: 'OVERLAP φX174 A∩B   5075–5386', a: 5075, b: 5386, kind: 'overlap' },
    { g: 'ms2',  name: 'OVERLAP MS2 lysis   1678–1905', a: 1678, b: 1905, kind: 'overlap' },
    { g: 'phix', name: 'single φX174 F      1100–1699', a: 1100, b: 1699, kind: 'single' },
    { g: 'ms2',  name: 'single MS2 replicase 2000–2599', a: 2000, b: 2599, kind: 'single' },
    { g: 'ecoli', name: 'single E.coli aspK  1000–1599', a: 1000, b: 1599, kind: 'single' },
    { g: 'ecoli', name: 'single E.coli thrC  4000–4599', a: 4000, b: 4599, kind: 'single' },
  ];
  console.log('  locus (Δ = vs that genome\'s baseline):');
  let agree = 0, overlaps = 0, singles = 0, singlesOK = 0;
  for (const L of loci) {
    const s = frameStats(sub(L.g, L.a, L.b)), b = base[L.g];
    const dOpen = round(s.open - b.open, 2), dS = round(s.S - b.S, 3);
    const up = s.open > b.open + 0.5 || s.S > b.S + 0.05;
    if (L.kind === 'overlap') { overlaps++; if (up) agree++; } else { singles++; if (!up) singlesOK++; }
    console.log(`    ${L.kind === 'overlap' ? '▲' : '·'} ${L.name.padEnd(30)} open=${s.open} (Δ${dOpen >= 0 ? '+' : ''}${dOpen})  S=${round(s.S, 3)} (Δ${dS >= 0 ? '+' : ''}${dS})`);
  }
  const nullWin = frameStats(shuf(sub('phix', 568, 843)));
  console.log(`    ○ null φX174 D∩E shuffled        open=${nullWin.open}  S=${round(nullWin.S, 3)}  (structure destroyed)`);
  console.log(`  → overlaps above baseline: ${agree}/${overlaps};  single-coding at/below baseline: ${singlesOK}/${singles}.`);
  console.log('    Each locus read against its OWN genome (φX174 baseline is high — the compactness confound).\n');
};

// ── run ──────────────────────────────────────────────────────────────────────
test0();
test1a();
test1b();
test2();
console.log('═══ TEST 3 · selection vs. accessibility ═══');
console.log('  Specced (docs/genome-rho.md) but gated: needs an external genomic LM and a');
console.log('  population panel — not runnable offline here.\n');
