// text-generate.mjs — the Bayesian predictor over a TOKEN stream (an n-gram LM).
//
// The same Existence-rung predictor that handled the melody and the video trajectory,
// run over words instead of notes or positions. Interpolated backoff + the novelty
// reserve (the engine's own), trained on real Gutenberg prose. This is what "generate
// text" means with the current basis: the unit IS the surface token, so it generates
// locally-fluent prose — and shows exactly the n-gram ceiling that no amount of corpus
// fixes (the bounce lesson: more data in a basis that can't hold long-range structure
// does not buy coherence).
//
//   node scripts/text-generate.mjs [order] [nWords]

import { readFileSync } from 'node:fs';

const ORDER = Number(process.argv[2]) || 3;
const NWORDS = Number(process.argv[3]) || 80;
const RESERVE = 1.0;

const text = readFileSync('./pg5200.txt', 'utf8');
const toks = (text.toLowerCase().match(/[a-z']+|[.,;:!?]/g)) || [];
const split = Math.floor(toks.length * 0.9);
const train = toks.slice(0, split), held = toks.slice(split);

// counts: unigram + order-k context → next
const uni = new Map(); const grams = Array.from({ length: ORDER + 1 }, () => new Map());
for (let i = 0; i < train.length; i++) {
  uni.set(train[i], (uni.get(train[i]) || 0) + 1);
  for (let j = 1; j <= ORDER && i - j >= 0; j++) {
    const ctx = train.slice(i - j, i).join(' ');
    const row = grams[j].get(ctx) || new Map(); row.set(train[i], (row.get(train[i]) || 0) + 1); grams[j].set(ctx, row);
  }
}
const V = uni.size;
const sum = (m) => { let s = 0; for (const w of m.values()) s += w; return s; };
const Zuni = sum(uni) + RESERVE;
const probOf = (ctx, next) => {
  let p = ((uni.get(next) || 0) + RESERVE / V) / Zuni;
  for (let j = 1; j <= ORDER && j <= ctx.length; j++) {
    const row = grams[j].get(ctx.slice(ctx.length - j).join(' ')); if (!row) continue;
    const Zrow = sum(row) + RESERVE; const alpha = (Zrow - RESERVE) / (Zrow - RESERVE + 1);
    p = alpha * (((row.get(next) || 0) + RESERVE / V) / Zrow) + (1 - alpha) * p;
  }
  return Math.max(p, 1e-9);
};
const distOf = (ctx) => {
  // candidates: the continuations seen for the longest matching context, + backoff
  const cands = new Set();
  for (let j = ORDER; j >= 1; j--) { const row = grams[j].get(ctx.slice(ctx.length - j).join(' ')); if (row) for (const k of row.keys()) cands.add(k); if (cands.size > 60) break; }
  if (cands.size < 5) for (const k of uni.keys()) { cands.add(k); if (cands.size > 200) break; }
  const ranked = [...cands].map(u => ({ u, p: probOf(ctx, u) })).sort((a, b) => b.p - a.p);
  const Z = ranked.reduce((s, r) => s + r.p, 0) || 1; return ranked.map(r => ({ u: r.u, p: r.p / Z }));
};
let s = 12345; const rnd = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const draw = (ranked) => { const Z = ranked.reduce((a, r) => a + r.p, 0) || 1; let x = rnd() * Z; for (const r of ranked) { x -= r.p; if (x <= 0) return r.u; } return ranked.at(-1)?.u; };
const detok = (ts) => ts.join(' ').replace(/ ([.,;:!?])/g, '$1').replace(/(^|[.!?] )([a-z])/g, (m, a, b) => a + b.toUpperCase());

const generate = (seedWords, n) => {
  let ctx = seedWords.slice(); const out = seedWords.slice();
  for (let k = 0; k < n; k++) { const u = draw(distOf(ctx)); out.push(u); ctx = [...ctx, u].slice(-ORDER); }
  return out;
};

// held-out perplexity — did it learn the language's local statistics?
let bits = 0; for (let i = ORDER; i < Math.min(held.length, 3000); i++) bits += -Math.log2(probOf(held.slice(i - ORDER, i), held[i]));
const ppl = Math.pow(2, bits / Math.min(held.length - ORDER, 3000 - ORDER));

console.log(`trained on ${train.length} tokens (vocab ${V}); order-${ORDER} backoff + reserve.`);
console.log(`held-out perplexity ≈ ${ppl.toFixed(1)} (lower = better local prediction)\n`);
for (const seed of [['gregor', 'was'], ['his', 'sister'], ['the', 'chief', 'clerk']]) {
  console.log(`▸ seed "${seed.join(' ')}":`);
  console.log('  ' + detok(generate(seed, NWORDS)) + '\n');
}
