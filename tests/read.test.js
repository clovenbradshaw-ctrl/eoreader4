import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/parse/index.js';
import { createCorefField } from '../src/parse/coref.js';
import { readingAt, structureSurface, consciousness } from '../src/read/index.js';
import { foldNote } from '../src/fold/index.js';

test('coref field is a normalised distribution, strongest first', () => {
  const f = createCorefField();
  f.note('a', 0); f.note('a', 1); f.note('b', 1);
  const fld = f.field(2);
  assert.equal(fld[0].id, 'a');                       // more mass → ranked first
  const sum = fld.reduce((s, c) => s + c.w, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, 'weights sum to 1');
});

const STORY = 'Grete Vale entered. Grete sat. Grete read. Gregor Pike arrived. Gregor coughed. Gregor waited.';

test('significance: the opening cannot be surprising (no prior)', () => {
  const doc = parseText(STORY, { docId: 'r' });
  assert.equal(readingAt(doc, 0).surprise, 0);
});

test('significance: a new figure raises surprisal, tagged INS', () => {
  const doc = parseText(STORY, { docId: 'r' });
  const r = readingAt(doc, 3); // "Gregor Pike arrived"
  assert.ok(r.surprise > 0, 'an unexpected figure is surprising');
  assert.ok(r.surprisalBits > 0);
  assert.ok(r.surprises.some(s => s.op === 'INS'));
  assert.ok(r.predicted.figures.includes('Grete Vale'), 'predicted from prior mass');
});

test('structure surface reports the figures a window turns on', () => {
  const doc = parseText(STORY, { docId: 'r' });
  const s = structureSurface(doc, [3, 4, 5]);
  assert.ok(s.figures.some(f => f.id === 'gregor-pike'));
});

test('the consciousness folds three levels into a cited reading', () => {
  const doc = parseText('Alice met Bob. Alice met Bob. Alice trusted Bob.', { docId: 'c' });
  const spans = [0, 1, 2].map(idx => ({ idx, text: doc.sentences[idx], score: 1 }));
  const c = consciousness(doc, spans, 1);
  assert.ok(c.text.length > 0);
  assert.match(c.text, /Alice/);
  assert.match(c.text, /\[s\d\]/, 'citations preserved for binding');
  assert.deepEqual(c.sources, [0, 1, 2]);
  assert.ok(c.levels.existence && c.levels.structure && c.levels.significance);
});

test('foldNote without a doc condenses the spans (a fold, not a copy)', () => {
  const spans = [{ idx: 0, text: 'A short line.' }, { idx: 1, text: 'Another.' }];
  const note = foldNote(spans);
  assert.match(note.text, /\[s0\]/);
  assert.deepEqual(note.sources, [0, 1]);
});
