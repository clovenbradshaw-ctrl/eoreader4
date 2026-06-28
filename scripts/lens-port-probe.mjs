// scripts/lens-port-probe.mjs — THE AFTERNOON MEASUREMENT (spec-the-lens-port.md, Track B).
//
// The whole idea hinges on one question: does the concept→token bridge actually move the
// surface, and does first-token biasing cover the grounded set? This probe answers the parts
// that DON'T need a GPU — bridge coverage and the noise-null discipline — over a real document,
// and documents the one part that does (the live "does biasing move the model's surface" run,
// which uses the WebLLM tokenizer in the browser).
//
//   node scripts/lens-port-probe.mjs [path/to/doc.txt]   (defaults to pg5200.txt, first ~40k chars)
//
// Coverage here uses a STAND-IN whitespace tokenizer, so the clean/lossy split is optimistic
// (real byte-level BPE fragments more names). The real numbers come from injecting the model's
// own tokenizer (webllm getTokenizer()); this run validates the plumbing and the magnitude
// discipline, not the model's exact vocabulary.

import { readFileSync } from 'node:fs';
import { parseText } from '../src/perceiver/parse/pipeline.js';
import { buildConceptTokenMap, measureBridge } from '../src/write/concept-tokens.js';
import { softmax, applyBias } from '../src/write/lens-port.js';
import { deriveNull } from '../src/core/index.js';

// A deterministic stand-in tokenizer: a leading space marks a word start; each distinct piece
// gets a stable id. Greedy over whitespace, so a multi-word name fragments into its words.
const makeWhitespaceTokenizer = () => {
  const dict = new Map(); const rev = [];
  const id = (piece) => { if (!dict.has(piece)) { dict.set(piece, rev.length); rev.push(piece); } return dict.get(piece); };
  return {
    encode(text) {
      const out = [];
      for (const m of String(text).matchAll(/\s+\S+|\S+/g)) out.push(id(m[0]));
      return out;
    },
    decode(ids) { return (Array.isArray(ids) ? ids : [ids]).map(i => rev[i] ?? '').join(''); },
  };
};

const path = process.argv[2] || 'pg5200.txt';
let text = '';
try { text = readFileSync(path, 'utf8').slice(0, 40000); }
catch { console.error(`could not read ${path}`); process.exit(1); }

const doc = parseText(text);
const tok = makeWhitespaceTokenizer();
const surf = { focus: null };

console.log(`\n── lens-port probe · ${path} (${doc.sentences?.length ?? 0} sentences) ──\n`);

// 1) Bridge coverage — how much of the grounded set maps to a single word-initial token.
const cov = measureBridge(doc, surf, tok);
console.log('bridge coverage (stand-in tokenizer; real BPE fragments more):');
console.log(`  figures mapped   : ${cov.figuresMapped}`);
console.log(`  clean first-token: ${cov.cleanFirstToken}  (${(cov.cleanFraction * 100).toFixed(1)}%)`);
console.log(`  lossy multi-token: ${cov.lossyMultiToken}`);
console.log(`  grounded numbers : ${cov.groundedNumbers}`);

// 2) Noise-null discipline — a targeted relevance bias on a salient figure must move the output
// more than a random bias of the same magnitude (spec "Magnitude — the noise-null discipline").
const map = buildConceptTokenMap(doc, surf, tok);
const figures = map.figures.slice(0, 1);
if (figures.length) {
  const target = map.firstTokenOf(figures[0]);
  const V = Math.max(target + 1, 256);
  const logits = new Float32Array(V);            // flat ⇒ high entropy ⇒ a real choice point
  const mag = 4;
  const before = softmax(logits)[target];
  const real = softmax(applyBias(logits, new Map([[target, mag]])))[target] - before;
  const rand = [];
  for (let i = 0; i < V; i++) { if (i === target) continue; rand.push(softmax(applyBias(logits, new Map([[i, mag]])))[target] - before); }
  const floor = deriveNull(rand, { scale: 'linear', alpha: 0.05 });
  console.log(`\nnoise-null on figure "${figures[0]}" (token ${target}):`);
  console.log(`  real Δp(target)  : ${real.toExponential(3)}`);
  console.log(`  noise floor      : ${Number.isFinite(floor) ? floor.toExponential(3) : 'unmeasurable'}`);
  console.log(`  verdict          : ${real > (Number.isFinite(floor) ? floor : 0) ? 'STEERS (beats noise)' : 'noise'}`);
}

console.log('\nThe live test (does biasing move the MODEL\'s surface) runs in the browser with the');
console.log('lens toggle on and webllm.getTokenizer() supplying the real ids — see chat.html.\n');
