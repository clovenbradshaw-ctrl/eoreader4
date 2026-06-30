import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildActivityBundle, serializeActivity, isWebDoc, webDocPointer, webSourcePointer,
} from '../src/ui/activity-export.js';

// The single-file "all activity" export. The builder is pure (data → object) and
// the serialiser is pure (object → string), so the bundle's shape is pinned here
// without the DOM or a download. exportActivity (which gathers from live STATE and
// touches the page) is left to the browser; these guard the fold and its resilience.

test('bundle folds the three streams and stamps a counts header', () => {
  const b = buildActivityBundle({
    exportedAt: '2026-06-30',
    transcript: [
      { role: 'user', content: 'Who wrote it?' },
      { role: 'assistant', content: 'Kafka [s2].' },
    ],
    audit: [{ id: 't1', question: 'Who wrote it?', answer: 'Kafka [s2].' }],
    documents: [
      { docId: 'metamorphosis.txt', events: [{ seq: 0, op: 'INS' }, { seq: 1, op: 'CON' }] },
      { docId: 'empty.txt', events: [] },
    ],
  });

  assert.equal(b.kind, 'eoreader4-activity');
  assert.equal(b.version, 2);
  assert.equal(b.exportedAt, '2026-06-30');
  // counts is the header — the shape readable without walking the file.
  assert.deepEqual(b.counts, { messages: 2, turns: 1, documents: 2, events: 2, webSources: 0 });
  // The streams are carried verbatim.
  assert.equal(b.transcript[1].content, 'Kafka [s2].');
  assert.equal(b.audit[0].id, 't1');
  assert.equal(b.documents[0].events.length, 2);
});

test('an empty session still yields a valid, zeroed bundle', () => {
  const b = buildActivityBundle({});
  assert.deepEqual(b.counts, { messages: 0, turns: 0, documents: 0, events: 0, webSources: 0 });
  assert.deepEqual(b.transcript, []);
  assert.deepEqual(b.audit, []);
  assert.deepEqual(b.documents, []);
  assert.deepEqual(b.webSources, []);
});

// ── Web imports are referenced by pointer, never embedded ────────────────────

test('isWebDoc recognises a web-source document by either stamp', () => {
  assert.equal(isWebDoc({ sourceKind: 'web-source' }), true);
  assert.equal(isWebDoc({ web: { url: 'https://example.com' } }), true);
  assert.equal(isWebDoc({ docId: 'local.txt', log: { events: [] } }), false);
  assert.equal(isWebDoc(null), false);
});

test('webDocPointer carries the url + hash, not the reading log', () => {
  const doc = {
    sourceKind: 'web-source',
    web: { url: 'https://en.wikipedia.org/wiki/Kafka', title: 'Kafka', content_hash: 'fnv:abc',
           fetched_at: '2026-06-30T00:00:00Z', final_url: null, published: '1915', engine: 'web:wikipedia' },
    log: { events: [{ op: 'NUL', text: 'a very long page of text' }, { op: 'INS' }] },
  };
  const p = webDocPointer('web-abc', doc);
  assert.equal(p.kind, 'web-pointer');
  assert.equal(p.pointer.url, 'https://en.wikipedia.org/wiki/Kafka');
  assert.equal(p.pointer.content_hash, 'fnv:abc');
  assert.equal(p.events_omitted, 2);            // the reading log is referenced, not embedded
  assert.equal('events' in p, false);           // …and the full text never appears
  assert.equal(JSON.stringify(p).includes('a very long page of text'), false);
});

test('webSourcePointer names the OPFS location of the cached bytes', () => {
  const p = webSourcePointer({
    key: 'fnv:abc', content_hash: 'fnv:abc', url: 'https://example.com', title: 'Ex',
    fetched_at: '2026-06-30T00:00:00Z', bytes: 12345, dir: 'eoreader-web', file: 'fnv_abc.bin', persisted: true,
  });
  assert.equal(p.opfs, 'eoreader-web/fnv_abc.bin');
  assert.equal(p.content_hash, 'fnv:abc');
  assert.equal(p.url, 'https://example.com');
  assert.equal(p.bytes, 12345);
});

test('a web-source document collapses to a pointer in the documents stream', () => {
  const b = buildActivityBundle({
    documents: [webDocPointer('web-abc', { sourceKind: 'web-source', web: { url: 'https://x.test' }, log: { events: [{ op: 'NUL', text: 'secret full text' }] } })],
    webSources: [webSourcePointer({ content_hash: 'fnv:abc', url: 'https://x.test', bytes: 9, dir: 'eoreader-web', file: 'fnv_abc.bin' })],
  });
  assert.equal(b.counts.documents, 1);
  assert.equal(b.counts.webSources, 1);
  assert.equal(serializeActivity(b).includes('secret full text'), false);
});

test('serializeActivity round-trips to the same object', () => {
  const b = buildActivityBundle({
    exportedAt: '2026-06-30',
    transcript: [{ role: 'user', content: 'hi' }],
    audit: [{ id: 't1' }],
    documents: [{ docId: 'd', events: [{ seq: 0, op: 'NUL' }] }],
  });
  const text = serializeActivity(b);
  assert.match(text, /"kind": "eoreader4-activity"/);
  assert.deepEqual(JSON.parse(text), b);
});

test('serializeActivity survives a circular reference without throwing', () => {
  const cyclic = { id: 't1' };
  cyclic.self = cyclic;                       // a ref JSON.stringify can't follow
  const text = serializeActivity(buildActivityBundle({ audit: [cyclic] }));
  const parsed = JSON.parse(text);            // still valid JSON…
  assert.equal(parsed.kind, 'eoreader4-activity');
  assert.match(text, /export_error/);         // …carrying the failure, not crashing
});
