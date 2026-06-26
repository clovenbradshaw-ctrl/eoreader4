// structural-significance.mjs — the significance column with NO embedder.
//
// ρ built from OPERATIONS (the cube's Act face read off the log), not from a MiniLM
// cosine projection. Meaning here is what the operators do to the field, not the company
// a word keeps — so the eigen-lenses are operational readings (segment-bond-instantiate,
// assert-evaluate), never topic clusters, and the embedder stays in VOX where it belongs.
//
//   node scripts/structural-significance.mjs
import { readFileSync } from 'node:fs';
import { parseText } from '../src/perceiver/parse/index.js';
import { structuralHorizon, operatorProfiles, structuralCommutator, createHorizon } from '../src/surfer/index.js';

let raw = readFileSync('./pg5200.txt', 'utf8');
const a = raw.search(/\*\*\* ?START OF TH/i), b = raw.search(/\*\*\* ?END OF TH/i);
if (a >= 0 && b > a) raw = raw.slice(raw.indexOf('\n', a) + 1, b);
const doc = parseText(raw, { docId: 'metamorphosis' });

console.log('STRUCTURAL significance — ρ from operations, no embedder, nothing distributional\n');
const base = structuralHorizon(doc, { k: 4 });
console.log(`[operators only]  units ${base.units}  departure ${base.departure}  lensEntropy ${base.lensEntropy}`);
console.log(`  tone: ${base.tone.label}   domain mix: ${JSON.stringify(base.tone.domainMix)}`);
for (const l of base.lenses) console.log(`    ${String(l.weight).padEnd(7)} = ${l.pattern.map(p => `${p.w > 0 ? '+' : ''}${p.w}·${p.op}`).join('  ')}`);

const H = structuralHorizon(doc, { k: 5, relations: true, signs: true });
console.log(`\n[enriched: + relation classes + polarity signs]  ${H.dims.length} dims  departure ${H.departure}  lensEntropy ${H.lensEntropy}`);
console.log(`  tone: ${H.tone.label}   dominant relation: ${H.tone.relation}`);
console.log('  operational-relational lenses (finer readings, still structural):');
for (const l of H.lenses) console.log(`    ${String(l.weight).padEnd(7)} = ${l.pattern.map(p => `${p.w > 0 ? '+' : ''}${p.w}·${p.op}`).join('  ')}`);

const prof = operatorProfiles(doc); const half = prof.length >> 1;
console.log(`\nParadigm (operational): first-half vs second-half commutator = ${structuralCommutator(prof.slice(0, half), prof.slice(half))}`);
console.log('  (low → the book keeps one operational basis; it does not paradigm-shift mid-way)');

// The native organism loop: the operator profiles feed the persistent Horizon directly —
// no embedder anywhere. Eight "chapters" fold in; the operational self accumulates.
const prior = { vectors: Object.fromEntries(['NUL','SEG','DEF','SIG','CON','EVA','INS','SYN','REC'].map((o, i) => [o, [...Array(9)].map((_, j) => (i === j ? 1 : 0))])) };
const hz = createHorizon({ prior, gamma: 0.7 });
const chunks = 8, per = Math.ceil(prof.length / chunks);
console.log('\nthe Horizon accumulating the operational self across the book:');
for (let c = 0; c < chunks; c++) {
  const slice = prof.slice(c * per, (c + 1) * per).filter(p => p.some(x => x > 0));
  if (slice.length) { const r = hz.observe(slice); console.log(`  ch${c}: departure ${r.departure}  entropy ${r.entropy}  reserve ${r.reserve}`); }
}
console.log('\nNo embedder was loaded. Meaning was constituted from what the operators did.');
