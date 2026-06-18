import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseText } from '../src/parse/index.js';
import { projectGraph } from '../src/core/index.js';
import { createPhasepostClassifier, createCellAdjacency } from '../src/classify/index.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';
import { createCorefField } from '../src/parse/coref.js';
import { runVetoes } from '../src/ground/veto.js';
import { TALKER } from '../src/converse/index.js';
import {
  VERDICTS, documentFieldAt, claimedEdges, factCheck,
  proposeCoref, corroborateCoref, geometricSecond,
} from '../src/factcheck/index.js';

const CELLS = JSON.parse(
  readFileSync(new URL('../data/phasepost-cells.json', import.meta.url))).CELLS;

// A meaning-measuring fake: a lookup table over a tiny 4-dim space. Each embedded
// query (a clause, by default construction) maps to a chosen vector, so we drive
// exactly which cell a clause lands in and the centroid cosine between cells.
const fakeEmbedder = (table, { measuresMeaning = true } = {}) => ({
  id: 'fake', measuresMeaning, isWarm: () => true, async warm() {},
  async embed(t) { return Float32Array.from(table[t] || [0, 0, 0, 0]); },
});
const bundle = (vectors) => ({ meta: { model: 'test', construction: 'clause', dim: 4 }, vectors });

// Three Pattern-band cell centroids: CON_Binding_Link and CON_Tending_Field are
// adjacent (cosine 0.8 ≥ floor 0.6); SYN_Making_Link is far from both (cosine 0).
const PATTERN = {
  CON_Binding_Link:  [1,   0,   0, 0],
  CON_Tending_Field: [0.8, 0.6, 0, 0],
  SYN_Making_Link:   [0,   0,   1, 0],
};

const DOC_TEXT =
  'Gregor Pike waited at home. Grete Vale watched him. Grete Vale tends Gregor Pike now. Klaus Berg arrived later.';

const liveClassifier = (table) =>
  createPhasepostClassifier({ cells: CELLS, embedder: fakeEmbedder(table), centroids: bundle(PATTERN) });

// ---------------------------------------------------------------------------
// The document referent table is the binding of record (§5).

test('documentFieldAt reconstructs a γ-decayed referent field from the page', () => {
  const doc = parseText(DOC_TEXT, { docId: 'd' });
  const at2 = documentFieldAt(doc, 2);
  // At s2 Grete Vale (s1,s2) outweighs Gregor Pike (s0,s2) and Klaus Berg (s3).
  assert.equal(at2[0].id, 'grete-vale');
  assert.ok(at2.every(c => c.w >= 0 && c.w <= 1));
});

test('a talker claim resolves its endpoints through the DOCUMENT table, not the talker', () => {
  const doc = parseText(DOC_TEXT, { docId: 'd' });
  // A leading pronoun in the talker's claim binds to the hottest DOCUMENT
  // referent at the cursor — the talker does not get to choose the node.
  const expected = documentFieldAt(doc, 2)[0].id;
  const claims = claimedEdges({ prose: 'He tends Klaus Berg.', doc, cursor: 2 });
  assert.equal(claims.length, 1);
  assert.equal(claims[0].src, expected);          // document-side, never the talker's
  assert.equal(claims[0].tgt, 'klaus-berg');
});

// ---------------------------------------------------------------------------
// The four verdicts (§3).

test('corroborated: a claim matching a document edge earns its citation (§7)', async () => {
  const doc   = parseText(DOC_TEXT, { docId: 'd' });
  const graph = projectGraph(doc.log, {});
  const clf   = liveClassifier({
    'Grete Vale looks after Gregor Pike.': [1, 0, 0, 0],   // → CON_Binding_Link
    'Grete Vale tends Gregor Pike now.':   [0.8, 0.6, 0, 0], // → CON_Tending_Field (adjacent)
  });
  const out = await factCheck({ prose: 'Grete Vale looks after Gregor Pike.', doc, graph, classifier: clf });
  assert.equal(out.counts.corroborated, 1);
  assert.equal(out.claims[0].verdict, VERDICTS.CORROBORATED);
  assert.equal(out.claims[0].citation, 's2');     // the document edge's witness
  assert.deepEqual([...out.citations], ['s2']);
  assert.equal(out.refuse, false);
});

test('unsupported: a relation between two resolved referents with no document edge', async () => {
  const doc   = parseText(DOC_TEXT, { docId: 'd' });
  const graph = projectGraph(doc.log, {});
  const clf   = liveClassifier({ 'Grete Vale owns Klaus Berg.': [1, 0, 0, 0] });
  const out = await factCheck({ prose: 'Grete Vale owns Klaus Berg.', doc, graph, classifier: clf });
  assert.equal(out.counts.unsupported, 1);
  assert.equal(out.claims[0].verdict, VERDICTS.UNSUPPORTED);
  assert.equal(out.claims[0].reason, 'no-edge');
  assert.ok(out.fired.some(f => f.id === 'edge-unsupported' && f.refuses === false));
  assert.equal(out.refuse, false);                // unsupported flags, does not refuse
});

test('contradicted: an explicit VOID denying the claimed relation is a hard refusal', async () => {
  const doc = parseText('Block Corp opened downtown. River House stood beside it.', { docId: 'v' });
  // The document carves the cause of River House as absent — a no-cause-named VOID.
  doc.log.append({ op: 'NUL', kind: 'void', node: 'river-house', rel: 'caused', sentIdx: 1 });
  const graph = projectGraph(doc.log, {});
  assert.equal(graph.voids.length, 1);
  const clf = liveClassifier({
    'Block Corp caused River House.': [1, 0, 0, 0],   // CON_Binding_Link
    'caused':                          [1, 0, 0, 0],   // the void's relation, same cell
  });
  const out = await factCheck({ prose: 'Block Corp caused River House.', doc, graph, classifier: clf });
  assert.equal(out.counts.contradicted, 1);
  assert.equal(out.claims[0].verdict, VERDICTS.CONTRADICTED);
  assert.equal(out.refuse, true);
  assert.ok(out.fired.some(f => f.id === 'edge-contradicted' && f.refuses === true));
});

test('indeterminate under the hash organ: every relational verdict holds (§4)', async () => {
  const doc   = parseText(DOC_TEXT, { docId: 'd' });
  const graph = projectGraph(doc.log, {});
  // The hash embedder does not measure meaning — the classifier holds every
  // position, so the relation cannot be typed and the verdict cannot run.
  const clf = createPhasepostClassifier({
    cells: CELLS, embedder: createHashEmbedder(), centroids: bundle(PATTERN),
  });
  const out = await factCheck({ prose: 'Grete Vale looks after Gregor Pike.', doc, graph, classifier: clf });
  assert.equal(out.counts.indeterminate, 1);
  assert.equal(out.claims[0].verdict, VERDICTS.INDETERMINATE);
  assert.equal(out.claims[0].reason, 'weak-embedder');
  assert.equal(out.fired.length, 0);              // the check is honestly inert
  assert.equal(out.refuse, false);
});

test('indeterminate: an asserted relation whose endpoints will not resolve is held', async () => {
  const doc   = parseText(DOC_TEXT, { docId: 'd' });
  const graph = projectGraph(doc.log, {});
  const clf   = liveClassifier({});
  const out = await factCheck({ prose: 'Grete Vale trusts strangers.', doc, graph, classifier: clf });
  assert.equal(out.claims[0].verdict, VERDICTS.INDETERMINATE);
  assert.equal(out.claims[0].reason, 'unresolved-endpoints');
});

test('a mixed turn reports each verdict and refuses only on contradiction', async () => {
  const doc   = parseText(DOC_TEXT, { docId: 'd' });
  const graph = projectGraph(doc.log, {});
  const clf   = liveClassifier({
    'Grete Vale looks after Gregor Pike.': [1, 0, 0, 0],
    'Grete Vale tends Gregor Pike now.':   [0.8, 0.6, 0, 0],
    'Grete Vale owns Klaus Berg.':         [1, 0, 0, 0],
  });
  const out = await factCheck({
    prose: 'Grete Vale looks after Gregor Pike. Grete Vale owns Klaus Berg.',
    doc, graph, classifier: clf,
  });
  assert.equal(out.counts.corroborated, 1);
  assert.equal(out.counts.unsupported, 1);
  assert.deepEqual([...out.citations], ['s2']);
  assert.equal(out.refuse, false);
});

// ---------------------------------------------------------------------------
// Relation correspondence is geometric, not string (§4).

test('cell adjacency is read off the centroid geometry; unmeasurable under no centroids', () => {
  const adj = createCellAdjacency(PATTERN);
  assert.equal(adj.adjacent('CON_Binding_Link', 'CON_Binding_Link'), true);   // self
  assert.equal(adj.adjacent('CON_Binding_Link', 'CON_Tending_Field'), true);  // 0.8 ≥ 0.6
  assert.equal(adj.adjacent('CON_Binding_Link', 'SYN_Making_Link'), false);   // 0 < 0.6
  const none = createCellAdjacency(null);
  assert.equal(none.measurable(), false);
  assert.equal(none.adjacent('CON_Binding_Link', 'CON_Tending_Field'), null); // hold, never guess
});

// ---------------------------------------------------------------------------
// The veto battery surfaces the edge-grounding check beside the node one (§8).

test('the edge-grounding vetoes fire on the four-way verdict and are inert without it', () => {
  const base = { draft: 'a sentence', question: 'q', bound: [] };
  const contra = runVetoes({ ...base, edgeVerdicts: [{ verdict: 'contradicted' }] });
  assert.ok(contra.fired.some(f => f.id === 'edge-contradicted'));
  assert.equal(contra.refuse, true);

  const unsup = runVetoes({ ...base, edgeVerdicts: [{ verdict: 'unsupported' }] });
  assert.ok(unsup.fired.some(f => f.id === 'edge-unsupported'));
  assert.equal(unsup.refuse, false);              // flag-only

  const indet = runVetoes({ ...base, edgeVerdicts: [{ verdict: 'indeterminate' }] });
  assert.ok(!indet.fired.some(f => f.id.startsWith('edge-')));

  const inert = runVetoes(base);                  // no fact-check ran
  assert.ok(!inert.fired.some(f => f.id.startsWith('edge-')));
});

// ---------------------------------------------------------------------------
// Coreference as proposal (§6): the talker proposes, document-side readers dispose.

test('a coref proposal deposits capped conversational warmth, never grounded mass', () => {
  const f  = createCorefField();
  const ev = proposeCoref({ a: 'officer', b: 'topps', cursor: 0, field: f });
  assert.equal(ev.witness, TALKER);
  assert.equal(ev.kind, 'coref-proposal');
  assert.ok(f.field(0).some(c => c.id === 'officer' && c.conversational > 0));
  assert.ok(f.field(0).some(c => c.id === 'topps'   && c.conversational > 0));
  assert.ok(!f.fieldGrounded(0).some(c => c.id === 'officer')); // warmth, never witness
});

test('corroborateCoref commits only on a grounding reader’s second; holds otherwise', async () => {
  const proposal = proposeCoref({ a: 'officer', b: 'topps', cursor: 5 });

  const held = await corroborateCoref(proposal, { second: async () => ({ seconds: false }) });
  assert.equal(held.committed, false);
  const none = await corroborateCoref(proposal, {});            // no reader → held
  assert.equal(none.committed, false);

  const ok = await corroborateCoref(proposal, {
    second: async () => ({ seconds: true, by: 'geometric', score: 0.9 }), cursor: 5,
  });
  assert.equal(ok.committed, true);
  assert.equal(ok.merge.op, 'SYN');
  assert.equal(ok.merge.kind, 'merge');
  assert.notEqual(ok.merge.witness, TALKER);      // the grounding reader, not the talker
});

test('geometricSecond cannot corroborate under the hash organ (the proposal holds)', async () => {
  const second = geometricSecond({
    embedder: createHashEmbedder(), textA: 'the off-duty officer', textB: 'Sgt. Topps',
  });
  const v = await second();
  assert.equal(v.seconds, false);
  assert.equal(v.reason, 'weak-embedder');
});

test('a committed coref merge unifies the referents in the document reading', async () => {
  const doc = parseText('Alpha One spoke first. Bravo Two spoke later.', { docId: 'm' });
  const before = projectGraph(doc.log, {});
  assert.notEqual(before.representative('alpha-one'), before.representative('bravo-two'));

  const proposal = proposeCoref({ a: 'alpha-one', b: 'bravo-two', cursor: 1 });
  const { committed, merge } = await corroborateCoref(proposal, {
    second: async () => ({ seconds: true, by: 'geometric' }), cursor: 1,
  });
  assert.ok(committed);
  doc.log.append(merge);                          // the caller owns the log
  const after = projectGraph(doc.log, {});
  assert.equal(after.representative('alpha-one'), after.representative('bravo-two'));
});
