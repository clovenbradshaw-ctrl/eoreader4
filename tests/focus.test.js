import { test } from 'node:test';
import assert from 'node:assert/strict';

import { needsContext, conversationalFocus, resolveRetrievalQuery, contentWords }
  from '../src/converse/focus.js';

// The audit's failure: a grounded follow-up retrieved on its literal words. "now?"
// found sentences containing "now"; "answer my first question" found nothing about the
// first question. These lock in the resolution — lean on the conversation when the
// question can't stand alone, pass a self-contained question through untouched.

test('contentWords keeps topic tokens and drops stop / deictic words', () => {
  assert.deepEqual(contentWords('who is grete?'), ['grete']);
  assert.deepEqual(contentWords('now?'), []);              // a pure deictic carries no topic
  assert.deepEqual(contentWords('go on then'), []);
  assert.deepEqual(contentWords("What is Gregor's job?"), ['gregor', 'job']);
});

test('needsContext: a self-contained question stands alone; a thin / self-referential one leans', () => {
  assert.equal(needsContext("What is Gregor's job?"), false);
  assert.equal(needsContext('who is grete?'), false);
  assert.equal(needsContext('now?'), true);
  assert.equal(needsContext('why?'), true);
  assert.equal(needsContext('what about her?'), true);
  assert.equal(needsContext('go on'), true);
  assert.equal(needsContext('i wanted you to answer my first question'), true);
  assert.equal(needsContext('you said something earlier'), true);
});

test('conversationalFocus pulls topic terms from the USER side, newest first, dropping deictics', () => {
  const history = [
    { role: 'user',      content: 'who is grete?' },
    { role: 'assistant', content: "The document doesn't cover that." },
    { role: 'user',      content: 'now?' },
  ];
  const focus = conversationalFocus(history);
  assert.ok(focus.includes('grete'), 'carries the salient noun from an earlier user turn');
  assert.ok(!focus.includes('now'), 'a deictic-only turn contributes no topic');
  assert.ok(!focus.some(t => /cover|document/.test(t)), "the talker's answers are never a source");
});

test('resolveRetrievalQuery augments a follow-up but leaves a strong query untouched', () => {
  const history = [{ role: 'user', content: 'who is grete?' }];
  assert.equal(
    resolveRetrievalQuery("What is Gregor's job?", history),
    "What is Gregor's job?",
    'a self-contained question is never polluted with stale topic',
  );
  const resolved = resolveRetrievalQuery('now?', history);
  assert.match(resolved, /grete/, 'a thin follow-up retrieves on the conversation topic');
  assert.match(resolved, /now/,   'the original question is preserved, not replaced');
});

test('resolveRetrievalQuery with no usable history returns the question unchanged', () => {
  assert.equal(resolveRetrievalQuery('now?', []), 'now?');
  assert.equal(resolveRetrievalQuery('now?', [{ role: 'assistant', content: 'hi' }]), 'now?');
});

// The "who is Monk?" failure (eoreader4 audit): a follow-up that referred to the
// musician only by a dangling pronoun ("but what is his name?") or a correction
// ("no the musician") re-anchored retrieval on its literal words and drifted to
// "His name is Curtis Yarvin" / "Old Oedipus". A pronoun with no antecedent, and a
// correction redirecting the last question, must lean on the conversation so the
// embedding retrieval rides the referent the prior turn established.
test('a dangling third-person pronoun leans on the conversation', () => {
  assert.equal(needsContext('but what is his name?'), true);
  assert.equal(needsContext("what's her job?"), true);
  assert.equal(needsContext('what does he do?'), true);
  // a pronoun ALONGSIDE a real topic still stands on its own — not every "his" leans
  assert.equal(needsContext('is his Yellowstone theory right?'), false);
});

test('a correction / redirect opener leans only when it carries no strong query', () => {
  assert.equal(needsContext('no the musician'), true);
  assert.equal(needsContext('actually the pianist'), true);
  assert.equal(needsContext('no, summarize chapter three'), false);   // a real standalone is never polluted
});

test('the musician follow-ups carry the prior topic into the retrieval query', () => {
  // The turn before asked "who is the musician?"; the embedding query for the
  // follow-up must now ride "musician" rather than the bare "name".
  const history = [
    { role: 'user',      content: 'who is the musician?' },
    { role: 'assistant', content: 'An American jazz player.' },
  ];
  assert.match(resolveRetrievalQuery('but what is his name?', history), /musician/);
  assert.match(resolveRetrievalQuery('but what is his name?', history), /name/);  // own words kept
  assert.match(resolveRetrievalQuery('no the musician', history), /musician/);
});
