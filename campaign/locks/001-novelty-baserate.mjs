// REGRESSION LOCK — capability: the novelty reserve tracks the recent novelty rate.
// Confirmed by exp/001-novelty-baserate in two senses (text, music). This guard fails the
// day the precondition changes: if the dissociation collapses, if the control swings (a
// large cast starts moving the reserve), or if the DEFAULT path drifts off byte-identical.
//
//   node campaign/locks/001-novelty-baserate.mjs   (exit 1 if the capability regressed)

import { parseText } from '../../src/perceiver/parse/index.js';
import { readingAt } from '../../src/perceiver/index.js';
import { ingestMusic } from '../../src/organs/in/music.js';
import { runMeasure } from '../exp/001-novelty-baserate/measure.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(here, '../exp/001-novelty-baserate/key.json'), 'utf8'));

let bad = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) bad++; };

// --- the confirmed dissociation + control, in both senses ---
const by = {};
for (const r of runMeasure()) {
  r.delta = r.live_bayesBits - r.signal_bayesBits;
  (by[key.items[r.item].modality] ||= {})[key.items[r.item].condition] = r;
}
for (const mod of Object.keys(by)) {
  const { high, low, ctrl } = by[mod];
  check((high.delta - low.delta) >= 0.10, `${mod}: reserve effect Δ(high) ≫ Δ(low)  (${high.delta.toFixed(2)} vs ${low.delta.toFixed(2)})`);
  check(Math.abs(ctrl.delta - low.delta) <= 0.06 && (high.delta - ctrl.delta) >= 0.10,
    `${mod}: control holds — Δ(ctrl)≈Δ(low)≪Δ(high) (cast size does not move the reserve)`);
  check(high.noveltyAmp > low.noveltyAmp, `${mod}: instrument — noveltyAmp(high) > noveltyAmp(low)`);
}
check(Object.keys(by).length >= 2, `omnimodal — two organs: ${Object.keys(by).join(', ')}`);

// --- parity canary: the DEFAULT path (no signalNovelty) is byte-identical. These are the
//     surprise.test.js exact-value goldens, re-pinned here so the lock alarms even if that
//     test is edited. A drift means the gated change leaked into the default reader. ---
const gold = parseText('Ada Long spoke. Ada Long spoke. Ben Cole arrived. Ben Cole spoke. Cara Dove entered. Cara Dove spoke.', { docId: 'gold' });
check(readingAt(gold, 0).bayesBits === 0,    'parity: opening is exactly 0 on the default path');
check(readingAt(gold, 2).bayesBits === 0.2,  'parity: a newcomer reads 0.2 on the default path (the constant reserve)');
check(readingAt(gold, 4).bayesBits === 0.26, 'parity: a third figure reads 0.26 on the default path');
// The music default path is unchanged too (the constant reserve), and only differs under the flag.
const m = ingestMusic({ name: 'p', notes: ['C4', 'E4', 'G4', 'C4', 'E4', 'G4'] });
check(readingAt(m, 5).bayesBits === readingAt(m, 5, { signalNovelty: false }).bayesBits,
  'parity: signalNovelty:false equals the default reading');

console.log(`\n${bad ? `LOCK BROKEN (${bad})` : 'lock green'} — novelty reserve tracks the recent rate; default path byte-identical.`);
process.exit(bad ? 1 : 0);
