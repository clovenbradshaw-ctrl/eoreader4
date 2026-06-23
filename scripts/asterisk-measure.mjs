// scripts/asterisk-measure.mjs — directive #1: MEASURE BEFORE BUILDING.
//
// The ontological asterisk earns its place only if latent asterisks are real on our
// own corpus. This is the cheap, read-only pass the directive asks for: build a
// MASTER LOG across several sources, then count human labels whose norm2 form is
// borne by ≥2 distinct ids the FIRM union-find does not unite — the population the
// engine renders today as accidental separation (the same name namespaced apart
// across sources) plus accidental paint-collision (one id standing in for two).
//
// The corpus models "four pages over two weeks": the Metamorphosis body is cut into
// contiguous PAGES, each ingested as its own source, plus the two short stories in
// data/. A character named on page 1 and again on page 5 is two namespaced ids
// bearing one name — exactly the cross-source same-label case the asterisk holds.
//
//   node scripts/asterisk-measure.mjs            # headline counts
//   ASTERISK_DEBUG=1 node scripts/asterisk-measure.mjs   # + the per-name groups
//
// Nothing is mutated and nothing is built here — it only reports the shape of the
// problem, so the build that follows rests on a number, not a hunch.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseText } from '../src/perceiver/parse/pipeline.js';
import { createCompositeDoc } from '../src/organs/in/composite.js';
import { latentAsterisks } from '../src/core/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const DEBUG = /^(1|true|on)$/i.test(process.env.ASTERISK_DEBUG || '');

// The Metamorphosis body between the Gutenberg banners, cut into N contiguous pages
// by paragraph blocks — each page a SOURCE a reader saw on a different day.
const pagesFromGutenberg = (raw, nPages = 6) => {
  const start = raw.indexOf('*** START OF');
  const end   = raw.indexOf('*** END OF');
  const body  = raw.slice(raw.indexOf('\n', start) + 1, end > 0 ? end : undefined);
  const paras = body.split(/\n\s*\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(p => p.length > 40);
  const per   = Math.ceil(paras.length / nPages);
  const pages = [];
  for (let i = 0; i < paras.length; i += per) pages.push(paras.slice(i, i + per).join('\n'));
  return pages;
};

const docs = [];
try {
  pagesFromGutenberg(read('pg5200.txt')).forEach((text, i) =>
    docs.push(parseText(text, { docId: `metamorphosis-p${i + 1}` })));
} catch { /* pg5200 absent — fall back to the short corpus alone */ }
for (const [file, id] of [['data/metamorphosis.txt', 'metamorphosis-short'], ['data/esker.txt', 'esker']]) {
  try { docs.push(parseText(read(file), { docId: id })); } catch { /* optional */ }
}

if (docs.length < 2) {
  console.error('asterisk-measure: need ≥2 sources to measure cross-source identity; found', docs.length);
  process.exit(1);
}

// The master log, referents namespaced apart by source (crossDocSyn OFF — we measure
// the raw population, not what the binder would collapse).
const master = createCompositeDoc(docs, { crossDocSyn: false });
const firm   = latentAsterisks(master.log);                          // latent asterisks (firm-only)
const spec   = latentAsterisks(master.log, { includeSpeculative: true });

const insCount = master.log.snapshot().filter(e => e.op === 'INS').length;

console.log('— asterisk-measure ————————————————————————————————————————');
console.log(`sources:            ${docs.length}  (${docs.map(d => d.docId).join(', ')})`);
console.log(`INS events:         ${insCount}`);
console.log(`LATENT ASTERISKS:   ${firm.count}   (names borne by ≥2 ids the firm union-find leaves apart)`);
console.log(`  ↳ candidate pairs: ${firm.groups.reduce((n, g) => n + g.roots.length - 1, 0)}`);
console.log(`residual w/ specm.: ${spec.count}   (after folding cross-source speculation — what the old binder hides)`);

if (DEBUG) {
  console.log('\n— latent asterisk groups (label → distinct ids the engine separates) ——');
  for (const g of firm.groups.slice(0, 40)) {
    console.log(`  ${g.label || g.norm}*  ×${g.roots.length}`);
    if (g.ids.length <= 8) for (const id of g.ids) console.log(`      ${id}`);
  }
  if (firm.groups.length > 40) console.log(`  … and ${firm.groups.length - 40} more`);
}
console.log('————————————————————————————————————————————————————————————');
