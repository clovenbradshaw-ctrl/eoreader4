// learn-links.mjs — run the label-feedback link-type growth over a corpus and post the
// learning to GitHub (via the n8n publish webhook → clovenbradshaw-ctrl/plain-text).
//
// A link is its operator (the first level). The closed relation vocabulary types only a
// minority of links; the recurring untyped verbs are CANDIDATE specific types. For each we
// MEASURE whether the structural feature space carves it beyond a same-operator null —
// `structureGrows` is the empirical answer to "can the structural basis learn a new
// distinction on its own, or must VOX push the meaning down?". We post that record so the
// learning accumulates across runs (append-only JSONL), clearly filed as what it is.
//
//   node scripts/learn-links.mjs [path-to-text]            # run + post
//   node scripts/learn-links.mjs [path-to-text] --dry-run  # run + print, no post
//
// The webhook contract (POST {filename, mode, contentRaw, message}):
//   https://n8n.intelechia.com/webhook/site/publish
// writes/creates the file in clovenbradshaw-ctrl/plain-text (main), readable at
//   https://raw.githubusercontent.com/clovenbradshaw-ctrl/plain-text/main/<filename>

import { readFileSync } from 'node:fs';
import { parseText } from '../src/perceiver/parse/index.js';
import { growLinkTypes } from '../src/surfer/index.js';

const PUBLISH_URL = 'https://n8n.intelechia.com/webhook/site/publish';
const LEARNING_FILE = 'eoreader4-learning/grown-link-types.jsonl';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const path = args.find(a => !a.startsWith('--')) || './pg5200.txt';
const docId = path.replace(/^.*\//, '').replace(/\.[^.]*$/, '');

let raw = readFileSync(path, 'utf8');
const a = raw.search(/\*\*\* ?START OF TH/i), b = raw.search(/\*\*\* ?END OF TH/i);
if (a >= 0 && b > a) raw = raw.slice(raw.indexOf('\n', a) + 1, b);   // strip Gutenberg boilerplate

const doc = parseText(raw, { docId });
const g = growLinkTypes(doc, { minCount: 4, samples: 300 });

// the learning record — the measured verdict plus the candidates it was read from.
const record = {
  at: new Date().toISOString(),
  doc: docId,
  total: g.total, typed: g.typed, untyped: g.untyped, typedFraction: g.typedFraction,
  candidates: g.candidates, usableCount: g.usableCount,
  structureGrows: g.structureGrows,
  grown: g.grown,
  // the plain reading of the verdict, so the file is legible without re-deriving it.
  finding: g.structureGrows
    ? 'structure alone grew at least one usable specific link-type (it beat a same-operator null)'
    : 'no recurring untyped label named a regularity the structural features could separate within its operator — the labels carry meaning structure does not see, so the semantic push from VOX is doing real work here',
};

console.log(`\nlabel-feedback link-type growth — ${docId}`);
console.log(`  links ${g.total}   closed-vocab typed ${g.typed} (${(g.typedFraction * 100).toFixed(1)}%)   untyped ${g.untyped}`);
console.log(`  recurring untyped candidates ${g.candidates}   usable ${g.usableCount}   structureGrows ${g.structureGrows}`);
for (const t of g.grown) console.log(`    ${t.usable ? 'USABLE' : '  -   '}  ${t.key.padEnd(22)} n=${String(t.count).padEnd(4)} coh=${t.coherence}  null=${t.nullLine}`);
console.log(`\n  finding: ${record.finding}\n`);

if (dryRun) { console.log('--dry-run: not posting. Payload filename would be', LEARNING_FILE); process.exit(0); }

const body = {
  filename: LEARNING_FILE,
  mode: 'append',
  contentRaw: JSON.stringify(record),
  message: `eoreader4 link-type learning — ${docId}: structureGrows=${g.structureGrows} (${g.usableCount}/${g.candidates} usable)`,
};

try {
  const res = await fetch(PUBLISH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) { console.error(`POST failed ${res.status}: ${text.slice(0, 400)}`); process.exit(1); }
  console.log(`posted → ${LEARNING_FILE}`);
  console.log(`  ${text.slice(0, 300)}`);
  console.log(`  read at https://raw.githubusercontent.com/clovenbradshaw-ctrl/plain-text/main/${LEARNING_FILE}`);
} catch (err) {
  console.error('POST error (the webhook host may be egress-blocked from this environment):', err.message);
  console.error('Run with --dry-run to inspect the payload without posting.');
  process.exit(1);
}
