#!/usr/bin/env node
// reference-measure — P0 of "Reference by reading" (docs/reference-by-reading.md §6).
//
// "Measure, and let it come back negative." Before any rewire, put the audit's turns
// onto the document's reading line through the EXISTING pipeline and surf each turn's
// span. The question P0 answers: is the per-pivot warmest figure already the right
// referent (then the fix is wiring), or does the document's faded mass swamp the
// conversation / does admission fail to bind the definite description (then the defect
// is upstream — γ, the horizon, or ingestion)?
//
// There is no Monk document in the tree (the audit ran over an external session), so
// this reconstructs the audit's STRUCTURE in a compact fixture: a musician (Monk)
// introduced EARLY and then faded, a "His name is Curtis Yarvin" distractor the word
// "name" retrieves, and Nietzsche / Dostoevsky / Oedipus as the other figures. The
// document ENDS on Oedipus, so the figure the document hands the conversation is NOT
// Monk — the test is sharp: only the conversation can re-warm him.
//
//   node scripts/reference-measure.mjs
//
// Two line policies are measured: USER turns only on the line, and USER+TALKER turns
// (the talker's replies are units too, §4). A third column reads the ENTITY horizon
// (readingAt opts.horizon:'entity'). RAG-nomination is reported beside the parse-only
// warmth so the §3 "RAG nominates referents to warm the line" gap is visible.

import { parseText }      from '../src/perceiver/parse/pipeline.js';
import { readingAt, namedReferents } from '../src/perceiver/index.js';
import { surfFold }       from '../src/surfer/index.js';
import { retrieveHybrid } from '../src/retrieve/index.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';

// ── The fixture: the audit's structure, controlled. ─────────────────────────────
const DOC = [
  // Monk — the musician — enters EARLY and is named, then the essay moves on.
  'Thelonious Monk drifts through the essay like a refrain.',
  'Monk is the only real musician in the room, all dissonance and silence.',
  'The pianist keeps needling the others, and he will not let the argument rest.',
  // Nietzsche.
  'The piece turns to Nietzsche.',
  'Nietzsche is patient with the noise; he tolerates the dissonance because he hears a method in it.',
  'Where a lesser reader would demand resolution, Nietzsche simply waits.',
  // Dostoevsky.
  'Then Dostoevsky enters, and the essay asks whether he ever answers the question it keeps posing.',
  'Dostoevsky circles, defers, and circles again.',
  // The distractor: a different man, whose NAME is given outright.
  'There is a long digression about a reactionary blogger.',
  'His name is Curtis Yarvin, and the digression spends pages on his theories.',
  'Curtis Yarvin is not the subject of the essay, only a foil.',
  // The close — the document ends on Oedipus, NOT on Monk.
  'At the close the essay returns to Oedipus.',
  'Old Oedipus stumbles toward a truth he already carries.',
  'The riddle, in the end, was always his own name.',
].join(' ');

// The audit's turns. `reply` is the talker's answer (the second one is the WRONG
// answer the audit actually produced — kept so the me-ness correction (§4) can be
// measured against it).
const TURNS = [
  { user: 'who is the musician?',                 reply: 'Thelonious Monk, an American jazz pianist.', expect: 'Monk' },
  { user: 'but what is his name?',                reply: 'His name is Curtis Yarvin.',                 expect: 'Monk' },
  { user: 'no the musician',                      reply: 'Right — Thelonious Monk.',                   expect: 'Monk' },
  { user: 'the musician keeps needling him, but I care more about why Nietzsche tolerates it, and does Dostoevsky ever actually answer',
                                                  reply: 'Monk needles; Nietzsche tolerates; Dostoevsky defers.',
                                                  expect: 'Monk|Nietzsche|Dostoevsky' },
  { user: 'summarize the essay',                  reply: '',                                            expect: 'Monk' },
];

const embedder = createHashEmbedder();
const DOC_ID = 'audit-fixture';

const hit = (figs, expect) => {
  const want = expect.split('|');
  return want.some(w => (figs || []).some(f => String(f).includes(w)));
};
const fmt = (figs) => (figs && figs.length ? figs.join(', ') : '∅');

// The figure the DOCUMENT alone hands the conversation (warmest at the last doc unit).
const baseDoc = parseText(DOC, { docId: DOC_ID });
const nDoc = baseDoc.units.length;
const handover = readingAt(baseDoc, nDoc - 1).predicted.figures;
console.log(`# reference-measure — ${nDoc} document units`);
console.log(`# the document hands over (warmest at its last unit): ${fmt(handover)}\n`);

// RAG nomination: what the lexical/hybrid retrieval points the line at for a turn.
const ragNominate = async (doc, text) => {
  const spans = await retrieveHybrid(doc, text, embedder, 6);
  const ids = new Set();
  for (const s of spans.slice(0, 3)) for (const id of namedReferents(doc, s.text)) ids.add(id);
  // render ids to labels via a fresh reading's name map
  const labelOf = (id) => {
    for (const e of (doc.log.snapshot ? doc.log.snapshot() : doc.log.events)) if (e.op === 'INS' && e.id === id) return e.label;
    return id;
  };
  return { topSpan: spans[0]?.text || '∅', nominated: [...ids].map(labelOf) };
};

// The γ-mass of figure `id` at cursor `at` over the line's log — the same heat
// kernel readingAt folds (γ=0.7), so this reads the warmth readingAt would read.
const massAt = (line, id, at, gamma = 0.7) => {
  let m = 0;
  for (const e of (line.log.snapshot ? line.log.snapshot() : line.log.events))
    if (e.op === 'INS' && e.id === id && e.sentIdx != null && e.sentIdx < at)
      m += Math.pow(gamma, at - 1 - e.sentIdx);
  return m;
};
// The figures the CONVERSATION named (INS at sentIdx >= convStart), warmest first —
// the cast the conversation put on the line, the document body excluded.
const convWarm = (line, convStart, at) => {
  const ids = new Set();
  const label = new Map();
  for (const e of (line.log.snapshot ? line.log.snapshot() : line.log.events)) {
    if (e.op !== 'INS') continue;
    if (!label.has(e.id)) label.set(e.id, e.label);
    if (e.sentIdx != null && e.sentIdx >= convStart && e.sentIdx <= at) ids.add(e.id);
  }
  return [...ids].map(id => ({ id, label: label.get(id) || id, mass: massAt(line, id, at) }))
                 .sort((a, b) => b.mass - a.mass);
};

const runPolicy = async (label, withTalker) => {
  console.log(`\n=== policy: ${label} ===`);
  console.log('turn                                  piv  recency-warmest    conv-warmest       RAG-nominee        resolved (conv⊕nom)');
  let prefix = DOC;
  let prev = nDoc;
  const pivotCounts = [];
  for (const t of TURNS) {
    prefix += '\n\n' + t.user;
    const line = parseText(prefix, { docId: DOC_ID });
    const lo = prev, hi = line.units.length - 1;
    const span = Math.max(0, hi - lo);
    const surf = surfFold(line, lo, { behind: 0, ahead: span + 1, maxStops: 5 });
    const stopsIn = (surf.stops || []).filter(s => s >= lo && s <= hi);
    pivotCounts.push(stopsIn.length || 1);
    const recFigs = readingAt(line, hi).predicted.figures;
    const rag     = await ragNominate(baseDoc, t.user);
    const cw      = convWarm(line, nDoc, hi);

    // The resolution rule the evidence supports, in one line and no regex:
    //   prefer the RAG nominee the CONVERSATION has also warmed (embedding points
    //   at a referent the conversation already holds — this resolves the correction:
    //   "no the musician" re-nominates Monk, who is conv-warm, over the talker's
    //   just-committed wrong answer); else the conversation's warmest figure (the
    //   pronoun case, where embedding would mislead); else the RAG nominee (the
    //   definite description the conversation has not yet named).
    const norm = (s) => String(s || '').toLowerCase();
    const cwLabels = new Set(cw.map(c => norm(c.label)));
    const nomInConv = rag.nominated.find(n => cwLabels.has(norm(n)));
    const resolved = nomInConv ?? cw[0]?.label ?? rag.nominated[0] ?? recFigs[0] ?? null;

    const ok = (v) => (hit(Array.isArray(v) ? v : [v], t.expect) ? '✓' : '·');
    console.log(
      `${t.user.slice(0, 36).padEnd(36)} ${String(stopsIn.length || 1).padStart(2)}  ` +
      `${ok(recFigs[0])} ${fmt(recFigs).slice(0, 16).padEnd(16)} ` +
      `${ok(cw[0]?.label)} ${(cw[0]?.label || '∅').slice(0, 16).padEnd(16)} ` +
      `${ok(rag.nominated[0])} ${(rag.nominated[0] || '∅').slice(0, 16).padEnd(16)} ` +
      `${ok(resolved)} ${String(resolved || '∅').slice(0, 18)}`);

    prev = line.units.length;
    if (withTalker && t.reply) { prefix += '\n\n' + t.reply; prev = parseText(prefix, { docId: DOC_ID }).units.length; }
  }
  const single = pivotCounts.filter(n => n === 1).length;
  console.log(`pivots/turn: ${pivotCounts.join(' ')}   (single-stop turns: ${single}/${pivotCounts.length})`);
};

await runPolicy('USER turns only on the line', false);
await runPolicy('USER + TALKER turns on the line', true);

console.log(`\n# legend: ✓ = the expected referent leads; · = it does not.`);
console.log(`# recency-warmest: readingAt(cursor).figures[0] — warmth over the whole line.`);
console.log(`# conv-warmest:    warmest figure the CONVERSATION named (doc body excluded).`);
console.log(`# RAG-nominee:     the figure lexical/hybrid retrieval points the line at (§3).`);
console.log(`# resolved:        conv-warmest ?? RAG-nominee — the rule the evidence supports.`);
