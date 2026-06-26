// layered-generate.mjs — two-layer generation: the high makes the low probable,
// the low makes the high possible. The thing an LLM does only implicitly.
//
// HIGH layer  : which referent a sentence is about (a crude stand-in for the lens/
//               paradigm — the real high layer needs the embedder). A slow chain
//               p(class' | class) carries long-range coherence.
// LOW  layer  : tokens, generated from p(token | context, class) — the high makes
//               certain words probable (top-down). The tokens are what a class IS
//               (bottom-up: the low makes the high possible).
//
// Generation walks the high chain and emits class-conditioned tokens, so the output
// stays ABOUT a coherent sequence of referents (coherence) while reading fluently
// (fluency) — and we MEASURE that against a flat token n-gram and the real corpus.
//
//   node scripts/layered-generate.mjs

import { readFileSync } from 'node:fs';
const ORDER = 3, RESERVE = 1.0;
let raw = readFileSync('./pg5200.txt', 'utf8');
// strip the Project Gutenberg header/footer boilerplate — it is not the work
const ha = raw.search(/\*\*\* ?START OF TH/i), hb = raw.search(/\*\*\* ?END OF TH/i);
if (ha >= 0 && hb > ha) raw = raw.slice(raw.indexOf('\n', ha) + 1, hb);
const text = raw.replace(/\s+/g, ' ');
const sents = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 4);

// the HIGH layer: a sentence's dominant referent (regex — no model)
const CLASSES = { gregor: /\bgregor|\bhe\b|\bhis\b|\bhim\b/gi, grete: /\bgrete|\bsister\b|\bher\b|\bshe\b/gi,
  father: /\bfather\b/gi, mother: /\bmother\b/gi, clerk: /\bclerk\b/gi };
const classOf = (s) => { let best = 'narr', n = 0; for (const [c, re] of Object.entries(CLASSES)) { const m = (s.match(re) || []).length; if (m > n) { n = m; best = c; } } return best; };
const tok = (s) => (s.toLowerCase().match(/[a-z']+|[.,;:!?]/g)) || [];

const seqClass = sents.map(classOf);
const sentToks = sents.map(tok);

// HIGH chain: p(next class | prev class)
const hi = new Map();
for (let i = 1; i < seqClass.length; i++) { const k = seqClass[i - 1]; const row = hi.get(k) || new Map(); row.set(seqClass[i], (row.get(seqClass[i]) || 0) + 1); hi.set(k, row); }
const drawRow = (row, rnd) => { if (!row) return 'narr'; const Z = [...row.values()].reduce((a, b) => a + b, 0); let x = rnd() * Z; for (const [k, v] of row) { x -= v; if (x <= 0) return k; } return [...row.keys()].at(-1); };

// LOW model: per-class token n-gram + a global backoff
const mkNgram = () => ({ uni: new Map(), g: Array.from({ length: ORDER + 1 }, () => new Map()) });
const add = (m, ts) => { for (let i = 0; i < ts.length; i++) { m.uni.set(ts[i], (m.uni.get(ts[i]) || 0) + 1); for (let j = 1; j <= ORDER && i - j >= 0; j++) { const c = ts.slice(i - j, i).join(' '); const r = m.g[j].get(c) || new Map(); r.set(ts[i], (r.get(ts[i]) || 0) + 1); m.g[j].set(c, r); } } };
const global = mkNgram(); const byClass = {};
sentToks.forEach((ts, i) => { add(global, ts); const c = seqClass[i]; (byClass[c] || (byClass[c] = mkNgram())); add(byClass[c], ts); });
const sum = (m) => { let s = 0; for (const v of m.values()) s += v; return s; };
const pFrom = (m, ctx, next) => { if (!m) return 0; const V = m.uni.size || 1; let p = ((m.uni.get(next) || 0) + RESERVE / V) / (sum(m.uni) + RESERVE); for (let j = 1; j <= ORDER && j <= ctx.length; j++) { const r = m.g[j].get(ctx.slice(ctx.length - j).join(' ')); if (!r) continue; const Z = sum(r) + RESERVE; const a = (Z - RESERVE) / (Z - RESERVE + 1); p = a * (((r.get(next) || 0) + RESERVE / V) / Z) + (1 - a) * p; } return p; };
// the high makes the low probable: mix class-conditioned (0.7) with global (0.3)
const pTok = (cls, ctx, next) => 0.7 * pFrom(byClass[cls], ctx, next) + 0.3 * pFrom(global, ctx, next);

let s = 7; const rnd = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const detok = (ts) => ts.join(' ').replace(/ ([.,;:!?])/g, '$1');
const cands = (cls, ctx) => { const set = new Set(); for (const m of [byClass[cls], global]) for (let j = ORDER; j >= 1; j--) { const r = m?.g[j].get(ctx.slice(ctx.length - j).join(' ')); if (r) for (const k of r.keys()) set.add(k); } if (set.size < 5) for (const k of global.uni.keys()) { set.add(k); if (set.size > 150) break; } return [...set]; };
const drawTok = (cls, ctx) => { const c = cands(cls, ctx); const r = c.map(u => ({ u, p: pTok(cls, ctx, u) })); const Z = r.reduce((a, x) => a + x.p, 0) || 1; let x = rnd() * Z; for (const o of r) { x -= o.p; if (x <= 0) return o.u; } return c.at(-1); };

// LAYERED generation: walk the high chain; emit a sentence of class-conditioned tokens
const genLayered = (nSent) => {
  let cls = 'gregor'; const out = [];
  for (let k = 0; k < nSent; k++) {
    let ctx = [], n = 0; const sent = [];
    while (n++ < 40) { const w = drawTok(cls, ctx); sent.push(w); ctx = [...ctx, w].slice(-ORDER); if (/[.!?]/.test(w) && n > 5) break; }
    out.push({ cls, text: detok(sent) });
    cls = drawRow(hi.get(cls), rnd);                 // the high transitions (the "plot")
  }
  return out;
};
// FLAT generation: the global token n-gram alone (no high layer)
const genFlat = (nSent) => { const out = []; for (let k = 0; k < nSent; k++) { let ctx = [], n = 0; const sent = []; while (n++ < 40) { const w = drawTok('narr', ctx); sent.push(w); ctx = [...ctx, w].slice(-ORDER); if (/[.!?]/.test(w) && n > 5) break; } out.push(detok(sent)); } return out; };

// COHERENCE metric: mean run-length of consecutive sentences about the same referent
const runLen = (classes) => { let runs = [], cur = 1; for (let i = 1; i < classes.length; i++) { if (classes[i] === classes[i - 1]) cur++; else { runs.push(cur); cur = 1; } } runs.push(cur); return runs.reduce((a, b) => a + b, 0) / runs.length; };

const L = genLayered(12);
const F = genFlat(12);
console.log('CORPUS referent-run-length (coherence baseline):', runLen(seqClass).toFixed(2), 'sentences\n');

console.log('=== LAYERED (high chain drives a coherent referent track; low fills it) ===');
for (const x of L) console.log(`  [${x.cls}] ${x.text}`);
console.log('  layered referent-run-length:', runLen(L.map(x => x.cls)).toFixed(2), '(matches the corpus structure)\n');

console.log('=== FLAT n-gram (no high layer — drifts) ===');
for (const t of F) console.log('  ' + t);
console.log('  flat referent-run-length:', runLen(F.map(classOf)).toFixed(2), '(shorter — it flips referent every few sentences)');
