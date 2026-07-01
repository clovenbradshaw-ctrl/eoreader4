import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/perceiver/parse/index.js';
import { surfFold } from '../src/surfer/index.js';
import {
  summarizeSurf, classifyStops, turnsWithSurf,
  surfSummaryHtml, fieldStripHtml, stopsHtml, significanceHtml,
} from '../src/ui/surfer-view.js';

// The Surfer view's pure, DOM-free surface — the part CI covers without a browser (the
// same convention as replay-view's buildBeats / predict-view's defaultCursor). The
// reading register reads off surfFold; the chat register reads off the recorded audit.
// The mount/scrub wiring is exercised against a browser out of band.

const STORY = 'Grete Vale entered. Grete sat. Grete read. Gregor Pike arrived. ' +
              'Gregor coughed. Gregor waited. Otto Stein knocked. Otto left. ' +
              'Otto returned. Mara Cole spoke. Mara left.';
const doc = parseText(STORY, { docId: 's' });
const surf = surfFold(doc, 3);

test('summarizeSurf reads the axes and the reach off a real surf', () => {
  const sum = summarizeSurf(surf);
  assert.equal(sum.anchor, surf.anchor);
  assert.equal(sum.peak, surf.peak);
  assert.equal(sum.rode, surf.rode);
  assert.equal(sum.stops, surf.stops.length);
  assert.ok(sum.reachLo <= sum.anchor && sum.anchor <= sum.reachHi, 'the anchor sits inside the reach');
  // The peak's significance is read off the field cell at the peak.
  const peakCell = surf.field.find(f => f.idx === surf.peak);
  assert.equal(sum.peakBayes, peakCell ? peakCell.bayes : null);
});

test('classifyStops names every stop, anchor and frame-breaks taking precedence', () => {
  const rows = classifyStops(surf);
  assert.equal(rows.length, surf.stops.length, 'one row per stop');
  // Reading order.
  const idxs = rows.map(r => r.idx);
  assert.deepEqual(idxs, [...idxs].sort((a, b) => a - b), 'stops are in reading order');
  // The anchor is always classified as the anchor.
  assert.equal(rows.find(r => r.idx === surf.anchor).reason, 'anchor');
  // Every recorded frame-break (that is not the anchor) is a frame-break.
  for (const c of surf.recCursors) {
    if (c === surf.anchor) continue;
    assert.equal(rows.find(r => r.idx === c)?.reason, 'frame-break', `L${c} broke a frame`);
  }
  // Every reason is one of the three the surfer arrests for.
  for (const r of rows) assert.ok(['anchor', 'frame-break', 'surprise-peak'].includes(r.reason));
});

test('turnsWithSurf reads the surf and the significance column off recorded turns, newest first', () => {
  const turns = [
    { id: 't1', question: 'first', reading: { surf: { anchor: 0, peak: 2, stops: [0, 2], recCursors: [], rode: 'bayesian-figure', field: [] } },
      steps: [{ name: 'fold', data: { surf: { focus: 'Grete', lensEntropy: 0.4, lenses: 1, stance: { op: 'DEF', stance: 'Making', firmness: 0.8, guard: 'clear' } } } }] },
    { id: 't2', question: 'no surf here', reading: null, steps: [] },
    { id: 't3', question: 'second', reading: { surf: { anchor: 5, peak: 7, stops: [5, 7], recCursors: [7], rode: 'bayesian-void', field: [] } }, steps: [] },
  ];
  const out = turnsWithSurf(turns);
  assert.equal(out.length, 2, 'only turns that ran a surf are kept');
  assert.deepEqual(out.map(t => t.id), ['t3', 't1'], 'newest first');
  // The fold step's focus is merged onto the surf; its significance column is carried.
  const first = out.find(t => t.id === 't1');
  assert.equal(first.surf.focus, 'Grete');
  assert.ok(first.sig && first.sig.stance.op === 'DEF', 'the significance column rode');
  // A turn whose fold recorded no meaning column carries sig === null.
  assert.equal(out.find(t => t.id === 't3').sig, null);
});

test('turnsWithSurf accepts the audit log object as well as a bare array', () => {
  const turns = [{ id: 'tA', question: 'q', reading: { surf: { anchor: 1, peak: 1, stops: [1], recCursors: [], rode: 'bayesian-figure', field: [] } }, steps: [] }];
  assert.equal(turnsWithSurf({ turns }).length, 1, 'reads .turns off the log object');
  assert.equal(turnsWithSurf([]).length, 0, 'an empty history is empty');
  assert.equal(turnsWithSurf(undefined).length, 0, 'a missing audit is empty, not a throw');
});

test('the HTML builders mark the peak, badge the arrests, and never leak markup', () => {
  const sum = summarizeSurf(surf);
  const html = surfSummaryHtml(sum) + fieldStripHtml(surf) + stopsHtml(surf, doc.sentences);
  assert.match(html, /peak L/, 'the peak is named');
  assert.match(html, /data-anchor="/, 'field cells re-anchor the surf');
  assert.match(html, /data-idx="/, 'stops cite back into the document');
  assert.match(html, new RegExp(`L${surf.anchor}`), 'the anchor line is shown');

  // A stop whose line contains markup is escaped when rendered.
  const evil = { anchor: 0, peak: 0, stops: [0], recCursors: [], rode: 'bayesian-figure',
    field: [{ idx: 0, focus: 'x', bayes: 0.3, surprisalBits: 1 }] };
  const row = stopsHtml(evil, ['<script>alert(1)</script>']);
  assert.doesNotMatch(row, /<script>/, 'angle brackets in the line are escaped');
  assert.match(row, /&lt;script&gt;/, 'the escaped form is present');
});

test('significanceHtml renders the column when it rode and nothing when it did not', () => {
  assert.equal(significanceHtml(null), '', 'no column → no block');
  const html = significanceHtml({ atmosphere: { tone: 'grave', verdict: 'departed', departure: 0.12 },
    lensEntropy: 0.5, lenses: 2, paradigm: 'under-read', stance: { op: 'DEF', stance: 'Making', firmness: 0.7, guard: 'clear' } });
  assert.match(html, /atmosphere/);
  assert.match(html, /entropy 0\.500/);
  assert.match(html, /under-read/);
  assert.match(html, /firmness 0\.70/);
});
