import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ingestImage } from '../src/ingest/image.js';
import { readingAt } from '../src/read/index.js';

// The image adapter must yield the same doc contract text does, so the graph,
// reading levels and fold all work over an image's object graph unchanged.
const DETECTIONS = {
  name: 'street.jpg', width: 800, height: 600,
  regions: [
    { label: 'Person', bbox: [100, 120, 80, 200] },
    { label: 'Dog',    bbox: [200, 300, 60, 80] },
    { label: 'Car',    bbox: [400, 140, 300, 160] },
  ],
  relations: [{ from: 0, to: 1, kind: 'con', via: 'walking' }],
};

test('image adapter emits the nine operators onto the same spine', () => {
  const doc = ingestImage(DETECTIONS);
  assert.equal(doc.modality, 'image');
  assert.equal(doc.units.length, 3);
  const g = doc.projectGraph();
  assert.equal(g.entities.size, 3);
  assert.ok(g.edges.some(e => e.via === 'walking'));
});

test('reading mode runs over an image with no change to the spine', () => {
  const doc = ingestImage(DETECTIONS);
  const r = readingAt(doc, 1);
  assert.ok(typeof r.surprise === 'number');
  assert.ok(Array.isArray(r.surprises));
});

test('repeated labels become distinct referents', () => {
  const doc = ingestImage({
    name: 'crowd', regions: [{ label: 'Person', bbox: [0, 0, 1, 1] }, { label: 'Person', bbox: [10, 0, 1, 1] }],
  });
  assert.equal(doc.projectGraph().entities.size, 2);
});
