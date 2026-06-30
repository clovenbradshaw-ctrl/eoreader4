import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ingestText } from '../src/organs/in/index.js';
import { readingAt } from '../src/perceiver/index.js';
import { buildBeats, propRow, heldRow } from '../src/ui/replay-view.js';

// The replay view's pure, DOM-free surface — the part CI covers without a browser
// (the same convention as predict-view's defaultCursor / feed-view's feedHolons).
// The mount/play/pause timer wiring is verified against jsdom out of band; the
// per-cursor reading itself is covered in the perceiver/reading tests.

const text = readFileSync(new URL('../data/esker.txt', import.meta.url), 'utf8');
const doc = await ingestText(text, {});
const beats = buildBeats(doc);

test('buildBeats covers every line and never skips one silently', () => {
  const units = doc.units || doc.sentences;
  // Each line contributes exactly one 'line' beat, in order, with no gaps.
  const lineBeats = beats.filter(b => b.type === 'line');
  assert.equal(lineBeats.length, units.length, 'one line beat per unit');
  lineBeats.forEach((b, i) => assert.equal(b.c, i, 'line beats are in document order'));
  // Every line is followed by at least one proposition beat (a fired operator, or a
  // 'held' non-event) before the next line — the replay never advances a line blank.
  for (let i = 0; i < beats.length; i++) {
    if (beats[i].type !== 'line') continue;
    const next = beats[i + 1];
    assert.ok(next && next.c === beats[i].c && next.type !== 'line',
      `line ${beats[i].c} reveals at least one proposition`);
  }
});

test('a proposition beat mirrors a surprise the reading named', () => {
  // Find a line that actually yielded fired operators, and check its prop beats match.
  const units = doc.units || doc.sentences;
  let checked = 0;
  for (let c = 0; c < units.length && checked < 3; c++) {
    const r = readingAt(doc, c);
    if (!r.surprises.length) continue;
    const props = beats.filter(b => b.c === c && b.type === 'prop');
    assert.equal(props.length, r.surprises.length, `line ${c} has one prop beat per surprise`);
    assert.equal(props[0].op, r.surprises[0].op, 'the operator carries through');
    assert.equal(props[0].text, r.surprises[0].text, 'the clause carries through');
    checked++;
  }
  assert.ok(checked > 0, 'the document has at least one line with named propositions');
});

test('readingByLine is causal — it never carries a line past the cursor', () => {
  for (const b of beats) {
    const keys = Object.keys(b.readingByLine).map(Number);
    assert.ok(Math.max(...keys) <= b.c, `beat at line ${b.c} sees no future line`);
    assert.ok(b.readingByLine[b.c], 'the current line is included');
  }
});

test('propRow renders the operator chip and marks the fresh beat', () => {
  const beat = { op: 'CON', text: 'Gregor with sister' };
  const fresh = propRow(beat, true);
  assert.match(fresh, /<span class="op CON">CON<\/span>/, 'the operator chip is rendered');
  assert.match(fresh, /Gregor with sister/, 'the clause is shown');
  assert.match(fresh, /rp-fresh/, 'the current beat is marked fresh');
  assert.doesNotMatch(propRow(beat, false), /rp-fresh/, 'an older beat is not marked fresh');
});

test('heldRow renders a NUL non-transformation for a steady line', () => {
  const row = heldRow({ reading: { held: true, predicted: { figures: ['Gregor', 'sister'] } } }, true);
  assert.match(row, /<span class="op NUL">NUL<\/span>/, 'a held line is a NUL');
  assert.match(row, /stay in focus/, 'it names what held');
});

test('propRow escapes HTML in the clause', () => {
  const row = propRow({ op: 'DEF', text: '<script>alert(1)</script>' });
  assert.doesNotMatch(row, /<script>/, 'angle brackets are escaped');
  assert.match(row, /&lt;script&gt;/, 'escaped form is present');
});
