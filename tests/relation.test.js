import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/reader/parse/index.js';
import { answerRelation, answerWho } from '../src/answer/mechanical.js';
import { editWithin, fuzzyMatches, fuzzCeiling } from '../src/reader/parse/fuzzy.js';

// A relational "who" is a one-hop graph surf, not a definition lookup. The document
// logs the kinship as a typed CON edge (Gregor --sister--> Grete); the answer is the
// node on the other end. These pin the surf — and that it never mis-binds the phrase
// to the bare name inside it, the confidently-wrong path the old `answerWho` took.

const STORY =
  'Gregor Samsa woke transformed. His sister Grete brought a bowl of milk. ' +
  'Grete opened the window. The father drove Gregor back into the room.';

const apos = String.fromCharCode(39);

test('answerRelation surfs "who is X’s sister" to the graph edge, not X', () => {
  const doc = parseText(STORY, { docId: 'rel' });
  const a = answerRelation(doc, `who is gregor${apos}s sister`);
  assert.ok(a, 'a relational answer is produced');
  assert.equal(a.route, 'who');
  assert.match(a.text, /Grete/, 'the answer is the sister, Grete');
  assert.doesNotMatch(a.text, /salesman|transformed/, 'it is not Gregor’s own predicate');
  assert.ok(a.sources.length > 0 && Number.isInteger(a.sources[0]), 'the witnessing line is cited');
});

test('answerRelation reads the "sister of X" form too', () => {
  const doc = parseText(STORY, { docId: 'rel' });
  const a = answerRelation(doc, 'who is the sister of gregor');
  assert.ok(a && /Grete/.test(a.text), 'of-form resolves to Grete');
});

test('a CONJOINED relational who still surfs to the sister, not the bare name', () => {
  // The audit case: "who is gregor's sister AND what does she do in the story?" used to
  // fail answerRelation's end-anchored regex, fall through to answerWho, and bind the
  // whole phrase to Gregor (it CONTAINS "gregor") — answering with his own predicate.
  // The relation noun may now be followed by a conjoined clause; the surf fires.
  const doc = parseText(STORY, { docId: 'rel' });
  const a = answerRelation(doc, `who is gregor${apos}s sister and what does she do in the story?`);
  assert.ok(a, 'the conjoined question still produces a relational answer');
  assert.match(a.text, /Grete/, 'it surfs to the sister, Grete');
  assert.doesNotMatch(a.text, /transformed|salesman|milk/, 'never Gregor’s own predicate');
  // The of-form takes a trailing clause too, without truncating a multi-word owner.
  const b = answerRelation(doc, 'who is the sister of gregor and what does she do?');
  assert.ok(b && /Grete/.test(b.text), 'of-form + trailing clause resolves to Grete');
});

test('answerWho defers a possessive or run-on phrase instead of mis-binding the name inside it', () => {
  const doc = parseText(STORY, { docId: 'rel' });
  // answerWho is a BARE-NAME lookup. A possessive ("gregor's sister") and a long
  // run-on both merely contain an admitted name; binding the phrase to that name is the
  // confidently-wrong path. Both must defer (null) so the turn surfs or grounds instead.
  assert.equal(answerWho(doc, `who is gregor${apos}s sister and what does she do in the story?`), null);
  assert.equal(answerWho(doc, `who is gregor${apos}s sister`), null, 'a bare possessive is not a name');
});

test('answerRelation honours the gender split — a sister query never returns a brother', () => {
  const doc = parseText(STORY, { docId: 'rel' });
  // The document has only a sister edge; asking for a brother must defer (null),
  // not hand back Grete.
  assert.equal(answerRelation(doc, `who is gregor${apos}s brother`), null);
});

test('answerRelation reads a SYMMETRIC primitive in reverse for a genderless query', () => {
  const doc = parseText(STORY, { docId: 'rel' });
  // The edge is logged Gregor --sister--> Grete; sibling is symmetric, so Grete's
  // sibling is recoverable from the reverse, but only genderless (the noun on the
  // edge describes the owner, not the answer).
  const a = answerRelation(doc, `who is grete${apos}s sibling`);
  assert.ok(a && /Gregor/.test(a.text), 'symmetric reverse finds Gregor');
  // The gendered reverse cannot be verified and must defer.
  assert.equal(answerRelation(doc, `who is grete${apos}s brother`), null);
});

test('answerRelation defers on a non-relational who (let answerWho handle it)', () => {
  const doc = parseText('Gregor Samsa is a travelling salesman. Gregor waited.', { docId: 'rel' });
  assert.equal(answerRelation(doc, 'who is gregor'), null, 'plain who is not intercepted');
  assert.equal(answerRelation(doc, 'who is gregor samsa'), null);
  // And the plain-who path still answers it from the predicate.
  const w = answerWho(doc, 'who is gregor');
  assert.ok(w && /salesman/.test(w.text));
});

test('answerWho answers a clean nominal definition but defers on a copula-state fragment', () => {
  // A predicate nominative ("is a violinist") is a real "who is X" answer.
  const clean = parseText('Grete is a violinist. Grete practised daily. Grete smiled warmly.', { docId: 'wd1' });
  const w = answerWho(clean, 'who is grete');
  assert.ok(w && /violinist/.test(w.text), 'a predicate nominative answers mechanically');

  // But a transient state the copula happened to introduce ("was sleeping", "was
  // talking") is not a definition — answerWho defers (null) so the turn falls through
  // to the grounded, referent-centred reading instead of answering with a state.
  const messy = parseText('Grete entered quietly. Grete was sleeping in the cold. Grete was talking softly.', { docId: 'wd2' });
  assert.equal(answerWho(messy, 'who is grete'), null, 'a state fragment is not a definition — defer to grounded');
});

test('answerRelation defers on an untyped relation (outside the algebra)', () => {
  const doc = parseText(STORY, { docId: 'rel' });
  assert.equal(answerRelation(doc, `who is gregor${apos}s landlord`), null);
});

// ── the fuzzy primitive ────────────────────────────────────────────────────

test('editWithin is bounded and exact within the ceiling', () => {
  assert.equal(editWithin('greta', 'grete', 1), 1, 'one substitution');
  assert.equal(editWithin('zebras', 'apples', 1), 2, 'far apart → past the ceiling (maxDist+1)');
  assert.equal(editWithin('cat', 'cat', 0), 0, 'identical at ceiling 0');
});

test('fuzzCeiling keeps short tokens exact and lets longer ones drift', () => {
  assert.equal(fuzzCeiling(3), 0);
  assert.equal(fuzzCeiling(5), 1);
  assert.equal(fuzzCeiling(9), 2);
});

test('fuzzyMatches rescues an out-of-vocabulary term onto its near neighbour', () => {
  const vocab = new Set(['grete', 'gregor', 'milk', 'window']);
  assert.deepEqual(fuzzyMatches('grete', vocab), [{ token: 'grete', dist: 0 }], 'exact short-circuits');
  const greta = fuzzyMatches('greta', vocab);
  assert.deepEqual(greta, [{ token: 'grete', dist: 1 }], 'greta → grete at distance 1');
  assert.deepEqual(fuzzyMatches('zzzzz', vocab), [], 'nothing near → no phantom match');
});
