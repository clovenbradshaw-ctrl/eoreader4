import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildActivityBundle, serializeActivity } from '../src/ui/activity-export.js';

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
  assert.equal(b.version, 1);
  assert.equal(b.exportedAt, '2026-06-30');
  // counts is the header — the shape readable without walking the file.
  assert.deepEqual(b.counts, { messages: 2, turns: 1, documents: 2, events: 2 });
  // The streams are carried verbatim.
  assert.equal(b.transcript[1].content, 'Kafka [s2].');
  assert.equal(b.audit[0].id, 't1');
  assert.equal(b.documents[0].events.length, 2);
});

test('an empty session still yields a valid, zeroed bundle', () => {
  const b = buildActivityBundle({});
  assert.deepEqual(b.counts, { messages: 0, turns: 0, documents: 0, events: 0 });
  assert.deepEqual(b.transcript, []);
  assert.deepEqual(b.audit, []);
  assert.deepEqual(b.documents, []);
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
