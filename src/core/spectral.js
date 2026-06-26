// The density operator — the one interpretive object the Significance column reads.
//
// docs/cube.md #5/#6 and the significance-column spec: there is ONE interpretive
// object, a density operator
//
//     ρ(doc, frame) = Σₖ wₖ · sₖ · |vₖ⟩⟨vₖ| ,  trace-normalised,
//
// built purely from a document's cached unit vectors, salience-weighted by wₖ, with
// a SIGNED contribution sₖ from each unit's Resolution stance so an asserting reading
// and a defeating one of the same content INTERFERE rather than accumulate. ρ is the
// Horizon of the Significance row — the projection of the log into current
// interpretive state — and a mixture, not a vector, because a document is not one
// reading.
//
// This leaf is the linear algebra ONLY: it takes vectors, never an embedder and never
// a document, so it is testable with no corpus and the surfer stays acyclic (its only
// dependency is voidnull.js, the repo's Born rule, which the passes run their spectra
// against — not imported here, but this module is shaped to feed it). Three properties
// the column leans on, none bolted on:
//
//   • PURE ON VECTORS — never sees a modality, so the column runs unchanged on text,
//     audio, video (the cheap half of omnimodality, Track E).
//   • A PROBABILITY SIMPLEX — for an unsigned (PSD) build the eigenvalues are ≥0 and
//     sum to 1 (Born/Gleason), so ρ is at once the recognition object ("what readings
//     is this") and the prediction object ("what reading will the next unit fall
//     under, with what weight"). The signed build can leave the PSD cone; the spectrum
//     is then read by magnitude and the simplex claim is the unsigned default's.
//   • THE BASIS IS THE LOAD-BEARING CHOICE — ρ is meant to be built over the 27-cell
//     SIGNIFICANCE activations (classify/centroids.js), not raw embeddings, so its
//     eigenvectors are FRAMES (readings-under-a-frame), not TOPIC clusters. That
//     projection is the caller's job; this module is basis-agnostic and works in
//     whatever coordinates it is handed.
//
// The eigensolver is cyclic Jacobi for real symmetric matrices — exact to float
// tolerance, no dependency, trivially cheap at the 27-dim significance grain.

// ── matrix helpers (row-major arrays of arrays) ──────────────────────────────

const zeros = (n) => Array.from({ length: n }, () => new Array(n).fill(0));

const identity = (n) => {
  const I = zeros(n);
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
};

const matMul = (A, B) => {
  const n = A.length, m = B[0]?.length ?? 0, k = B.length;
  const C = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++)
    for (let p = 0; p < k; p++) {
      const a = A[i][p];
      if (a === 0) continue;
      for (let j = 0; j < m; j++) C[i][j] += a * B[p][j];
    }
  return C;
};

const transpose = (A) => {
  const n = A.length, m = A[0]?.length ?? 0;
  const T = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) T[j][i] = A[i][j];
  return T;
};

// Frobenius norm of a matrix — √Σ aᵢⱼ².
const frobenius = (A) => {
  let s = 0;
  for (const row of A) for (const x of row) s += x * x;
  return Math.sqrt(s);
};

// ── the symmetric eigensolver (cyclic Jacobi) ────────────────────────────────
//
// Diagonalise a real symmetric matrix A = V Λ Vᵀ. Returns eigenvalues (ascending is
// not guaranteed; the public eigenLenses sorts) and the eigenvectors as COLUMNS of V,
// surfaced as an array of unit row-vectors for convenience. Robust for the small
// (≤ a few hundred) symmetric matrices the significance basis produces.
export const symmetricEig = (Ain, { maxSweeps = 100, tol = 1e-14 } = {}) => {
  const n = Ain.length;
  if (n === 0) return { values: [], vectors: [] };
  const A = Ain.map(r => r.slice());
  const V = identity(n);

  const offDiagSq = () => {
    let s = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) s += A[p][q] * A[p][q];
    return s;
  };

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    if (offDiagSq() <= tol) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p][q];
        if (Math.abs(apq) < 1e-300) continue;
        const app = A[p][p], aqq = A[q][q];
        // Rotation that zeroes A[p][q]: t = tan(θ) from the standard Jacobi formula.
        const theta = (aqq - app) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        // Apply the rotation to rows/cols p,q of A.
        for (let i = 0; i < n; i++) {
          const aip = A[i][p], aiq = A[i][q];
          A[i][p] = c * aip - s * aiq;
          A[i][q] = s * aip + c * aiq;
        }
        for (let i = 0; i < n; i++) {
          const api = A[p][i], aqi = A[q][i];
          A[p][i] = c * api - s * aqi;
          A[q][i] = s * api + c * aqi;
        }
        // Accumulate the eigenvectors.
        for (let i = 0; i < n; i++) {
          const vip = V[i][p], viq = V[i][q];
          V[i][p] = c * vip - s * viq;
          V[i][q] = s * vip + c * viq;
        }
      }
    }
  }

  const values = [];
  for (let i = 0; i < n; i++) values.push(A[i][i]);
  // Eigenvectors as rows (column j of V is the eigenvector for values[j]).
  const vectors = [];
  for (let j = 0; j < n; j++) {
    const v = new Array(n);
    for (let i = 0; i < n; i++) v[i] = V[i][j];
    vectors.push(v);
  }
  return { values, vectors };
};

// ── buildDensity ─────────────────────────────────────────────────────────────
//
// ρ = Σₖ wₖ sₖ |vₖ⟩⟨vₖ|, trace-normalised. `vectors` is an array of equal-length
// real vectors (the unit activations); `weights` the salience wₖ (default 1);
// `signs` the ±1 Resolution polarity (default +1 — asserting). The trace is
// Σₖ wₖ sₖ |vₖ|²; normalising by it makes Tr(ρ)=1. With all signs +1 and weights ≥0
// the result is PSD (a proper density matrix); a signed build can leave the cone,
// which is the documented research territory (signs let contradiction subtract).
export const buildDensity = (vectors, weights = null, signs = null) => {
  const vs = (vectors || []).filter(v => Array.isArray(v) && v.length);
  const dim = vs.length ? vs[0].length : 0;
  if (!dim) return { rho: [], dim: 0, trace: 0 };

  const rho = zeros(dim);
  let trace = 0;
  for (let k = 0; k < vs.length; k++) {
    const v = vs[k];
    if (v.length !== dim) continue;            // ragged input → skip, never crash
    const w = (weights && Number.isFinite(weights[k])) ? weights[k] : 1;
    const s = (signs && Number.isFinite(signs[k])) ? signs[k] : 1;
    const a = w * s;
    if (a === 0) continue;
    for (let i = 0; i < dim; i++) {
      const ai = a * v[i];
      if (ai === 0) continue;
      for (let j = 0; j < dim; j++) rho[i][j] += ai * v[j];
    }
    let norm2 = 0;
    for (let i = 0; i < dim; i++) norm2 += v[i] * v[i];
    trace += a * norm2;
  }
  if (Math.abs(trace) > 1e-300) {
    for (let i = 0; i < dim; i++) for (let j = 0; j < dim; j++) rho[i][j] /= trace;
  }
  return { rho, dim, trace };
};

// ── eigenLenses ──────────────────────────────────────────────────────────────
//
// The document's natural readings, ranked by Born weight. weight = eigenvalue; lens =
// the unit eigenvector. Ranked by eigenvalue (descending) — for a PSD ρ these are the
// Born probabilities and form a simplex; for a signed ρ they are ranked by signed
// magnitude so the dominant reading still leads. `k` caps the returned count.
export const eigenLenses = (rho, { k = Infinity } = {}) => {
  if (!rho?.length) return [];
  const { values, vectors } = symmetricEig(rho);
  const pairs = values.map((weight, i) => ({ weight, lens: vectors[i] }));
  pairs.sort((a, b) => b.weight - a.weight);
  return Number.isFinite(k) ? pairs.slice(0, Math.max(0, k | 0)) : pairs;
};

// ── vonNeumann ───────────────────────────────────────────────────────────────
//
// S = −Σ λ ln λ over the eigenvalue spectrum — the concentration of readings (the
// NPOV scalar, and the predictive uncertainty of the next unit). 0 for a pure state
// (one eigenvalue 1), ln k for k equal eigenvalues (1/k each). Only positive
// eigenvalues contribute (0 ln 0 = 0; negative eigenvalues from a signed build are
// skipped — entropy is a property of the probability spectrum).
export const vonNeumann = (eigenvalues) => {
  let s = 0;
  for (const lambda of eigenvalues || []) {
    if (lambda > 1e-12) s -= lambda * Math.log(lambda);
  }
  return s;
};

// ── relEntropy (Umegaki, safe pseudo-log) ────────────────────────────────────
//
// S(ρ‖σ) = Tr(ρ ln ρ) − Tr(ρ ln σ), the quantum relative entropy — the Atmosphere
// pass's departure scalar (Track B). Computed through both spectra: with ρ = Σ λᵢ|i⟩⟨i|
// and σ = Σ μⱼ|j⟩⟨j|,
//     Tr(ρ ln ρ) = Σ λᵢ ln λᵢ,  Tr(ρ ln σ) = Σᵢⱼ λᵢ (ln μⱼ) |⟨i|j⟩|².
// The "safe pseudo-log" floors σ's eigenvalues at EPS so a σ near-null direction does
// not send the divergence to +∞ (which the exact Umegaki would, when ρ has support
// there). S(ρ‖ρ)=0 exactly: the overlaps collapse to δᵢⱼ and the two traces cancel.
const REL_EPS = 1e-12;
export const relEntropy = (rho, sigma) => {
  if (!rho?.length || !sigma?.length || rho.length !== sigma.length) return 0;
  const er = symmetricEig(rho);
  const es = symmetricEig(sigma);
  const n = rho.length;

  let trRlnR = 0;
  for (const lambda of er.values) if (lambda > REL_EPS) trRlnR += lambda * Math.log(lambda);

  let trRlnS = 0;
  for (let i = 0; i < n; i++) {
    const lambda = er.values[i];
    if (lambda <= REL_EPS) continue;
    const vi = er.vectors[i];
    for (let j = 0; j < n; j++) {
      const mu = es.values[j];
      const lnMu = Math.log(Math.max(mu, REL_EPS));   // pseudo-log floor
      const vj = es.vectors[j];
      let dot = 0;
      for (let p = 0; p < n; p++) dot += vi[p] * vj[p];
      trRlnS += lambda * lnMu * dot * dot;
    }
  }
  return Math.max(0, trRlnR - trRlnS);              // S(ρ‖σ) ≥ 0 (clamp float noise)
};

// ── projectorFrom / commutator ───────────────────────────────────────────────
//
// A projector onto a set of (unit) directions: Π = Σ |vᵢ⟩⟨vᵢ|. The Paradigm pass
// (Track D) compares the projectors of two competing bases.
export const projectorFrom = (vecs) => {
  const vs = (vecs || []).filter(v => Array.isArray(v) && v.length);
  const dim = vs.length ? vs[0].length : 0;
  const P = zeros(dim);
  for (const v of vs) {
    if (v.length !== dim) continue;
    for (let i = 0; i < dim; i++) {
      const vi = v[i];
      if (vi === 0) continue;
      for (let j = 0; j < dim; j++) P[i][j] += vi * v[j];
    }
  }
  return P;
};

// ‖[Π_A, Π_B]‖_F — the Frobenius norm of the commutator, the incommensurability
// scalar (Track D). Zero iff the two projectors share an eigenbasis (commute). Two
// bases learned from a corpus almost never commute exactly, so this is gated against
// a BASELINE, never against zero — the calibration the spec's "honest seam" demands.
export const commutator = (projA, projB) => {
  if (!projA?.length || !projB?.length || projA.length !== projB.length) return 0;
  const AB = matMul(projA, projB);
  const BA = matMul(projB, projA);
  const n = projA.length;
  const C = zeros(n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) C[i][j] = AB[i][j] - BA[i][j];
  return frobenius(C);
};

// matrix helpers exposed for the passes that assemble bases off ρ.
export { matMul, transpose, frobenius };
