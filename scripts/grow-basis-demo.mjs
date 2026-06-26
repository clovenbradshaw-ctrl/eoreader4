// grow-basis-demo.mjs — the cells themselves learned: a frame growing a new category.
//
// A stream of "readings" arrives. Most fall on the shipped cells (the frame has a
// reading for them). Then a NEW kind of meaning recurs — unframed at first (high
// residual, no cell). When enough of them cohere, the basis COMPOSES a cell for it
// (REC Composing a Paradigm), and the once-unframed reading now has a home: its residual
// collapses. This is the strong form of "better" — not more data in a fixed frame, but
// a new frame element grown from experience where the given categories failed.
//
//   node scripts/grow-basis-demo.mjs

import { createGrowingBasis } from '../src/surfer/index.js';

const D = 8;
const e = (i) => { const v = new Array(D).fill(0); v[i] = 1; return v; };
const near = (k, j, w) => { const v = e(k); v[j] = w; return v; };
const PRIOR = { vectors: { A: e(0), B: e(1), C: e(2) } };   // three shipped cells

const g = createGrowingBasis(PRIOR, { minCluster: 3 });
console.log(`shipped frame: ${g.cells.map(c => c.key).join(', ')}   belongs-floor ${g.floor}\n`);
console.log('turn  reading            nearest  residual  event');

// a deterministic jitter so the demo has no Math.random
let s = 99; const jit = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return (((t ^ t >>> 14) >>> 0) / 4294967296 - 0.5) * 0.12; };

// turns 0–5 in-frame (near A/B/C); turns 6–9 a recurring UNFRAMED category (near e5)
const plan = [
  ['near A', () => near(0, 3, jit())], ['near B', () => near(1, 4, jit())], ['near C', () => near(2, 5, jit())],
  ['near A', () => near(0, 3, jit())], ['near B', () => near(1, 4, jit())], ['near C', () => near(2, 5, jit())],
  ['NEW kind', () => near(5, 6, jit())], ['NEW kind', () => near(5, 6, jit())],
  ['NEW kind', () => near(5, 6, jit())], ['NEW kind', () => near(5, 6, jit())],
];
plan.forEach(([desc, mk], t) => {
  const v = mk();
  const before = g.nearest(v);
  const r = g.admit(v, { label: desc });
  const ev = r.composed ? `COMPOSED ${r.composed} (frame grows)` : (r.fit ? '' : 'unframed (buffered)');
  console.log(`${String(t).padStart(3)}   ${desc.padEnd(16)}  ${before.key.padEnd(7).slice(0, 7)}  ${String(r.residual).padStart(7)}  ${ev}`);
});

console.log(`\nframe after: ${g.cells.map(c => c.key + (c.learned ? '*' : '')).join(', ')}   (* = learned)`);
console.log(`learned ${g.learnedCount} cell(s); log:`);
for (const l of g.log) console.log('  ', JSON.stringify(l));

// the once-unframed reading now has a home
const probe = near(5, 6, 0.0);
console.log(`\na fresh "NEW kind" reading now lands on ${g.nearest(probe).key} (residual ${g.residualOf(probe)}) —`);
console.log('what was unframed noise is now a category the column can read, weigh, and re-ground into.');
