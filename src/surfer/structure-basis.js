// The structural significance basis — ρ built from operations, not embeddings.
//
// The significance column first built ρ over the 27-cell COSINE projection of a MiniLM
// embedding. That imported the distributional theory of meaning (a word is the company
// it keeps) — the LLM bet EOreader4 exists to refute, and it pinned the column to the
// embedder (now rightly a VOX/surface organ). Meaning here is OPERATIONAL: what the
// DEF·EVA·REC·CON·SIG·INS… operators do to the field. So the per-unit activation is its
// profile over the nine operators — the cube's Act face — read straight off the log,
// with no embedder and nothing distributional.
//
// spectral.js is pure on vectors, so the whole density-operator apparatus is unchanged;
// only the basis moves from embedding-space to operator-space. The eigen-lenses are then
// recurring OPERATIONAL PATTERNS (a reading: which operations cohere — "instantiate-and-
// bond", "assert-and-evaluate"), which cannot be topic clusters because they are made of
// operators, not content words. That is the separation the embedding path needed
// centering to fake; here it is free, because structure is not distribution.

import { buildDensity, eigenLenses, vonNeumann, relEntropy, commutator, projectorFrom, OPERATORS } from '../core/index.js';

// the operational vocabulary: the nine operators (Act face = Mode × Domain).
export const OPS = Object.freeze(Object.keys(OPERATORS));
const OP_IDX = Object.fromEntries(OPS.map((o, i) => [o, i]));
const round = (x) => Math.round(x * 1e4) / 1e4;

// Per-unit structural activation: the count of each operator the unit performs, read off
// the append-only log by sentence index. Raw counts (buildDensity trace-normalises).
export const operatorProfiles = (doc) => {
  const units = doc?.units || doc?.sentences || [];
  const prof = units.map(() => new Array(OPS.length).fill(0));
  const events = typeof doc?.log?.snapshot === 'function' ? doc.log.snapshot() : (doc?.log?.events || []);
  for (const e of events) {
    if (e.sentIdx == null || !(e.op in OP_IDX)) continue;
    if (e.sentIdx >= 0 && e.sentIdx < prof.length) prof[e.sentIdx][OP_IDX[e.op]] += 1;
  }
  return prof;
};

// the bare operational ground σ: maximally mixed over the operators (no operation
// privileged). A document departs it as its operations concentrate into a reading.
const groundSigma = (() => {
  let cached = null;
  return () => (cached || (cached = buildDensity(OPS.map((_, i) => { const v = new Array(OPS.length).fill(0); v[i] = 1; return v; })).rho));
})();

// name an eigen-lens by its heaviest operators — the operational pattern it is.
const lensTop = (lens, n = 3) => OPS.map((op, i) => ({ op, w: lens[i] }))
  .sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, n)
  .filter(o => Math.abs(o.w) > 0.15).map(o => ({ op: o.op, w: round(o.w) }));

// the structural tone: the dominant operator by ρ-mass, and the Domain/Mode balance —
// is the document mostly building existence (INS/SIG), structure (CON/SEG/SYN), or
// significance (DEF/EVA/REC)? That mix IS the operational atmosphere.
const toneOf = (rho) => {
  let best = -1, bi = 0;
  for (let i = 0; i < OPS.length; i++) if (rho[i][i] > best) { best = rho[i][i]; bi = i; }
  const op = OPS[bi], o = OPERATORS[op];
  const domMass = { Existence: 0, Structure: 0, Interpretation: 0 };
  for (let i = 0; i < OPS.length; i++) domMass[OPERATORS[OPS[i]].domain] += rho[i][i];
  const dom = Object.entries(domMass).sort((a, b) => b[1] - a[1]);
  return Object.freeze({
    op, mode: o.mode, domain: o.domain,
    label: `reads as ${o.mode.toLowerCase()} · ${dom[0][0].toLowerCase()}`,
    domainMix: Object.fromEntries(Object.entries(domMass).map(([k, v]) => [k, round(v)])),
  });
};

// structuralHorizon(doc | profiles, { k, alpha }) → the embedder-free significance reading.
// Same shape as the embedding column (departure · tone · lenses · lensEntropy) but every
// number is operational. `lenses[].real` is gated by a spectral deriveNull is left to the
// caller (surf already does it); here we report the spectrum honestly.
export const structuralHorizon = (docOrProfiles, { k = 4 } = {}) => {
  const profiles = Array.isArray(docOrProfiles?.[0]) ? docOrProfiles : operatorProfiles(docOrProfiles);
  const acts = profiles.filter(p => p.some(x => x > 0));     // drop units that perform no operation
  const blank = { units: 0, departure: 0, tone: null, lenses: [], lensEntropy: 0, rho: [] };
  if (acts.length < 2) return blank;

  const { rho } = buildDensity(acts);
  const spectrum = eigenLenses(rho).map(l => l.weight);
  const top = eigenLenses(rho, { k });
  return {
    units: acts.length,
    departure: round(relEntropy(rho, groundSigma())),
    lensEntropy: round(vonNeumann(spectrum)),
    tone: toneOf(rho),
    lenses: top.map(({ lens, weight }) => ({ weight: round(weight), pattern: lensTop(lens), lens })),
    rho,
  };
};

// Two documents' operational bases incommensurable? The Paradigm pass, structurally: do
// the top operational patterns of two docs (or two halves) fail to commute past a
// within-document baseline. Same commutator, an operator basis instead of an embedding one.
export const structuralCommutator = (profilesA, profilesB, { m = 3 } = {}) => {
  const proj = (ps) => projectorFrom(eigenLenses(buildDensity(ps.filter(p => p.some(x => x > 0))).rho, { k: m }).map(l => l.lens));
  return round(commutator(proj(profilesA), proj(profilesB)));
};
