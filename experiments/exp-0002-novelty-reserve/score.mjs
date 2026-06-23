// exp-0002 · SCORER — joins the key-blind measure to the held key and adjudicates the
// predicted DISSOCIATION: the signal-derived reserve must help the positively-autocorrelated
// stream (deltaSurprisal < 0) and regress the anti-correlated stream (deltaSurprisal > 0).
// A pass is the sign-split landing as the key predicted; it does NOT promote the variant —
// the disposition (NOT PROMOTED) is recorded because ON breaks parity and the net sign over a
// real corpus is set by that corpus's autocorrelation, which a blanket reserve cannot know.
//
//   node experiments/exp-0002-novelty-reserve/score.mjs   → prints the verdict, exits 0 on pass

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { measure } from './measure.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(here, 'key.json'), 'utf8'));

const sign = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
const want = { signal_helps: -1, signal_regresses: 1 };

const results = measure();
let pass = true;
for (const r of results) {
  const pred = key.predictions[r.id];
  const ok = sign(r.deltaSurprisal) === want[pred.predict];
  pass = pass && ok;
  console.log(`${r.id}: deltaSurprisal=${r.deltaSurprisal} bits  predicted=${pred.predict} (${pred.direction})  ${ok ? 'PASS' : 'FAIL'}`);
}

const splitConfirmed = sign(results[0]?.deltaSurprisal) !== sign(results[1]?.deltaSurprisal)
  && results.every(r => r.deltaSurprisal !== 0);

console.log('---');
console.log(`dissociation confirmed: ${splitConfirmed && pass}`);
console.log(`disposition: ${key.disposition.split(' — ')[0]}`);
if (!(splitConfirmed && pass)) { console.error('exp-0002 dissociation did NOT hold'); process.exit(1); }
