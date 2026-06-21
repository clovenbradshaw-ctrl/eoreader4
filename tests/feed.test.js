import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/perceiver/parse/index.js';
import { buildFeed } from '../src/turn/index.js';
import { feedHolons } from '../src/ui/feed-view.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';
import { EXCERPTS_HEADER } from '../src/model/prompt.js';

// parseText alone doesn't attach the lazy embedding cache (ingestText does), so
// mirror it here — retrieveSemantic reads doc.sentenceEmbeddings(embedder).
const setup = (text) => {
  const doc = parseText(text, { docId: 'feed.txt' });
  let p = null;
  doc.sentenceEmbeddings = async (e) => (p ??= Promise.all(doc.sentences.map(s => e.embed(s))));
  return doc;
};

// The probe IS the turn pipeline minus the model: a grounded message comes back
// with the retrieved spans, the folded note (carrying the structure surface the
// holons are shaped from) and the verbatim prompt that would be handed over.
test('buildFeed assembles the grounded model feed without calling a model', async () => {
  const doc = setup('Grete Vale greeted Gregor Pike. Gregor Pike smiled at Grete Vale. The office was quiet.');
  const feed = await buildFeed({ question: 'Gregor', doc, embedder: createHashEmbedder() });

  assert.equal(feed.route, 'grounded');
  assert.ok(feed.spans.length > 0, 'retrieval put excerpts in the feed');
  assert.ok(feed.note?.levels?.structure, 'the fold exposes the structure surface the holons read');
  assert.ok(feed.promptText.includes(EXCERPTS_HEADER), 'the prompt carries the verbatim excerpts');
  assert.ok(feed.messages.some(m => m.role === 'system'), 'the prompt is a real message list');
  // Nothing was generated — the model stages never ran.
  assert.equal(feed.rawOutput, undefined);
  assert.equal(feed.answer, undefined);
});

// A mechanical short-circuit feeds no model at all — the probe must report that,
// not fabricate a prompt.
test('buildFeed reports a mechanical short-circuit as no model feed', async () => {
  const doc = setup('Anything at all.');
  const feed = await buildFeed({ question: 'what is 2 + 2?', doc, embedder: createHashEmbedder() });

  assert.equal(feed.terminate, true);
  assert.equal(feed.route, 'math');
  assert.ok(feed.answer.includes('4'));
  assert.equal(feed.promptText, undefined, 'no prompt is built for a mechanical answer');
  assert.equal(feed.spans, undefined, 'retrieval never ran');
});

// With no document the feed degrades to the chat prompt — no excerpts, no graph.
test('buildFeed with no document degrades to the chat feed', async () => {
  const feed = await buildFeed({ question: 'tell me something', doc: null, embedder: createHashEmbedder() });
  assert.equal(feed.route, 'chat');
  assert.equal(feed.spans.length, 0);
  assert.equal(feed.note, null);
  assert.ok(feed.promptText.length > 0, 'a chat prompt is still built');
});

// feedHolons shapes the structure surface into nested holons: a bond nests under
// the figure it leaves and points at the line it was read from; a def nests as a
// property leaf. Pure — no document, no DOM.
test('feedHolons nests bonds and defs under their figure, traced to a line', () => {
  const holons = feedHolons({
    figures: [{ id: 'a', label: 'Grete Vale', count: 2 }, { id: 'b', label: 'Gregor Pike', count: 1 }],
    relations: [{ op: 'CON', src: { id: 'a', label: 'Grete Vale' }, tgt: { id: 'b', label: 'Gregor Pike' }, via: 'greeted', idx: 0 }],
    defs: [{ id: 'b', label: 'Gregor Pike', value: 'the clerk', idx: 1 }],
  });

  const a = holons.find(h => h.id === 'a');
  const b = holons.find(h => h.id === 'b');
  assert.equal(a.bonds.length, 1);
  assert.equal(a.bonds[0].via, 'greeted');
  assert.equal(a.bonds[0].to.label, 'Gregor Pike');
  assert.equal(a.bonds[0].idx, 0, 'the bond is traced to the line it was read from');
  assert.equal(b.defs[0].value, 'the clerk');
  assert.equal(b.defs[0].idx, 1);
});

// "Don't clip the graph": every bond in the window is shaped, with no cap — the
// prompt's notes cap at 8 arrows, but the holon tree shows them all.
test('feedHolons does not clip — it keeps every bond in the window', () => {
  const relations = Array.from({ length: 12 }, (_, i) => ({
    op: 'CON', src: { id: 'a', label: 'A' }, tgt: { id: `t${i}`, label: `T${i}` }, via: 'with', idx: i,
  }));
  const holons = feedHolons({ figures: [{ id: 'a', label: 'A', count: 12 }], relations, defs: [] });
  assert.equal(holons.find(h => h.id === 'a').bonds.length, 12, 'all 12 bonds survive — uncapped');
});

// A bond endpoint that was never ranked as a figure still earns a holon, so no
// arrow is orphaned and the graph around the terms stays whole.
test('feedHolons gives an unranked endpoint its own holon', () => {
  const holons = feedHolons({
    figures: [],
    relations: [{ op: 'SIG', src: { id: 'x', label: 'X' }, tgt: { id: 'y', label: 'Y' }, via: 'told', idx: 3 }],
    defs: [],
  });
  assert.equal(holons.length, 1);
  assert.equal(holons[0].id, 'x');
  assert.equal(holons[0].bonds[0].op, 'SIG');
});
