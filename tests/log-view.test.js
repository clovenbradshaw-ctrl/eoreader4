import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/parse/index.js';
import { argspanDesc } from '../src/ui/log-view.js';

const argspan = (doc) => doc.log.filter(e => e.op === 'SEG' && e.kind === 'argspan')[0];

// The bug this guards: the Pattern slot printed the bond OPERATOR (Pattern⟨CON⟩),
// which read as if the cell had been named CON — beside "cells held", which says it
// has not. The Pattern position is the S-V-O relation; it serialises as the relation
// (the directed arrow —verb→), the same kind of content Ground and Figure show.
test('argspanDesc serialises Pattern as the relation, not the bond operator', () => {
  const doc = parseText('Grete Vale greeted Gregor Pike.', { docId: 'p' });
  const s = argspanDesc(argspan(doc));

  // The three positions all show their element; the cell is held at no-commit.
  assert.match(s, /Ground⟨“Grete Vale”, “Gregor Pike”⟩/, 'Ground shows the grounded existents');
  assert.match(s, /Figure⟨“greeted”⟩/, 'Figure shows the foregrounded act');
  assert.match(s, /Pattern⟨—greeted→⟩/, 'Pattern shows the relation as the directed arrow');
  assert.match(s, /cells held/, 'every cell is held at no-commit');

  // The operator never appears inside the Pattern bracket — it is not a committed cell.
  assert.doesNotMatch(s, /Pattern⟨CON⟩/, 'the bond operator is not printed as the Pattern cell');
  assert.doesNotMatch(s, /Pattern⟨[A-Z]{3}⟩/, 'no bare operator id stands in the Pattern slot');
});

// A speech bond feeds SIG, not CON — and the same rule holds: the operator does not
// stand in the Pattern slot; the relation (—told→) does.
test('argspanDesc shows the relation for a SIG-feeding bond too', () => {
  const doc = parseText('Grete Vale told Gregor Pike.', { docId: 'p' });
  const s = argspanDesc(argspan(doc));
  assert.match(s, /Pattern⟨—told→⟩/, 'the relation arrow, not the operator');
  assert.doesNotMatch(s, /Pattern⟨SIG⟩/, 'the bond operator is not printed as the Pattern cell');
});
