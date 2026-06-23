// p001 · MEASURE — read-only. Emits per-item channels over prior context only.
//
// Touches no production code: it imports readingAt and the organs and READS the
// reserve the engine forms. It never imports the key. The reserve MODE is read from
// the environment (RESERVE=signal turns on the signal-derived reserve once the fix
// exists; unset = the live/fixed engine), so the SAME script runs before and after
// the fix and the two runs are directly comparable.
//
// Run:  node experiments/exp-0002-novelty-reserve/measure.mjs
//       RESERVE=signal node experiments/exp-0002-novelty-reserve/measure.mjs

import { readingAt } from '../../src/perceiver/reading.js';
import { items } from './stimulus.mjs';

const MODE = process.env.RESERVE === 'signal' ? 'signal' : 'fixed';

const rows = [];
for (const it of items()) {
  // opts.forward surfaces the figure-field reserve (read-only); opts.reserve selects
  // the reserve mode (a no-op until the fix exists). The probe cursor is the step the
  // genuine newcomer arrives.
  const r = readingAt(it.doc, it.cursor, { forward: true, reserve: MODE });
  const reserveFig = r.reserveFig;
  rows.push({
    id: it.id, modality: it.modality, group: it.group,
    totalFig: r.totalFig,
    reserveFig: reserveFig != null ? round4(reserveFig) : null,
    newcomerBits: reserveFig > 0 ? round4(-Math.log2(reserveFig)) : null,
    surprisalBits: r.surprisalBits,
    bayesBits: r.bayesBits,
  });
}

const out = { mode: MODE, rows };
// Machine-readable line for the scorer (stdin/pipe), then a human table.
if (process.env.EMIT === 'json') { console.log(JSON.stringify(out)); }
else {
  console.log(`\n# p001 novelty-reserve · MEASURE (reserve mode: ${MODE})\n`);
  console.log('  item                     group     totalFig  reserveFig  newcomerBits');
  for (const r of rows) {
    console.log(`  ${r.id.padEnd(24)} ${String(r.group).padEnd(9)} ${String(r.totalFig).padStart(7)}  ${String(r.reserveFig).padStart(9)}  ${String(r.newcomerBits).padStart(11)}`);
  }
  console.log('');
}

export { out };
function round4(x) { return Math.round(x * 1e4) / 1e4; }
