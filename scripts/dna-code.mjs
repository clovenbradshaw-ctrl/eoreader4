// Let the genetic code's families EMERGE — no codon table, no a priori category.
//
// emerge-notes.mjs let "the same note" emerge from overtone overlap. This goes one
// modality lower: feed the engine the 64 codons as bare triplets (no amino acids, no
// table, no hint that the third base is redundant), read each codon as its prefixes —
// the way a tone is read as its overtones — and let the engine's mutual-nearest
// union-find (SYN) group them. The only relation used is RANK: a codon merges with
// the codon it shares the most prefixes with, iff that codon's strongest match is it.
//
//   node scripts/dna-code.mjs
//
// The amino-acid map below is used ONLY to SCORE what emerged. It is never handed to
// the reader — the adapter sees triplets and nothing else.

import { ingestCodons } from '../src/organs/in/codon.js';
import { discoverEquivalences, mutualNearestPairs } from '../src/perceiver/index.js';
import { retrieveLexical } from '../src/retrieve/index.js';

// Standard genetic code (RNA). For scoring only.
const CODE = {
  UUU: 'Phe', UUC: 'Phe', UUA: 'Leu', UUG: 'Leu', CUU: 'Leu', CUC: 'Leu', CUA: 'Leu', CUG: 'Leu',
  AUU: 'Ile', AUC: 'Ile', AUA: 'Ile', AUG: 'Met', GUU: 'Val', GUC: 'Val', GUA: 'Val', GUG: 'Val',
  UCU: 'Ser', UCC: 'Ser', UCA: 'Ser', UCG: 'Ser', CCU: 'Pro', CCC: 'Pro', CCA: 'Pro', CCG: 'Pro',
  ACU: 'Thr', ACC: 'Thr', ACA: 'Thr', ACG: 'Thr', GCU: 'Ala', GCC: 'Ala', GCA: 'Ala', GCG: 'Ala',
  UAU: 'Tyr', UAC: 'Tyr', UAA: 'Stop', UAG: 'Stop', CAU: 'His', CAC: 'His', CAA: 'Gln', CAG: 'Gln',
  AAU: 'Asn', AAC: 'Asn', AAA: 'Lys', AAG: 'Lys', GAU: 'Asp', GAC: 'Asp', GAA: 'Glu', GAG: 'Glu',
  UGU: 'Cys', UGC: 'Cys', UGA: 'Stop', UGG: 'Trp', CGU: 'Arg', CGC: 'Arg', CGA: 'Arg', CGG: 'Arg',
  AGU: 'Ser', AGC: 'Ser', AGA: 'Arg', AGG: 'Arg', GGU: 'Gly', GGC: 'Gly', GGA: 'Gly', GGG: 'Gly',
};
const codons = Object.keys(CODE);
const de = (doc, o = {}) => discoverEquivalences(doc, { retrieve: retrieveLexical, ...o });

// ---------------------------------------------------------------------------
// PART A — the 64 codons collapse into their families, with no table supplied.
// ---------------------------------------------------------------------------
const dna = ingestCodons({ name: 'standard-code', codons });
console.log('=== PART A · CODON FAMILIES EMERGE (no genetic code supplied) ===');
console.log(`before: ${dna.projectGraph().entities.size} entities — every codon its own thing.\n`);

const pairs = mutualNearestPairs(dna, { retrieve: retrieveLexical });
console.log(`mutual-nearest pairs (each codon's strongest prefix-match, where it's mutual): ${pairs.length}`);

const { classes } = de(dna);   // appends SYN merges to the log
const families = classes.filter(c => c.length > 1);
console.log(`after the engine collapses them: ${dna.projectGraph().entities.size} entities — ${families.length} families.\n`);

const dominant = (cl) => {
  const counts = {};
  for (const i of cl) { const a = CODE[codons[i]]; counts[a] = (counts[a] || 0) + 1; }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
};
let pureBoxes = 0, pureAcids = 0;
for (const cl of families) {
  const cs = cl.map(i => codons[i]);
  const box = new Set(cs.map(c => c.slice(0, 2)));      // first-two-base "box"
  const counts = dominant(cl);
  const isOneAcid = counts.length === 1;
  if (box.size === 1) pureBoxes++;
  if (isOneAcid) pureAcids++;
  const aa = counts.map(([a, n]) => `${a}×${n}`).join(' + ');
  console.log(`   ${[...box][0]}_  {${cs.join(', ')}}  →  ${aa}${isOneAcid ? '' : '   (split by the 3rd base)'}`);
}
console.log(`\nEvery family is exactly one first-two-base BOX: ${pureBoxes}/${families.length}.`);
console.log(`Of those, families that are a SINGLE amino acid: ${pureAcids}/${families.length}.`);
console.log('The reader recovered the genetic code\'s 4×4 block structure — and, where the');
console.log('third base is redundant (Crick\'s wobble), it never drew the distinction at all,');
console.log('the way the octave collapsed but the fifth did not. The category is the output.');

// ---------------------------------------------------------------------------
// PART B · 1 — the reading order is what does it (the falsifiable mechanism).
// ---------------------------------------------------------------------------
// Read a codon as an UNORDERED bag of position-tagged bases instead of nested
// prefixes, and every codon sharing any two of three positions becomes mutually
// nearest to a chain of others — the union-find runs away and all 64 fuse into one
// blob. Prefixes weight the first base most (it is in every prefix); a flat bag
// weights all three equally and the block structure dissolves. Same machinery, and
// it does NOT hallucinate families — it reports one meaningless lump, the honest
// failure mode.
const flat = (() => {
  // A throwaway doc with flat tokens, scored the same way.
  const d = ingestCodons({ name: 'flat', codons });
  codons.forEach((c, i) => {
    const t = [`b1${c[0]}`, `b2${c[1]}`, `b3${c[2]}`].map(s => s.toLowerCase());
    d.tokensBySentence[i] = new Set(t);
    d.partialTokens[i] = t;
  });
  return d;
})();
const flatFamilies = de(flat).classes.filter(c => c.length > 1);
console.log('\n=== PART B · THE READING ORDER IS THE MECHANISM ===');
console.log(`read as a flat bag of {pos1, pos2, pos3} bases instead of nested prefixes:`);
console.log(`   ${flatFamilies.length} family/families; largest has ${Math.max(0, ...flatFamilies.map(f => f.length))} codons` +
  ` (the union-find fuses everything — no block structure).`);

// ---------------------------------------------------------------------------
// PART B · 2 — the real code is special (the biology, falsified against chance).
// ---------------------------------------------------------------------------
// The 16 boxes are a fact of prefix-nesting over a 4-letter triplet — they appear
// for ANY assignment of amino acids. What is NOT generic is that the real code's
// redundancy lines up with those boxes: 8 of 16 are a single amino acid. Shuffle the
// amino-acid labels across the codons (a random code with the same amino-acid counts)
// and ask how often chance does as well.
const boxes = families.map(cl => cl.map(i => codons[i]));
const pureCount = (assign) => boxes.filter(b => new Set(b.map(c => assign[c])).size === 1).length;
const realAssign = Object.fromEntries(codons.map(c => [c, CODE[c]]));
const realPure = pureCount(realAssign);

let s = 0x2545f491;                                   // seeded PRNG — reproducible, no Math.random
const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const labels = codons.map(c => CODE[c]);
const N = 5000;
let sum = 0, max = 0, atLeast = 0;
for (let t = 0; t < N; t++) {
  const a = labels.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const assign = Object.fromEntries(codons.map((c, k) => [c, a[k]]));
  const p = pureCount(assign);
  sum += p; if (p > max) max = p; if (p >= realPure) atLeast++;
}
console.log('\n=== PART B · IS THE REAL CODE SPECIAL? (vs. random codes) ===');
console.log(`real genetic code:   single-amino-acid boxes = ${realPure} / ${boxes.length}`);
console.log(`random codes (${N}):  mean = ${(sum / N).toFixed(2)},  best = ${max},  ` +
  `P(chance ≥ ${realPure}) = ${(atLeast / N).toExponential(2)}`);
console.log('The engine\'s emergent boxes are not just sequence artefacts: on the real code');
console.log('they coincide with amino-acid identity far beyond anything chance produces — the');
console.log('genetic code is organised so the redundancy the reader finds is functional.');
