// The locus adapter — a window of DNA → reading vectors (vₖ), weights (wₖ), and
// stance signs (sₖ), the three columns the density operator ρ is built from
// (docs/genome-rho.md). This is the one piece of real design the genome-ρ experiment
// needs; everything downstream is core/spectral.js, unmodified.
//
// A "reading vector" of a codon is its prefix spectrum — the first base, the first two,
// the whole triplet — the same representation the codon organ (organs/in/codon.js)
// used to recover the genetic code's 16 boxes. Here those vectors populate ρ instead of
// the equivalence reader, so the question shifts from "which codons are one family" to
// "how many readings is this locus under, and do they interfere".

const BASES = ['A', 'C', 'G', 'T'];
const COMP = { A: 'T', T: 'A', C: 'G', G: 'C', N: 'N' };
const STOPS = new Set(['TAA', 'TAG', 'TGA']);   // standard code, DNA spelling

export const complement = (b) => COMP[b] || 'N';
export const reverseComplement = (seq) => {
  let out = '';
  for (let i = seq.length - 1; i >= 0; i--) out += complement(seq[i]);
  return out;
};

// Parse a single-record FASTA into a bare uppercase sequence (drops the header and all
// whitespace; non-ACGT letters are kept as-is so the codon filter can skip them).
export const parseFasta = (text) => {
  const lines = String(text).split(/\r?\n/);
  let seq = '';
  for (const ln of lines) { if (ln.startsWith('>')) continue; seq += ln.replace(/\s/g, ''); }
  return seq.toUpperCase();
};

// The codons of a sequence in a given 0-based frame. Skips any triplet that runs off
// the end or carries a non-ACGT base — never a phantom codon.
export const codonsOf = (seq, frame = 0) => {
  const out = [];
  for (let i = frame; i + 3 <= seq.length; i += 3) {
    const c = seq.slice(i, i + 3);
    if (/^[ACGT]{3}$/.test(c)) out.push(c);
  }
  return out;
};

export const isStop = (codon) => STOPS.has(codon);

// ── the reading vector ────────────────────────────────────────────────────────
//
// Two bases on offer, both fixed-dimension so every codon lands in the same space:
//   'prefix'   84-dim — p1 (4) + p2 (16) + p3 (64). The codon-organ representation;
//              RC is NOT a coordinate map here, so it can reveal RC-non-equivariance.
//   'position' 12-dim — 3 positions × 4 bases, one-hot. RC acts as a fixed linear
//              permutation+swap of coordinates, so ρ_rc = P ρ_fwd Pᵀ (isospectral) —
//              the analytically transparent control.
const prefixIndex = (() => {
  const idx = new Map();
  let n = 0;
  for (const a of BASES) idx.set(a, n++);
  for (const a of BASES) for (const b of BASES) idx.set(a + b, n++);
  for (const a of BASES) for (const b of BASES) for (const c of BASES) idx.set(a + b + c, n++);
  return idx;
})();
const PREFIX_DIM = prefixIndex.size;       // 84
const POSITION_DIM = 12;

export const codonVector = (codon, basis = 'prefix') => {
  if (basis === 'position') {
    const v = new Array(POSITION_DIM).fill(0);
    for (let p = 0; p < 3; p++) v[p * 4 + BASES.indexOf(codon[p])] = 1;
    return v;
  }
  const v = new Array(PREFIX_DIM).fill(0);
  v[prefixIndex.get(codon[0])] = 1;
  v[prefixIndex.get(codon.slice(0, 2))] = 1;
  v[prefixIndex.get(codon)] = 1;
  return v;
};

export const vectorDim = (basis = 'prefix') => (basis === 'position' ? POSITION_DIM : PREFIX_DIM);

// ── columns for ρ ───────────────────────────────────────────────────────────────
//
// A window read codon-by-codon: the vectors that go straight into buildDensity. The
// default weights/signs (1, +1) give the plain asserting density; callers override
// `signs` to make a competing reading subtract (the interference build).
export const codonReadings = (seq, { frame = 0, basis = 'prefix' } = {}) => {
  const codons = codonsOf(seq, frame);
  return { codons, vectors: codons.map((c) => codonVector(c, basis)) };
};

// A frame's reading summarised as one vector: the salience-normalised sum of its codon
// vectors (a codon-usage signature), paired with a model-free coding salience — the
// frame's freedom from stop codons. A real ORF has no internal stops, so its salience
// is high; an out-of-frame reading collects stops and is down-weighted. No annotation,
// no model: the stop codons do the discriminating.
export const frameReading = (seq, frame, { basis = 'prefix' } = {}) => {
  const codons = codonsOf(seq, frame);
  const dim = vectorDim(basis);
  const sum = new Array(dim).fill(0);
  let stops = 0, run = 0, longestRun = 0;
  for (const c of codons) {
    if (isStop(c)) { stops++; run = 0; } else { run++; if (run > longestRun) longestRun = run; }
    const v = codonVector(c, basis);
    for (let i = 0; i < dim; i++) sum[i] += v[i];
  }
  let norm = 0; for (const x of sum) norm += x * x; norm = Math.sqrt(norm) || 1;
  const vector = sum.map((x) => x / norm);
  // Coding salience: the longest STOP-FREE RUN as a fraction of the frame, squared. An
  // ORF is one long uninterrupted run (robust to a terminal stop, unlike a raw count);
  // an out-of-frame reading is chopped into short runs. The weight wₖ. No model.
  const orf = codons.length ? longestRun / codons.length : 0;
  return { frame, codons: codons.length, stops, longestRun, salience: orf * orf, vector };
};

// All six reading frames of a window (3 forward + 3 on the reverse complement), each as
// a (vector, salience) pair — the units of the reading-frame ρ (Test 2).
export const sixFrameReadings = (seq, { basis = 'prefix' } = {}) => {
  const rc = reverseComplement(seq);
  const fwd = [0, 1, 2].map((f) => ({ ...frameReading(seq, f, { basis }), strand: '+' }));
  const rev = [0, 1, 2].map((f) => ({ ...frameReading(rc, f, { basis }), strand: '-' }));
  return [...fwd, ...rev];
};
