// layered-stack-demo.mjs — Paradigm → Lens → Proposition → Token, generated at once.
//   node scripts/layered-stack-demo.mjs
import { readFileSync } from 'node:fs';
import { createLayeredGenerator } from '../src/surfer/index.js';

let raw = readFileSync('./pg5200.txt', 'utf8');
const ha = raw.search(/\*\*\* ?START OF TH/i), hb = raw.search(/\*\*\* ?END OF TH/i);
if (ha >= 0 && hb > ha) raw = raw.slice(raw.indexOf('\n', ha) + 1, hb);
const sentsRaw = raw.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 4);
const tok = (s) => (s.toLowerCase().match(/[a-z']+|[.,;:!?]/g)) || [];
const sentences = sentsRaw.map(tok);
const N = sentsRaw.length;

// four observable proxy layers (the real high layers would be lens/paradigm from ρ)
const AFFECT = /\b(afraid|fear|anger|angry|horror|horrible|love|loved|hate|terrible|gentle|worried|shock|disgust|pain|cried|wept|happy|relief|desperate|tender)\b/i;
const REF = { gregor: /\bgregor|\bhe\b|\bhis\b|\bhim\b/gi, grete: /\bgrete|\bsister\b|\bshe\b|\bher\b/gi, father: /\bfather\b/gi, mother: /\bmother\b/gi, clerk: /\bclerk\b/gi };
const refOf = (s) => { let b = 'narr', n = 0; for (const [c, re] of Object.entries(REF)) { const m = (s.match(re) || []).length; if (m > n) { n = m; b = c; } } return b; };

const layers = [
  { name: 'paradigm', syms: sentsRaw.map((_, i) => 'act' + (1 + Math.floor(3 * i / N))), order: 1 },   // the slow arc
  { name: 'lens',     syms: sentsRaw.map(s => AFFECT.test(s) ? 'charged' : 'plain'), order: 2 },         // affective register
  { name: 'proposition', syms: sentsRaw.map(refOf), order: 2 },                                          // active referent
];
const G = createLayeredGenerator({ layers, sentences, order: 2, tokenOrder: 3 });

console.log('layers (high→low):', G.layers.join(' → '), '→ token');
console.log('source coherence (run-length per layer):', JSON.stringify(G.sourceCoherence()), '\n');

const gen = G.generate(12, { seed: 5 });
console.log('=== generated (every layer drawn at once) ===');
for (const g of gen) console.log(`  [${g.symbols.paradigm} · ${g.symbols.lens} · ${g.symbols.proposition}] ${g.text}`);
console.log('\ngenerated coherence per layer:', JSON.stringify(G.coherenceOf(gen)),
  '\n→ each layer holds at its own timescale (paradigm slowest, proposition faster), like the source.');

console.log('\n=== re-ground ONE layer (paradigm) at sentence 6 — only the top layer jumps ===');
const gen2 = G.generate(12, { seed: 5, regroundAt: { 6: 'paradigm' } });
for (let i = 0; i < gen2.length; i++) {
  const g = gen2[i];
  console.log(`  ${i}: [${g.symbols.paradigm} · ${g.symbols.lens} · ${g.symbols.proposition}]${g.regrounded ? '  <-- REC(paradigm): relocate the frame, layers below continue' : ''}`);
}
