// Emergent equivalence — note categories with no threshold, no a priori.
//
// The frequency reader MEASURES harmonic relatedness (overtone overlap) but
// leaves every tone its own entity. To turn that measurement into a category —
// "these are the same note" — the obvious move is a threshold: merge any pair
// over 0.4. But a threshold is a chosen number, a small a priori smuggled back
// in, and the whole point was to keep the structure in the signal.
//
// So there is no threshold here. The only relation used is RANK: a tone's
// nearest neighbour is whatever it overlaps most. Two tones merge iff each is
// the OTHER's nearest — mutual nearest neighbour, the parameter-free grouping
// (Gestalt proximity, relationally). The merges compose by the engine's own
// union-find (SYN), so equivalence is transitive: 110↔220, 220↔440, 440↔880
// collapse into one note. A fifth is never the tonic's strongest match, so it
// never joins. The single non-relational condition is "shares at least one
// overtone" — related vs unrelated, 0 vs not, which is not a magnitude anyone
// picked. The category is the output of the operation, not an input to it.

import { retrieveLexical } from '../retrieve/index.js';

// The set of a tone's strongest matches (a set, so exact ties — the two octaves
// of a tone are equally near — are both kept). Empty when it shares nothing.
const nearestSet = (doc, i) => {
  const res = retrieveLexical(doc, doc.spectrumQuery(i), doc.units.length + 1)
    .filter(r => r.idx !== i && r.score > 0);
  if (!res.length) return { best: 0, set: new Set() };
  const best = res[0].score;
  return { best, set: new Set(res.filter(r => Math.abs(r.score - best) < 1e-9).map(r => r.idx)) };
};

// The mutual-nearest pairs: i and j where each is among the other's strongest.
export const mutualNearestPairs = (doc) => {
  const n = doc.units.length;
  const near = Array.from({ length: n }, (_, i) => nearestSet(doc, i));
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (const j of near[i].set) {
      if (j > i && near[j].set.has(i)) pairs.push({ i, j, score: near[i].best });
    }
  }
  return pairs;
};

// Discover the equivalence classes and (by default) commit them: append a SYN
// merge per mutual-nearest pair to the log, so the engine's projection collapses
// them itself. Returns the pairs and the classes (each an array of unit indices).
export const discoverEquivalences = (doc, { emit = true } = {}) => {
  const pairs = mutualNearestPairs(doc);

  const parent = new Map();
  const find = (x) => { let p = parent.get(x) ?? x; while (p !== (parent.get(p) ?? p)) p = parent.get(p) ?? p; return p; };
  const union = (a, b) => { parent.set(find(a), find(b)); };

  for (const { i, j } of pairs) {
    if (emit) doc.log.append({ op: 'SYN', kind: 'merge', from: `n${i}`, to: `n${j}`, sentIdx: j });
    union(i, j);
  }

  const byRoot = new Map();
  for (let i = 0; i < doc.units.length; i++) {
    const r = find(i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(i);
  }
  return { pairs, classes: [...byRoot.values()] };
};
