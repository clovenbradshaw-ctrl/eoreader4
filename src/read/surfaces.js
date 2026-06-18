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
// reading the talker can use. The reading the talker reads is the ARROWS — the
// structured reading — never the count headline and never the machinery. The
// source indices live on `sources` (the machine-readable channel the binder
// re-cites against), never inside the text: the talker never sees s348.
export const consciousness = (doc, spans, cursor = null) => {
  const existence = existenceSurface(doc, spans);
  const idxs = existence.map(s => s.idx);
  const structure = structureSurface(doc, idxs);
  const significance = cursor == null ? null : significanceSurface(doc, cursor);
  const text = composeNote(structure, significance);
  return { text, sources: idxs, levels: { existence, structure, significance } };
};

// The notes register — the arrow serializer over the folded graph. The talker
// reads a serialized graph in plain language and speaks prose; the mechanics
// stay grounder-side. So each note is an arrow with a PLAIN-LANGUAGE relation
// label (tends, holds-with, originated-in, slammed) — never an operator code,
// never a cell name, never a sentence index, never a citation token, never a
// referent id. The graph's specific relation (the verb on the edge) overrides
// any generic; a relation with no verb falls back to the generic `linked-to`.
// This is the document-notes slot of the prompt, AND the same register the
// edge-grounding veto checks the talker's sentences against — one object, two
// directions.
export const serializeNotes = (structure, { max = 8 } = {}) => {
  const lines = [];
  const seen = new Set();
  for (const r of (structure?.relations || [])) {
    const rel = plainRel(r.via);
    const key = `${r.src.id}|${rel}|${r.tgt.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`${r.src.label} --${rel}--> ${r.tgt.label}`);
    if (lines.length >= max) return lines;
  }
  for (const d of (structure?.defs || [])) {
    const key = `def|${d.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`${d.label}: ${d.value}`);            // a property line, A: fact
    if (lines.length >= max) return lines;
  }
  return lines;
};

// A relation label the talker may read: the edge's own verb, plain, hyphenated
// so it reads as one arrow label ("originated in" → "originated-in"). Never a
// code; the generic stands only when the graph carried no verb.
const plainRel = (via) => {
  const v = String(via || '').trim().replace(/[.!?]+$/, '').replace(/\s+/g, '-');
  return v || 'linked-to';
};

// Replace the count headline with the arrows (the structured reading), and keep
// the significance summary when the cursor genuinely moved — plain prose, no
// machinery. The indices that used to ride in `[sN]` tags are gone from the
// talker's view by design (§3); they remain on `sources`.
const composeNote = (structure, significance) => {
  const lines = serializeNotes(structure, { max: 8 });

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
