import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deriveOpen, buildIdle, summarizeCandidate } from '../src/ui/idle-view.js';
import { canWitness } from '../src/core/index.js';

// The Rest view's DOM-free surface (§15/§16): derive what the first ingress left
// open from the REAL projected-graph shape, then drive the real idle loop over it.
// A synthetic doc stands in for the parser (entities/edges/voids — core/project.js's
// shape), the same way predict-view's pure exports are tested without a browser.

// A Metamorphosis-shaped graph: Gregor is well-characterized early; his sister is
// mentioned once at first (hedged) and named only later; the chief clerk is
// introduced but uncharacterized until a later relation; the MEANING is a genuine
// void nothing later resolves.
const doc = () => ({
  docId: 'metamorphosis',
  sentences: Array.from({ length: 30 }, (_, i) => `sentence ${i}`),
  projectGraph: () => ({
    representative: (x) => x,
    voids: [{ node: 'meaning', rel: 'same-as', sentIdx: 8 }],
    entities: new Map([
      ['gregor',  { id: 'gregor',  label: 'Gregor Samsa',          sightings: 50, firstSeen: 0, props: {} }],
      ['sister',  { id: 'sister',  label: 'his sister',            sightings: 12, firstSeen: 5, props: {} }],
      ['clerk',   { id: 'clerk',   label: 'the chief clerk',       sightings: 6,  firstSeen: 6, props: {} }],
      ['meaning', { id: 'meaning', label: 'what the change means', sightings: 5,  firstSeen: 8, props: {} }],
      ['bed',     { id: 'bed',     label: 'the bed',     sightings: 1, firstSeen: 1, props: {} }],
      ['vermin',  { id: 'vermin',  label: 'a vermin',    sightings: 1, firstSeen: 1, props: {} }],
      ['job',     { id: 'job',     label: 'his work',    sightings: 1, firstSeen: 3, props: {} }],
      ['violin',  { id: 'violin',  label: 'the violin',  sightings: 1, firstSeen: 18, props: {} }],
      ['gname',   { id: 'gname',   label: 'Grete',       sightings: 1, firstSeen: 20, props: {} }],
      ['firm',    { id: 'firm',    label: 'the firm',    sightings: 1, firstSeen: 15, props: {} }],
    ]),
    edges: [
      { from: 'gregor', to: 'bed',    via: 'wakes in', sentIdx: 1 },
      { from: 'gregor', to: 'vermin', via: 'becomes',  sentIdx: 1 },
      { from: 'gregor', to: 'job',    via: 'works as', sentIdx: 3 },
      { from: 'sister', to: 'gregor', via: 'tends',    sentIdx: 6 },   // one early relation → hedged
      { from: 'sister', to: 'violin', via: 'plays',    sentIdx: 18 },  // learned deeper
      { from: 'sister', to: 'gname',  via: 'is named', sentIdx: 20 },  // the name, given later
      { from: 'clerk',  to: 'firm',   via: 'represents', sentIdx: 15 },// the clerk's role, learned deeper
    ],
  }),
});

test('deriveOpen: the first ingress leaves the thin referents open, not the characterized ones (§15)', () => {
  const { open } = deriveOpen(doc());
  const byId = Object.fromEntries(open.map(o => [o.id, o.band]));
  assert.ok(!('gregor' in byId), 'Gregor is well-characterized at ingress — not open');
  assert.equal(byId['sister'], 'hedged', 'mentioned once at first → hedged');
  assert.equal(byId['clerk'], 'void', 'introduced but uncharacterized → void');
  assert.equal(byId['meaning'], 'void', 'the reader marked its identity void');
  assert.ok(!('violin' in byId) && !('gname' in byId), 'referents that only appear later were not part of the ingress');
});

test('openLedger over the built fold shows the real open set (§16 "Open")', () => {
  const st = buildIdle(doc());
  const ledger = st.idle ? openLedgerOf(st) : [];
  const byId = Object.fromEntries(ledger.map(e => [e.rid, e.band]));
  assert.deepEqual(Object.keys(byId).sort(), ['clerk', 'meaning', 'sister']);
  assert.equal(byId['sister'], 'hedged');
  assert.equal(byId['clerk'], 'void');
});

test('processing further surfaces, from later in the doc, what ingress could not learn — reafferent (§8, §15)', () => {
  const st = buildIdle(doc());
  const r = st.idle.arrive({ reach: st.S });                 // read the whole document
  const rids = r.candidates.map(c => c.rid).sort();
  assert.deepEqual(rids, ['clerk', 'sister'], 'the two resolvable gaps surface; the void does not');

  for (const c of r.candidates) {
    assert.equal(canWitness(c.prov), false, 'every candidate is reafferent — it cannot witness itself (the firewall)');
    assert.equal(st.idle.canGround(c), false);
  }
  // the candidate leads with the exafferent passage that resolves it, with its cite
  const sister = r.candidates.find(c => c.rid === 'sister');
  assert.equal(sister.body.sentIdx, 18, 'read from the first later relation');
  const line = summarizeCandidate('his sister', sister.body);
  assert.match(line, /his sister/);
  assert.match(line, /sentence 18/, 'leads with the real passage (the grounding evidence)');
  assert.match(line, /\(c18\)/, 'cited to the sentence it was read from');
});

test('confirming a candidate closes the gap; a genuine void stays open (the witness act, §16)', () => {
  const st = buildIdle(doc());
  const r = st.idle.arrive({ reach: st.S });
  const sister = r.candidates.find(c => c.rid === 'sister');

  // the view's confirm: ground it, then record the firm descriptor that settles it
  st.idle.confirm(sister, { by: 'human' });
  st.fold.record('sister', { t: sister.body.sentIdx, op: 'DEF', attr: `${sister.body.via} ${sister.body.other}`, res: 'firm' });
  st.resolution.set('sister', firmHigh());

  const after = openLedgerOf(st).map(e => e.rid).sort();
  assert.ok(!after.includes('sister'), 'confirming closes the sister gap — it leaves the open set');
  assert.ok(after.includes('meaning'), 'the meaning stays open — the instrument never invents what the text leaves void');
});

// helpers — read the live ledger the way the view does
import { openLedger } from '../src/write/voids.js';
import { firm } from '../src/core/index.js';
const openLedgerOf = (st) => openLedger(st.fold, { resolution: st.resolution });
const firmHigh = () => firm(0.85);
