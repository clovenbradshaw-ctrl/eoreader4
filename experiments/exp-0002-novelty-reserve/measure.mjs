// READ-ONLY measurement for EXP-001. Emits per-item channels over prior context only,
// causally. Touches no production code (imports only). The same script measures the
// GAP under the live engine and the CAPABILITY after the fix is threaded on — it asks
// for both the 'constant' and 'context' reserve every run; before the fix the 'context'
// request is a no-op and the two channels coincide (the gap), after it they diverge.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildDoc, reserveAt, figureNewcomerSeries, streamLength } from '../lib/streams.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const stimulus = JSON.parse(readFileSync(join(HERE, 'stimulus.json'), 'utf8'));

const out = [];
for (const item of stimulus.items) {
  const doc = await buildDoc(item);
  const S = streamLength(doc);
  const cursor = S - 1;                       // the final cursor; prior = steps 0..S-2
  const { isNewcomer, distinct } = figureNewcomerSeries(doc);

  // The two reserve channels at the measured cursor.
  const reserveConstant = reserveAt(doc, cursor, 'constant');
  const reserveContext  = reserveAt(doc, cursor, 'context');

  // The whole reserve curve + the newcomer outcome at each step, for the generalization
  // metric (does the reserve at c predict a newcomer arriving at c?).
  const curve = [];
  for (let c = 1; c < S; c++) {
    curve.push({
      c,
      rc: reserveAt(doc, c, 'constant'),
      rx: reserveAt(doc, c, 'context'),
      newcomer: isNewcomer[c],
    });
  }

  out.push({ id: item.id, modality: item.modality, S, distinct, cursor,
             reserveConstant, reserveContext, curve });
}

writeFileSync(join(HERE, 'measure-out.jsonl'), out.map(o => JSON.stringify(o)).join('\n') + '\n');
console.log(`measured ${out.length} items → measure-out.jsonl`);
// Instrument trace: one item, both channels, so a human can see the channel computed.
const t = out[0];
console.log(`trace ${t.id} (${t.modality}): reserveConstant=${t.reserveConstant?.toFixed(5)} reserveContext=${t.reserveContext?.toFixed(5)} distinctFigures=${t.distinct}`);
