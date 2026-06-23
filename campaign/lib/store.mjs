// The archive + ledger — the campaign's append-only memory.
//
// Mirrors the engine's own discipline: the log is the source of truth, everything
// else is a projection. Two JSONL files, append-only:
//
//   pressure-archive.jsonl  the POPULATION of pressures (selection reads this to
//                           score novelty against the rest and to stop generating
//                           near the flat ones).
//   ledger.jsonl            one line per EXPERIMENT (capability, claim, verdict,
//                           mechanism, fix layer, scope).
//
// A pressure carries its seed of record so it is replayable; a ledger line carries
// the layer of any fix so the map records WHERE a capability lives.

import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ARCHIVE = join(HERE, '..', 'pressure-archive.jsonl');
const LEDGER  = join(HERE, '..', 'ledger.jsonl');

const readJsonl = (path) => (existsSync(path)
  ? readFileSync(path, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : []);
const appendJsonl = (path, obj) => appendFileSync(path, JSON.stringify(obj) + '\n');

// A pressure: { id, drawnAt, seedOfRecord:[{title,revision}], target (cell),
//   modality, kind, level, horizon, source ('domain-injection'|'orthogonal-collision'|
//   'structured-draw'|'mutation'|'empty-cell'), stimulusShape, difficulty (0..1 under
//   the live engine — intermediate is kept), novelty (0..1 vs archive), verdict }
export const appendPressure = (p) => appendJsonl(ARCHIVE, p);
export const pressures = () => readJsonl(ARCHIVE);

// A ledger line: { id, capability, claim, stimulusShape, verdict
//   ('confirmed'|'gap-located'|'fixed'|'flat'|'limit-named'), mechanism, layer
//   ('interior'|'organ'|'convention'|'n/a'), senses:[...], scope:{holds,fails}, lock }
export const appendLedger = (e) => appendJsonl(LEDGER, { ts: new Date().toISOString(), ...e });
export const ledger = () => readJsonl(LEDGER);

// Novelty of a candidate pressure against the archive: 1 minus the fraction of
// prior pressures sharing its (target, modality, kind, source) signature. A draw
// far from everything tried scores ~1; a near-repeat scores low. Selection keeps
// high-novelty, intermediate-difficulty pressures and stops near the flat ones.
export const noveltyAgainstArchive = (cand) => {
  const prior = pressures();
  if (!prior.length) return 1;
  const sig = (p) => `${p.target}|${p.modality}|${p.kind}|${p.source}`;
  const s = sig(cand);
  const shared = prior.filter(p => sig(p) === s).length;
  return 1 - shared / prior.length;
};
