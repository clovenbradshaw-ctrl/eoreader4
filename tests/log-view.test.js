import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/parse/index.js';
import { argspanDesc, serializeLog } from '../src/ui/log-view.js';

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

// The export is the FULL log — every event the reading sealed, one JSON object
// per line, in seq order — not the level-grouped subset the view renders.
test('serializeLog emits the full event log as JSONL in seq order', () => {
  const doc = parseText('Grete Vale greeted Gregor Pike. He smiled at her.', { docId: 'story.txt' });
  const events = doc.log.snapshot();
  const lines = serializeLog(doc).split('\n');

  assert.ok(events.length > 0, 'the reading produced events');
  assert.equal(lines.length, events.length, 'one line per event — the whole log, not a filtered view');

  lines.forEach((line, i) => {
    const e = JSON.parse(line);                     // every line is valid JSON
    assert.equal(e.seq, i, 'lines are in append (seq) order');
    assert.ok(e.op, 'each line is an operator event');
  });

  // Round-trips back to the sealed events verbatim — nothing dropped or reshaped.
  assert.deepEqual(lines.map(l => JSON.parse(l)), events.map(e => JSON.parse(JSON.stringify(e))));
});

// The levelled view is a lossy projection — it renders a human description and
// never the per-event seq/t the log seals onto every event. The export is the
// raw stream, so it carries that metadata in full, with seqs contiguous from 0
// (nothing dropped between the rendered rows).
test('serializeLog carries the raw seq/t metadata the level view omits', () => {
  const doc = parseText('Grete Vale greeted Gregor Pike. He smiled at her.', { docId: 'p' });
  const recs = serializeLog(doc).split('\n').map(l => JSON.parse(l));

  recs.forEach((e, i) => {
    assert.equal(e.seq, i, 'seqs are contiguous from 0 — the whole stream, in order');
    assert.equal(typeof e.t, 'number', 'each event keeps its sealed timestamp');
  });
});

test('serializeLog returns "" when there is no log to export', () => {
  assert.equal(serializeLog(null), '');
  assert.equal(serializeLog({}), '');
  assert.equal(serializeLog({ log: { events: [] } }), '');
});
