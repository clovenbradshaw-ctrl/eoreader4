// exp-0007 · the GENERATE column (INS · SYN · REC) at the spectral grain.
//
// The cube's ACT face has three modes; exp-0003..0006 built the Differentiate and
// Relate operators (SEG=voidPeaks, DEF=readingCount, SIG=bornAssign, CON=coupling). The
// Generate column — INS (birth a reading), SYN (merge a returning reading into its
// identity), REC (carry a learned reading as a prior) — is what an ONLINE, accumulating
// reader needs. This battery tests all three:
//   • seq_separable — well-separated readings in sequence: the regime where online INS
//     births correctly (and can beat the batch reader).
//   • transfer_{short,long}_{A,B} — the SAME registers drawn twice. A is read to LEARN a
//     prior (REC); B is read cold vs prior-seeded. Short blocks are the regime where cold
//     INS cannot birth in time and the prior earns its keep.
// Deterministic (seeded PRNG, no deps).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'battery');
mkdirSync(OUT, { recursive: true });

const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const norm = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
function axes(dim, k, seed) {
  const r = rng(seed), A = [];
  for (let c = 0; c < k; c++) { let v = Array.from({ length: dim }, () => gauss(r)); for (const u of A) { const p = dot(v, u); v = v.map((x, i) => x - p * u[i]); } const n = norm(v); A.push(v.map((x) => x / n)); }
  return A;
}
const dump = (name, units, boundaries, labels, tol, note) => {
  writeFileSync(join(OUT, name), JSON.stringify({ units: units.map((u) => u.map((x) => +x.toFixed(5))), boundaries, labels, tol, note }));
  console.log(`${name.padEnd(22)} T=${String(units.length).padStart(4)} reads=${new Set(labels).size} blocks=${boundaries.length + 1}`);
};

const DIM = 40;
const REG = axes(DIM, 3, 1);              // the SHARED registers (same across A and B)

// register stream with recurrence: plan 0,1,2,0,1,2,0
function registerStream(name, seed, per, note) {
  const g = rng(seed), plan = [0, 1, 2, 0, 1, 2, 0];
  const units = [], bounds = [], labels = []; let t = 0;
  plan.forEach((r, bi) => { if (bi) bounds.push(t); for (let n = 0; n < per; n++) { units.push(REG[r].map((x) => x + 0.25 * gauss(g))); labels.push(r); t++; } });
  dump(name, units, bounds, labels, 2, note);
}
// well-separated sequential readings (the INS-works regime)
function separableSeq(name, seed) {
  const g = rng(seed), K = 6, ax = axes(DIM, K, seed + 5);
  const units = [], bounds = [], labels = []; let t = 0;
  for (let k = 0; k < K; k++) { if (k) bounds.push(t); for (let n = 0; n < 22; n++) { units.push(ax[k].map((x) => x + 0.2 * gauss(g))); labels.push(k); t++; } }
  dump(name, units, bounds, labels, 3, 'well-separated readings in sequence (INS births correctly)');
}

separableSeq('seq_separable.json', 700);
registerStream('transfer_short_A.json', 10, 8, 'learn: 3 registers, short blocks');
registerStream('transfer_short_B.json', 20, 8, 'test: same registers, short blocks, fresh draw');
registerStream('transfer_long_A.json', 30, 24, 'learn: 3 registers, long blocks');
registerStream('transfer_long_B.json', 40, 24, 'test: same registers, long blocks, fresh draw');
console.log('generate-column battery generated.');
