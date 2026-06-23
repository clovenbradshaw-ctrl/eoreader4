// GENERALIZATION / FITNESS check for EXP-001. A fix earns its keep only if it raises
// AGGREGATE competence across independent pressures, not the one that prompted it.
//
// The honest, signal-grounded fitness: the reserve at cursor c is the reader's belief,
// having read steps 0..c-1, that step c brings something unseen. So measure how well the
// reserve DISCRIMINATES the outcome — AUC(reserve(c), isNewcomer(c)) — over diverse real
// streams: the in-repo corpora, a real melody, and two RANDOM-WIKIPEDIA extracts (the
// outside-in seed, replayable from experiments/seeds/). A lift of context over constant,
// aggregated, with no stream badly regressed, is real generalization.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ingestText, ingestMusic } from '../../src/organs/in/index.js';
import { readingAt } from '../../src/perceiver/index.js';
import { figureNewcomerSeries, streamLength } from '../lib/streams.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const SEEDS = join(HERE, '..', 'seeds');

// AUC(score, label) — P(score|label=1 > score|label=0). 0.5 = no discrimination.
const auc = (pairs) => {
  const pos = pairs.filter(p => p.y).map(p => p.s);
  const neg = pairs.filter(p => !p.y).map(p => p.s);
  if (!pos.length || !neg.length) return null;
  let s = 0;
  for (const a of pos) for (const b of neg) s += a > b ? 1 : (a === b ? 0.5 : 0);
  return s / (pos.length * neg.length);
};

const reserveDiscrimination = (doc) => {
  const { isNewcomer } = figureNewcomerSeries(doc);
  const S = streamLength(doc);
  const cPairs = [], xPairs = [];
  for (let c = 1; c < S; c++) {
    const rc = readingAt(doc, c, { forward: true, reserve: 'constant' }).pNext?.reserve;
    const rx = readingAt(doc, c, { forward: true, reserve: 'context'  }).pNext?.reserve;
    if (rc != null) cPairs.push({ s: rc, y: isNewcomer[c] });
    if (rx != null) xPairs.push({ s: rx, y: isNewcomer[c] });
  }
  return { constant: auc(cPairs), context: auc(xPairs), n: S, newcomers: isNewcomer.filter(Boolean).length };
};

const streams = [];
const addText = async (label, text) => { streams.push({ label, kind: 'text', doc: await ingestText(text, {}) }); };

await addText('esker.txt', readFileSync(join(ROOT, 'data', 'esker.txt'), 'utf8'));
await addText('metamorphosis.txt', readFileSync(join(ROOT, 'data', 'metamorphosis.txt'), 'utf8'));
streams.push({ label: 'twinkle (music)', kind: 'music',
  doc: ingestMusic({ name: 'twinkle', notes: ['C4','C4','G4','G4','A4','A4','G4','F4','F4','E4','E4','D4','D4','C4'] }) });

// The outside-in seeds: every cached random-Wikipedia extract, replayable by title+rev.
if (existsSync(SEEDS)) {
  for (const f of readdirSync(SEEDS).filter(f => f.endsWith('.json'))) {
    const a = JSON.parse(readFileSync(join(SEEDS, f), 'utf8'));
    if (a.extract && a.extract.length > 40) await addText(`wiki:${a.title} @${a.revision}`, a.extract);
  }
}

console.log('=== GENERALIZATION: AUC(reserve(c) predicts newcomer at c) ===');
console.log('  stream                                    n   new   constant  context   lift');
let sumC = 0, sumX = 0, nMeasured = 0, regressed = 0;
for (const s of streams) {
  const r = reserveDiscrimination(s.doc);
  if (r.constant == null || r.context == null) { console.log(`  ${s.label.padEnd(40)} (too few newcomers/steps — skipped)`); continue; }
  const lift = r.context - r.constant;
  if (lift < -0.02) regressed++;
  sumC += r.constant; sumX += r.context; nMeasured++;
  console.log(`  ${s.label.slice(0,40).padEnd(40)} ${String(r.n).padStart(3)} ${String(r.newcomers).padStart(4)}    ` +
    `${r.constant.toFixed(3)}    ${r.context.toFixed(3)}   ${lift >= 0 ? '+' : ''}${lift.toFixed(3)}`);
}
const aggC = sumC / nMeasured, aggX = sumX / nMeasured;
console.log(`\n  AGGREGATE over ${nMeasured} streams:  constant ${aggC.toFixed(3)}  →  context ${aggX.toFixed(3)}   ` +
  `(lift ${aggX - aggC >= 0 ? '+' : ''}${(aggX - aggC).toFixed(3)})`);
console.log(`  streams materially regressed (lift < -0.02): ${regressed}`);
console.log(aggX >= aggC && regressed === 0
  ? '  → FITNESS PASS: context raises aggregate newcomer-discrimination, no stream regressed.'
  : '  → FITNESS REVIEW: see per-stream lift above (scope note for the ledger).');
