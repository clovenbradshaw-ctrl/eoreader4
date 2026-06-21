import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ingestText } from '../src/organs/in/index.js';
import { buildMoveLog } from '../src/predict/index.js';
import { defaultCursor, postRow, chip } from '../src/ui/predict-view.js';

// The predict view's pure, DOM-free surface — the part CI covers without a browser
// (the same convention as feed-view's feedHolons / log-view's argspanDesc). The
// mount/render/scrub wiring is verified against jsdom out of band; the predictor
// itself is covered in predict.test.js.

const text = readFileSync(new URL('../data/esker.txt', import.meta.url), 'utf8');
const doc = await ingestText(text, {});
const ml = buildMoveLog(doc);

test('defaultCursor opens on the move just before the strongest-strain break', () => {
  const c = defaultCursor(ml);
  const next = ml.moves[c + 1];
  assert.equal(next.op, 'REC', 'the cursor sits one move before a REC');
  // and it is the strongest break — no other REC sits on a higher-strain unit.
  const breaks = ml.moves.filter(m => m.op === 'REC' && m.i > 0);
  const maxRatio = Math.max(...breaks.map(b => ml.frameByCursor[b.cursor].ratio));
  assert.equal(ml.frameByCursor[next.cursor].ratio, maxRatio, 'it is the highest-strain break');
});

test('defaultCursor falls back to 0 when there is no break', () => {
  assert.equal(defaultCursor({ moves: [{ op: 'INS', cursor: 0, i: 0 }], frameByCursor: [{ ratio: 0 }] }), 0);
});

test('postRow marks the actual next move and scales its bar', () => {
  const hit = postRow('REC', 0.9, 'REC');
  assert.match(hit, /class="pv-post-row is-actual"/, 'the actual move row is marked');
  assert.match(hit, /<span class="op REC">REC<\/span>/, 'the operator chip is rendered');
  assert.match(hit, /width:90%/, 'the bar scales with probability');
  const miss = postRow('INS', 0.1, 'REC');
  assert.doesNotMatch(miss, /is-actual/, 'a non-actual row is not marked');
});

test('chip renders the operator with the EVA verdict sign and register mark', () => {
  const strain = chip({ op: 'EVA', verdict: 'strain', register: 'enacted', site: { domain: 'Interpretation' }, resolution: { grain: 'Figure' } });
  assert.match(strain, />EVA−</, 'a straining EVA shows the − sign');
  assert.match(strain, /pv-en/, 'an enacted move carries the register mark');
  const confirm = chip({ op: 'EVA', verdict: 'confirm', register: 'enacted', site: { domain: 'Interpretation' }, resolution: { grain: 'Figure' } });
  assert.match(confirm, />EVA\+</, 'a confirming EVA shows the + sign');
  const ins = chip({ op: 'INS', register: 'content', site: { domain: 'Existence' }, resolution: { grain: 'Ground' } }, true);
  assert.match(ins, /op INS pv-cur/, 'the current move is highlighted');
  assert.doesNotMatch(ins, /pv-en/, 'a content move has no enacted mark');
});
