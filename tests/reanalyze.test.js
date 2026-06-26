import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/perceiver/parse/index.js';
import { reanalyze } from '../src/surfer/index.js';

// Bond-level reanalysis: the garden-path recovery as the surprisal → re-retrieve →
// reconsolidate loop, one level below the basis REC. Composes the verb oracle, γ-recency
// re-retrieval, and a logged REC; the mis-bond stays on the append-only trail (auditable).

const isVerb = (w) => ['fell', 'rose', 'ran', 'raced', 'sank', 'stopped', 'died'].includes(w);

test('the garden path is detected by its surprisal: a verb in the object slot', () => {
  const doc = parseText('Beauty ran past the barn fell.', { docId: 'g' });
  const r = reanalyze(doc, { isVerb });
  assert.equal(r.count, 1, 'one reanalysis');
  assert.deepEqual(r.reanalyses[0].trigger, { kind: 'predicate-in-object-slot', verb: 'fell', of: 'ran' });
});

test('reanalysis reconsolidates: supersede the mis-bond, form subject+orphaned-verb, demote the original', () => {
  const doc = parseText('Beauty ran past the barn fell.', { docId: 'g' });
  const a = reanalyze(doc, { isVerb }).reanalyses[0];
  assert.deepEqual(a.superseded, { src: 'beauty', via: 'ran', tgt: 'fell' });
  assert.deepEqual(a.formed, { src: 'beauty', via: 'fell' }, 'orphaned verb becomes the main predicate');
  assert.equal(a.demoted.modifierOf, 'beauty', 'the original verb is demoted to a modifier');
});

test('the reconsolidation is an auditable REC event (the mis-bond is left on the trail, not deleted)', () => {
  const doc = parseText('Beauty ran past the barn fell.', { docId: 'g' });
  const before = doc.log.snapshot().filter(e => e.op === 'CON' || e.op === 'SIG').length;
  const a = reanalyze(doc, { isVerb }).reanalyses[0];
  assert.equal(a.rec.op, 'REC');
  assert.equal(a.rec.kind, 'reanalysis');
  assert.ok(a.rec.supersedes && a.rec.forms, 'the event records what dissolved and what formed');
  // reanalyze is pure — it does not mutate the log; the mis-bond is still there to audit
  const after = doc.log.snapshot().filter(e => e.op === 'CON' || e.op === 'SIG').length;
  assert.equal(after, before, 'append-only: the trail is unchanged unless the caller appends the REC');
});

test('no false reanalysis: a real entity in the object slot is not a garden path', () => {
  const doc = parseText('Beauty saw Grete.', { docId: 'c' });
  assert.equal(reanalyze(doc, { isVerb }).count, 0, 'an entity object is fine — no spurious reanalysis');
});

test('re-retrieval is γ-recency: the orphaned verb takes the most recently available subject', () => {
  const doc = parseText('Anna saw Ben. Beauty ran past the barn fell.', { docId: 'g' });
  const a = reanalyze(doc, { isVerb }).reanalyses.find(x => x.trigger.verb === 'fell');
  assert.ok(a, 'the garden path in the second sentence is found');
  assert.equal(a.rec.subjectReretrieved, 'beauty', 'the most recent entity is re-retrieved as subject');
});
