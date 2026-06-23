// E003 — inside-out MUTATION PROBE on the reserve mechanism. Read-only, throwaway:
// the point is not to keep any mutation, it is what the mutation reveals about
// which lines are load-bearing and where coverage is thin.
//
// A perturbation that breaks exactly one confirmed capability shows which experiment
// locks that line (a regression lock you can name precisely). A perturbation that
// changes no result means the code is dead or untested w.r.t. the archive — and the
// finding is a missing pressure. Each variant is injected through surpriseAt's
// `novelty` parameter (no production edit), reproducing E001's confound-free stream
// dissociation under a different reserve law.

import { surpriseAt } from '../../../src/core/index.js';

const G = 0.7;
// E001's two surface-matched contexts at the probe cursor (figure field only).
const m = (o) => new Map(Object.entries(o));
const earlyPrior = m({ 'f:e1': G ** 7, 'f:e2': G ** 6,
  'f:e3': G ** 5 + G ** 4 + G ** 3 + G ** 2 + G ** 1 + G ** 0 });
const latePrior = m({ 'f:e1': G ** 7 + G ** 6 + G ** 5 + G ** 4 + G ** 3 + G ** 2,
  'f:e2': G ** 1, 'f:e3': G ** 0 });
const deposit = m({ 'f:e9': 1 });               // the newcomer probe
const earlyFirst = [0, 1, 2], lateFirst = [0, 6, 7], at = 8;

// The canonical fix and a set of structure-preserving perturbations of it.
const variants = {
  canonical:        (fs) => fs.reduce((s, f) => f < at ? s + G ** (at - 1 - f) : s, 0),
  'constant-revert':(fs) => 1.0,                                   // undo the fix
  'no-decay':       (fs) => fs.filter(f => f < at).length,         // raw newcomer count (drop γ)
  'reversed-decay': (fs) => fs.reduce((s, f) => f < at ? s + G ** f : s, 0), // weight OLD newcomers
  'off-by-one':     (fs) => fs.reduce((s, f) => f < at ? s + G ** (at - f) : s, 0), // shift the exponent
};

const margin = (reserveFn) => {
  const re = reserveFn(earlyFirst), rl = reserveFn(lateFirst);
  const be = surpriseAt(earlyPrior, deposit, { gamma: G, novelty: re }).bayesBits;
  const bl = surpriseAt(latePrior, deposit, { gamma: G, novelty: rl }).bayesBits;
  return { reserveEarly: round3(re), reserveLate: round3(rl), bayesEarly: be, bayesLate: bl, signalMargin: round3(be - bl) };
};

const CAPABILITY_THRESHOLD = 0.1;   // E001's lock: signalMargin must exceed this
const out = { experiment: 'E003-reserve-mutation-probe', source: 'inside-out (mutation probe)',
  site: 'src/core/surprise.js#noveltyReserve', variants: {}, findings: [] };

for (const [name, fn] of Object.entries(variants)) {
  const r = margin(fn);
  const holds = r.signalMargin > CAPABILITY_THRESHOLD;
  out.variants[name] = { ...r, E001holds: holds };
}

// Load-bearing analysis: every perturbation of the reserve should BREAK E001
// (drop the margin below threshold). If one does not, that part of the law is dead.
for (const [name, v] of Object.entries(out.variants)) {
  if (name === 'canonical') continue;
  out.findings.push(v.E001holds
    ? `LIVE-BUT-UNLOCKED: '${name}' still passes E001 (margin ${v.signalMargin}) — the lock does not constrain this dimension; write a pressure for it`
    : `LOAD-BEARING: '${name}' breaks E001 (margin ${v.signalMargin} ≤ ${CAPABILITY_THRESHOLD}) — E001 locks this line precisely`);
}

// Coverage bridge: sites no archive experiment would catch under perturbation —
// the runner's cold regions. Perturbing them changes nothing in E001/E002 because
// they are off the reserve path: that absence is itself data (a missing pressure).
out.coverageGap = {
  note: 'these interior sites are not on the reserve path, so no current experiment '
      + 'would catch a perturbation of them — each is a pressure waiting to be drawn',
  coldSites: ['src/core/voidnull.js#deriveNull', 'src/core/voidnull.js#extremeValueZ', 'src/predict/predictor.js#FLAT_CONCENTRATION'],
};

console.log(JSON.stringify(out, null, 2));
function round3(x) { return Math.round(x * 1000) / 1000; }
