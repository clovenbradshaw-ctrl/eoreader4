import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/parse/pipeline.js';
import { retrieveLexical } from '../src/retrieve/lexical.js';
import { retrieveHybrid } from '../src/retrieve/hybrid.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';

const withEmbeddings = (doc) => {
  let p = null;
  doc.sentenceEmbeddings = async (e) => {
    if (p) return p;
    p = Promise.all(doc.sentences.map(s => e.embed(s)));
    return p;
  };
  return doc;
};

test('retrieveLexical ranks by token overlap', () => {
  const doc = parseText(
    'Alice loves apples. Bob hates broccoli. Charlie eats cake.',
    { docId: 'd1' }
  );
  const r = retrieveLexical(doc, 'apples', 5);
  assert.equal(r[0].idx, 0);
});

test('retrieveLexical returns empty on no overlap', () => {
  const doc = parseText('Alice loves apples.', { docId: 'd1' });
  const r = retrieveLexical(doc, 'zebras', 5);
  assert.equal(r.length, 0);
});

test('retrieveHybrid merges lexical and semantic, max-pooling score', async () => {
  const doc = withEmbeddings(parseText(
    'Alice loves apples. Bob hates broccoli.', { docId: 'd1' }
  ));
  const embedder = createHashEmbedder();
  const r = await retrieveHybrid(doc, 'apples', embedder, 5);
  assert.ok(r.length > 0);
  // sentence 0 should be top-ranked (it contains 'apples')
  assert.equal(r[0].idx, 0);
});

test('retrieveLexical respects k', () => {
  const doc = parseText(
    'Alice ran. Bob ran. Charlie ran. Dana ran. Eve ran.',
    { docId: 'd1' }
  );
  const r = retrieveLexical(doc, 'ran', 3);
  assert.equal(r.length, 3);
});
