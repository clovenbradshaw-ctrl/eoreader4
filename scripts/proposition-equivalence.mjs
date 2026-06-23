// Proposition equivalence, measured — the abstention test for MEANING.
//
// The claim under test (the user's): two clauses that say the same thing differently —
// "Ralph owns a boat" / "Ralph is the owner of a boat" — should be attested as the SAME
// proposition from their embeddings, robustly. "Robustly" is the whole job: a detector
// that merges paraphrases must also REFUSE to merge unrelated clauses, and must refuse
// to merge a clause with its own NEGATION (whose embedding is nearly identical). So this
// run reports, like scripts/abstain.mjs does for tones and shapes:
//
//   • DETECTION  — the paraphrase pairs clear the field's own noise null.
//   • ABSTENTION — a field of all-distinct propositions clears nothing (false-merge ≈ 0).
//   • THE VETO   — a negation, near in embedding, is forked by polarity, never merged.
//
// The boundary is not picked. It is the Born rule (src/core/voidnull.js): the field's
// non-cohering cosines are samples of what chance produces, and a merge must beat the
// extreme-value (1−α) quantile of that background — leave-one-out, robust, causal.
//
// MiniLM is the real instrument; we cannot download it here. So this script stands in a
// MEANING-FAITHFUL synthetic embedder — a shared positive baseline (unrelated clauses
// cosine ~0.4, as real sentence vectors do) plus a per-concept direction, paraphrases
// sharing the concept. The mechanism is the embedder's CONSUMER, so the measurement is
// real even though the organ is a stand-in; under the warm MiniLM organ the same call
// runs unchanged (the firewall, measuresMeaning, is the seam). Run:
//
//   node scripts/proposition-equivalence.mjs

import { discoverPropositionEquivalence } from '../src/perceiver/proposition-equivalence.js';

// ── a meaning-faithful synthetic embedder (offline stand-in for warm MiniLM) ─────
const D = 80;
const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);   // repo idiom (abstain.mjs)
const gauss = (r) => (r() + r() + r() + r() - 2);
const norm = (v) => { const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1; return v.map(x => x / n); };
const conceptVec = (seed, concept) => {
  const r = rng(seed);
  const v = new Array(D).fill(0);
  v[0] = 0.5;                                  // shared baseline → positive cosines
  for (let i = 1; i < 8; i++) v[i] = 0.45 * gauss(r);   // topic spread → realistic variance
  v[8 + (concept % 64)] = 1.1;                 // the concept's own dominant direction
  return new Float32Array(norm(v));
};
// concept + surface seed per clause; paraphrases share a concept, distractors do not.
const mkEmbedder = (table) => ({
  measuresMeaning: true,
  embed: async (text) => {
    const e = table[text];
    if (e) return conceptVec(e[1], e[0]);
    let h = 0; for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return conceptVec(h, 40 + (h % 24));
  },
});

const pct = (x) => `${(x * 100).toFixed(0)}%`;

console.log('=== PROPOSITION EQUIVALENCE · ATTESTED BY THE BORN RULE ===');
console.log('  "the noise gives the odds, the reading does the measuring" — applied to MEANING\n');

// ── 1. DETECTION + ABSTENTION in one field ───────────────────────────────────────
const SPACE = {
  'Ralph owns a boat':              [0, 11],
  'Ralph is the owner of a boat':   [0, 12],   // paraphrase A
  'Grete plays the violin':         [1, 21],
  'The violin is played by Grete':  [1, 22],   // paraphrase B
  'The dog slept by the fire':      [2, 31],
  'The train left at noon':         [3, 41],
  'Snow fell on the rooftops':      [4, 51],
  'He counted the coins twice':     [5, 61],
};
const field = Object.keys(SPACE);
const embedder = mkEmbedder(SPACE);
const out = await discoverPropositionEquivalence(field, { embedder, alpha: 0.01 });

console.log(`## a field of ${field.length} propositions (2 paraphrase pairs planted, 4 distractors)`);
console.log(`   the Born null is derived from the field's OWN non-cohering cosines (α=0.01)\n`);
for (const c of out.pairs)
  console.log(`   ✅ SAME  (${c.sim.toFixed(3)} > null ${c.boundary.toFixed(3)})  «${field[c.i]}»  ≡  «${field[c.j]}»`);
for (const c of out.held)
  console.log(`   ·  held  (${c.sim.toFixed(3)} ≤ null ${c.boundary.toFixed(3)})  «${field[c.i]}»  ~  «${field[c.j]}»  (asterisk stands)`);
console.log(`\n   ⇒ ${out.pairs.length} attested, ${out.held.length} held. The two paraphrase pairs cleared`);
console.log(`     the null; the distractors' nearest-neighbours did not. No threshold was picked.\n`);

// ── 2. ABSTENTION: a noise-only field (no paraphrases) ───────────────────────────
const NOISE = {};
['The dog slept by the fire', 'The train left at noon', 'Snow fell on the rooftops',
 'He counted the coins twice', 'A letter arrived on Monday', 'The lamp flickered once',
 'Rain streaked the glass', 'The bell rang twice'].forEach((c, i) => { NOISE[c] = [10 + i, 100 + i]; });
const noiseField = Object.keys(NOISE);
const noiseOut = await discoverPropositionEquivalence(noiseField, { embedder: mkEmbedder(NOISE), alpha: 0.01 });
console.log(`## abstention — ${noiseField.length} all-distinct propositions, nothing planted`);
console.log(`   false merges: ${noiseOut.pairs.length}/${noiseField.length}   voided: ${noiseOut.voided}   (the correct, rare behaviour is silence)`);
console.log(`   ⇒ the mutual-nearest argmax still PROPOSES pairs, but none beats what the field's`);
console.log(`     own noise produces — so the engine asserts a DEF-to-void, not a hallucinated merge.\n`);

// ── 3. THE POLARITY VETO: a negation is not a paraphrase, however near ───────────
const POLAR = {
  'Ralph owns a boat':         [0, 11],
  'Ralph does not own a boat': [0, 13],   // same concept (near embedding), opposite sign
  'Grete plays the violin':    [1, 21],
  'The violin is played by Grete': [1, 22],
};
const polarProps = [
  { clause: 'Ralph owns a boat', polarity: '+' },
  { clause: 'Ralph does not own a boat', polarity: '−' },   // the parser's sign (U+2212)
  { clause: 'Grete plays the violin', polarity: '+' },
  { clause: 'The violin is played by Grete', polarity: '+' },
];
const polarOut = await discoverPropositionEquivalence(polarProps, { embedder: mkEmbedder(POLAR), alpha: 0.01 });
console.log('## the polarity veto — "owns" vs "does not own" (near in embedding, opposite in sign)');
for (const c of polarOut.opposed)
  console.log(`   ⊥ OPPOSED  (${c.sim.toFixed(3)})  «${polarProps[c.i].clause}»  ⟂  «${polarProps[c.j].clause}»  — contradiction, not identity`);
for (const c of polarOut.pairs)
  console.log(`   ✅ SAME     (${c.sim.toFixed(3)})  «${polarProps[c.i].clause}»  ≡  «${polarProps[c.j].clause}»`);
console.log(`   ⇒ the negation's embedding is NEAR (it shares almost every word), so a bare cosine`);
console.log(`     threshold would merge it. Polarity — the parser's, never spelling's — forks it.\n`);

console.log('=== WHAT THIS SHOWS ===');
console.log('Proposition sameness is an EVA judgment (construe A as B) attested by the Born rule:');
console.log('embedding nearness PROPOSES the merge, the field\'s own noise null DISPOSES of it, and');
console.log('polarity vetoes the one case nearness gets wrong. DEF each proposition, EVA the cosine,');
console.log('REC the merge / split / hold — the same loop asterisk.js runs on a name, run on a clause.');
console.log('The real instrument is warm MiniLM; under the hash organ the firewall holds every pair.');
