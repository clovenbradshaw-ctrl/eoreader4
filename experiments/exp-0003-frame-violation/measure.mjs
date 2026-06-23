// READ-ONLY measurement for exp-0003. For each item, emit the three significance channels
// at the final cursor: bayesBits (belief-movement / the mass KL), surprisalBits (−log p),
// and bridge (connectivity). Causal, prior-context only. Imports production code; mutates
// nothing; the suite stays byte-identical.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createLog } from '../../src/core/index.js';
import { ingestText } from '../../src/organs/in/index.js';
import { readingAt } from '../../src/perceiver/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const stimulus = JSON.parse(readFileSync(join(HERE, 'stimulus.json'), 'utf8'));

// Build a bare operator log from an event list (the membrane organ for DEF/INS/CON).
const membraneDoc = (events, name) => {
  const log = createLog({ docId: name });
  events.forEach((e, i) => log.append({ ...e, sentIdx: i }));
  return { docId: name, modality: 'membrane', units: events.map((e, i) => `${e.op}@${i}`), log };
};

const buildDoc = async (item) =>
  item.modality === 'text' ? await ingestText(item.input, {}) : membraneDoc(item.input, item.id);

const out = [];
for (const item of stimulus.items) {
  const doc = await buildDoc(item);
  const S = doc.units.length;
  const at = S - 1;
  const r = readingAt(doc, at, { forward: true, bridge: true });
  out.push({ id: item.id, modality: item.modality, at,
             bayes: r.bayesBits, surprisal: r.surprisalBits, bridge: r.bridge ?? 0 });
}

writeFileSync(join(HERE, 'measure-out.jsonl'), out.map(o => JSON.stringify(o)).join('\n') + '\n');
console.log(`measured ${out.length} items → measure-out.jsonl`);
// Instrument trace: the two probe twins + the positive control, so a human sees the values.
for (const id of ['bird-V', 'bird-C', 'pc-bridge']) {
  const t = out.find(o => o.id === id);
  if (t) console.log(`  ${id.padEnd(10)} bayes=${t.bayes.toFixed(3)} surprisal=${t.surprisal.toFixed(2)} bridge=${t.bridge.toFixed(2)}`);
}
