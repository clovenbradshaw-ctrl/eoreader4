// Referent resolution as physics, not decision.
//
// A pronoun does not *pick* an antecedent. Each mentioned entity leaves a
// decaying trace — a mass that grows on every sighting and falls off with
// reading distance (the same γ kernel the graph runs on). A pronoun induces a
// FIELD: a weighted distribution over the candidates currently in play. We
// never commit "he = Gregor"; we report the field, and the strongest weight
// becomes the bond's coupling. As evidence accumulates the field concentrates,
// so the weight asymptotically approaches 1 — truth as a limit, not a verdict.
//
// This is also the seam where a model collapses referents the right way: not
// by returning a choice, but by emitting meta-content (a paraphrase, a feature,
// an embedding similarity) that adds weight to candidates. `reinforce(id, w)`
// is that door — a continuous nudge to the field, never a switch.

export const createCorefField = ({ gamma = 0.7, maxDist = 8 } = {}) => {
  const traces = new Map(); // id → { lastIdx, mass }

  const note = (id, sentIdx) => {
    const tr = traces.get(id) || { lastIdx: sentIdx, mass: 0 };
    // Decay the standing mass to *now*, then add this sighting's unit mass.
    tr.mass = tr.mass * Math.pow(gamma, Math.max(0, sentIdx - tr.lastIdx)) + 1;
    tr.lastIdx = sentIdx;
    traces.set(id, tr);
  };

  // Optional model/meta nudge: weight a candidate without deciding it.
  const reinforce = (id, w, sentIdx) => {
    const tr = traces.get(id) || { lastIdx: sentIdx ?? 0, mass: 0 };
    tr.mass += Math.max(0, w);
    traces.set(id, tr);
  };

  // The field at a reading position: candidates with normalised weights,
  // strongest first. A pure measurement of the current traces.
  const field = (sentIdx) => {
    const cands = [];
    for (const [id, tr] of traces) {
      const dist = sentIdx - tr.lastIdx;
      if (dist < 0 || dist > maxDist) continue;
      const w = tr.mass * Math.pow(gamma, dist);
      if (w > 0) cands.push({ id, w });
    }
    const Z = cands.reduce((s, c) => s + c.w, 0) || 1;
    for (const c of cands) c.w = c.w / Z;
    cands.sort((a, b) => b.w - a.w);
    return cands;
  };

  return { note, reinforce, field };
};
