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

export const NOVELTY_RESERVE = 1.0;   // reserved prior mass for an as-yet-unseen atom (the constant default)

// THE NOVELTY AMPLITUDE — the signal-derived reserve, modality-agnostic (the constant hunt).
//
// A constant reserve (NOVELTY_RESERVE) run through the Born step `reserve = novelty /
// (Σmass + novelty)` is blind to whether newcomers have actually been arriving: only the
// accumulated mass moves it, so the reader grows equally certain that nothing new will come
// whether it just saw three first-appearances or none. That is the reader failing to learn
// from its own signal. The fix is not a better formula — it is to make the reserve AMPLITUDE
// track the recent novelty RATE under the SAME γ-decay kernel the figure field uses, then run
// it through the SAME fixed Born step. Context enters at the amplitude; the law is untouched.
//
//   firstSeenSteps  the reading-step index at which each DISTINCT basis-atom first appeared
//   at              the cursor step — only first-appearances strictly before it count (causal)
//   gamma           the same recency kernel the profile decays under (commensurate units)
//
// Returns Σ γ^(at-1-j) over first-appearances j < at: a γ-decayed count of newcomers, in the
// same units as the γ-mass field, so the two are comparable inside the Born ratio. High right
// after a burst of newcomers; decaying toward zero across a stretch of pure confirmation. The
// recipe is the SAME for every sense — a proposition for text, a unit for a melody — only the
// front-end that supplies the first-appearance steps differs.
export const noveltyAmplitude = (firstSeenSteps, at, gamma) => {
  let amp = 0;
  for (const j of firstSeenSteps) if (j < at) amp += Math.pow(gamma, at - 1 - j);
  return amp;
};

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

const round = (x) => Math.round(x * 100) / 100;
