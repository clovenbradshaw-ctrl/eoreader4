import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/parse/index.js';
import { argspanDesc } from '../src/ui/log-view.js';

const argspan = (doc) => doc.log.filter(e => e.op === 'SEG' && e.kind === 'argspan')[0];

// The bug this guards: the Pattern slot printed the bond OPERATOR (Pattern⟨CON⟩),
// which read as if the cell had been named CON — beside "cells held", which says it
// has not. The Pattern position is the S-V-O relation; it points at a verbatim span
// of the original line (subject…object), the same kind of content Ground and Figure
// show, and never a synthesized glyph or an operator id.
test('argspanDesc points the Pattern at the verbatim relation span', () => {
  const doc = parseText('Grete Vale greeted Gregor Pike.', { docId: 'p' });
  const s = argspanDesc(argspan(doc));

  // The three positions all show their element; the cell is held at no-commit.
  assert.match(s, /Ground⟨“Grete Vale”, “Gregor Pike”⟩/, 'Ground shows the grounded existents');
  assert.match(s, /Figure⟨“greeted”⟩/, 'Figure shows the foregrounded act');
  assert.match(s, /Pattern⟨.*“Grete Vale greeted Gregor Pike”.*⟩/,
    'Pattern points at the verbatim subject…object span of the original line');
  assert.match(s, /cells held/, 'every cell is held at no-commit');

  // The span is a citation — clicking it jumps to the line it was read from.
  assert.match(s, /Pattern⟨<span class="log-cite" data-idx="\d+">/, 'the Pattern span points back to its line');

  // The operator never stands in the Pattern slot — it is not a committed cell.
  assert.doesNotMatch(s, /Pattern⟨CON⟩/, 'the bond operator is not printed as the Pattern cell');
  assert.doesNotMatch(s, /Pattern⟨—/, 'no synthesized arrow stands in for the span');
});

// A speech bond feeds SIG, not CON — the rule is the same: the Pattern points at the
// verbatim relation span, never the operator.
test('argspanDesc points the Pattern at the span for a SIG-feeding bond too', () => {
  const doc = parseText('Grete Vale told Gregor Pike.', { docId: 'p' });
  const s = argspanDesc(argspan(doc));
  assert.match(s, /Pattern⟨.*“Grete Vale told Gregor Pike”.*⟩/, 'the verbatim relation span');
  assert.doesNotMatch(s, /Pattern⟨SIG⟩/, 'the bond operator is not printed as the Pattern cell');
});
