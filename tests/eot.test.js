import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseEOT, eotDoc } from '../src/ingest/index.js';
import { projectGraph } from '../src/core/index.js';
import { trajectory, siteTerrainAt } from '../src/surfer/index.js';

// EOT (docs/eot-surface-syntax.md): punctuation shape carries the common operators; the
// ingester recovers the operator, mints anchors, derives the Site cell, and stamps provenance.

test('the worked lowering (§8.7) recovers operators from shape, mints one anchor for Alice', () => {
  const src = [
    'Alice : Person                      @intake ~2026-01-15',
    'Alice.age = 30',
    'Alice.email = nil',
    'Alice -> Bob : knows',
    'Alice : VIP                         @loyalty ~2026-06-01',
    '!eva Alice.tier : Bronze -> Gold    @loyalty',
    'Region <- [TN, KY, AL]',
    '!rec vocabulary:status {active,inactive} => {enrolled,waitlisted,suspended}',
  ].join('\n');
  const { events, diagnostics, signs } = parseEOT(src);
  assert.equal(diagnostics.length, 0, 'no malformed lines');
  const ops = events.map((e) => e.op);
  assert.deepEqual(ops, ['INS', 'DEF', 'NUL', 'CON', 'SIG', 'EVA', 'SYN', 'REC'], 'operator recovered per line');

  const ins = events[0];
  assert.equal(ins.operand.type, 'Person');
  assert.equal(ins.site, 'Entity', 'INS on an individual lands at Entity (Existence × Figure)');
  assert.ok(ins.anchor, 'INS mints an anchor');
  assert.equal(ins.agent, 'intake');
  assert.equal(ins.ts, '2026-01-15', 'provenance trailer parsed');

  // the same anchor carries through every later Alice event (§8.4)
  const aliceAnchor = signs.get('Alice');
  assert.equal(events[1].anchor, aliceAnchor, 'Alice.age = 30 → DEF reuses the anchor');
  assert.equal(events[2].op, 'NUL', 'nil value → NUL');
  assert.equal(events[4].op, 'SIG', 'a SECOND "Alice : VIP" is re-designation, not a new INS');
  assert.equal(events[4].anchor, aliceAnchor, 'SIG keeps Alice’s anchor');

  assert.equal(events[3].operand.relation, 'knows');
  assert.equal(events[3].site, 'Link', 'a link lands at the Link site (Structure × Figure)');
  assert.deepEqual(events[6].operand.parts, ['TN', 'KY', 'AL'], 'SYN aggregate parts');
  assert.equal(events[7].site, 'Paradigm', 'a vocabulary reframe lands at Paradigm');
  assert.deepEqual(events[7].operand.old_terms, ['active', 'inactive']);
});

test('the colon rule: spaced is IS-A, tight is a namespace (§4.3)', () => {
  const { events, diagnostics } = parseEOT('customer:123 : Person\ncustomer:123.status = active');
  assert.equal(diagnostics.length, 0);
  assert.equal(events[0].op, 'INS');
  assert.equal(events[0].target, 'customer:123', 'the tight colon is part of one sign');
  assert.equal(events[1].op, 'DEF');
  assert.equal(events[1].operand.value, 'active');
});

test('provenance defaults from the ingestion context when no trailer (§8.3)', () => {
  const { events } = parseEOT('Alice : Person', { agent: 'model:local', ts: '2026-06-27', mode: 'asserted' });
  assert.equal(events[0].agent, 'model:local');
  assert.equal(events[0].ts, '2026-06-27');
  assert.equal(events[0].mode, 'asserted');
});

test('malformed lines become diagnostics, never silent drops (§9)', () => {
  const src = [
    'Alice :Person',          // one-sided colon
    'Alice -> Bob',           // link missing : relation
    '!wat Alice : Person',    // unknown flag
    'Bob : Person',           // valid — interleaved, must still ingest
  ].join('\n');
  const { events, diagnostics } = parseEOT(src);
  assert.equal(events.length, 1, 'the one valid line still produces an event');
  assert.equal(events[0].target, 'Bob');
  assert.equal(diagnostics.length, 3, 'three malformed lines flagged');
  assert.match(diagnostics[0].expected, /one side/);
  assert.match(diagnostics[1].expected, /relation label is required|link/);
  assert.match(diagnostics[2].expected, /unknown flag/);
  assert.equal(diagnostics[1].line, 2, 'diagnostics carry the line number');
});

test('== reconciles two signs (SYN identity); | partitions (SEG)', () => {
  const { events } = parseEOT('Alice == AliceB\nCases | status');
  assert.equal(events[0].op, 'SYN');
  assert.equal(events[0].operand.mode, 'identity');
  assert.equal(events[0].operand.same_as, 'AliceB');
  assert.equal(events[1].op, 'SEG');
  assert.equal(events[1].operand.key, 'status');
  assert.equal(events[1].site, 'Network', 'a partition lands at Network (Structure × Pattern)');
});

test('comments and blank lines produce no events (§4.2)', () => {
  const { events } = parseEOT('# a heading\n\nAlice : Person   # trailing comment\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].operand.type, 'Person');
});

// EOT NATIVE — the surface mints straight into the engine's append-only log, so an EOT
// document is a first-class doc the graph stack reads. The sign is surface; the hashId is
// identity; every coref resolves to it; every SEG carves its own referent.

test('eotDoc mints a real log the graph stack reads natively', () => {
  const doc = eotDoc('Alice : Person\nAlice -> Bob : knows');
  const ev = doc.log.snapshot();
  assert.ok(ev.some(e => e.op === 'INS' && e.label === 'Alice' && /^r#/.test(e.id)), 'Alice is INS\'d with an immutable hashId');
  const con = ev.find(e => e.op === 'CON');
  assert.equal(con.via, 'knows');
  assert.equal(con.src, doc.signs.get('Alice'), 'the link\'s src is Alice\'s id, not her label');
  assert.equal(con.tgt, doc.signs.get('Bob'), 'Bob is a span too, with his own id');
  assert.ok(projectGraph(doc.log, { cursor: Infinity }), 'projectGraph reads the EOT log');
  assert.equal(siteTerrainAt(doc, 1), 'Link', 'the link locus types as Link, natively');
});

test('the sign is surface; the hashId is identity — every coref resolves to one id', () => {
  // "Alice" is what the model writes; on the backend it is ONE span. A later mention, and a
  // reconciled alias (==), both resolve to the same immutable id.
  const doc = eotDoc([
    'Alice : Person',
    'Alice -> Bob : knows',     // a later mention of Alice
    'Alice == Ali',             // Ali is the same span
    'Ali -> Carol : trusts',    // a mention via the alias
  ].join('\n'));
  const aliceId = doc.signs.get('Alice');
  const cons = doc.log.snapshot().filter(e => e.op === 'CON');
  assert.equal(cons[0].src, aliceId, 'the later mention of Alice is the same id');
  assert.equal(doc.signs.get('Ali'), aliceId, 'the alias resolves to Alice\'s id');
  assert.equal(cons[1].src, aliceId, 'a mention via the alias carries Alice\'s id — all corefs share it');
});

test('every SEG carves its own referent with its own hashId', () => {
  const doc = eotDoc('Cases : Set\nCases | status');
  const ins = doc.log.snapshot().filter(e => e.op === 'INS');
  const seg = doc.log.snapshot().find(e => e.op === 'SEG');
  assert.ok(seg.seg && /^r#/.test(seg.seg), 'the SEG carries a fresh segment id');
  assert.ok(ins.some(e => e.id === seg.seg && e.label === 'status'), 'the carved segment is itself INS\'d — a referent, not a mention');
  assert.notEqual(seg.seg, seg.src, 'the segment id is distinct from the partitioned entity');
});

test('an EOT doc drives the trajectory like any other (focus by sign, read by id)', () => {
  const doc = eotDoc([
    'Grete -> Gregor : fed',
    'Grete -> Gregor : tended',
    'Grete -> Gregor : renounced',
  ].join('\n'));
  const t = trajectory(doc, { focus: 'Grete', segments: [2] });
  assert.equal(t.terrain, 'Network');
  assert.ok(t.phases.length >= 1, 'the EOT graph yields a trajectory');
  const vias = t.phases.flatMap(p => p.relations.map(r => r.via));
  assert.ok(vias.includes('fed') && vias.includes('renounced'), 'the arc reads the EOT relations');
});

import { assembleBrief } from '../src/write/index.js';

test('assembleBrief on an EOT doc selects the SALIENT relations (link-salience), drops off-thread', () => {
  const doc = eotDoc([
    'Grete -> Gregor : fed',
    'Grete -> Gregor : tended',
    'Grete -> Gregor : nursed',
    'Grete -> Gregor : renounced',
    'Carol -> Dan : fled',          // off-thread — must not be selected
  ].join('\n'));
  const b = assembleBrief(doc, { question: 'How does Grete treat Gregor?' });
  assert.equal(b.surf.focus, 'Grete', 'the focus is the subject of the salient links');
  assert.match(b.prompt.user, /eo:renounced/, 'the reversal edge is kept');
  assert.match(b.prompt.user, /eo:band "firm"/, 'EOT bonds read firm (clean, curated)');
  assert.doesNotMatch(b.prompt.user, /Carol|eo:fled/, 'the off-thread relation is dropped by link-salience');
});

test('an EOT doc with no thread keeps the whole graph (nothing to narrow by)', () => {
  const doc = eotDoc('Grete -> Gregor : fed\nGrete -> Gregor : renounced');
  const b = assembleBrief(doc, {});   // no question
  assert.ok(b.propositions.length >= 2, 'with no thread, the whole graph rides');
});
