import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/parse/pipeline.js';
import { isChrome } from '../src/parse/chrome.js';
import { createEntityAdmission } from '../src/parse/entities.js';
import { segmentSentences } from '../src/parse/sentences.js';
import { tok } from '../src/parse/tokenize.js';
import { projectGraph } from '../src/core/project.js';

test('chrome gate holds only degenerate structure — roles are semantic', () => {
  assert.ok(isChrome('42'));            // a bare number
  assert.ok(isChrome('III'));           // a bare roman numeral
  assert.ok(isChrome('---'));           // a separator rule
  assert.ok(!isChrome('Page 12'));      // a heading is a semantic site role, not a list match
  assert.ok(!isChrome('Alice met Bob at the cafe.'));
  assert.ok(isChrome('Page 12', true)); // ...but a mini-LLM nudge can still hold it
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

test('multi-word proper names admit on first sighting', () => {
  const doc = parseText('Project Gutenberg is great.', { docId: 'm' });
  assert.ok(doc.admission.isAdmitted('Project Gutenberg'));
});

test('name-containment is a SYN synthesis: "Gregor" folds into "Gregor Samsa"', () => {
  const doc = parseText('Gregor Samsa woke. Gregor dressed. Gregor ate.', { docId: 's' });
  const g = projectGraph(doc.log);
  assert.equal(g.entities.size, 1, 'one referent, not two');
  assert.ok(doc.log.filter(e => e.op === 'SYN' && e.kind === 'alias').length >= 1);
});

test('a lowercase connector never trails a name ("Grete the news" → "Grete")', () => {
  const doc = parseText('He told Grete the news. Grete waited. Grete left.', { docId: 'c' });
  assert.ok(doc.admission.isAdmitted('Grete'));
  assert.ok(!doc.admission.isAdmitted('Grete the'));
});

test('coreference is a weighted field: a pronoun subject bonds with a coupling weight', () => {
  const doc = parseText(
    'Grete Vale entered. Gregor Pike arrived. Gregor stood. Gregor paused. He greeted Grete Vale.',
    { docId: 'r' });
  const con = doc.log.filter(e => e.op === 'CON' && e.via === 'greeted')[0];
  assert.ok(con, 'pronoun subject produced a bond');
  assert.equal(con.src, 'gregor-pike');           // "He" resolved by the field
  assert.ok(con.w > 0 && con.w < 1, `coupling is a weight, got ${con.w}`);
});

test('kinship apposition resolves a pronoun owner through the field ("His sister Grete")', () => {
  // kinshipEdges calls coref.resolve for a possessive owner pronoun; the
  // pipeline now provides it (the strongest prior candidate). Gregor is hottest
  // before the last line, so "His" resolves to him and the kin bond fires.
  // Before the fix `resolve` was missing and this bond dropped silently.
  const doc = parseText(
    'Grete arrived. Grete waited. Gregor Samsa woke. Gregor stood. His sister Grete left.',
    { docId: 'k' });
  const con = doc.log.filter(e => e.op === 'CON' && e.via === 'sister')[0];
  assert.ok(con, 'pronoun-owned kinship apposition produced a bond');
  assert.equal(con.src, 'gregor-samsa');
  assert.equal(con.tgt, 'grete');
});

test('speech verbs emit SIG, other transitive verbs emit CON', () => {
  const doc = parseText('Alice told Bob. Alice told Bob. Alice told Bob now.', { docId: 'g' });
  assert.ok(doc.log.filter(e => e.op === 'SIG' && e.via === 'told').length >= 1);
});

test('Pass 0 induces the document\'s attribution verbs as REC entries', () => {
  const doc = parseText('"Run!" shouted Alice. Alice waited. "Why?" pinged Bob.', { docId: 'p' });
  const recs = doc.log.filter(e => e.op === 'REC' && e.kind === 'attribution-verb');
  const tokens = recs.map(r => r.token);
  assert.ok(tokens.includes('shouted'));
  assert.ok(tokens.includes('pinged'), 'a document-specific verb is learned, not whitelisted');
});

test('parseText exposes a modality-neutral units list', () => {
  const doc = parseText('One. Two.', { docId: 'u' });
  assert.equal(doc.modality, 'text');
  assert.deepEqual(doc.units, doc.sentences);
});
