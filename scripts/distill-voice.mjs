// scripts/distill-voice.mjs — freeze the contrastive register cartridge (spec-the-lens-port.md,
// Track E; spec-the-pantheon.md, Track A's bake material).
//
// The trained register is contrastive: the per-token logit difference between an EXPERT and an
// ANTI-EXPERT (or a plain prompt against an ornate one) IS the steering vector — proxy-tuning at
// the logit level, no weight touched. Live dual-decode is two forward passes per step (too
// expensive on the CPU target), so the difference is averaged offline over the corpus once and
// shipped as one small swappable, auditable vector (data/voice-cartridge.json).
//
//   node scripts/distill-voice.mjs --demo            write a trivial placeholder cartridge
//   node scripts/distill-voice.mjs --model <backend> bake from a backend that exposes logit access
//
// The bake itself needs a backend whose `propose`/logit path is reachable in Node (the Mechanics
// battery wires one via @huggingface/transformers); this script holds the PIPELINE and writes the
// artifact. Without a model it prints what it would do and (with --demo) writes an empty cartridge,
// so the loader stays exercised and the file shape is canonical.

import { writeFileSync } from 'node:fs';

const OUT = 'data/voice-cartridge.json';

// The expert / anti-expert prompt pair. The difference between the two next-token distributions,
// averaged over the corpus contexts, is the register direction. (Per spec-the-pantheon, the Act
// pantheon bakes one such pair PER face-value — toward/against — from the corrected legal-run
// exemplars; this single pair is the lens-port register term those generalize.)
const PAIRS = [
  { key: 'register',
    expert: 'You are a precise, grounded legal analyst. State only what the record supports, plainly.',
    anti:  'You are a florid, ornate storyteller. Embellish freely with vivid, abstract flourish.' },
];

const arg = (flag) => { const i = process.argv.indexOf(flag); return i >= 0 ? (process.argv[i + 1] ?? true) : null; };

const writeCartridge = (tokens, meta) => {
  const json = { meta: { kind: meta.kind, note: meta.note, pairs: PAIRS.length, model: meta.model || null, built: new Date().toISOString() }, tokens };
  writeFileSync(OUT, JSON.stringify(json, null, 2) + '\n');
  console.log(`wrote ${OUT} (${Object.keys(tokens).length} token biases)`);
};

if (arg('--demo') != null) {
  // A placeholder: empty token map, canonical shape. loadVoiceCartridge → zero bias (no-op).
  writeCartridge({}, { kind: 'demo-empty', note: 'Placeholder — no register baked. Run with --model to distill.' });
  process.exit(0);
}

const backend = arg('--model');
if (!backend) {
  console.log('distill-voice — the contrastive register bake.\n');
  console.log('  Pipeline: for each corpus context, decode one step under the EXPERT system prompt and');
  console.log('  under the ANTI-EXPERT prompt; accumulate (logit_expert − logit_anti) per token; average');
  console.log('  over contexts; keep the top-|Δ| tokens; write them to', OUT, 'as { tokenId: delta }.\n');
  console.log('  Needs a backend with logit access. Re-run with:  --model <backend>   or   --demo');
  process.exit(0);
}

// The real bake would: load the backend, iterate corpus contexts, dual-decode per the PAIRS,
// average per-token logit differences, threshold, and writeCartridge(...). It is gated behind a
// reachable logit path (not present in a bare Node run), so this branch documents the shape and
// exits rather than pretending to bake.
console.error(`distill-voice: backend "${backend}" needs a reachable logit path (propose/forwardTokensAndSample).`);
console.error('Wire it like eoreader4-eval/mechanics, then average (logit_expert − logit_anti) into', OUT, '.');
process.exit(2);
