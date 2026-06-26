// Meaning is not extracted. It is conjectured by a self, and refuted by what follows.
//
// The corpus harvest settled it empirically: meaning is not in the structure to be read off
// (the structural learner found only form — copular rigidity, boilerplate — never sense),
// and it is not in the distribution either (the embedder was moved to VOX for the same
// reason). Both are EXTRACTION, and there is nothing to extract. A relation's meaning is the
// inferential role a self ASSIGNS it — what the self, having met it, expects it to license —
// posited as a guess, committed to as a prediction, and kept only while the world does not
// refute it. Meaning is conjecture-and-refutation (Popper) over inferential role
// (Wittgenstein's use, Brandom's consequence), owned by the one doing the guessing.
//
// THE SELF EARNS ITS NAME by three things a lookup table cannot do (and nothing more is
// claimed):
//   1. FALLIBLE — the conjecture predicts, so it can be wrong; sustained refutation
//      overturns it. A table-extracted type cannot be wrong; it merely is.
//   2. OWNED — the conjecture comes through the ENACTOR door (reafference, mine) and so it
//      CANNOT witness itself true (core/provenance). Only the consequence that actually
//      follows — exafference, the world, not-mine, which CAN witness — corroborates or
//      refutes it. The self/world line is the refutation loop: my guess never confirms
//      itself; the world does. A meaning a self made is mine; a fact it was given is not.
//   3. PERSPECTIVAL — two selves with different reading histories hold different conjectures
//      for the same relation. Extraction from a shared corpus is identical for everyone;
//      conjecture is indexed to the self and its trajectory of refutations.

import { fromEnactor, fromPerceiver, isMine, canWitness } from '../core/index.js';

const round = (x) => Math.round(x * 1e4) / 1e4;

// createConjecturer — a self that holds conjectured meanings and revises them by refutation.
//
//   meet(relation, consequence) — the self meets `relation` and observes the `consequence`
//     it licensed THIS time (a categorical token: the operator it led to, the kind of target
//     it took, an outcome — any witnessed signal). On first sight the self ABDUCES the
//     simplest meaning ("it leads to what just followed") as its conjecture. On later sights
//     it TESTS: a match corroborates (support grows, strain relaxes); a mismatch is the world
//     refuting (strain grows). When refutation outweighs support the conjecture is OVERTURNED
//     and re-abduced from the fresh evidence — a REC at the level of meaning.
//
//   meaningOf(relation) — the self's CURRENT surviving conjecture: what it predicts the
//     relation licenses, its confidence (corroboration vs refutation), whether it is mine,
//     and how many times the world has overturned it. Never a cluster read off a corpus.
export const createConjecturer = () => {
  const held = new Map();   // relation → { predicts, support, strain, prov, revisions, seen }

  const meet = (relation, consequence) => {
    // the consequence is exafferent — it comes from the world, and so it is what CAN witness
    // (anchor or refute) the self's guess. The guess itself never can.
    const evidence = fromPerceiver();
    let c = held.get(relation);
    if (!c) {
      // ABDUCE: posit the simplest meaning consistent with the one case seen. The guess is
      // the self's — reafference, mine, and unable to confirm itself.
      c = { predicts: consequence, support: 1, strain: 0, prov: fromEnactor('conjecture'), revisions: 0, seen: 1 };
      held.set(relation, c);
      return Object.freeze({ relation, conjecture: c.predicts, status: 'posited', mine: isMine(c.prov), witnessedBy: canWitness(evidence) });
    }
    c.seen += 1;
    if (consequence === c.predicts) {
      c.support += 1; if (c.strain > 0) c.strain -= 1;
      return Object.freeze({ relation, conjecture: c.predicts, status: 'corroborated', mine: true, witnessedBy: canWitness(evidence) });
    }
    // the world did not do what the conjecture predicted — a refutation.
    c.strain += 1;
    if (c.strain > c.support) {
      c.predicts = consequence; c.support = 1; c.strain = 0; c.revisions += 1;
      return Object.freeze({ relation, conjecture: c.predicts, status: 'overturned', mine: true, witnessedBy: canWitness(evidence) });
    }
    return Object.freeze({ relation, conjecture: c.predicts, status: 'strained', mine: true, witnessedBy: canWitness(evidence) });
  };

  const meaningOf = (relation) => {
    const c = held.get(relation);
    if (!c) return null;
    return Object.freeze({
      relation,
      predicts: c.predicts,                                   // meaning AS the inferential role it licenses
      confidence: round(c.support / (c.support + c.strain)),  // corroboration vs refutation, not frequency
      mine: isMine(c.prov),                                   // a conjecture I made — reafferent
      canWitnessItself: canWitness(c.prov),                   // false: my guess cannot confirm itself
      revisions: c.revisions,                                 // how many times the world overturned it
      seen: c.seen,
      conjecturedNotExtracted: true,
    });
  };

  return Object.freeze({
    meet, meaningOf,
    holds: () => [...held.keys()],
    snapshot: () => [...held.entries()].map(([relation, c]) => ({ relation, predicts: c.predicts, support: c.support, strain: c.strain, revisions: c.revisions, seen: c.seen })),
  });
};
