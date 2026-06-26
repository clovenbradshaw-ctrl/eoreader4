// Growing specific link-types from the links the closed vocabulary leaves untyped —
// label feedback (word → concept), the half the reading side never had.
//
// A link is its operator (structure-basis.js, first level). The shipped relation-class
// taxonomy (RELTYPES) is a fixed second level that types only the minority of links whose
// verb the conventions ledger already knows; the recurring REST stay untyped — the parse
// keeps meeting "became", "seemed", "tried", "made" and has no concept to file them under.
//
// Comprehension runs concept → word: a known concept lends its word. LEARNING runs the
// other way, word → concept: a label that keeps recurring is evidence of a distinction the
// frame is missing, and the label is what lets the distinction be grown. That is the move
// here. We take each recurring untyped link-verb as a CANDIDATE new specific type, scoped
// under its operator (`CON/became`, `SIG/seemed` — the operator is still the first level,
// this only makes it more specific), and then we ask the honest question:
//
//   does STRUCTURE ALONE carve this distinction, or does the label carry meaning the
//   structure can't see (so it would have to be pushed down from VOX)?
//
// We answer it by measurement, not assertion. Each link gets a STRUCTURAL feature vector —
// its operator, bond coupling, target kind, polarity, and the operator-profile of its
// sentence (its operational context). The verb itself is NEVER a feature (that would be
// circular). A candidate type is USABLE only if the links that share its verb cohere in
// that structural space BEYOND what random same-size groups of untyped links reach — the
// engine's own signal-from-noise line (deriveNull), the same rule that gates SYN. If a
// label's links cohere structurally, structure recovered the distinction the label names.
// If they don't, the label names something structure can't see — the empirical case that
// the semantic push from VOX is doing real work, not the structural basis.

import { deriveNull } from '../core/index.js';
import { OPS, operatorProfiles } from './structure-basis.js';

const OP_IDX = Object.fromEntries(OPS.map((o, i) => [o, i]));
const round = (x) => Math.round(x * 1e4) / 1e4;
const normVec = (v) => { const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1; return v.map(x => x / n); };
const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d > 1e-12 ? dot / d : 0;
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// linkInventory(doc) — the edges between nodes, each typed by its operator (first level),
// carrying its verb (the label) and the closed-vocab relType when the ledger knew it.
export const linkInventory = (doc) => {
  const events = typeof doc?.log?.snapshot === 'function' ? doc.log.snapshot() : (doc?.log?.events || []);
  const profiles = operatorProfiles(doc);
  const links = [];
  for (const e of events) {
    if ((e.op !== 'CON' && e.op !== 'SIG') || !e.via) continue;
    const coupling = e.coupling != null ? e.coupling : (e.w != null ? e.w : 1);
    links.push({
      op: e.op,
      via: String(e.via).toLowerCase(),
      relType: e.relType || null,
      coupling: Math.max(0, Math.min(1, coupling)),
      tgtKind: e.tgtKind === 'np' ? 'np' : (e.tgt != null ? 'entity' : 'other'),
      polarity: e.polarity === '−' || e.polarity === '-' ? -1 : (e.polarity ? 1 : 0),
      sentIdx: e.sentIdx,
      ctx: e.sentIdx != null && e.sentIdx >= 0 && e.sentIdx < profiles.length ? profiles[e.sentIdx] : new Array(OPS.length).fill(0),
    });
  }
  const typed = links.filter(l => l.relType).length;
  return { links, total: links.length, typed, untyped: links.length - typed };
};

// the STRUCTURAL feature vector of a link — operator, coupling, target kind, polarity, and
// its sentence's operator-profile (its operational context). The verb is deliberately
// absent: we are testing whether structure can find the regularity the verb labels.
const featureOf = (l) => {
  const op = new Array(OPS.length).fill(0); op[OP_IDX[l.op]] = 1;
  const kind = [l.tgtKind === 'entity' ? 1 : 0, l.tgtKind === 'np' ? 1 : 0, l.tgtKind === 'other' ? 1 : 0];
  return [...op, l.coupling, ...kind, l.polarity, ...normVec(l.ctx)];
};

// within-group coherence: how tight a set of links sits in structural-feature space (mean
// pairwise cosine). High → these links ARE structurally alike, whatever their verb.
const coherence = (feats) => {
  if (feats.length < 2) return 0;
  let s = 0, n = 0;
  for (let i = 0; i < feats.length; i++) for (let j = i + 1; j < feats.length; j++) { s += cosine(feats[i], feats[j]); n++; }
  return n ? s / n : 0;
};

// the closed-vocab refinement only types a minority of links — count the recurring verbs
// it leaves untyped. These are the labels with no concept: the candidates for growth.
export const untypedVias = (doc, { minCount = 3 } = {}) => {
  const { links } = linkInventory(doc);
  const byVia = new Map();
  for (const l of links) if (!l.relType) { const a = byVia.get(l.via) || []; a.push(l); byVia.set(l.via, a); }
  return [...byVia.entries()]
    .filter(([, ls]) => ls.length >= minCount)
    .map(([via, ls]) => {
      const opCount = {}; for (const l of ls) opCount[l.op] = (opCount[l.op] || 0) + 1;
      const op = Object.entries(opCount).sort((a, b) => b[1] - a[1])[0][0];
      return { via, count: ls.length, op };
    })
    .sort((a, b) => b.count - a.count);
};

// growLinkTypes(doc, { minCount, alpha, samples }) — the label-feedback growth, measured.
//
// For each recurring untyped verb, propose a specific type scoped under its operator and
// test it: is the structural coherence of its links above the engine's signal-from-noise
// line, built from random same-size groups of untyped links? Returns each candidate with
// its coherence, the derived null line, and a USABLE verdict — plus `structureGrows`, the
// answer to whether structure alone grew any usable distinction (vs the labels carrying
// meaning only VOX could supply).
export const growLinkTypes = (doc, { minCount = 3, alpha = 0.05, samples = 200 } = {}) => {
  const { links, total, typed, untyped } = linkInventory(doc);
  const pool = links.filter(l => !l.relType);

  // a deterministic LCG so the null is reproducible (no Date/Math.random; resume-safe).
  let seed = (pool.length * 2654435761 + total * 40503 + 1) >>> 0;
  const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 0x100000000; };
  const sampleFrom = (feats, k) => { if (feats.length < k) return null; const idx = []; const used = new Set(); let guard = 0; while (idx.length < k && guard++ < k * 20) { const i = (rand() * feats.length) | 0; if (!used.has(i)) { used.add(i); idx.push(i); } } return idx.map(i => feats[i]); };

  const cands = untypedVias(doc, { minCount });
  const grown = cands.map(({ via, count, op }) => {
    const feats = pool.filter(l => l.via === via).map(featureOf);
    const coh = coherence(feats);
    // The fair null: random same-size groups drawn from links of the SAME OPERATOR. The
    // operator one-hot is then constant across the candidate and the null, so the test
    // isolates the question that matters — do these verb-sharing links cohere on the FINER
    // structure (coupling, target kind, polarity, operational context) beyond chance,
    // WITHIN their operator. That is what "growing a more specific type" has to earn.
    const opFeats = pool.filter(l => l.op === op).map(featureOf);
    const bg = [];
    for (let s = 0; s < samples; s++) { const grp = sampleFrom(opFeats, count); if (grp) bg.push(coherence(grp)); }
    const line = deriveNull(bg, { scale: 'linear', alpha, N: 2 });
    const usable = Number.isFinite(line) && coh > line;
    return Object.freeze({
      key: `${op}/${via}`,            // the operator stays first; this only makes it specific
      via, op, count,
      coherence: round(coh),
      nullLine: Number.isFinite(line) ? round(line) : null,
      usable,
    });
  });

  const usableTypes = grown.filter(g => g.usable);
  return Object.freeze({
    total, typed, untyped,
    typedFraction: total ? round(typed / total) : 0,
    candidates: grown.length,
    grown,
    usableCount: usableTypes.length,
    // the measured verdict on the structural-vs-distributional question. TRUE: at least one
    // recurring untyped label names a regularity STRUCTURE alone recovers — the basis grows
    // a usable specific type on its own. FALSE: the recurring labels carry distinctions the
    // structural features can't separate — evidence the semantic push from VOX does real work.
    structureGrows: usableTypes.length > 0,
  });
};
