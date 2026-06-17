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
// A model may also have an opinion about a referent. It does NOT get to write
// that opinion into the field: a witness observes, it does not decide. The
// fold-safe shape is a deposition — the model emits a Given event ("read `he`
// as Gregor here"), append-only and addressed, and the fold weighs it as
// testimony beside the count and the γ-mass. `reinforce` below is the wrong
// door — an injection straight into the field — kept inert and unwired (the
// firewall holding) until that deposition path exists, after the SEG rework.

export const createCorefField = ({ gamma = 0.7, maxDist = 8 } = {}) => {
  const traces = new Map(); // id → { lastIdx, mass }

  const note = (id, sentIdx) => {
    const tr = traces.get(id) || { lastIdx: sentIdx, mass: 0 };
    // Decay the standing mass to *now*, then add this sighting's unit mass.
    tr.mass = tr.mass * Math.pow(gamma, Math.max(0, sentIdx - tr.lastIdx)) + 1;
    tr.lastIdx = sentIdx;
    traces.set(id, tr);
  };

  // WRONG DOOR — kept inert, never called. A direct mass write is the model
  // deciding a referent, the move the witness/fold split forbids. A model's
  // influence must enter as a deposited Given event the fold reads as
  // testimony, never as an injection here. See header; do not wire until then.
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
