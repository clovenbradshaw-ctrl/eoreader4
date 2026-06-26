import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/perceiver/parse/index.js';
import { think, everyThoughtIsMine } from '../src/write/index.js';
import { READ_BACK } from '../src/core/index.js';

// Thinking = impressionistic talking turned inward. Voice an impression, hear it back,
// let the hearing re-focus, voice again — grounded, firewalled, self-terminating.

const DOC = () => parseText(
  'Gregor saw Grete. Grete trusted the father. The father struck Gregor. Gregor loved Grete.',
  { docId: 'm' },
);

test('a train of thought wanders the graph from a starting focus', () => {
  const t = think(DOC(), { cursor: 'Gregor', genders: { Gregor: 'm', Grete: 'f' }, maxThoughts: 8 });
  assert.ok(t.train.length >= 1, 'it thinks at least one thought');
  assert.equal(t.train[0].focus, 'Gregor', 'the train starts where the cursor was set');
  assert.ok(t.voiced.length > 0, 'the inner monologue has words');
  // the focus migrates — more than one figure is thought from (association along the graph)
  assert.ok(t.focusReached.length >= 2, 'attention moves to figures the utterances reached');
});

test('every thought is mine and cannot witness — the firewall (no rumination → fact)', () => {
  const t = think(DOC(), { cursor: 'Gregor', genders: { Gregor: 'm', Grete: 'f' } });
  assert.equal(everyThoughtIsMine(t.train), true, 'no thought can be witnessed as world');
  for (const th of t.train) {
    assert.equal(th.classified, READ_BACK, 'each thought is read-back-of-prior-self');
    assert.equal(th.canWitness, false, 'a thought never anchors — it only steers attention');
  }
});

test('it is self-terminating — quiesces when no fresh figure is reached, not by the backstop', () => {
  const t = think(DOC(), { cursor: 'Gregor', genders: { Gregor: 'm', Grete: 'f' }, maxThoughts: 64 });
  assert.equal(t.quiesced, true, 'the train stops on its own, before the hard bound');
  assert.ok(t.train.length < 64, 'it does not spin to the backstop');
  // no figure is thought from twice — attention only ever moves to fresh ground
  const lc = t.focusReached.map((f) => String(f).toLowerCase());
  assert.equal(new Set(lc).size, lc.length, 'each figure is a focus at most once');
});

test('thinking is grounded — every voiced proposition is one the graph holds', () => {
  const t = think(DOC(), { cursor: 'Gregor', genders: { Gregor: 'm', Grete: 'f' } });
  const said = t.train.flatMap((th) => th.propositions.map((p) => p.verb));
  // the relations thought are the doc's own verbs; nothing invented
  for (const v of said) assert.match(v, /saw|trusted|struck|loved/, `${v} is a relation the scene holds`);
});

test('a doc with no relations yields no thoughts — nothing to think about', () => {
  const t = think(parseText('Light.', { docId: 'e' }), {});
  assert.equal(t.train.length, 0, 'no scene, no inner speech');
  assert.equal(t.quiesced, true);
});
