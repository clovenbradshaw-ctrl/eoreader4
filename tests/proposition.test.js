import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseText, positionElements, argumentSpansHold, SVO_EXTRACTOR,
} from '../src/parse/index.js';
import { projectGraph } from '../src/core/index.js';

const argspans = (doc) => doc.log.filter(e => e.op === 'SEG' && e.kind === 'argspan');
const cons     = (doc) => doc.log.filter(e => e.op === 'CON');

// §3, §8 — argument-span extraction emits a logged clause SEG BEFORE the bond.
test('the SVO parse logs an argument-span SEG before the CON', () => {
  const doc = parseText('Grete Vale greeted Gregor Pike.', { docId: 'p' });
  const seg = argspans(doc);
  assert.equal(seg.length, 1, 'one argument-span SEG for the one bond');
  const con = cons(doc).find(c => c.src === 'grete-vale' && c.tgt === 'gregor-pike');
  assert.ok(con, 'the bond still fires');
  assert.equal(con.via, 'greeted');
  assert.equal(con.seq, seg[0].seq + 1, 'the SEG is written before the bond');
  assert.equal(con.argspan, seg[0].seq, 'the bond references the SEG it was read from');
});

// §3 — the argument-span SEG is a perception: witnessed by the extractor, with confidence.
test('the argument-span SEG is a perception — reader and confidence, not a fact', () => {
  const doc = parseText('Grete Vale greeted Gregor Pike.', { docId: 'p' });
  const seg = argspans(doc)[0];
  assert.equal(seg.kind, 'argspan');
  assert.equal(seg.reader, SVO_EXTRACTOR, 'witnessed by the extractor that produced it');
  assert.ok(typeof seg.confidence === 'number' && seg.confidence > 0, 'carries the extractor confidence');
  assert.equal(seg.depicts, 'CON', 'records the bond it feeds');
});

// §3, §8 — the spans walk back to the verbatim text by offset (the witness chain).
test('the argument spans walk back to the verbatim text by offset', () => {
  const doc = parseText('Grete Vale greeted Gregor Pike.', { docId: 'p' });
  const seg = argspans(doc)[0];
  const sentence = doc.sentences[seg.sentIdx];
  assert.equal(sentence.slice(seg.subject.start, seg.subject.end), 'Grete Vale');
  assert.equal(sentence.slice(seg.verb.start, seg.verb.end), 'greeted');
  assert.equal(sentence.slice(seg.object.start, seg.object.end), 'Gregor Pike');
  assert.ok(argumentSpansHold(seg, sentence), 'every span slices to its stored text');
  // Tamper with an offset and the chain no longer holds.
  assert.ok(!argumentSpansHold({ ...seg, subject: { ...seg.subject, end: seg.subject.end + 3 } }, sentence));
});

// §1, §8 — the two senses of span are distinct: an argument span is sub-clause.
test('an argument span is a sub-clause stretch, not the whole sentence', () => {
  const doc = parseText('Grete Vale greeted Gregor Pike.', { docId: 'p' });
  const seg = argspans(doc)[0];
  const len = doc.sentences[seg.sentIdx].length;
  assert.ok(seg.object.start > 0 && seg.object.end <= len, 'the object span is interior to the sentence');
  assert.ok(seg.subject.end < seg.object.start, 'subject and object are disjoint stretches');
  assert.ok(seg.object.end - seg.object.start < len, 'the argument span is shorter than the retrieval unit');
});

// §4 Step C, §5, §8 — positioning is structural; cells are held at no-commit.
test('positionElements assigns by structure and holds the cells at no-commit', () => {
  const doc = parseText('Grete Vale greeted Gregor Pike.', { docId: 'p' });
  const seg = argspans(doc)[0];
  const p = positionElements(seg, { op: seg.depicts });
  assert.equal(p.assigned_by, 'structure', 'the positions are grammar, not measurement');
  assert.deepEqual(p.ground.elements.map(e => e.id), ['grete-vale', 'gregor-pike'],
    'subject and object are the grounded existents (Ground)');
  assert.equal(p.figure.elements[0].text, 'greeted', 'the verb is the act foregrounded (Figure)');
  assert.equal(p.pattern.elements[0].op, 'CON', 'the relation is the bond (Pattern)');
  // The Pattern points at a verbatim span of the original line — the subject…object
  // stretch — not a synthesized label. Its offsets slice back to the stored text.
  const span = p.pattern.elements[0].span;
  assert.equal(p.pattern.elements[0].relation, 'Grete Vale greeted Gregor Pike', 'the verbatim relation span');
  assert.equal(doc.sentences[seg.sentIdx].slice(span.start, span.end), span.text, 'the span slices back to the line');
  // The lane: every cell is held at no-commit — geometry names them only when live.
  for (const pos of [p.ground, p.figure, p.pattern]) {
    assert.equal(pos.cell, null, 'cell-naming is meaning-only — no-commit under the hash organ');
  }
});

// §3 — the relation span is a first-class argument span: verbatim, with offsets, and
// it walks back to the line by the same witness chain the other three spans do.
test('the relation span is logged verbatim and walks back to the line', () => {
  const doc = parseText('Grete Vale greeted Gregor Pike.', { docId: 'p' });
  const seg = argspans(doc)[0];
  const sentence = doc.sentences[seg.sentIdx];
  assert.ok(seg.relation, 'the SEG carries the relation span');
  assert.equal(sentence.slice(seg.relation.start, seg.relation.end), 'Grete Vale greeted Gregor Pike');
  assert.ok(argumentSpansHold(seg, sentence), 'the relation span holds with the others');
  // Tamper with the relation offset and the chain no longer holds.
  assert.ok(!argumentSpansHold({ ...seg, relation: { ...seg.relation, end: seg.relation.end + 3 } }, sentence));
});

// §8 — speech routes to SIG and still logs its argument spans.
test('a speech verb logs an argument-span SEG depicting SIG', () => {
  const doc = parseText('Grete Vale told Gregor Pike.', { docId: 'p' });
  const seg = argspans(doc)[0];
  assert.ok(seg, 'speech still cuts argument spans');
  assert.equal(seg.depicts, 'SIG', 'the bond it feeds is an attribution');
  assert.equal(seg.verb.text, 'told');
});

// §2 (scope) — a copular DEF is node-shaped, not S-V-O; it logs no argument-span SEG.
test('a copular DEF is not an SVO bond and logs no argument-span SEG', () => {
  const doc = parseText('Grete Vale is here. Grete Vale is here.', { docId: 'p' });
  assert.ok(doc.log.filter(e => e.op === 'DEF' && e.key === 'predicate').length >= 1, 'the DEF fires');
  assert.equal(argspans(doc).length, 0, 'no argument-span SEG for a node-shaped assertion');
});

// §8 — the logged SEG is inert to the projection: it adds no edge and retracts nothing.
test('the argument-span SEG does not perturb the graph projection', () => {
  const doc = parseText('Grete Vale greeted Gregor Pike.', { docId: 'p' });
  const g = projectGraph(doc.log, {});
  assert.equal(g.edges.length, 1, 'one bond, the SEG adds no edge');
  assert.ok(g.entities.has('grete-vale') && g.entities.has('gregor-pike'),
    'both endpoints survive — the SEG retracts nothing');
});

// The headVerb offset extension stays backward-compatible for its other consumer.
test('headVerb still reports verb/rest/copular and now the offsets too', async () => {
  const { headVerb } = await import('../src/parse/relations.js');
  const h = headVerb(' greeted Gregor Pike.');
  assert.equal(h.verb, 'greeted');
  assert.equal(h.copular, false);
  assert.equal(' greeted Gregor Pike.'.slice(h.at, h.restStart), 'greeted', 'at/restStart frame the verb');
});
