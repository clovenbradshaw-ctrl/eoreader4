// The substrate's append-only writers + difficulty/novelty scoring.
//
// Three persistent artifacts every later step re-reads (the selection rules are
// re-reads of these, not intentions):
//   archive.jsonl  the population of pressures tried — stimulus shape, seed of
//                  record, difficulty under the live engine, novelty vs the rest,
//                  verdict. The seed makes every draw replayable.
//   ledger.jsonl   one appended line per experiment — capability, claim, stimulus
//                  shape, verdict, mechanism, fix layer, scope (where it holds / not).
//   coverage.json  which sites the runs have exercised, so the inside-out draw can
//                  be biased toward the cold regions.

import { readFileSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ARCHIVE = join(ROOT, 'archive.jsonl');
export const LEDGER = join(ROOT, 'ledger.jsonl');
export const COVERAGE = join(ROOT, 'coverage.json');

export const readArchive = () => (existsSync(ARCHIVE)
  ? readFileSync(ARCHIVE, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  : []);
export const readLedger = () => (existsSync(LEDGER)
  ? readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  : []);

export const appendArchive = (entry) => appendFileSync(ARCHIVE, JSON.stringify(entry) + '\n');
export const appendLedger = (entry) => appendFileSync(LEDGER, JSON.stringify(entry) + '\n');

// NOVELTY of a pressure against the archive — a shape distance, so the loop can keep
// high-novelty draws and stop generating near the ones that came back flat. Simple and
// honest: the fraction of axis values that no prior pressure shares on the same axis.
export const noveltyOf = (axes, archive = readArchive()) => {
  const fields = ['target', 'modality', 'kind', 'level', 'horizon'];
  if (!archive.length) return 1;
  let fresh = 0;
  for (const f of fields) {
    const seen = archive.some((p) => p.axes && p.axes[f] === axes[f]);
    if (!seen) fresh++;
  }
  return Math.round((fresh / fields.length) * 100) / 100;
};

// DIFFICULTY band from an experiment's margins. We keep the EDGE — a pressure that
// everything passes (flat) and one nothing could pass (flat) are both uninformative.
//   'flat-easy'  the cheap/control channel already separates → no gradient
//   'flat-hard'  nothing separates → no gradient (or a missing organ)
//   'edge'       the mechanism channel separates where the control does not → KEEP
export const difficultyBand = ({ controlSeparates, mechanismSeparates }) => {
  if (controlSeparates) return 'flat-easy';
  if (!mechanismSeparates) return 'flat-hard';
  return 'edge';
};

export const writeCoverage = (cov) => writeFileSync(COVERAGE, JSON.stringify(cov, null, 2) + '\n');
export const readCoverage = () => (existsSync(COVERAGE) ? JSON.parse(readFileSync(COVERAGE, 'utf8')) : { sites: {} });

// Bump a code site's exercised count (inside-out cold-region bias reads this).
export const bumpSite = (site) => {
  const cov = readCoverage();
  cov.sites[site] = (cov.sites[site] || 0) + 1;
  writeCoverage(cov);
};
