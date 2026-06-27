import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  admitWebSource, createWebStore, webRecord, webContentHash,
  toWebCitation, verifyCitation, engineDocId, recordIdForDoc, recordIdOf,
} from '../src/ingest/websource.js';
import { parseText } from '../src/perceiver/parse/index.js';
import { createCompositeDoc } from '../src/organs/in/index.js';
import { retrieveLexical } from '../src/retrieve/index.js';

// Web pages as first-class groundable sources (docs/web-search.md). The admission core is
// offline and pure: a fetched payload becomes a provenance-tagged prose doc that drops into the
// answer scope, enters retrieval ranking, and whose cited spans trace back to the web source —
// the same gates an uploaded file travels. Search/fetch (the proxy) sit on top of this.

const PAGE = {
  url: 'https://example.org/grete',
  title: 'The Samsa household',
  text: 'Gregor Samsa had a younger sister named Grete. Grete played the violin beautifully.',
  fetched_at: '2026-06-27T00:00:00Z',
  retrieval_query: "what is Gregor's sister's name",
  engine: 'searxng',
};

// ── Admission: a fetched page becomes a provenance-tagged prose doc ───────────

test('admitWebSource yields a normal prose doc with web identity as additive metadata', () => {
  const { doc, record } = admitWebSource(PAGE);
  assert.ok((doc.units || doc.sentences).length >= 2, 'the page parsed into sentences');
  assert.equal(doc.sourceKind, 'web-source');
  assert.equal(doc.web.url, PAGE.url);
  assert.equal(doc.web.content_hash, record.content_hash);
  assert.equal(record.schema, 'web-source/1');
  assert.equal(record.status, 'active');
  // the record id is colon-namespaced; the engine doc id is the colon-free bridge
  assert.match(record.id, /^web:[0-9a-f]{16}$/);
  assert.equal(doc.docId, engineDocId(record.id));
  assert.match(doc.docId, /^web-[0-9a-f]{16}$/);
  assert.equal(recordIdForDoc(doc.docId), record.id, 'the bridge round-trips');
});

test('the content hash is stable on the text and moves when the page changes', () => {
  assert.equal(webContentHash(PAGE.text), webContentHash(PAGE.text));
  assert.notEqual(webContentHash(PAGE.text), webContentHash(PAGE.text + ' She also read.'));
  assert.equal(recordIdOf(webContentHash(PAGE.text)), webRecord(PAGE).id);
});

// ── Scope parity: the web source enters retrieval, cited spans trace to it ────

test('a web source dropped into the answer scope enters retrieval and traces back through origin()', () => {
  const loaded = parseText('This is the loaded document. It is about something else entirely.', { docId: 'loaded' });
  const { doc: webDoc, record } = admitWebSource(PAGE);
  const composite = createCompositeDoc([loaded, webDoc]);

  // retrieval (embedder-free lexical) over the composite surfaces the web sentence about Grete
  const hits = retrieveLexical(composite, 'who is the sister named Grete', 6);
  assert.ok(hits.length, 'retrieval returned spans from the composite scope');
  const webHit = hits.find((h) => composite.origin(h.idx)?.docId === webDoc.docId);
  assert.ok(webHit, 'a retrieved span came from the web source');
  // and a span that came from the web source maps back to the web RECORD — citation provenance
  assert.equal(recordIdForDoc(composite.origin(webHit.idx).docId), record.id);
  assert.match(webHit.text, /Grete/, 'the surfaced web span carries the answer');
});

// ── Freeze / supersede / retract — the source SEG/retract law ─────────────────

test('the store freezes, supersedes on change, and retracts — never overwriting', () => {
  const store = createWebStore();

  const a = store.admit(PAGE);
  assert.ok(a.fresh && a.record.status === 'active');

  // same url, same text → the existing source, no new record
  const again = store.admit(PAGE);
  assert.equal(again.fresh, false);
  assert.equal(again.record.id, a.record.id);

  // same url, CHANGED text → a new record; the old is retained as superseded, not erased
  const changed = store.admit({ ...PAGE, text: PAGE.text + ' Later, Grete grew up.' });
  assert.ok(changed.fresh);
  assert.notEqual(changed.record.id, a.record.id);
  assert.equal(changed.superseded, a.record.id);
  assert.equal(store.get(a.record.id).record.status, 'superseded');
  assert.equal(store.active().length, 1, 'only the live source is active');

  // retract flips status; it stays in the store, legible
  assert.equal(store.retract(changed.record.id), changed.record.id);
  assert.equal(store.get(changed.record.id).record.status, 'retracted');
  assert.equal(store.active().length, 0);
});

// ── Provenance integrity: a citation is honoured only against a live, matching source ──

test('verifyCitation requires an active record whose hash still matches', () => {
  const { record } = admitWebSource(PAGE);
  const cite = toWebCitation(record, 's0', [0, 11]);
  assert.equal(cite.type, 'web-source');
  assert.equal(cite.source_id, record.id);
  assert.ok(verifyCitation(record, cite), 'active + matching hash → honoured');
  assert.ok(!verifyCitation({ ...record, status: 'retracted' }, cite), 'retracted → fails closed');
  assert.ok(!verifyCitation(record, { ...cite, content_hash: 'fnv:deadbeefdeadbeef' }), 'hash drift → fails closed');
});
