// The three levels of reading — three surfaces a mechanical "consciousness"
// queries behind the scenes, each able to ground the talker (the model).
//
// They are the three domains of the EO cube read top to bottom:
//
//   Level 1 — raw existence       the verbatim text (Existence)
//   Level 2 — extracted structure the SEG / CON / SIG / SYN graph (Structure)
//   Level 3 — significance        predict-what's-next, be surprised (Interpretation)
//
// The consciousness folds all three into the note the talker reads beside the
// verbatim spans. Nothing here calls a model; the reading is mechanical.

import { readingAt } from './reading.js';

// Level 1 — raw existence. The spans as they are, in source order.
export const existenceSurface = (_doc, spans) =>
  spans.slice().sort((a, b) => a.idx - b.idx).map(s => ({ idx: s.idx, text: s.text }));

// Level 2 — extracted structure. The figures the window turns on and the
// bonds / merges / resplits among them, each traced to the line it came from.
export const structureSurface = (doc, idxs) => {
  const window = new Set(idxs);
  const events = snapshot(doc);
  const label = new Map();
  for (const e of events) if (e.op === 'INS' && !label.has(e.id)) label.set(e.id, e.label);
  const name = (id) => ({ id, label: label.get(id) || id });

  const figures = new Map();
  const relations = [];
  const merges = [];
  const splits = [];
  for (const e of events) {
    if (!window.has(e.sentIdx)) continue;
    switch (e.op) {
      case 'INS': figures.set(e.id, (figures.get(e.id) || 0) + 1); break;
      case 'CON':
      case 'SIG': relations.push({ op: e.op, src: name(e.src), tgt: name(e.tgt), via: e.via, idx: e.sentIdx }); break;
      case 'SYN': if (e.kind === 'merge') merges.push({ from: name(e.from), to: name(e.to), idx: e.sentIdx }); break;
      case 'SEG': if (e.kind === 'retract') splits.push({ refSeq: e.refSeq, idx: e.sentIdx }); break;
    }
  }
  const defs = [];
  for (const e of events) {
    if (window.has(e.sentIdx) && e.op === 'DEF' && e.key === 'predicate') {
      defs.push({ ...name(e.id), value: e.value, idx: e.sentIdx });
    }
  }
  const rankedFigures = [...figures.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ ...name(id), count }));

  return { figures: rankedFigures, relations, defs, merges, splits };
};

// Level 3 — significance. Prediction + surprise at the reading cursor.
export const significanceSurface = (doc, cursor) => readingAt(doc, cursor);

// The consciousness. Query all three surfaces and fold them into a single
// reading the talker can use, with citations preserved for binding.
export const consciousness = (doc, spans, cursor = null) => {
  const existence = existenceSurface(doc, spans);
  const idxs = existence.map(s => s.idx);
  const structure = structureSurface(doc, idxs);
  const significance = cursor == null ? null : significanceSurface(doc, cursor);
  const text = composeNote(structure, significance);
  return { text, sources: idxs, levels: { existence, structure, significance } };
};

const composeNote = (structure, significance) => {
  const lines = [];
  const { figures, relations, defs } = structure;

  if (figures.length) {
    const top = figures.slice(0, 3).map(f => f.label);
    const list = top.length === 1 ? top[0]
      : top.slice(0, -1).join(', ') + ' and ' + top[top.length - 1];
    lines.push(`This passage centers on ${list}.`);
  }

  const seenRel = new Set();
  for (const r of relations) {
    const key = `${r.src.id}|${r.via}|${r.tgt.id}`;
    if (seenRel.has(key)) continue;
    seenRel.add(key);
    lines.push(`${r.src.label} ${r.via || 'is linked to'} ${r.tgt.label}. [s${r.idx}]`);
    if (lines.length >= 6) break;
  }

  const seenDef = new Set();
  for (const d of defs) {
    if (seenDef.has(d.id)) continue;
    seenDef.add(d.id);
    lines.push(`${d.label} — ${d.value}. [s${d.idx}]`);
    if (lines.length >= 8) break;
  }

  if (significance && significance.surprise >= 0.2 && significance.summary) {
    lines.push(significance.summary);
  }

  if (lines.length === 0) return '';
  let text = lines.join('\n');
  if (text.length > 760) text = text.slice(0, 760).replace(/\s+\S*$/, '') + '…';
  return text;
};

const snapshot = (doc) =>
  typeof doc.log.snapshot === 'function' ? doc.log.snapshot() : (doc.log.events || []);
