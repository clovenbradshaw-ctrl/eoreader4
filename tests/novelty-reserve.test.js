import { test } from 'node:test';
import assert from 'node:assert/strict';

import { noveltyAmplitude, surpriseAt, NOVELTY_RESERVE } from '../src/core/surprise.js';
import { parseText } from '../src/perceiver/parse/index.js';
import { readingAt } from '../src/perceiver/index.js';
import { ingestMusic } from '../src/organs/in/music.js';

// The signal-derived novelty reserve (campaign exp/001-novelty-baserate). The reserve mass a
// reader holds for an as-yet-unseen atom should track the recent RATE of newcomers — not the
// hand-set NOVELTY_RESERVE constant, which is blind to whether newcomers have been arriving.
// The amplitude becomes context-sensitive; the Born step (reserve = novelty/(sumPrior+novelty)
// in surpriseAt) stays fixed. Off by default — the default reader is byte-identical (parity).

test('noveltyAmplitude — γ-decayed newcomer rate: recent weighs 1, old decays, none is zero', () => {
  assert.equal(noveltyAmplitude([], 5, 0.7), 0);                 // no newcomers → no reserve amplitude
  assert.equal(noveltyAmplitude([5], 5, 0.7), 1);               // a newcomer arriving AT the cursor weighs γ⁰=1
  assert.ok(Math.abs(noveltyAmplitude([3], 5, 0.7) - 0.49) < 1e-9); // two steps back → γ² = 0.49
  // A high-rate stream (a newcomer every step) carries far more reserve than a low-rate one.
  const high = noveltyAmplitude([1, 2, 3, 4, 5], 5, 0.7);
  const low  = noveltyAmplitude([0, 5], 5, 0.7);
  assert.ok(high > low, `recent burst (${high.toFixed(2)}) > stale openings (${low.toFixed(2)})`);
});

test('the Born step is untouched — surpriseAt(novelty=amp) is the same law, a different amplitude', () => {
  // surpriseAt with the derived amplitude is just the existing law fed a context-sensitive
  // novelty; passing the constant reproduces NOVELTY_RESERVE exactly (no law change).
  const a = surpriseAt(new Map([['x', 2]]), new Map([['y', 1]]), { gamma: 0.7 });
  const b = surpriseAt(new Map([['x', 2]]), new Map([['y', 1]]), { gamma: 0.7, novelty: NOVELTY_RESERVE });
  assert.equal(a.bayesBits, b.bayesBits);
});

test('readingAt parity — signalNovelty defaults OFF and signalNovelty:false equals the default', () => {
  const doc = parseText('Ada Long spoke. Ada Long spoke. Ben Cole arrived. Ben Cole spoke.', { docId: 'p' });
  for (const c of [0, 1, 2, 3]) {
    assert.equal(readingAt(doc, c, { signalNovelty: false }).bayesBits, readingAt(doc, c).bayesBits,
      `cursor ${c}: the gated flag off is byte-identical to the default`);
  }
  // The opening still falls to exactly zero under the flag (a single newcomer weighs 1, as the constant did).
  assert.equal(readingAt(doc, 0, { signalNovelty: true }).bayesBits, 0);
});

// The capability: the SAME newcomer is less surprising after a burst of newcomers than after a
// stable stretch — matched on unit count (so total decayed mass is matched). Read via the
// reserve effect Δ = default − signal, which isolates the reserve within one item.
const reserveEffect = (doc, at) => readingAt(doc, at).bayesBits - readingAt(doc, at, { signalNovelty: true }).bayesBits;

test('text — the reserve absorbs more of a newcomer after a burst of newcomers (controlled for mass)', () => {
  const line = (ws) => parseText(ws.map(w => `${w} ran.`).join(' '), { docId: 'x' });
  const burst  = line([...Array(10).fill('Ada'), 'Bo', 'Cy', 'Di', 'Ed', 'Fi', 'Zo']);   // recent = newcomers
  const stable = line(['Ada', 'Bo', 'Cy', 'Ada', 'Bo', 'Cy', 'Ada', 'Bo', 'Cy', 'Ada', 'Bo', 'Cy', 'Ada', 'Bo', 'Cy', 'Zo']);  // recent = recurrence
  // Same length ⇒ identical total mass; the default reader is blind to the difference.
  assert.equal(readingAt(burst, 15).bayesBits, readingAt(stable, 15).bayesBits);
  // Under the signal reserve the newcomer Zo is markedly less surprising in the burst.
  assert.ok(reserveEffect(burst, 15) - reserveEffect(stable, 15) >= 0.1,
    `burst reserve effect ${reserveEffect(burst, 15).toFixed(2)} ≫ stable ${reserveEffect(stable, 15).toFixed(2)}`);
});

test('music — the same dissociation in a second organ (the omnimodal gate)', () => {
  const N = (notes) => ingestMusic({ name: 'm', notes });
  const burst  = N([...Array(10).fill('C4'), 'D4', 'E4', 'G4', 'A4', 'B4', 'F#5']);   // recent = new pitch classes
  const stable = N(['C4', 'D4', 'E4', 'C4', 'D4', 'E4', 'C4', 'D4', 'E4', 'C4', 'D4', 'E4', 'C4', 'D4', 'E4', 'F#5']);
  assert.ok(reserveEffect(burst, 15) - reserveEffect(stable, 15) >= 0.1,
    `burst reserve effect ${reserveEffect(burst, 15).toFixed(2)} ≫ stable ${reserveEffect(stable, 15).toFixed(2)} — interior change helps a 2nd sense`);
});
