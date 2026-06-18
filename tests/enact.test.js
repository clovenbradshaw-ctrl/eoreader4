import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEnactedLoop, replayFrames, loopStats, sameTerms,
  isEnacted, isDepicted, assertSingleRegister, enactedReadingTo,
  DEFAULT_THRESHOLDS,
} from '../src/enact/index.js';
import { parseText } from '../src/parse/index.js';

// A deterministic stand-in for the cheap γ-mass surprise: a fixed surprise per
// cursor and an optional terms function. Under test the loop is pure on this.
const fromArray = (arr, termsAt = () => []) =>
  (c) => ({ surprise: arr[c] ?? 0, terms: termsAt(c) });
const ops = (events, op) => events.filter(e => e.op === op);

// §3 — the opening cannot be surprising; it establishes a frame, nothing to test.
test('the opening establishes a frame at every layer — DEF, no EVA, no strain', () => {
  const loop = createEnactedLoop({ read: fromArray([0]) });
  loop.step(0);
  const defs = ops(loop.events, 'DEF');
  assert.equal(defs.length, 2, 'one DEF per layer');
  assert.deepEqual(defs.map(d => d.layer), ['proposition', 'document']);
  assert.ok(defs.every(d => d.producedBy === 'initial'), 'the opening frames are initial');
  assert.equal(ops(loop.events, 'EVA').length, 0, 'nothing to test against yet');
  assert.equal(loop.strainAt('proposition'), 0, 'no strain at the opening');
});

// §6 — a confirming EVA holds the frame; a straining EVA accumulates.
test('confirming EVA holds the frame; straining EVA accumulates', () => {
  const loop = createEnactedLoop({ read: fromArray([0, 0.1, 0.9]) });
  loop.runTo(2);
  const propEvas = ops(loop.events, 'EVA').filter(e => e.frameLayer === 'proposition');
  assert.equal(propEvas[0].verdict, 'confirm', '0.1 < band → confirm');
  assert.equal(propEvas[0].strainDelta, 0, 'a confirming EVA adds no strain');
  assert.equal(propEvas[1].verdict, 'strain', '0.9 > band → strain');
  assert.ok(propEvas[1].strainDelta > 0, 'a straining EVA accumulates');
});

// §3, §6 — REC fires on accumulated strain, never on a single anomaly.
test('REC fires on accumulated strain, not a single anomaly', () => {
  const once = createEnactedLoop({ read: fromArray([0, 0.99]) });
  once.runTo(1);
  assert.equal(ops(once.events, 'REC').length, 0, 'one anomaly does not restructure');

  const sustained = createEnactedLoop({ read: fromArray([0, 0.9, 0.9, 0.9, 0.9]) });
  sustained.runTo(4);
  const recs = ops(sustained.events, 'REC').filter(r => r.layer === 'proposition');
  assert.ok(recs.length >= 1, 'the running sum eventually breaks the frame');
  assert.ok(recs[0].strainSum >= DEFAULT_THRESHOLDS.proposition, 'REC carries the strain sum at firing');
  assert.ok(recs[0].forcedBy.length >= 2, 'REC references the EVAs that forced it');
});

// §4, §11 — the higher layer holds harder: document RECs are rarer.
test('the higher layer holds harder — document RECs are rarer than proposition', () => {
  const surprises = Array.from({ length: 30 }, (_, i) => (i === 0 ? 0 : 0.9));
  const loop = createEnactedLoop({ read: fromArray(surprises) });
  loop.runTo(29);
  const st = loopStats(loop.events);
  assert.ok(st.proposition.recs > st.document.recs, 'the document frame absorbs more before it breaks');
  assert.ok(st.document.recs >= 1, 'but it does break under sustained cross-layer strain');
});

// §4, §7 — the cross-layer EVA: a proposition particular bears on the document
// frame, and only the document layer restructures the document frame.
test('cross-layer EVA — the proposition particular strains the document frame', () => {
  const surprises = Array.from({ length: 12 }, (_, i) => (i === 0 ? 0 : 0.9));
  const loop = createEnactedLoop({ read: fromArray(surprises) });
  loop.runTo(11);
  const crossEvas = ops(loop.events, 'EVA').filter(e => e.cross);
  assert.ok(crossEvas.length > 0, 'there are cross-layer EVAs');
  assert.ok(crossEvas.every(e => e.frameLayer === 'document' && e.testLayer === 'proposition'),
    'a lower particular bears on the higher frame');
  const docRecs = ops(loop.events, 'REC').filter(r => r.layer === 'document');
  assert.ok(docRecs.length >= 1 && docRecs.every(r => r.target === 'document'),
    'only the higher layer restructures the higher frame');
});

// §5, §10 — the arrow of time: forward only, never a future frame.
test('the arrow of time — forward only, never a future frame', () => {
  const loop = createEnactedLoop({ read: fromArray([0, 0.3, 0.3]) });
  loop.step(0); loop.step(2);
  assert.throws(() => loop.step(1), /forward only/, 'cannot step backward into a settled frame');
  for (const e of ops(loop.events, 'EVA')) {
    assert.ok(e.frameCursor <= e.cursor, 'an EVA never tests a frame from the future');
  }
});

// §8, §10 — the log is in generation order; the order is constitutive.
test('the log is in generation order — seqs dense, cursors non-decreasing', () => {
  const loop = createEnactedLoop({ read: fromArray([0, 0.9, 0.9, 0.9, 0.9]) });
  loop.runTo(4);
  loop.events.forEach((e, i) => assert.equal(e.seq, i, 'seq is the generation index'));
  let prev = -Infinity;
  for (const e of loop.events) { assert.ok(e.cursor >= prev, 'cursors never go backward'); prev = e.cursor; }
});

// §5, §7 — the fold replays to a cursor; the same frame at two ages is two readings.
test('the fold replays to a cursor — the same frame at two ages is two readings', () => {
  const loop = createEnactedLoop({
    read: fromArray(
      [0, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
      (c) => (c < 3 ? ['early'] : ['late']),
    ),
  });
  loop.runTo(6);
  const firstRec = loopStats(loop.events).proposition.cursors[0];
  const young = replayFrames(loop.events, firstRec - 1).frames.get('proposition');
  const old   = replayFrames(loop.events, 6).frames.get('proposition');
  assert.ok(young.cursor < old.cursor, 'folded earlier, the frame is younger');
  assert.ok(!sameTerms(young.terms, old.terms), 'and it stands on different terms');
  assert.equal(replayFrames(loop.events, 0).recs.length, 0, 'at the opening no REC has fired');
  assert.ok(replayFrames(loop.events, 6).recs.length >= 1, 'by the end the loop has restructured');
});

// §2, §10 — the two loops are separated; a depicted REC is not an enacted REC.
test('the two loops are separated — register firewall, depicted REC ≠ enacted REC', () => {
  const loop = createEnactedLoop({ read: fromArray([0, 0.9, 0.9, 0.9]) });
  loop.runTo(3);
  assert.ok(loop.events.every(isEnacted), 'every enacted event is tagged enacted');
  assert.ok(loop.events.every(e => !isDepicted(e)), 'none is a phasepost perception');
  assert.ok(assertSingleRegister(loop.events), 'the enacted log is single-register');
  const depicted = { kind: 'phasepost', pattern: { op: 'REC' } };
  assert.throws(() => assertSingleRegister([...loop.events, depicted]),
    /register mix/, 'a depicted perception cannot enter the enacted chain');

  // A reading whose particulars all confirm never RECs — even if the content it
  // reads depicts a paradigm shift. The enacted loop has no phasepost input.
  const quiet = createEnactedLoop({ read: fromArray([0, 0.1, 0.05, 0.1, 0.0]) });
  quiet.runTo(4);
  assert.equal(ops(quiet.events, 'REC').length, 0,
    'a story about a revolution does not force the reading to restructure');
});

// §8 — the event shapes carry their fields; §9 — the RULES_LEDGER borrow.
test('the event shapes carry the §8 fields and the RULES_LEDGER shape', () => {
  const loop = createEnactedLoop({ read: fromArray([0, 0.9, 0.9, 0.9]) });
  loop.runTo(3);
  const def = loop.events.find(e => e.op === 'DEF');
  assert.ok(def.frame?.terms && def.frame.threshold != null && def.layer && def.cursor != null);
  assert.ok('producedBy' in def, 'a DEF carries what produced it');
  const eva = loop.events.find(e => e.op === 'EVA');
  assert.ok(eva.particular != null && eva.frameLayer && eva.frameCursor != null);
  assert.ok(['confirm', 'strain'].includes(eva.verdict) && typeof eva.surprise === 'number');
  const rec = loop.events.find(e => e.op === 'REC');
  assert.ok(rec.from && typeof rec.strainSum === 'number' && Array.isArray(rec.forcedBy));
  assert.equal(rec.target, 'proposition', 'RULES_LEDGER target (§9)');
  assert.equal(rec.action, 'restructure', 'RULES_LEDGER action (§9)');

  const lines = loop.exportJSONL().split('\n').map(s => JSON.parse(s));
  assert.equal(lines.length, loop.events.length, 'one JSONL line per event');
  assert.ok(lines.find(l => l.op === 'REC').strainSum != null, 'the ledger exports the strain sum');
});

// §11 — convergence reporting: a thrash is visible as the threshold error it is.
test('loopStats flags a thrash — RECs oscillating between two frames', () => {
  const oscillate = [
    { op: 'DEF', layer: 'proposition', cursor: 0, producedBy: 'initial', frame: { terms: ['A'] } },
    { op: 'REC', layer: 'proposition', cursor: 3 },
    { op: 'DEF', layer: 'proposition', cursor: 3, producedBy: { rec: 1 }, frame: { terms: ['B'] } },
    { op: 'REC', layer: 'proposition', cursor: 6 },
    { op: 'DEF', layer: 'proposition', cursor: 6, producedBy: { rec: 3 }, frame: { terms: ['A'] } },
  ];
  assert.equal(loopStats(oscillate).proposition.thrash, true, 'A → B → A is a thrash');

  const settle = [
    { op: 'DEF', layer: 'proposition', cursor: 0, producedBy: 'initial', frame: { terms: ['A'] } },
    { op: 'REC', layer: 'proposition', cursor: 3 },
    { op: 'DEF', layer: 'proposition', cursor: 3, producedBy: { rec: 1 }, frame: { terms: ['B'] } },
    { op: 'REC', layer: 'proposition', cursor: 6 },
    { op: 'DEF', layer: 'proposition', cursor: 6, producedBy: { rec: 3 }, frame: { terms: ['C'] } },
  ];
  assert.equal(loopStats(settle).proposition.thrash, false, 'A → B → C is a settling');
});

// The live wiring: the skeleton runs over a real document on the cheap surprise.
test('enactedReadingTo runs the skeleton over a real document on the cheap surprise', () => {
  const STORY = 'Grete Vale entered. Grete sat. Grete read. Gregor Pike arrived. ' +
                'Gregor coughed. Gregor waited. Otto Stein knocked. Otto left.';
  const doc = parseText(STORY, { docId: 'e' });
  const end = (doc.units || doc.sentences).length - 1;
  const r = enactedReadingTo(doc, end);
  assert.ok(r.frames.get('proposition') && r.frames.get('document'), 'frames at both layers');
  assert.ok(r.stats.proposition, 'stats per layer');
  assert.ok(Array.isArray(r.events) && r.events.every(isEnacted), 'a single-register enacted log');
  const open = enactedReadingTo(doc, 0);
  assert.ok(open.recs.length <= r.recs.length, 'the reading at the opening is younger than at the end');
});
