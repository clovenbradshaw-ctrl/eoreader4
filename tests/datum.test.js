import { test } from 'node:test';
import assert from 'node:assert/strict';

import { valueShape, inlineDatum, scanData } from '../src/perceiver/parse/datum.js';
import { parseText } from '../src/perceiver/parse/index.js';
import { isDatumDef, makeDatumDef, DATUM_KIND } from '../src/core/index.js';

// A datum is a KEY bound to its VALUE — the proposition a measurement makes. The reader
// used to throw it away: the value was a bare number chrome.js held as NUL, the label said
// nothing without it, and the temperature fell out of the reading. These tests pin the
// convention (a unit-bearing value binds to its key) and the regime switch (a run of data
// relaxes the rules), and prove golden prose is untouched.

// ── the value surface ─────────────────────────────────────────────────────────
test('valueShape reads a measurement, strong when it carries a unit', () => {
  assert.deepEqual(valueShape('66°'), { value: '66°', strong: true });
  assert.deepEqual(valueShape('70%'), { value: '70%', strong: true });
  assert.deepEqual(valueShape('$1,299.00'), { value: '$1,299.00', strong: true });
  assert.deepEqual(valueShape('120 bpm'), { value: '120 bpm', strong: true });
  // A bare number is a value, but WEAK — too easily a page number or footnote.
  assert.deepEqual(valueShape('52'), { value: '52', strong: false });
  // Prose is not a value.
  assert.equal(valueShape('survival'), null);
  assert.equal(valueShape('Chapter 4 begins'), null);
});

// ── the inline datum ──────────────────────────────────────────────────────────
test('inlineDatum binds a key to a unit-bearing value, never a prose colon', () => {
  assert.deepEqual(inlineDatum('High 66°'), { key: 'High', value: '66°' });
  assert.deepEqual(inlineDatum('Feels Like 61°'), { key: 'Feels Like', value: '61°' });
  assert.deepEqual(inlineDatum('Chance of Rain: 70%'), { key: 'Chance of Rain', value: '70%' });
  // A mid-prose colon has no value on its right — never a datum (the metadata.js worry).
  assert.equal(inlineDatum('She had one goal: survival.'), null);
  assert.equal(inlineDatum('The time was 12:30'), null);
});

// ── the weather block: the bug, fixed ───────────────────────────────────────────
test('a stacked weather details block yields the temperatures as datums', () => {
  // The shape the web reader extracts (parse/datum.js binds the value to the key above it).
  const text = [
    "Today's Forecast for Seattle",
    'Feels Like',
    '61°',
    'High',
    '66°',
    'Low',
    '52°',
    'Chance of Rain',
    '70%',
  ].join('\n');
  const doc = parseText(text);
  const datums = doc.log.filter(isDatumDef);
  const byKey = Object.fromEntries(datums.map(d => [d.key, d.value]));
  assert.equal(byKey['Feels Like'], '61°');
  assert.equal(byKey['High'], '66°');
  assert.equal(byKey['Low'], '52°');
  assert.equal(byKey['Chance of Rain'], '70%');
});

test('inline weather data binds on one line each', () => {
  const text = ['Seattle right now', 'Temperature 59°', 'Humidity: 81%', 'Wind 8 mph'].join('\n');
  const doc = parseText(text);
  const byKey = Object.fromEntries(doc.log.filter(isDatumDef).map(d => [d.key, d.value]));
  assert.equal(byKey['Temperature'], '59°');
  assert.equal(byKey['Humidity'], '81%');
  assert.equal(byKey['Wind'], '8 mph');
});

// ── the regime switch: a run relaxes the rules ──────────────────────────────────
test('a bare number binds inside a confirmed data run, not in open prose', () => {
  // In a run alongside strong (unit-bearing) data, a bare-number value is admitted.
  const run = scanData(['High', '66°', 'Pressure', '1013', 'Humidity', '81%']);
  const bound = [...run.values()].filter(v => v.role === 'value').map(v => v.value);
  assert.ok(bound.includes('1013'), 'bare 1013 binds inside the data run');
  // The same key→number adjacency in open prose does NOT bind (no run to license it).
  const prose = scanData(['He counted the steps', '1013', 'and then stopped']);
  assert.equal([...prose.values()].some(v => v.value === '1013'), false);
});

// ── golden parity: prose is untouched ───────────────────────────────────────────
test('plain prose admits no datums', () => {
  const text = 'Gregor woke from troubled dreams. He had been transformed in his bed. '
    + 'His sister Grete brought him milk. The room was cold and grey.';
  const doc = parseText(text);
  assert.equal(doc.log.filter(isDatumDef).length, 0);
});

// ── the core contract ───────────────────────────────────────────────────────────
test('makeDatumDef / isDatumDef are the universal datum shape', () => {
  const d = makeDatumDef({ id: 'unit:3', key: 'High', value: '66°', sentIdx: 3 });
  assert.equal(d.op, 'DEF');
  assert.equal(d.kind, DATUM_KIND);
  assert.equal(d.defeasible, true);
  assert.ok(isDatumDef(d));
  assert.equal(isDatumDef({ op: 'DEF', id: 'x', key: 'role', value: 'site' }), false);
});
