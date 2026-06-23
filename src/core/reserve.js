// THE CONTEXTUAL NOVELTY RESERVE — the reserve as a Born AMPLITUDE the signal teaches,
// not a hand-set constant.
//
// surpriseAt (surprise.js) reserves prior mass `novelty` for an as-yet-unseen atom; that
// reserve sets how EXPECTED a newcomer is, and so how far a newcomer moves belief. The
// shipped reserve is the fixed NOVELTY_RESERVE = 1.0, and a fixed reserve is blind to
// whether newcomers have actually been ARRIVING: a newcomer after a long drought and a
// newcomer in the middle of a churn get the same reserve, so the reader "grows equally
// certain that nothing new will come whether it just saw three newcomers or none." That is
// the reader failing to learn from its own signal.
//
// This is the fix the campaign names: keep the Born LAW fixed (surpriseAt is unchanged),
// and make the AMPLITUDE that flows into it track the recent novelty RATE under the SAME γ
// the figure field decays by:
//
//   reserve(at) = γ^at · seed  +  Σ_{k < at} newcomers(k) · γ^(at-1-k)
//
// • the sum is the γ-decayed count of newcomer ARRIVALS before the cursor — the same
//   recency kernel γ^(at-1-k) the figure field (priorProp) is built with, so the reserve
//   lives on the same scale as the masses it guards. High after a run of newcomers, low
//   after a drought.
// • the seed (default 1.0) is the OPENING reserve: at at=0 it is exactly the fixed reserve,
//   so reading the first line is byte-identical — then it DECAYS as γ^at → 0, so there is
//   no standing constant in the path asymptotically, only the decayed rate.
// • γ·(running) keeps the reserve strictly positive at every finite step, so the KL stays
//   defined on a newcomer (the absolute-continuity job the fixed reserve did).
//
// Modality-agnostic: it counts newcomers and knows nothing of what an atom MEANS — text,
// tone, or any organ whose front-end can say "this many atoms are new at this line" gets a
// rate-aware reserve, through the one fixed Born step. The basis (what counts as an atom)
// is the caller's; the decay math is the genome's.

export const RESERVE_SEED = 1.0;   // the OPENING reserve; decays as γ^at, never a standing constant

// contextualReserve(newcomersPerLine, at, { gamma, seed }) → reserve amplitude
//
//   newcomersPerLine  number of atoms first seen at each line k (index = line, value = count)
//   at                the reading cursor; the reserve is the PRIOR expectation BEFORE this line
//   gamma             the recency-decay kernel (the same γ the figure field uses)
//   seed              the opening reserve (default RESERVE_SEED), which decays away
export const contextualReserve = (newcomersPerLine, at, { gamma, seed = RESERVE_SEED } = {}) => {
  let reserve = Math.pow(gamma, at) * seed;                 // the opening reserve, receding
  const last = Math.min(at, newcomersPerLine.length);
  for (let k = 0; k < last; k++) {
    const n = newcomersPerLine[k] || 0;
    if (n) reserve += n * Math.pow(gamma, at - 1 - k);      // a newcomer arrival at k, γ-decayed to at
  }
  return reserve;
};
