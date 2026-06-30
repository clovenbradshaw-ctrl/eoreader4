// surf-wnp.mjs — surf War and Peace to answer the seminar questions, and SAVE the results.
//
// The honest deliverable (the firewall, src/surfer/evaluation.js): the surf is the modeler +
// the surfer, the σ-side. Per question it REACHES the material (regions, cast, cited bonds, the
// argument structure) and ATTRIBUTES the narrator's evaluative operation; it does NOT render the
// verdict. So this writes, for each question, the evidence the surf assembled — every span cited
// to a sentence index, verbatim quote attached — for a reader to evaluate region-reaching,
// citation quality, and the modeler's owner-attributed loci against their own reading.
//
// Run:  node eoreader4-eval/surf-wnp.mjs [path-to-pg2600.txt]
// Writes eoreader4-eval/surf-wnp-results.{json,md} next to this file.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseText } from '../src/perceiver/parse/index.js';
import { encodeLevels, attributedEvaluation, surfToAnswer } from '../src/surfer/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const QUESTIONS = [
  "Do Tolstoy's essayistic digressions enrich the novel or form a separate treatise grafted onto it?",
  "How does the novel dramatize the attack on the great-man theory, and is Kutuzov an alternative model of leadership?",
  "Trace Pierre's spiritual development — genuine progress toward truth or a series of illusions?",
  "Is the First Epilogue's domestic Natasha a betrayal of her vibrancy or a fulfillment of it?",
  "Analyze Tolstoy's defamiliarization — the opera scene — and its moral project.",
  "Is Platon Karataev endorsed as wisdom or a romanticization of the peasantry?",
  "How stable is the opposition between artificial Petersburg society and authentic Moscow?",
  "How does contingency and chance square with the deterministic claims about historical inevitability?",
];

const loadText = (path) => {
  const raw = readFileSync(path, 'utf8');
  const s0 = raw.indexOf('*** START OF THE PROJECT GUTENBERG');
  const e0 = raw.indexOf('*** END OF THE PROJECT GUTENBERG');
  const body = raw.slice(s0 >= 0 ? raw.indexOf('\n', s0) + 1 : 0, e0 > 0 ? e0 : undefined);
  const i = body.indexOf('Well, Prince');
  return i >= 0 ? body.slice(i) : body;
};

const path = process.argv[2] || join(HERE, 'pg2600.txt');
process.stderr.write(`reading ${path} …\n`);
const t0 = Date.now();
const doc = parseText(loadText(path), { docId: 'war-and-peace', totalRead: true });
const encoding = encodeLevels(doc);
const evaluation = attributedEvaluation(doc, encoding);
const readMs = Date.now() - t0;

const results = QUESTIONS.map((q) => surfToAnswer(q, { doc, encoding, evaluation, top: 3 }));

const meta = { doc: 'War and Peace (Maude trans., Gutenberg 2600)', sentences: doc.sentences.length,
               coarseUnits: encoding.segments.length, grain: encoding.mode, readMs };
writeFileSync(join(HERE, 'surf-wnp-results.json'), JSON.stringify({ meta, results }, null, 2));

// human-readable, for evaluation
const L = [];
L.push(`# Surf → War and Peace — saved results for evaluation\n`);
L.push(`${meta.sentences} sentences → ${meta.coarseUnits} ${meta.grain} units · read ${(readMs / 1000).toFixed(0)}s\n`);
L.push(`Two channels, gated and never blended (the firewall):`);
L.push(`- 🟦 **SOURCE (σ)** — cited document material + the narrator's *attributed* evaluative operation. Every span traces to a sentence index; audit it against the text.`);
L.push(`- 🟥 **INTERPRETATION (ρ)** — the reader's/talker's own verdict. The surf withholds it; a talker renders it in a *separate* call, as a visibly distinct channel. Here it is left open for you.\n`);
for (let i = 0; i < results.length; i++) {
  const r = results[i];
  L.push(`\n## Q${i + 1}. ${r.question}\n`);
  L.push(`*domain → ${r.domain}*  ·  keys: ${r.keys.join(', ')}\n`);
  L.push(`### 🟦 SOURCE — what the reading surfaces (cited)\n`);
  for (const reg of r.source.regions) {
    L.push(`\n**▸ ${reg.title || '(span)'}**  · s${reg.lo}–${reg.hi} (${reg.sentences}s) · cast: ${reg.cast.join(', ') || '—'}`);
    if (reg.evaluation) L.push(`  · narrator's evaluative operation (attributed): **${reg.evaluation.carrier || '—'}** (score ${reg.evaluation.score}, owner ${reg.evaluation.owner.replace('mind:', '')})`);
    const al = Object.entries(reg.argumentLinks);
    if (al.length) L.push(`  · argument links: ${al.map(([k, v]) => `${k}×${v}`).join(', ')}`);
    for (const b of reg.bonds) L.push(`  - \`${b.src} --${b.via}--> ${b.tgt}\` [s${b.sentIdx}] — "${b.quote}"`);
  }
  const ns = r.source.narratorStance;
  if (ns) L.push(`\n> narrator's sharpest judgment near this material (attributed, owner **${ns.owner.replace('mind:', '')}**): _${ns.carrier}_ @s${ns.sentIdx} — "${ns.quote}"`);
  L.push(`\n### 🟥 INTERPRETATION — the reader's verdict (ρ, withheld by the surf)\n`);
  L.push(`> _${r.interpretation.discipline}._ The surf renders no verdict; this is yours, or a talker's separate call.`);
}
writeFileSync(join(HERE, 'surf-wnp-results.md'), L.join('\n') + '\n');
process.stderr.write(`wrote surf-wnp-results.{json,md}\n`);
console.log(`done — ${results.length} questions, ${meta.sentences} sentences, ${(readMs / 1000).toFixed(0)}s read`);
