// probe — the Koestlerian probe: an autonomous inelegance surveyor (add-on spec).
//
// The probe surveys the code for inelegance, where inelegance is a measurable
// departure from Koestler's holon health (clean membrane, stable sub-whole, …),
// not a matter of taste. It is itself a clean holon: a perceiver-surfer that
// constitutes the module/holon graph (graph.js), measures holon-strain signatures
// (detectors.js), navigates to where strain gathers, and REPORTS a ranked map. It
// never edits — autonomy is in the finding, not the fixing — and it abstains (fires
// NUL) on what it cannot assess. A probe that edited would itself be a fused holon
// (perceiving and enacting with no membrane); it must not commit the inelegance it
// hunts.
//
// The gate is the system's own significance engine: a finding is reported only if
// its strain beats the derived null over the codebase's own distribution of strain
// (core/voidnull.deriveNull) — alpha the one knob, the probe's pickiness. A
// signature with too thin a distribution to derive a null is NOT assessed (never
// "fine", never flagged). Every reported finding cites the Koestler criterion it
// violates; one that cannot is taste, and is suppressed by construction.

import { deriveNull } from '../core/index.js';
import { crawlGraph } from './graph.js';
import { DETECTORS } from './detectors.js';

// A signature needs at least this many strain samples to derive an honest null. A
// thinner distribution cannot be gated against chance, so the probe abstains on it.
const MIN_BACKGROUND = 4;

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sd = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};

// survey — run the probe over a source root and return the ranked holon-strain map.
// Read-only: it crawls and measures, it does not touch the code. `commit` dates the
// map (golden-safe: findings are dated to a snapshot). A graph may be injected (for
// tests) instead of crawling the filesystem.
export const survey = ({ root = 'src', cwd = process.cwd(), alpha = 0.01, commit = null, graph = null } = {}) => {
  const g = graph || crawlGraph({ root, cwd });

  const findings = [];
  const assessed = [];
  const notAssessed = [];

  for (const detect of DETECTORS) {
    const { signature, findings: raw, background } = detect(g);

    // Abstain (NUL) when the distribution is too thin to derive an honest null —
    // not assessed, never silently approved or flagged.
    if (!background || background.length < MIN_BACKGROUND) {
      notAssessed.push({ signature, reason: 'distribution too thin to derive a null' });
      continue;
    }
    // Can a null be derived over this distribution at all? If not (e.g. degenerate),
    // the signature is not assessed. If yes, it IS assessed — and reports clean when
    // nothing beats the null. Assessed-and-clean is not the same as not-assessed.
    const probeNull = deriveNull(background, { scale: 'linear', alpha });
    if (!Number.isFinite(probeNull)) {
      notAssessed.push({ signature, reason: 'null underivable over the distribution' });
      continue;
    }
    assessed.push(signature);
    const m = mean(background), s = sd(background);
    for (const f of raw) {
      const nul = deriveNull(background, { scale: 'linear', alpha, leaveOut: f.strain });
      if (Number.isFinite(nul) && f.strain > nul) {
        findings.push(Object.freeze({
          ...f,
          null: Number(nul.toFixed(3)),
          z: s > 0 ? Number(((f.strain - m) / s).toFixed(2)) : 0,
        }));
      }
    }
  }

  // Rank by strain beyond the null (z), gravest first — the surfing sweep's peaks.
  findings.sort((a, b) => b.z - a.z || b.strain - a.strain);

  return Object.freeze({
    commit, alpha,
    findings: Object.freeze(findings),
    assessed: Object.freeze(assessed),
    notAssessed: Object.freeze(notAssessed),
  });
};

// renderMap — the ranked holon-strain map as text (the probe's one interface to the
// human, §5). A survey, not a patch.
export const renderMap = (report) => {
  const lines = [];
  lines.push(`Koestlerian probe — holon-strain map  (alpha ${report.alpha}${report.commit ? `, @${report.commit}` : ''})`);
  lines.push(`assessed: ${report.assessed.join(', ') || '—'}`);
  if (report.notAssessed.length) {
    lines.push(`not assessed (abstained): ${report.notAssessed.map(n => n.signature || n).join(', ')}`);
  }
  lines.push('─'.repeat(64));
  if (!report.findings.length) {
    lines.push('no finding beats the null — the surveyed region is clean.');
  }
  for (const f of report.findings) {
    lines.push(`FINDING  ${f.signature}   strain ${f.strain}  (z ${f.z}, null ${f.null})`);
    lines.push(`  locus     ${f.locus}`);
    lines.push(`  evidence  ${f.evidence.join('  ')}`);
    lines.push(`  criterion ${f.criterion}`);
    lines.push('');
  }
  return lines.join('\n');
};

export { crawlGraph } from './graph.js';
export { DETECTORS, membraneBreaches, fusedHolons } from './detectors.js';
