import { test } from 'node:test';
import assert from 'node:assert/strict';
import { citeSpansOf } from '../src/turn/pipeline.js';
import { buildPropositions } from '../src/ui/chat.js';

// Per-claim PROVENANCE: each cited [sN] resolves to the verbatim sentence it was bound to, so the
// transparency view can show the actual span behind every claim — "where it's coming from", not
// just a pointer. citeSpansOf reads that text off the spans the binder saw.

test('citeSpansOf maps each cited index to its span text', () => {
  const spans = [
    { idx: 3, text: 'Ryan Coogler is developing an X-Files reboot.' },
    { idx: 7, text: 'He also directed Black Panther.' },
    { idx: 9, text: 'An uncited span.' },
  ];
  const out = citeSpansOf([3, 7], spans);
  assert.equal(out[3], 'Ryan Coogler is developing an X-Files reboot.');
  assert.equal(out[7], 'He also directed Black Panther.');
  assert.equal(out[9], undefined, 'an uncited span is not included');
});

test('citeSpansOf collapses whitespace and caps long spans with an ellipsis', () => {
  const long = 'word '.repeat(80).trim();           // ~400 chars
  const out = citeSpansOf([1, 2], [
    { idx: 1, text: 'a\n  multiline\tspan' },
    { idx: 2, text: long },
  ]);
  assert.equal(out[1], 'a multiline span');
  assert.ok(out[2].length <= 241 && out[2].endsWith('…'), 'capped and ellipsized');
});

test('citeSpansOf is empty when there are no spans or no cited indices', () => {
  assert.deepEqual(citeSpansOf([3], []), {});
  assert.deepEqual(citeSpansOf([], [{ idx: 3, text: 'x' }]), {});
});

test('the span text flows onto each proposition as source.text', () => {
  const res = {
    route: 'grounded',
    bound: [{ claim: 'Coogler is developing an X-Files reboot.', citation: 's3' }],
    verdicts: [],
  };
  // citationSources carries the span text (merged in app.js from res.citeSpans).
  const sources = { 3: { label: 'notes.txt', url: '', text: 'Ryan Coogler is developing an X-Files reboot.' } };
  const props = buildPropositions(res, sources);
  assert.equal(props[0].source.text, 'Ryan Coogler is developing an X-Files reboot.');
});
