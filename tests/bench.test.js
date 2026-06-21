import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  surfaceNote, scoreProbe, aggregateTarget, aggregateBattery,
  runBattery, chargeValenceRegression, TARGETS,
} from '../src/bench/index.js';
import { ingestText } from '../src/organs/in/index.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';

// docs/surfing-success.md — the talker is out of the loop. The bench scores the
// surfaced structured note directly: recall × precision, gated by groundedness and
// by the forbidden/silence hard gates, aggregated per target and discounted by how
// much the note changes when the phrasing changes.

const embedder = createHashEmbedder();

// A synthetic note built straight, so the scoring math is tested without retrieval.
const noteOf = (over) => ({
  query: 'q', anchor: 0, peak: 0,
  spans: [16], spanText: { 16: "Gregor's sister cleaned the floor and learned which leftovers her brother preferred." },
  entities: [{ id: 'gregor-samsa', label: 'Gregor Samsa' }, { id: 'grete', label: 'Grete' }],
  relations: [{ src: { id: 'gregor-samsa', label: 'Gregor Samsa' }, tgt: { id: 'grete', label: 'Grete' }, via: 'sister', type: 'sibling', idx: 16 }],
  referents: [], defs: [], frameTurns: [],
  ...over,
});

const goldSibling = {
  required: {
    entities: ['gregor-samsa', 'grete'],
    relations: [{ src: 'gregor-samsa', tgt: 'grete', type: 'sibling', symmetric: true }],
    spans: [16],
  },
  forbidden: { relations: [{ src: 'gregor-samsa', tgt: 'grete', type: 'parent' }], tokens: [] },
};

test('a note carrying the gold elements scores ~1 — recall × precision × groundedness', async () => {
  const s = await scoreProbe(noteOf(), goldSibling, { embedder });
  assert.equal(s.recall, 1, 'all required elements present');
  assert.equal(s.precision, 1, 'nothing surplus');
  assert.equal(s.groundedness, 1, 'the relation cites a supporting span');
  assert.ok(s.score > 0.95 && !s.gated);
});

test('the sibling primitive is symmetric — the reversed edge satisfies the gold', async () => {
  const reversed = noteOf({ relations: [{ src: { id: 'grete', label: 'Grete' }, tgt: { id: 'gregor-samsa', label: 'Gregor Samsa' }, via: 'sister', type: 'sibling', idx: 16 }] });
  const s = await scoreProbe(reversed, goldSibling, { embedder });
  assert.ok(s.detail.relHit[0], 'reversed sibling edge matched');
});

test('precision (parsimony) prices surplus figure relations', async () => {
  const surplus = noteOf({
    entities: [{ id: 'gregor-samsa', label: 'Gregor Samsa' }, { id: 'grete', label: 'Grete' }, { id: 'otto', label: 'Otto' }],
    relations: [
      noteOf().relations[0],
      { src: { id: 'grete', label: 'Grete' }, tgt: { id: 'otto', label: 'Otto' }, via: 'met', type: null, idx: 16 },
    ],
    spanText: { 16: "Gregor's sister cleaned the floor; Grete met Otto." },
  });
  const s = await scoreProbe(surplus, goldSibling, { embedder });
  assert.equal(s.recall, 1, 'still recalls the required elements');
  assert.ok(s.precision < 1, 'surplus entity + relation drops precision');
});

test('the forbidden gate fails the probe outright, score zero', async () => {
  const wrong = noteOf({
    relations: [{ src: { id: 'gregor-samsa', label: 'Gregor Samsa' }, tgt: { id: 'grete', label: 'Grete' }, via: 'mother', type: 'parent', idx: 16 }],
  });
  const s = await scoreProbe(wrong, goldSibling, { embedder });
  assert.ok(s.gated && s.score === 0, 'a forbidden (wrong-type) relation disqualifies');
  assert.ok(s.gates.some(g => g.startsWith('forbidden-relation')));
});

test('groundedness zeroes a note whose citation does not support the claim', async () => {
  // Token grounding (no embedder) is deterministic — the hash organ's dimension
  // collisions can fabricate a small cosine, exactly the firewall it warns about.
  const ungrounded = noteOf({ spanText: { 16: 'The weather turned cold and the train was late.' } });
  const s = await scoreProbe(ungrounded, goldSibling, { embedder: null });
  assert.equal(s.groundedness, 0, 'the cited span shares no token with the sibling claim');
  assert.equal(s.score, 0, 'an ungrounded note cannot score well however complete');
});

test('the silence gate: a void slot held passes, a fact asserted fails', async () => {
  const goldSilence = {
    required: { entities: ['gregor-samsa'], spans: [0] },
    forbidden: { tokens: [] },
    silence: { slot: 'species', tokens: ['beetle', 'cockroach', 'insect'] },
  };
  const held = noteOf({
    entities: [{ id: 'gregor-samsa', label: 'Gregor Samsa' }], relations: [],
    spans: [0], spanText: { 0: 'Gregor Samsa woke transformed into a monstrous vermin.' },
  });
  const ok = await scoreProbe(held, goldSilence, { embedder });
  assert.equal(ok.voidMarker, true, 'no species named → the slot is void');
  assert.ok(!ok.gated);

  const broke = noteOf({
    entities: [{ id: 'gregor-samsa', label: 'Gregor Samsa' }], relations: [],
    spans: [0], spanText: { 0: 'Gregor Samsa woke transformed into a giant cockroach.' },
  });
  const bad = await scoreProbe(broke, goldSilence, { embedder });
  assert.ok(bad.gated && bad.score === 0, 'asserting the species is false certainty — fails');
});

test('angle aggregation: consistency discounts variance across phrasings', () => {
  const stable   = aggregateTarget([{ score: 1, gated: false }, { score: 1, gated: false }, { score: 1, gated: false }]);
  const splitHalf = aggregateTarget([{ score: 1, gated: false }, { score: 0, gated: false }]);
  assert.equal(stable.consistency, 1);
  assert.equal(stable.targetScore, 1);
  assert.equal(splitHalf.mean, 0.5, 'mean looks acceptable');
  assert.equal(splitHalf.consistency, 0, 'but consistency collapses');
  assert.equal(splitHalf.targetScore, 0, 'keyword-matching with extra steps earns nothing');
});

test('aggregateBattery sums target scores and flags any hard gate', () => {
  const b = aggregateBattery({
    a: aggregateTarget([{ score: 1, gated: false }]),
    b: aggregateTarget([{ score: 0.5, gated: true }]),
  });
  assert.equal(b.nTargets, 2);
  assert.ok(b.anyGate, 'a gated probe anywhere fails the admissibility check');
});

test('surfaceNote pivots the graph: relations are figure-to-figure, referents held apart', async () => {
  const doc = await ingestText("Gregor Samsa woke transformed. His sister Grete brought milk. Gregor's sister fed her brother every day.", {});
  const note = await surfaceNote(doc, 'who is Gregor sister', { embedder });
  for (const r of note.relations) {
    assert.notEqual(r.src.id, r.tgt.id);
    assert.ok(/[a-z]/.test(r.src.id) && /[a-z]/.test(r.tgt.id));
  }
  assert.ok(Array.isArray(note.referents), 'open-vocab NP edges live in referents, not the scored note');
  assert.ok(note.spans.length > 0 && note.spanText[note.spans[0]] != null);
});

test('the baseline battery runs, trips no hard gate, and recalls the sibling relation', async () => {
  const report = await runBattery({ embedder });
  assert.equal(report.anyGate, false, 'no probe fabricates or breaks silence at baseline');
  assert.ok(report.batteryScore > 0);
  // The sibling note must be REACHABLE — at least one angle carries the full
  // required set (the relation, both entities, the span). Which phrasing reaches it
  // depends on retrieval and the surf window, so we assert reachability, not a fixed
  // angle: a brittle per-phrasing pin would break every time the field shifts.
  const maxRecall = Math.max(...report.perTarget.sibling.angles.map(a => a.recall));
  assert.equal(maxRecall, 1, 'some angle surfaces the sibling relation, both entities, and the span');
});

test('charge/valence regression: the sentinel is clean ON, broken OFF', async () => {
  const cv = await chargeValenceRegression();
  assert.equal(cv.on.forbiddenRelationPresent, false, 'role exclusivity refuses sister-on-mother');
  assert.equal(cv.off.forbiddenRelationPresent, true, 'with the sentinel off the forbidden bond appears');
  assert.ok(cv.pass);
});

test('the battery is frozen — every target carries required + angles, silence carries its slot', () => {
  for (const [tid, t] of Object.entries(TARGETS)) {
    assert.ok(t.required, `${tid} has a required set`);
    assert.ok(Array.isArray(t.angles) && t.angles.length >= 6, `${tid} is hit from many angles`);
    if (t.kind === 'silence') assert.ok(t.silence?.tokens?.length, `${tid} declares its silence slot`);
  }
});
