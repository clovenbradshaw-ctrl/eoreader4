import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLog, projectGraph } from '../src/core/index.js';

// The proposition asterisk (docs/proposition-equivalence.md "a same_as? proposition void"):
// a held proposition equivalence — two assertions that might be one, identity unestablished —
// is projected as a first-class void, exactly as the entity same_as? asterisk is.

test('a held proposition equivalence becomes a first-class void + asterisk, anchored to both', () => {
  const log = createLog({ docId: 't' });
  // two propositions, plus the perceiver's held verdict (the cosine did not clear the null,
  // or the embedder is dark): NUL kind:'held-equivalence' over their two ids.
  log.append({ op: 'INS', id: 'p0', label: 'Ralph owns a boat', sentIdx: 0 });
  log.append({ op: 'INS', id: 'p1', label: 'Ralph is the owner of a boat', sentIdx: 1 });
  log.append({ op: 'NUL', kind: 'held-equivalence', src: 'p0', tgt: 'p1', sim: 0.41, sentIdx: 1 });

  const g = projectGraph(log);

  assert.equal(g.propositionAsterisks.length, 1, 'one held proposition equivalence surfaced');
  const a = g.propositionAsterisks[0];
  assert.equal(a.a, 'p0');
  assert.equal(a.b, 'p1');
  assert.equal(a.kind, 'same-proposition?');

  // and it stands a void anchored to BOTH ids, so a query from either side finds it
  const pv = g.voids.filter(v => v.kind === 'same-proposition?');
  assert.equal(pv.length, 2, 'a void from each side');
  assert.deepEqual(pv.map(v => v.node).sort(), ['p0', 'p1']);
  assert.equal(pv[0].rel, 'proposition');
  assert.equal(pv.find(v => v.node === 'p0').counter, 'p1', 'each void points at its counterpart');
});

test('golden parity: with no held-equivalence events the projection is unchanged', () => {
  const log = createLog({ docId: 't' });
  log.append({ op: 'INS', id: 'a', label: 'Alice', sentIdx: 0 });
  log.append({ op: 'INS', id: 'b', label: 'Bob', sentIdx: 0 });
  log.append({ op: 'CON', src: 'a', tgt: 'b', via: 'knows', sentIdx: 0 });

  const g = projectGraph(log);
  assert.equal(g.propositionAsterisks.length, 0, 'no proposition asterisks');
  assert.equal(g.voids.filter(v => v.kind === 'same-proposition?').length, 0, 'no proposition voids');
  // the new collection is present but empty — additive, never disturbing the existing fold
  assert.deepEqual(g.voids, [], 'voids untouched');
  assert.equal(g.edges.length, 1);
});
