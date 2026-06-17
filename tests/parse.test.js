import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/parse/pipeline.js';
import { isChrome } from '../src/parse/chrome.js';
import { createEntityAdmission } from '../src/parse/entities.js';
import { segmentSentences } from '../src/parse/sentences.js';
import { tok } from '../src/parse/tokenize.js';

test('chrome gate catches page numbers and separators', () => {
  assert.ok(isChrome('Page 12'));
  assert.ok(isChrome('---'));
  assert.ok(isChrome('42'));
  assert.ok(!isChrome('Alice met Bob at the cafe.'));
});

test('segmentSentences splits on ?.!', () => {
  const out = segmentSentences('Hello world. Is it ok? Yes!');
  assert.equal(out.length, 3);
});

test('two-sighting admission: candidate then admit', () => {
  const a = createEntityAdmission();
  const r1 = a.observe('Alice walked.');
  assert.equal(r1[0].status, 'candidate');
  const r2 = a.observe('Then Alice ran.');
  const aliceObs = r2.find(o => o.label === 'Alice');
  assert.equal(aliceObs.status, 'admit');
});

test('parseText emits INS only after a second sighting', () => {
  const doc = parseText('Alice walked. Then Alice ran.', { docId: 'd1' });
  const inss = doc.log.filter(e => e.op === 'INS' && e.id === 'alice');
  assert.equal(inss.length, 1);
  assert.equal(inss[0].label, 'Alice');
});

test('parseText emits DEF for copular sentences on admitted entities', () => {
  const doc = parseText('Alice is a baker. Alice is a baker.', { docId: 'd1' });
  const defs = doc.log.filter(e => e.op === 'DEF');
  assert.ok(defs.length >= 1);
  assert.equal(defs[0].id, 'alice');
  assert.equal(defs[0].key, 'predicate');
});

test('tok drops stopwords and short tokens', () => {
  assert.deepEqual(tok('The quick brown fox.'), ['quick', 'brown', 'fox']);
});

test('parseText keeps text and sentences alongside the log', () => {
  const doc = parseText('One. Two. Three.', { docId: 'x' });
  assert.equal(doc.sentences.length, 3);
  assert.equal(doc.text, 'One. Two. Three.');
  assert.equal(doc.docId, 'x');
});
