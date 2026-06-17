// Every token is available for the graph.
//
// The graph's node space is not "the admitted proper nouns" — it is the whole
// token index. A token is an existent (Object order 2, arithmetic: literal
// presence). An entity is an existent that *persists* — a token minted into a
// referent because it recurred. Same Existence order, two registers. So the
// node space is every content token; entities are the persistent subset.
//
// Availability is latent, not materialised: every token is *available*, and the
// reading surfaces the locally-massive ones by mass × cursor (the same γ field
// the graph runs on). Near the reading position the local tokens light up; far
// from it they fade, but none is ever excluded a priori. This is the substrate
// a SEG carver bonds over — bonds may land on any existent, not just the names.

import { tok } from '../parse/index.js';

export const tokenField = (doc, { cursor = null, gamma = 0.7 } = {}) => {
  const mass  = new Map();   // token → frequency (its arithmetic existence)
  const where = new Map();   // token → unit indices it occurs in
  (doc.tokensBySentence || []).forEach((set, i) => {
    for (const t of set) {
      mass.set(t, (mass.get(t) || 0) + 1);
      (where.get(t) || where.set(t, []).get(t)).push(i);
    }
  });

  // Which tokens have persisted into a minted referent.
  const persistent = new Set();
  for (const [label] of (doc.admission?.admitted || [])) for (const t of tok(label)) persistent.add(t);

  const nodes = [];
  for (const [t, m] of mass) {
    let salience = Math.log(1 + m);
    if (cursor != null) {
      let d = Infinity;
      for (const i of where.get(t)) d = Math.min(d, Math.abs(i - cursor));
      salience *= Math.pow(gamma, isFinite(d) ? Math.min(d, 24) : 24);
    }
    nodes.push({ token: t, mass: m, persistent: persistent.has(t), units: where.get(t), salience });
  }
  nodes.sort((a, b) => b.salience - a.salience);
  return nodes;
};
