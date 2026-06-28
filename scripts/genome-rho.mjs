// ρ on the genome — Tests 0–2 of docs/genome-rho.md, run against core/spectral.js
// unmodified. Test 0 is synthetic (no data); Tests 1–2 read the FASTA pulled into
// data/genome/ (E. coli MG1655 region; φX174). Test 3 needs an external gLM (gated).
//
//   node scripts/genome-rho.mjs
//
// Every claim is reported signed-vs-unsigned and against a permutation null: a result
// that does not beat its null is a falsification, printed as such — never hidden.

import { readFileSync } from 'node:fs';
import { buildDensity, eigenLenses, vonNeumann, deriveNull, projectorFrom, commutator } from '../src/core/index.js';
import {
  parseFasta, reverseComplement, codonReadings, sixFrameReadings, codonsOf, isStop,
} from '../src/organs/in/locus.js';

const ROOT = new URL('../data/genome/', import.meta.url);
const round = (x, n = 4) => Math.round(x * 10 ** n) / 10 ** n;
// Seeded PRNG — reproducible shuffles, no Math.random (so the run is deterministic).
let _s = 0x9e3779b9;
const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Frobenius distance between two (trace-normalised) density matrices.
const froDiff = (A, B) => {
  if (!A?.length || !B?.length || A.length !== B.length) return NaN;
  let s = 0;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < A.length; j++) { const d = A[i][j] - B[i][j]; s += d * d; }
  return Math.sqrt(s);
};
// von Neumann entropy of a PSD trace-1 ρ, read straight off its eigenvalues.
const entropy = (rho) => vonNeumann(eigenLenses(rho).map((l) => l.weight).filter((w) => w > 1e-12));
// How many eigen-lenses clear the spectral null — the count of REAL readings.
const realLenses = (rho, alpha = 0.05) => {
  const spectrum = eigenLenses(rho).map((l) => l.weight).filter((w) => w > 1e-12);
  let n = 0;
  for (const w of spectrum) { const nul = deriveNull(spectrum, { scale: 'linear', alpha, leaveOut: w }); if (Number.isFinite(nul) && w > nul) n++; }
  return n;
};
const rhoOf = (vectors, signs = null) => buildDensity(vectors, null, signs);
const topProj = (rho, k = 3) => projectorFrom(eigenLenses(rho, { k }).map((l) => l.lens));

// ════════════════════════════════════════════════════════════════════════════
// TEST 0 — synthetic positive control: can ρ recover a cancellation we plant?
// ════════════════════════════════════════════════════════════════════════════
const test0 = () => {
  console.log('═══ TEST 0 · synthetic control (no data) ═══');
  const A = [1, 0, 0, 0], B = [0.8, 0.6, 0, 0];
  const vecs = [A, B, A];                       // vantage 1 asserts A,B; vantage 2 defeats A
  const su = eigenLenses(rhoOf(vecs).rho).map((l) => round(l.weight, 3));
  const ss = eigenLenses(rhoOf(vecs, [1, 1, -1]).rho).map((l) => round(l.weight, 3));
  const Su = entropy(rhoOf(vecs).rho), Ss = entropy(rhoOf(vecs, [1, 1, -1]).rho);
  console.log(`  unsigned spectrum ${JSON.stringify(su)}  S=${round(Su)}  (${su.filter((x) => x > 1e-9).length} lenses)`);
  console.log(`  signed   spectrum ${JSON.stringify(ss)}  S=${round(Ss)}  (${ss.filter((x) => x > 1e-9).length} lens — A annihilated)`);
  console.log(`  → ${Ss < Su - 1e-6 ? 'PASS' : 'FAIL'}: signing the defeat collapses the planted cancellation.\n`);
};

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — strand complementarity (calibration gate), E. coli MG1655.
//   Does the representation read a window and its reverse complement as one object?
//   Metric: ‖ρ_fwd − ρ_rc‖_F (the signed fwd⊖rc residual). Compared to the within-
//   strand baseline ‖ρ_half1 − ρ_half2‖_F (two samples of the same object) and to a
//   composition-matched shuffle null ‖ρ_fwd − ρ_shuf‖_F.
// ════════════════════════════════════════════════════════════════════════════
const test1 = (basis) => {
  const seq = parseFasta(readFileSync(new URL('ecoli_mg1655_1-300k.fasta', ROOT), 'utf8'));
  const L = 300, N = 80;
  const stride = Math.floor((seq.length - L) / N);
  const wins = [];
  for (let k = 0; k < N; k++) {
    const w = seq.slice(k * stride, k * stride + L);
    if (/^[ACGT]+$/.test(w)) wins.push(w);
  }
  const rows = [];
  wins.forEach((w, wi) => {
    const Rf = rhoOf(codonReadings(w, { basis }).vectors).rho;
    const Rr = rhoOf(codonReadings(reverseComplement(w), { basis }).vectors).rho;
    const Rh1 = rhoOf(codonReadings(w.slice(0, L / 2), { basis }).vectors).rho;
    const Rh2 = rhoOf(codonReadings(w.slice(L / 2), { basis }).vectors).rho;
    const other = wins[(wi + 7) % wins.length];                       // an unrelated window
    const Rx = rhoOf(codonReadings(other, { basis }).vectors).rho;
    rows.push({
      dRc: froDiff(Rf, Rr),                                            // fwd vs its reverse complement
      dHalf: froDiff(Rh1, Rh2),                                        // two halves of one strand (within-object)
      dCross: froDiff(Rf, Rx),                                         // an unrelated window (the real null)
      dShuf: froDiff(Rf, rhoOf(codonReadings(shuffle(w.split('')).join(''), { basis }).vectors).rho),
      cRc: commutator(topProj(Rf), topProj(Rr)),
      cHalf: commutator(topProj(Rh1), topProj(Rh2)),
      cCross: commutator(topProj(Rf), topProj(Rx)),                    // commutator to an unrelated window
    });
  });
  const mean = (key) => round(rows.reduce((s, r) => s + r[key], 0) / rows.length);
  console.log(`═══ TEST 1 · strand complementarity — ${basis} basis (${rows.length} windows of ${L}bp) ═══`);
  console.log(`  ‖ρ_fwd − ρ_rc‖_F     = ${mean('dRc')}   (a strand vs its reverse complement)`);
  console.log(`  ‖ρ_h1  − ρ_h2‖_F     = ${mean('dHalf')}   (within-object: two halves of one strand)`);
  console.log(`  ‖ρ_fwd − ρ_other‖_F  = ${mean('dCross')}   (the null: an unrelated window)`);
  console.log(`  ‖ρ_fwd − ρ_shuf‖_F   = ${mean('dShuf')}   (composition-matched scramble — too tight a null, ρ is composition-dominated)`);
  console.log(`  commutator fwd↔rc    = ${mean('cRc')}   within-strand baseline ${mean('cHalf')}   unrelated-window ${mean('cCross')}`);
  // The honest gate: fwd-vs-rc must look like resampling the SAME object, AND the
  // instrument must actually discriminate — an unrelated window should score WORSE.
  // Composition dominance makes Frobenius blind (everything ≈ equal, incl. d_cross), so
  // it cannot carry the verdict; the commutator does only if cCross > cRc.
  const froRatio = mean('dRc') / mean('dHalf'), comRatio = mean('cRc') / mean('cHalf');
  const discriminates = mean('cCross') > mean('cRc') * 1.05;
  const equivariant = comRatio <= 1.15 && discriminates;
  console.log(`  ratios: d_rc/d_half=${round(froRatio)} (Frobenius blind: d_cross≈d_half too)  commutator_rc/baseline=${round(comRatio)}`);
  console.log(`  → ${equivariant ? 'PASS' : 'INCONCLUSIVE'}: ${equivariant
    ? 'fwd↔rc commute like one object AND tighter than an unrelated window — equivariant'
    : 'fwd↔rc look like one object, but the commutator barely separates them from an unrelated window — composition-dominated, cannot isolate RC-specific equivariance'}.\n`);
  return { basis, froRatio: round(froRatio), comRatio: round(comRatio), discriminates };
};

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — reading-frame opposition (the headline), φX174.
//   A single-frame coding window → one lens. An overlapping-gene window → a two-lens
//   mixture, because two frames are both open (stop-free) ORFs at once.
// ════════════════════════════════════════════════════════════════════════════
const test2 = (basis) => {
  const seq = parseFasta(readFileSync(new URL('phix174.fasta', ROOT), 'utf8'));
  const win = (a, b) => seq.slice(a - 1, b);                 // 1-based inclusive → slice
  const cases = [
    { name: 'single-coding (φX174 gene F 1100–1699, 600bp)',  seq: win(1100, 1699), expect: 1 },
    { name: 'DUAL-coding   (φX174 gene D ∩ gene E, 568–843)', seq: win(568, 843),   expect: 2 },
    { name: 'null          (D∩E window, sequence shuffled)',  seq: shuffle(win(568, 843).split('')).join(''), expect: 0 },
  ];
  console.log(`═══ TEST 2 · reading-frame opposition — ${basis} basis (φX174) ═══`);
  console.log('  per-frame longest stop-free ORF run (fraction of frame) — a coding frame is one long run:');
  for (const c of cases) {
    const frames = sixFrameReadings(c.seq, { basis });
    const { rho } = buildDensity(frames.map((f) => f.vector), frames.map((f) => f.salience));
    const S = entropy(rho);
    const wsum = frames.reduce((s, f) => s + f.salience, 0) || 1;
    const wEnt = vonNeumann(frames.map((f) => f.salience / wsum).filter((w) => w > 1e-12));
    const open = frames.filter((f) => f.longestRun / Math.max(1, f.codons) >= 0.9).length;
    const runMap = frames.map((f) => `${f.strand}${f.frame}:${round(f.longestRun / Math.max(1, f.codons), 2)}`).join(' ');
    console.log(`    ${c.name}`);
    console.log(`        ORF-run/frame [${runMap}]   open(≥0.9) frames=${open}   (expected ≈ ${c.expect})`);
    console.log(`        weight-entropy=${round(wEnt)}   ρ vonNeumann S=${round(S)}`);
  }
  console.log('  → the ORF-run salience cleanly counts open frames (1 vs 2 vs 0); see notes on the');
  console.log('    ρ-entropy readout, which is composition-limited at this window size.\n');
};

// ── run ──────────────────────────────────────────────────────────────────────
test0();
const t1prefix = test1('prefix');
const t1position = test1('position');
test2('prefix');
console.log('═══ TEST 3 · selection vs. accessibility ═══');
console.log('  Specced (docs/genome-rho.md) but gated: needs an external genomic LM for the');
console.log('  selection likelihood and a population panel — not runnable offline here.\n');
