import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPropositions } from '../src/ui/chat.js';

// The transparency view's data model (docs/web-search.md): every proposition the answer makes,
// paired with the source it cited — or marked unsupported / inaccurate by the fact-check. The
// builder is pure; this pins the mapping without the DOM.

test('a grounded claim is tied to the source it cited', () => {
  const res = {
    route: 'grounded',
    bound: [
      { claim: 'Ryan Coogler is developing an X-Files reboot.', citation: 's3' },
      { claim: 'He also directed Black Panther.', citation: null },
    ],
    verdicts: [],
  };
  const sources = { 3: { label: 'Ryan Coogler', url: 'https://en.wikipedia.org/wiki/Ryan_Coogler' } };
  const props = buildPropositions(res, sources);
  assert.equal(props.length, 2);
  assert.equal(props[0].status, 'grounded');
  assert.equal(props[0].source.url, 'https://en.wikipedia.org/wiki/Ryan_Coogler');
  assert.equal(props[1].status, 'ungrounded', 'a claim that cited nothing is flagged not-in-sources');
  assert.equal(props[1].source, null);
});

test('a contradicted verdict marks its claim inaccurate', () => {
  const res = {
    route: 'grounded',
    bound: [{ claim: 'The series premiered in 2018 on Paramount.', citation: null }],
    verdicts: [{ sentence: 'series premiered Paramount', verdict: 'contradicted', reason: 'voided' }],
  };
  const props = buildPropositions(res, {});
  assert.equal(props[0].status, 'inaccurate');
  assert.equal(props[0].reason, 'voided');
});

test('a corroborated verdict upgrades an uncited claim and lends it the source', () => {
  const res = {
    route: 'grounded',
    bound: [{ claim: 'Coogler produced Sinners.', citation: null }],
    verdicts: [{ sentence: 'Coogler produced Sinners', verdict: 'corroborated', citation: 's5' }],
  };
  const props = buildPropositions(res, { 5: { label: 'Sinners (film)', url: 'https://x/Sinners' } });
  assert.equal(props[0].status, 'grounded');
  assert.equal(props[0].source.url, 'https://x/Sinners');
});

test('a chat-route answer is marked general knowledge, not grounded', () => {
  const res = {
    route: 'chat',
    bound: [{ claim: 'The X-Files first aired in 1993.', citation: null }],
    verdicts: [],
  };
  const props = buildPropositions(res, {});
  assert.equal(props[0].status, 'general');
});

test('empty bound yields no propositions', () => {
  assert.deepEqual(buildPropositions({ route: 'grounded', bound: [], verdicts: [] }, {}), []);
});
