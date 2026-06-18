// scoreProbe — the number, computed mechanically against the gold note
// (docs/surfing-success.md §4). No model reads the note as prose.
//
//   probe score = (recall × precision) × groundedness,  0 if any hard gate trips.
//
//   recall (coverage)       of the gold's required entities, relations, cited
//                           spans, and frame turn, how many the note carries.
//   precision (parsimony)   of what the note carries, how much is required vs
//                           surplus. The product is the F-style balance — either
//                           alone is gameable (the whole book recalls everything).
//   groundedness (the gate) every relation/def element must cite a span that
//                           actually supports it (in-stack embedder, cosine ≥ floor).
//                           A multiplier, not a term: an ungrounded note cannot
//                           score well no matter how complete.
//   forbidden / silence     hard gates. A forbidden element, or a fact asserted
//                           where the text is silent, fails the probe outright —
//                           fabrication and false certainty are disqualifications,
//                           not quality tradeoffs.

import { noteMentions } from './note.js';

const SPAN_TOL = 2;          // a cited span matches within this many sentences (§4 tolerance window)
const DEFAULT_FLOOR = 0.15;  // groundedness cosine floor (hash organ scale; raise for MiniLM)
const FRAME_WINDOW = 3;      // a frame turn matches a REC within this many cursors of the gold cursor

export const scoreProbe = async (note, gold, { embedder = null, floor = DEFAULT_FLOOR } = {}) => {
  const req = gold.required || {};
  const reqEntities  = req.entities  || [];
  const reqRelations = req.relations || [];
  const reqSpans     = req.spans     || [];
  const reqFrame     = req.frameTurn || null;

  // ── recall: matched required elements / total required elements ──────────
  const entHit = reqEntities.map(id => note.entities.some(e => e.id === id));
  const relHit = reqRelations.map(r => note.relations.some(n => relationMatches(n, r)));
  const spanHit = reqSpans.map(idx => note.spans.some(s => Math.abs(s - idx) <= SPAN_TOL));
  const frameHit = reqFrame ? frameMatches(note.frameTurns, reqFrame) : null;

  const matched = entHit.filter(Boolean).length + relHit.filter(Boolean).length
    + spanHit.filter(Boolean).length + (frameHit === true ? 1 : 0);
  const total = reqEntities.length + reqRelations.length + reqSpans.length + (reqFrame ? 1 : 0);
  const recall = total === 0 ? 1 : matched / total;

  // ── precision: required-present / present (entities + relations) ─────────
  // Surplus the note surfaced beyond the gold is the parsimony cost. A note that
  // dumps the region recalls everything and prices it here.
  const present = note.entities.length + note.relations.length;
  const reqPresent = note.entities.filter(e => reqEntities.includes(e.id)).length
    + note.relations.filter(n => reqRelations.some(r => relationMatches(n, r))).length;
  const precision = present === 0 ? (total === 0 ? 1 : 0) : reqPresent / present;

  // ── groundedness: the multiplier ─────────────────────────────────────────
  // Every relation/def element must cite a span that supports it. Checked with the
  // in-stack embedder against the cited sentence; an element whose citation does not
  // clear the floor contributes nothing. groundedFraction multiplies the score.
  const claims = [
    ...note.relations.map(r => ({ phrase: relPhrase(r), idx: r.idx })),
    ...note.defs.map(d => ({ phrase: `${d.label} ${d.value}`, idx: d.idx })),
  ];
  let grounded = 0;
  for (const c of claims) {
    if (await supports(c.phrase, note.spanText[c.idx], embedder, floor)) grounded++;
  }
  const groundedFraction = claims.length === 0 ? 1 : grounded / claims.length;

  // ── hard gates: forbidden + silence ──────────────────────────────────────
  const forbidden = gold.forbidden || {};
  const gates = [];
  for (const id of (forbidden.entities || []))
    if (note.entities.some(e => e.id === id)) gates.push(`forbidden-entity:${id}`);
  for (const fr of (forbidden.relations || []))
    if (note.relations.some(n => relationMatches(n, fr))) gates.push(`forbidden-relation:${fr.src}->${fr.tgt}`);
  for (const tok of (forbidden.tokens || []))
    if (noteMentions(note, tok)) gates.push(`forbidden-token:${tok}`);

  let voidMarker = null;
  if (gold.silence) {
    // The void marker IS the absence — the §4 NUL: the text leaves the slot empty,
    // so the note must too. If any silence token surfaces, the note asserted a fact
    // where the text is silent (false certainty) and the probe fails outright.
    const named = (gold.silence.tokens || []).filter(t => noteMentions(note, t));
    voidMarker = named.length === 0;
    if (!voidMarker) gates.push(`silence-broken:${named.join(',')}`);
  }

  const gated = gates.length > 0;
  const base = recall * precision;
  const score = gated ? 0 : base * groundedFraction;

  return {
    score: round(score),
    recall: round(recall), precision: round(precision),
    groundedness: round(groundedFraction),
    gated, gates, voidMarker,
    detail: { entHit, relHit, spanHit, frameHit, matched, total, present, reqPresent, grounded, claims: claims.length },
  };
};

// A note relation matches a gold relation by source, target, and type/verb, in the
// stated direction. A gold relation marked `symmetric` (sibling, spouse) also
// matches the reversed edge — the gendered-projection primitive is symmetric.
const relationMatches = (note, gold) => {
  const typeOk = gold.type ? note.type === gold.type
    : gold.via ? note.via === gold.via : true;
  const fwd = note.src?.id === gold.src && note.tgt?.id === gold.tgt;
  const rev = gold.symmetric && note.src?.id === gold.tgt && note.tgt?.id === gold.src;
  return typeOk && (fwd || rev);
};

// A frame turn matches when a REC fired near the gold cursor (within FRAME_WINDOW),
// at the gold layer when one is named — the presence of a restructuring at the
// right point, the significance the question asked for.
const frameMatches = (turns, gold) => {
  const win = gold.window ?? FRAME_WINDOW;
  return turns.some(t =>
    (!gold.layer || t.layer === gold.layer) && Math.abs(t.cursor - gold.near) <= win);
};

const relPhrase = (r) => `${r.src?.label || r.src?.id} ${r.via || r.type || ''} ${r.tgt?.label || r.tgt?.id}`.trim();

// Does the cited span support the claim? Cosine of the claim phrase against the
// cited sentence, in the in-stack embedder's space, over the floor. With no
// embedder, fall back to token overlap so the gate still bites in pure-mechanical
// runs (the hot path never blocks on a model).
const supports = async (phrase, spanText, embedder, floor) => {
  if (!spanText) return false;
  if (embedder?.embed) {
    try {
      const [a, b] = await Promise.all([embedder.embed(phrase), embedder.embed(spanText)]);
      return cosine(a, b) >= floor;
    } catch { /* fall through to lexical */ }
  }
  return tokenOverlap(phrase, spanText) >= floor;
};

const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
};

const tokenOverlap = (a, b) => {
  const sa = new Set(String(a).toLowerCase().match(/[a-z]+/g) || []);
  const sb = new Set(String(b).toLowerCase().match(/[a-z]+/g) || []);
  if (sa.size === 0) return 0;
  let hit = 0; for (const t of sa) if (sb.has(t)) hit++;
  return hit / sa.size;
};

const round = (x) => Math.round(x * 1000) / 1000;
