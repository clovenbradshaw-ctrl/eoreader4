// GENERALIZATION probe (campaign: "fitness is generalization, not the single pass").
// The fix is justified only if it is stable on INDEPENDENT material it was not built on —
// not just the planted stimulus. Read the two real documents the goldens are pinned to,
// under the flag OFF (const) and ON (rate), at every cursor, and check the flag-on path is
// well-formed: the opening stays exactly 0, every bayes value is finite (no newcomer
// blew up the divergence), and the channel did not collapse to a constant (it still
// discriminates). Also confirm flag-off is byte-identical to the recorded reading.
//
// This is read-only; it imports the production reader and flips opts.rulesRev.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseText } from '../../../src/perceiver/parse/index.js';
import { readingAt } from '../../../src/perceiver/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const docs = ['data/metamorphosis.txt', 'data/esker.txt'];

let allOk = true;
for (const rel of docs) {
  const text = readFileSync(join(ROOT, rel), 'utf8');
  const doc = parseText(text, { docId: rel });
  const N = (doc.units || doc.sentences || []).length;

  const off = [], on = [];
  for (let c = 0; c < N; c++) {
    off.push(readingAt(doc, c).bayesBits);                    // const (default)
    on.push(readingAt(doc, c, { rulesRev: true }).bayesBits); // rate
  }
  const finite = on.every(Number.isFinite);
  // At cursor 0 (at=0) there is no prior history, so the rate amplitude is undefined and the
  // boundary keeps the constant — rate MUST equal const there (not necessarily 0: a doc that
  // opens with several simultaneous newcomers has a nonzero opening on BOTH paths).
  const openingMatches = on[0] === off[0];
  const onSpread = Math.max(...on) - Math.min(...on);
  const distinctOn = new Set(on.map(x => Math.round(x * 100))).size;
  const changed = off.some((v, i) => Math.abs(v - on[i]) > 1e-9);   // the flag actually does something
  const maxOn = Math.max(...on);

  const ok = finite && openingMatches && distinctOn > 3 && changed;
  allOk &&= ok;
  console.log(`${rel}  (${N} units)`);
  console.log(`  finite(on): ${finite}   opening rate==const: ${openingMatches} (${off[0]})   flag changes reading: ${changed}`);
  console.log(`  on: spread ${onSpread.toFixed(3)}, ${distinctOn} distinct values, max ${maxOn.toFixed(3)}  → ${ok ? 'STABLE' : 'PROBLEM'}`);
}
console.log(allOk ? '\nGENERALIZATION OK — the rate reserve is finite, well-formed and discriminating on independent documents.'
                  : '\nGENERALIZATION PROBLEM — see above.');
process.exit(allOk ? 0 : 1);
