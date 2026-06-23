// Append helpers for the three persistent artifacts. The log is the source of
// truth; these files are an append-only record of the campaign, read at the start
// of every cycle (selection rules are re-reads of these, not intentions).

import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVE = join(ROOT, 'archive.jsonl');
const LEDGER = join(ROOT, 'ledger.jsonl');
const COVERAGE = join(ROOT, 'coverage.json');

const ensure = (p) => { if (!existsSync(dirname(p))) mkdirSync(dirname(p), { recursive: true }); };
const appendLine = (p, obj) => { ensure(p); appendFileSync(p, JSON.stringify(obj) + '\n'); };
const readLines = (p) => existsSync(p)
  ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : [];

// A pressure: id, axes draw, seed of record, difficulty under the live engine,
// novelty against the rest, verdict.
export const appendPressure = (p) => appendLine(ARCHIVE, { ts: new Date().toISOString(), ...p });
export const readArchive = () => readLines(ARCHIVE);

// One experiment line: capability, claim, stimulus shape, verdict, mechanism,
// the layer of any fix, and the scope where it holds and where it does not.
export const appendLedger = (l) => appendLine(LEDGER, { ts: new Date().toISOString(), ...l });
export const readLedger = () => readLines(LEDGER);

// Coverage — which sites/cells the runs have exercised (bias the cold regions).
export const bumpCoverage = (keys) => {
  ensure(COVERAGE);
  const cov = existsSync(COVERAGE) ? JSON.parse(readFileSync(COVERAGE, 'utf8')) : {};
  for (const k of [].concat(keys)) cov[k] = (cov[k] || 0) + 1;
  writeFileSync(COVERAGE, JSON.stringify(cov, null, 2) + '\n');
  return cov;
};
export const readCoverage = () =>
  existsSync(COVERAGE) ? JSON.parse(readFileSync(COVERAGE, 'utf8')) : {};

export { ROOT };
