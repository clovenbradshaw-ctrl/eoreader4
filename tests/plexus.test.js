import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parametersOf, parameterOf, snapshotEOT,
  mapParameter, route, connect, patch,
} from '../src/plexus/index.js';
import { eotDoc } from '../src/ingest/eot.js';

// A hand-built structure surface — the shape the core's perceiver emits (figures/relations/defs).
// Two persistent holons (Gregor recurs 5×, Grete 3×) and a one-shot (Chief clerk, 1×).
const reading = () => ({
  figures: [
    { id: 'g', label: 'Gregor', count: 5 },
    { id: 'r', label: 'Grete',  count: 3 },
    { id: 'c', label: 'Chief',  count: 1 },
  ],
  relations: [
    { op: 'CON', src: { id: 'g', label: 'Gregor' }, tgt: { id: 'r', label: 'Grete' }, via: 'protects', polarity: '+' },
    { op: 'CON', src: { id: 'g', label: 'Gregor' }, tgt: { id: 'c', label: 'Chief' }, via: 'fears',    polarity: '+' },
  ],
  defs: [
    { id: 'g', label: 'Gregor', value: 'weary', idx: 0 },
  ],
});

// ── parameters: persistent holons emerge, ranked, with a stable identity ──────
test('parametersOf exposes persistent holons, most-persistent first', () => {
  const params = parametersOf(reading(), { organ: 'text' });
  assert.deepEqual(params.map((p) => p.label), ['Gregor', 'Grete', 'Chief']);
  assert.equal(params[0].persistence, 5);
  assert.equal(params[0].kind, 'figure');
  assert.equal(params[0].organ, 'text');
  // a stable, deterministic wire-endpoint id + the holon's organ-independent identity
  assert.match(params[0].key, /^[0-9a-f]{8}$/);
  assert.match(params[0].holonId, /^[0-9a-f]{8}$/);
});

test('the persistence floor selects the holons that clearly emerged', () => {
  const params = parametersOf(reading(), { organ: 'text', minPersistence: 2 });
  assert.deepEqual(params.map((p) => p.label), ['Gregor', 'Grete'], 'the one-shot is not persistent');
});

test('the endpoint id is organ-scoped; the holon identity is not', () => {
  const heard = parametersOf(reading(), { organ: 'audio' })[0];
  const read  = parametersOf(reading(), { organ: 'text'  })[0];
  assert.notEqual(heard.key, read.key, 'same holon on two organs → two endpoints');
  assert.equal(heard.holonId, read.holonId, 'but one holon identity');
});

test('parameterOf finds by label or key', () => {
  const r = reading();
  const p = parameterOf(r, 'Grete', { organ: 'text' });
  assert.equal(p.label, 'Grete');
  assert.equal(parameterOf(r, p.key, { organ: 'text' }).label, 'Grete');
  assert.equal(parameterOf(r, 'Nobody', { organ: 'text' }), null);
});

// ── the wire's payload is EOT — the translation layer ─────────────────────────
test('snapshotEOT carries a holon state as EOT triples (LINK + IS-A)', () => {
  const p = parameterOf(reading(), 'Gregor', { organ: 'text' });
  const lines = snapshotEOT(p, reading());
  assert.ok(lines.includes('Gregor -> Grete : protects'));
  assert.ok(lines.includes('Gregor -> Chief : fears'));
  assert.ok(lines.includes('Gregor : weary'));
});

test('a rename relabels the holon under the destination parameter name', () => {
  const p = parameterOf(reading(), 'Gregor', { organ: 'text' });
  const lines = snapshotEOT(p, reading(), { as: 'Protagonist' });
  assert.ok(lines.includes('Protagonist -> Grete : protects'));
  assert.ok(lines.includes('Protagonist : weary'));
  assert.ok(!lines.some((l) => l.startsWith('Gregor')), 'the source name does not leak across the wire');
});

// ── the binding: pure data, deterministic identity ────────────────────────────
test('mapParameter draws a wire as deterministic data', () => {
  const p = parameterOf(reading(), 'Gregor', { organ: 'text' });
  const b1 = mapParameter(p, { organ: 'music', as: 'Motif' });
  const b2 = mapParameter(p, { organ: 'music', as: 'Motif' });
  assert.equal(b1.id, b2.id, 'the same wire has the same identity of record');
  assert.equal(b1.from.organ, 'text');
  assert.equal(b1.to.organ, 'music');
  assert.equal(b1.to.as, 'Motif');
  assert.equal(b1.rename, true);
  assert.equal(b1.via, 'eot');
});

test('route renders the wire payload; recBridge documents the vocabulary bridge', () => {
  const p = parameterOf(reading(), 'Gregor', { organ: 'text' });
  const b = mapParameter(p, { organ: 'music', as: 'Motif' });
  const { eot, lines } = route(b, reading());
  assert.ok(lines.includes('Motif -> Grete : protects'));
  assert.equal(typeof eot, 'string');

  const bridged = route(b, reading(), { recBridge: true });
  assert.equal(bridged.lines[0], '!rec vocabulary:text {Gregor} => {Motif}');
});

// ── connect: EOT lowers into the target as a first-class doc (the real ingester) ──
test('connect lowers a routed holon into a first-class EOT doc', () => {
  const p = parameterOf(reading(), 'Gregor', { organ: 'text' });
  const b = mapParameter(p, { organ: 'music', as: 'Motif' });
  const doc = connect(b, reading(), eotDoc);

  assert.ok(doc.log, 'a first-class doc with an append-only log');
  assert.equal(doc.eot, true);
  assert.equal(doc.diagnostics.length, 0, 'the wire emitted well-formed EOT — nothing malformed');
  // the holon crossed under its destination name and minted spans there
  assert.ok(doc.signs.has('Motif'));
  assert.ok(doc.signs.has('Grete'));
  assert.ok(!doc.signs.has('Gregor'), 'the source name did not cross the wire');
});

test('patch draws and routes in one step', () => {
  const p = parameterOf(reading(), 'Gregor', { organ: 'text' });
  const { binding, lines } = patch(p, { organ: 'music', as: 'Motif' }, reading());
  assert.equal(binding.to.organ, 'music');
  assert.ok(lines.includes('Motif -> Grete : protects'));
});

test('connect requires an injected ingester (the plexus imports none)', () => {
  const p = parameterOf(reading(), 'Gregor', { organ: 'text' });
  const b = mapParameter(p, { organ: 'music' });
  assert.throws(() => connect(b, reading(), null), /ingester/);
});
