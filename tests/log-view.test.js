import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/parse/index.js';
import { argspanDesc } from '../src/ui/log-view.js';

const argspan = (doc) => doc.log.filter(e => e.op === 'SEG' && e.kind === 'argspan')[0];

// The information-structure mapping (§4C): the subject is the given (Ground), the
// object is the new picked-out element (Figure), the verb is the relation (Pattern).
// Each position points at one verbatim span of the line, clickable back to it — never
// a bond operator, and the object is no longer lumped into Ground with the subject.
test('argspanDesc maps subject→Ground, object→Figure, verb→Pattern as verbatim spans', () => {
  const doc = parseText('Grete Vale greeted Gregor Pike.', { docId: 'p' });
  const s = argspanDesc(argspan(doc));

  assert.match(s, /Ground⟨.*“Grete Vale”.*⟩/, 'the subject is the given (Ground)');
  assert.match(s, /Figure⟨.*“Gregor Pike”.*⟩/, 'the object is the new (Figure)');
  assert.match(s, /Pattern⟨.*“greeted”.*⟩/, 'the verb is the relation (Pattern)');
  assert.match(s, /cells held/, 'the operator-grain cells are held at no-commit');

  // Each position is a citation back to its line.
  assert.match(s, /Ground⟨<span class="log-cite" data-idx="\d+">/, 'Ground points back to its line');
  assert.match(s, /Figure⟨<span class="log-cite" data-idx="\d+">/, 'Figure points back to its line');
  assert.match(s, /Pattern⟨<span class="log-cite" data-idx="\d+">/, 'Pattern points back to its line');

  // The operator never stands in a slot, and the object has left Ground.
  assert.doesNotMatch(s, /Pattern⟨CON⟩/, 'the bond operator is not printed as the Pattern cell');
  assert.doesNotMatch(s, /Ground⟨[^⟩]*Gregor Pike/, 'the object is the Figure now, not part of Ground');
});

// A speech bond feeds SIG, but the role mapping is the same: object→Figure,
// verb→Pattern. (At the grain layer the verb of a SIG is a Figure-band operator —
// that is the documented seam; the role positions still read given/new/relation.)
test('argspanDesc maps a SIG-feeding bond the same way', () => {
  const doc = parseText('Grete Vale told Gregor Pike.', { docId: 'p' });
  const s = argspanDesc(argspan(doc));
  assert.match(s, /Figure⟨.*“Gregor Pike”.*⟩/, 'the object is the Figure');
  assert.match(s, /Pattern⟨.*“told”.*⟩/, 'the verb is the Pattern');
  assert.doesNotMatch(s, /Pattern⟨SIG⟩/, 'the operator is not printed as the Pattern cell');
});
