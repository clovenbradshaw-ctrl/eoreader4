import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildDream, renderDream } from '../src/ui/dream-view.js';

// The dream walks the document's REAL projected graph (core/project.js). We hand it a
// synthetic graph so the derivation is tested without the perceiver pipeline or a browser:
//   Alice—Carol, Alice—Dave, Bob—Carol, Bob—Dave, Carol—Dave   (traversed edges)
//   Zed                                                          (spurious: no edges, seen once)
// Alice and Bob never co-occur in an edge, yet they share BOTH Carol and Dave — a
// meaningful connection the reading never traversed. The dream should surface exactly that
// (Born-weighted), prune Zed, and hold everything on the §8 firewall (ungrounded).
const fakeDoc = () => {
  const entities = new Map([
    ['a', { id: 'a', label: 'Alice', sightings: 5 }],
    ['b', { id: 'b', label: 'Bob', sightings: 5 }],
    ['c', { id: 'c', label: 'Carol', sightings: 4 }],
    ['d', { id: 'd', label: 'Dave', sightings: 4 }],
    ['z', { id: 'z', label: 'Zed', sightings: 1 }],
  ]);
  const edges = [
    { from: 'a', to: 'c', kind: 'meets', sentIdx: 1 },
    { from: 'a', to: 'd', kind: 'meets', sentIdx: 2 },
    { from: 'b', to: 'c', kind: 'meets', sentIdx: 3 },
    { from: 'b', to: 'd', kind: 'meets', sentIdx: 4 },
    { from: 'c', to: 'd', kind: 'meets', sentIdx: 5 },
  ];
  return {
    sentences: Array.from({ length: 10 }, (_, i) => `sentence ${i}`),  // no START/END markers → whole body
    projectGraph: () => ({ entities, edges, voids: [], representative: (x) => x }),
  };
};

test('buildDream surfaces the untraversed latent rhyme, Born-weighted', () => {
  const dream = buildDream(fakeDoc());
  assert.equal(dream.stats.referents, 5);
  // Alice—Bob never traversed but shares Carol & Dave — it should lead the strengthening
  assert.ok(dream.strengthened.length >= 1, 'a rhyme surfaced');
  const top = dream.strengthened[0];
  assert.deepEqual([top.aLabel, top.bLabel].sort(), ['Alice', 'Bob'], 'the shared-neighbour rhyme leads');
  assert.equal(top.kind, 'strengthen', 'they share connective tissue → a strengthen, not a bare propose');
  assert.deepEqual(top.shared.sort(), ['Carol', 'Dave'], 'the why is the shared neighbours');
  assert.ok(top.weight > 0, 'it carries a Born weight');
});

test('buildDream never surfaces a pair the reading traversed (a direct edge)', () => {
  const dream = buildDream(fakeDoc());
  const key = (r) => [r.aLabel, r.bLabel].sort().join('|');
  const surfaced = new Set(dream.strengthened.map(key));
  assert.ok(!surfaced.has('Carol|Dave'), 'Carol—Dave was a direct edge; the dream skips it');
  assert.ok(!surfaced.has('Alice|Carol'), 'Alice—Carol was traversed; skipped too');
});

test('buildDream prunes the spurious referent (fit one arrival, nothing after)', () => {
  const dream = buildDream(fakeDoc());
  assert.ok(dream.pruned.some(p => p.label === 'Zed'), 'Zed — never connected, seen once — is forgotten');
  assert.equal(dream.stats.pruned, dream.pruned.length);
});

test('buildDream is safe on an empty / graph-less doc', () => {
  const dream = buildDream({});
  assert.equal(dream.stats.referents, 0);
  assert.deepEqual(dream.strengthened, []);
  assert.deepEqual(dream.pruned, []);
});

test('renderDream produces a panel naming the dream and its rhymes (pure string)', () => {
  const html = renderDream(buildDream(fakeDoc()));
  assert.match(html, /Dreaming/);
  assert.match(html, /Born-weighted/);
  assert.match(html, /Alice/);
  assert.match(html, /Bob/);
  assert.match(html, /\|ψ\|²/, 'the Born measure is shown');
  assert.match(html, /Zed/, 'the pruned referent is shown struck through');
});
