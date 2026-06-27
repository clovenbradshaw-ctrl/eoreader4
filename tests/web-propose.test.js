import { test } from 'node:test';
import assert from 'node:assert/strict';

import { proposeWebSearch, COST_NOTICE } from '../src/turn/propose.js';
import { runTurnWithWeb } from '../src/turn/web.js';
import { admitWebSource } from '../src/ingest/websource.js';

// "Search the internet to respond" actually firing (docs/web-search.md): the turn PROPOSES a
// query when the document can't close the gap (proposer-only — it never fetches), and a
// confirmed/auto go-ahead fetches+admits and re-runs with the web sources in scope.

// ── The proposer: a gap becomes a query, a sound turn proposes nothing ────────

test('a measured void proposes a web search; the question is the query', () => {
  const p = proposeWebSearch({ route: 'grounded', task: 'answer', question: 'how much was the fine?',
    voidMeasure: true, bound: [], vetoes: [] });
  assert.ok(p);
  assert.equal(p.query, 'how much was the fine?');
  assert.match(p.rationale, /does not cover/);
  assert.equal(p.cost, COST_NOTICE);
});

test('an answer bound to nothing proposes, sharpened with the figure the reading centres on', () => {
  const p = proposeWebSearch({
    route: 'grounded', task: 'answer', question: 'what is her name?',
    bound: [{ claim: 'She is kind.', citation: null, score: 0 }],   // unbound: uncited, no contact
    rawOutput: 'She is kind.', refTarget: { label: 'Grete' }, vetoes: [],
  });
  assert.ok(p);
  assert.match(p.query, /what is her name\? Grete/);
});

test('a well-grounded turn proposes nothing; a whole-doc task never proposes', () => {
  assert.equal(proposeWebSearch({ route: 'grounded', task: 'answer', question: 'q',
    bound: [{ claim: 'a', citation: 's0' }], rawOutput: 'a', vetoes: [] }), null);
  assert.equal(proposeWebSearch({ route: 'grounded', task: 'summary', question: 'summarize',
    voidMeasure: true, bound: [], vetoes: [] }), null);          // summary gaps are not lookups
  assert.equal(proposeWebSearch({ route: 'chat', task: 'answer', question: 'hi', bound: [], vetoes: [] }), null);
});

test('low-coverage alone proposes (few claims grounded)', () => {
  const p = proposeWebSearch({ route: 'grounded', task: 'answer', question: 'what happened?',
    bound: [{ citation: 's0' }, { citation: null }], rawOutput: 'a lot happened across the report',
    vetoes: [{ id: 'low-coverage' }] });
  assert.ok(p && /few of the claims/.test(p.rationale));
});

// ── The orchestration: confirm / auto / proposer-only, with injected runTurn ──

const groundedDoc = (text) => admitWebSource({ url: 'https://w/x', text }).doc;

// A fake runTurn: first call returns a turn with a proposal; the re-run (docs grew) returns a
// grounded answer. Records what scope each call saw.
const fakeRunner = () => {
  const calls = [];
  const impl = async (args) => {
    calls.push(args);
    if (calls.length === 1) return { answer: 'I did not find it.', webProposal: { query: 'grete samsa', rationale: 'void', cost: COST_NOTICE }, flags: [] };
    return { answer: 'Her name is Grete.', webProposal: null, flags: [], sources: [0] };
  };
  return { impl, calls };
};

test('auto mode: a proposal is fetched, admitted, and the turn re-runs with the web sources in scope', async () => {
  const { impl, calls } = fakeRunner();
  let searched = null;
  const webSearch = async (q) => { searched = q; return [{ doc: groundedDoc('His sister was named Grete.') }]; };
  const out = await runTurnWithWeb({ question: 'what is her name?', docs: [] },
    { mode: 'auto', webSearch, runTurnImpl: impl });
  assert.equal(searched, 'grete samsa', 'the proposed query was searched');
  assert.equal(out.answer, 'Her name is Grete.', 'the re-run answer is returned');
  assert.equal(out.webFetched.results, 1);
  assert.equal(calls.length, 2, 're-ran once with the web source');
  assert.equal(calls[1].docs.length, 1, 'the web doc joined the scope');
});

test('confirm mode: nothing is fetched without a go-ahead (proposer-only)', async () => {
  let fetched = false;
  const webSearch = async () => { fetched = true; return [{ doc: groundedDoc('x') }]; };

  const r1 = fakeRunner();
  const declined = await runTurnWithWeb({ question: 'q', docs: [] },
    { mode: 'confirm', confirm: () => false, webSearch, runTurnImpl: r1.impl });
  assert.equal(fetched, false, 'declined → no network');
  assert.equal(declined.answer, 'I did not find it.', 'the first answer stands');
  assert.equal(r1.calls.length, 1);

  const r2 = fakeRunner();
  const approved = await runTurnWithWeb({ question: 'q', docs: [] },
    { mode: 'confirm', confirm: () => true, webSearch, runTurnImpl: r2.impl });
  assert.equal(fetched, true, 'approved → fetched');
  assert.equal(approved.answer, 'Her name is Grete.');
});

test('off mode (and a no-proposal turn) never reach for the net', async () => {
  const { impl } = fakeRunner();
  let fetched = false;
  const webSearch = async () => { fetched = true; return []; };
  const off = await runTurnWithWeb({ question: 'q', docs: [] }, { mode: 'off', webSearch, runTurnImpl: impl });
  assert.equal(fetched, false);
  assert.equal(off.answer, 'I did not find it.');
});
