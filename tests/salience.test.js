import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseText } from '../src/perceiver/parse/index.js';
import { surfFold, threadBasis, bornSalience, figureSalience, salienceField } from '../src/surfer/index.js';

// Salience by the Born rule against the activated conversation thread. The thread is a state
// |T⟩ over terms (and the figures those terms name); a span's salience is |⟨T|s⟩|². The same
// noise null that decides structure decides where the surfer's return stops being salient —
// only the basis differs (the document's surprise for structure, the thread for salience).

test('threadBasis is the whole activated thread — prompt AND recent turns, not just the prompt', () => {
  const b = threadBasis({
    query: 'and now?',
    history: [{ role: 'user', content: 'tell me about Grete' }, { role: 'assistant', content: '...' }],
  });
  assert.ok(b.terms.has('now'), 'the prompt is in the basis');
  assert.ok(b.terms.has('grete'), 'a recent USER turn is in the basis (the live thread, not just the last message)');
});

test('threadBasis resolves the thread FIGURES against the doc, possessive-tolerant', () => {
  const doc = parseText('Gregor saw Grete. Grete fed Gregor.', { docId: 'd' });
  const b = threadBasis({ query: "How does Grete's feeling toward Gregor change?", doc });
  assert.ok(b.figures.has('grete'), "Grete's (possessive) still activates the figure Grete");
  assert.ok(b.figures.has('gregor'), 'Gregor is on the thread');
});

test('bornSalience is the squared term overlap — a span off the thread scores ~0', () => {
  const b = threadBasis({ query: 'Grete milk' });
  const on  = bornSalience(b.terms, new Set(['grete', 'milk', 'brought']));
  const off = bornSalience(b.terms, new Set(['clock', 'train', 'window']));
  assert.ok(on > 0, 'a span using the thread words is salient');
  assert.equal(off, 0, 'a span sharing no thread word is not');
});

test('the figure channel survives coref — a span about the figure by description is salient', () => {
  // "the creature" names no thread word, but the surfer resolves it to Gregor, so the figure
  // channel makes it salient to a thread about Gregor where the lexical channel cannot.
  const thread = new Set(['gregor samsa']);
  assert.ok(figureSalience(thread, ['Gregor Samsa', 'Grete']) > 0, 'a coref-resolved figure match is salient');
  assert.equal(figureSalience(thread, ['Klamm']), 0, 'a figure off the thread is not');
});

test('thread conditioning keeps the coref reversal a lexical basis would drop (Metamorphosis)', () => {
  // s30 — "Grete turned to her parents and said the creature must go" — is the story's turn.
  // It names "Grete" but not "Gregor"; it is ABOUT Gregor only by coref ("the creature"). The
  // figure channel (the surfer's resolved field) keeps it salient; the term channel cannot.
  const doc = parseText(readFileSync('data/metamorphosis.txt', 'utf8'), { docId: 'm', genderCoref: true });
  const thread = threadBasis({ query: "How does Grete's feeling toward Gregor change over the story?", doc });

  // term-only salience over s30 is weak (it shares no figure NAME with much of the thread);
  // the figure channel lifts it, because s30's resolved field carries Gregor.
  const termOnly = salienceField(doc, thread)[30];
  const figured = figureSalience(thread.figures, ['Gregor Samsa', 'Grete']);   // s30's resolved figures
  assert.ok(figured > termOnly, 'the figure channel scores the coref turn above its bare lexical overlap');

  const salient = surfFold(doc, 11, { reach: 'adaptive', thread });
  assert.ok(salient.stops.includes(30), 'the reversal ("the creature must go") stays among the salient stops');
});

test('no thread → the surf is byte-identical (salience is opt-in)', () => {
  const doc = parseText('Gregor saw Grete. Grete fed Gregor. The father struck Gregor.', { docId: 'p' });
  const a = surfFold(doc, 0);
  const b = surfFold(doc, 0, {});                     // no thread
  assert.deepEqual(a.stops, b.stops);
  assert.equal(a.rode, b.rode);
});
