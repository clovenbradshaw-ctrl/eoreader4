// THE ONE SURPRISE — the modality-agnostic core (Track A, docs/spec-one-surprise.md).
//
// There is exactly one surprise: D_KL(posterior ‖ prior) over a γ-decayed referent
// profile in a fixed basis. The profile is the BACKWARD object — the γ-decayed summary
// of what has arrived; the posterior is that profile advanced one step (every incumbent
// decays by γ, every atom delivered this step deposits γ⁰ = 1). A fixed NOVELTY reserve
// atom keeps the divergence defined on a newcomer (absolute continuity) and makes an
// opening fall to exactly zero on its own.
//
// This is the form `reading.js` already computed for the text Bayesian-surprise channel,
// lifted out verbatim so it is the ONLY form. The only modality-specific code is the
// FRONT-END map from raw signal into the basis: `prior` and `arrival` are Maps from a
// basis-atom (an arbitrary key — a proposition for text, a tonal move for music, a cell
// for the phasepost path) to a mass, and `axisLabel` renders an atom to a readable strain
// axis. Everything here — the posterior, the divergence, the reserve, the per-dimension
// contribution — is shared.
//
// Operations and their ORDER are preserved exactly from reading.js so the text path stays
// byte-identical: the parity gate is `node --test tests/*.test.js` (docs/spec-one-surprise.md).

export const NOVELTY_RESERVE = 1.0;   // reserved prior mass for an as-yet-unseen atom

// surpriseAt(prior, arrival, { gamma, novelty, axisLabel }) → { bayesBits, bayesBy }
//
//   prior     Map<atom, mass>  the γ-decayed profile BEFORE this step (the backward object)
//   arrival   Map<atom, mass>  the deposit delivered AT this step (the full unit)
//   gamma     the recency-decay kernel (the horizon)
//   novelty   the reserve atom's mass (protention)
//   axisLabel (atom) → label   front-end renderer for the per-dimension strain axis
//
// Returns the SIGNIFICANCE channel: `bayesBits` is the raw KL in bits (caller squashes /
// rounds), `bayesBy` is the per-dimension KL contribution (rounded) — the strain AXIS a
// boundary (REC) restructures along. The paired predictive channel (−log₂ p(arrival)) and
// the explicit forward distribution p(next) fold into this core in the next Track A step;
// the signature is shaped to carry them without disturbing this one.
export const surpriseAt = (prior, arrival, { gamma, novelty = NOVELTY_RESERVE, axisLabel = (k) => k } = {}) => {
  const support   = new Set([...prior.keys(), ...arrival.keys()]);
  const newcomers = [...arrival.keys()].filter(k => !prior.has(k));
  // The profile's own reserve probability — co-entrants split it, so the reserve is
  // never multiply-counted (a single newcomer gets all of it).
  const sumPrior  = [...prior.values()].reduce((s, m) => s + m, 0);
  const reserve   = novelty / (sumPrior + novelty);
  const newShare  = newcomers.length ? reserve / newcomers.length : 0;

  const postMass = new Map();
  let sumPost = 0;
  for (const k of support) {
    const m1 = gamma * (prior.get(k) || 0) + (arrival.get(k) || 0); // m′ = γ·m + deposits
    postMass.set(k, m1);
    sumPost += m1;
  }
  const denomPost = sumPost + novelty;
  const priorW = (k) => (prior.has(k) ? prior.get(k) : newShare);
  let sumW = novelty;
  for (const k of support) sumW += priorW(k);

  let bayesBits = 0;
  const bayesBy = {};                          // per-DIMENSION KL contribution — the strain AXIS the
  for (const k of support) {                   // enacted loop accumulates so a REC knows what broke it
    const pPost = postMass.get(k) / denomPost;
    if (pPost <= 0) continue;
    const c = pPost * Math.log2(pPost / (priorW(k) / sumW));
    bayesBits += c;
    if (c > 0) { const a = axisLabel(k); bayesBy[a] = round((bayesBy[a] || 0) + c); }  // belief moved TOWARD it
  }
  // The reserve atom (protention) — present in both prior and posterior, the term that
  // keeps the KL defined (absolute continuity) on every newcomer.
  {
    const pPost = novelty / denomPost;
    if (pPost > 0) bayesBits += pPost * Math.log2(pPost / (novelty / sumW));
  }
  bayesBits = Math.max(0, bayesBits);          // KL ≥ 0 (clamp float noise)
  return { bayesBits, bayesBy };
};

// p(next | profile) — THE FORWARD DISTRIBUTION (Track A, docs/spec-one-surprise.md).
//
// Surprise has two objects. The profile is the BACKWARD object — the γ-decayed summary of
// what has arrived. Scoring (and generating) also needs the FORWARD object: an explicit
// distribution over what arrives next. This is it: the profile renormalised into a proper
// distribution over the basis, with the NOVELTY reserve holding probability for an unseen
// atom (`reserve`). Σ p(dist) + reserve = 1.
//
// "Reading scores the arrival under p(next); generation draws from p(next)." Same object,
// two uses. It is exposed here for the DRAW (the generator's first act, Part II) and as the
// honest forward object the recognition core can already turn around into. It is NOT yet
// wired into the predictive SCORE — today's surprisal is an ad-hoc floored mean, not
// −log₂ p(arrival) under this distribution; adopting this for scoring changes the surprisal
// and ships behind RULES_REV with a parallel golden (the deferred Track A step).
export const forwardDist = (profile, { novelty = NOVELTY_RESERVE } = {}) => {
  const sum = [...profile.values()].reduce((s, m) => s + m, 0);
  const Z = sum + novelty;                       // reserve mass keeps it proper over an open basis
  const dist = [...profile.entries()]
    .map(([atom, m]) => [atom, m / Z])
    .sort((a, b) => b[1] - a[1]);                // ranked — the heaviest incumbents lead the draw
  return { dist, reserve: novelty / Z, Z };
};

// The NOVELTY reserve as a SIGNAL-DERIVED amplitude, not a constant.
//
// `surpriseAt`/`forwardDist` reserve a mass `novelty` for an as-yet-unseen atom —
// the Born amplitude for "something new arrives next", read off by the same fixed
// normalization every incumbent goes through: p(unseen) = novelty / (Σmass + novelty).
// Held CONSTANT (NOVELTY_RESERVE = 1.0) that amplitude is blind to whether newcomers
// have actually been arriving: p(unseen) then decays purely with accumulated mass, so
// the reader grows equally certain that nothing new will come whether it just saw a
// burst of newcomers or a long stretch of confirmation. That is the reader failing to
// learn from its own signal — a hand-rolled constant standing in for a rate the signal
// could teach.
//
// This is the fix the design prescribes: make the reserved AMPLITUDE track the recent
// novelty rate under the SAME γ the figure field decays by, then run it through the
// SAME fixed Born step. Context enters at the amplitude; the law stays put.
//
//   R_t = γ · R_{t-1} + newcomers_t
//
// R is a mass in the figure field's own units — a γ-accumulated count of newcomer
// events, deposited exactly as a sighting deposits γ⁰ = 1 to a figure and decayed by
// the same γ — so p(unseen) = R / (Σmass + R) is the fraction of recent deposits that
// were new. High after newcomers, low after a long stretch of confirmation, with no
// constant anywhere in the path.
//
// Absolute continuity (the property the constant was there to guarantee — a newcomer
// must never have probability exactly zero, or the KL diverges) is preserved WITHOUT a
// constant: seed R with the opening burst (at step 0 every atom is a newcomer, so
// R_0 = newcomers_0 ≥ 1 for any non-empty stream), and since R_t = γ·R_{t-1} + … ≥
// γ·R_{t-1} > 0 with 0 < γ < 1, R stays strictly positive for the whole reading. How
// low it falls in a confirmation tail is set by the opening novelty and the tail
// length — both signal, no designer number.
//
// ONE TIMESCALE IS NOT ENOUGH. A reserve that is only the γ-recent newcomer mass
// over-reacts at a regime change it has not yet seen: after a long confirmation
// stretch it has decayed near zero, so the FIRST newcomer of the next burst lands as
// a near-infinite surprise (a per-regime trace puts the entire deficit of the naive
// form on exactly this stretch→burst transition). The reactive estimator cannot
// anticipate a burst it has no recent evidence for.
//
// The fix keeps the law and stays signal-derived: anchor the fast γ-recent newcomer
// mass with a FLOOR at the reading's OWN long-run newcomer rate, so the reserve never
// falls below what a typical window of THIS reading carries. Both timescales are the
// signal's own counts — a γ-decayed recent count and a cumulative all-history rate —
// combined by the same `max` the void boundary uses (voidnull.js). No constant, no
// `+1` pseudo-count (the very "one over mass plus one" the design warns against):
//
//   dNew  = γ·dNew + newcomers      (fast: reactive recent newcomer mass)
//   dSteps= γ·dSteps + 1            (the decayed window size, → 1/(1−γ))
//   rate  = cumNewcomers / cumSteps (slow: the reading's own long-run newcomer rate)
//   R     = max(dNew, rate · dSteps)
//
// During a burst dNew dominates and R is reactive; during a stretch dNew decays out
// and R is HELD at `rate·dSteps` — the decayed-window newcomer mass this reading
// averages — so the next burst's opener is surprising in proportion to how overdue it
// was, never catastrophically. p(unseen) = R/(Σmass+R) is high after newcomers, low
// after a long stretch, and floored by the reading's own novelty rate. Absolute
// continuity holds without a constant: the opening deposits ≥1 newcomer, so cumNewcomers
// ≥ 1 thereafter and the floor is strictly positive for the whole reading.
//
// Streaming and modality-agnostic, the sibling of `createNoiseFloor` (voidnull.js):
// the driver `observe`s the newcomer count each step and hands `.mass` to the next
// step's Born normalization as `novelty`.
export const createNoveltyReserve = ({ gamma } = {}) => {
  if (!Number.isFinite(gamma) || gamma <= 0 || gamma >= 1) {
    throw new Error('createNoveltyReserve needs a decay 0 < gamma < 1');
  }
  let dNew = 0, dSteps = 0, cumNew = 0, cumSteps = 0;
  let seeded = false;
  return {
    // Advance one step. `newcomers` = atoms arriving this step that were never seen
    // before. The opening step seeds the fast accumulators (no decay before the first
    // deposit); thereafter the γ-decayed counts advance exactly as a figure's mass does.
    observe(newcomers = 0) {
      const n = Math.max(0, newcomers);
      dNew   = seeded ? gamma * dNew + n : n;
      dSteps = seeded ? gamma * dSteps + 1 : 1;
      cumNew += n; cumSteps += 1;
      seeded = true;
      return this.mass;
    },
    // The reserve amplitude as it stands — the mass to hand surpriseAt/forwardDist as
    // `novelty` for the NEXT step's Born normalization. Before the first observation a
    // cold caller falls back to the constant so absolute continuity always holds.
    get mass() {
      if (!seeded) return NOVELTY_RESERVE;
      const floor = (cumNew / cumSteps) * dSteps;   // the reading's own long-run newcomer mass
      return Math.max(dNew, floor);
    },
  };
};

const round = (x) => Math.round(x * 100) / 100;
