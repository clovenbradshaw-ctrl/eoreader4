import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/parse/index.js';
import { createCorefField } from '../src/parse/coref.js';
import { readingAt, structureSurface, consciousness, siteRoles, predictNext, tokenField, carveBonds } from '../src/read/index.js';
import { foldNote } from '../src/fold/index.js';
import { projectGraph } from '../src/core/index.js';

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

test('every token is available for the graph — entities are the persistent subset', () => {
  const doc = parseText('Topps slammed the man. Topps kicked the truck. Topps left.', { docId: 't' });
  const byTok = new Map(tokenField(doc).map(n => [n.token, n]));
  assert.ok(byTok.has('man'));                  // a common-noun object is an available node
  assert.ok(byTok.has('truck'));
  assert.ok(byTok.get('topps').persistent);     // the minted referent is flagged persistent
  assert.ok(!byTok.get('man').persistent);      // a one-off token is available, not persistent
});

test('carveBonds: the model carves bonds onto entities and token nodes', async () => {
  const doc = parseText('The trooper Topps slammed the man. Topps drove the truck.', { docId: 'c' });
  const model = { phrase: async (msgs) => {
    const u = msgs[1].content;
    if (u.includes('slammed')) return 'Topps | slammed | the man';
    if (u.includes('drove'))   return 'Topps | drove | the truck';
    return 'NONE';
  } };
  const { carved } = await carveBonds(doc, model);
  assert.ok(carved >= 1, 'the model carved at least one bond');
  const carvedEvents = doc.log.filter(e => e.kind === 'carved');
  assert.ok(carvedEvents.some(e => e.src === 'topps' && e.tgt === 't:man'),
    'a bond landed on a token node, not just an entity');
  const g = projectGraph(doc.log);
  assert.ok([...g.entities.keys()].includes('t:man'), 'the token node is materialized in the graph');
});

test('site role is semantic: off-distribution + figure-less reads as a site', () => {
  // Three on-body units pointing one way, one boilerplate unit pointing another.
  const vecs = [[1, 0], [0.96, 0.28], [0.99, 0.1], [0, 1]];
  const anchored = new Set([0, 1, 2]);          // the boilerplate anchors no figure
  const roles = siteRoles(['a', 'b', 'c', 'LICENSE'], vecs, anchored, 0.5);
  assert.equal(roles[3].role, 'site');
  assert.equal(roles[0].role, 'figure');
});

test('predictive surprise = embedding distance from the model\'s predicted next line', async () => {
  const doc = { sentences: ['The cat sat.', 'It purred softly.'] };
  // A model that predicts the actual next line → near-zero surprise.
  const model = { phrase: async () => 'It purred softly.' };
  const embedder = { embed: async (t) => t === 'It purred softly.' ? new Float32Array([1, 0]) : new Float32Array([0, 1]) };
  const hit = await predictNext(doc, 0, { model, embedder });
  assert.ok(hit.surprise < 0.01, `confirmed prediction is unsurprising, got ${hit.surprise}`);

  const wrong = { phrase: async () => 'A spaceship landed.' };
  const miss = await predictNext(doc, 0, { model: wrong, embedder });
  assert.ok(miss.surprise > 0.9, `a defied prediction is surprising, got ${miss.surprise}`);
});
