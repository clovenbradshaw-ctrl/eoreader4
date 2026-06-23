// Record an experiment's outcome into the three persistent artifacts: update the
// pressure's archive entry (drawn → its verdict), append one ledger line, and upsert the
// regression-lock manifest. The ledger and locks are append/upsert logs; the archive entry
// is updated in place (a pressure's verdict is the one mutable field of its record, the
// projection of the experiment that ran it). Usage: node lab/record.mjs P001

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ARCHIVE = join(HERE, 'pressure-archive.jsonl');
const LEDGER = join(HERE, 'ledger.jsonl');
const LOCKS = join(HERE, 'regression-locks.jsonl');

// The outcomes this campaign has produced, keyed by pressure id. Each is the human-read
// distillation of the experiment's held key + blind verdict + the fix's layer.
const OUTCOMES = {
  P001: {
    difficulty: {
      underLiveEngine: 'gap — half-passes',
      note: 'The default (flag-off) engine READS every stream but cannot DISCRIMINATE novelty rate: at matched mass the constant reserve gives the identical bayes value to novel-rich and confirm-rich (margin 0.000). Intermediate difficulty, high gradient — a located gap a single signal-derived amplitude closes.',
    },
    verdict: 'confirmed',
    experiment: 'lab/exp/P001-novelty-reserve',
    capability: 'novelty-reserve-as-a-signal',
    claim: 'The significance/forward reserve should track the recent γ-decayed RATE of newcomers, not accumulated mass — high after newcomers, low after confirmation.',
    mechanism: 'noveltyRate (γ-decayed first-appearance rate) supplies the reserve AMPLITUDE; the fixed Born step (surpriseAt/forwardDist) is untouched. Context at the amplitude, law fixed.',
    layer: 'interior (src/core/surprise.js: noveltyRate) + the text reader wiring (src/perceiver/reading.js), behind RULES_REV',
    omnimodal: 'confirmed in TWO senses — text (parser organ) and frequency (pitch-identity adapter) — through identical interior code',
    scope: {
      holds: 'the significance (Bayesian-surprise) and forward (p(next)) reserve, any modality whose front-end emits comparable atoms',
      doesNotYet: 'the figure-field surprisal reserve (reading.js pNovel, line ~150) is still a constant — a follow-up pressure; and the rate path is gated OFF by default pending a wider generalization sweep before global default-on',
    },
    locks: ['tests/novelty-reserve.test.js'],
  },
};

const pid = process.argv[2] || 'P001';
const o = OUTCOMES[pid];
if (!o) { console.error(`no recorded outcome for ${pid}`); process.exit(1); }

// 1 — archive entry, updated in place.
const rows = readFileSync(ARCHIVE, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const row = rows.find((r) => r.id === pid);
if (!row) { console.error(`${pid} not in archive`); process.exit(1); }
row.difficulty = o.difficulty;
row.verdict = o.verdict;
row.experiment = o.experiment;
row.capability = o.capability;
writeFileSync(ARCHIVE, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

// 2 — ledger line (append-only).
const ledgerLine = {
  ts: new Date().toISOString(),
  pressure: pid,
  capability: o.capability,
  claim: o.claim,
  stimulusShape: rows.find((r) => r.id === pid).axes,
  verdict: o.verdict,
  mechanism: o.mechanism,
  layer: o.layer,
  omnimodal: o.omnimodal,
  scope: o.scope,
};
appendFileSync(LEDGER, JSON.stringify(ledgerLine) + '\n');

// 3 — regression-lock manifest (upsert).
const lockLine = {
  capability: o.capability,
  pressure: pid,
  lock: o.locks,
  precondition: 'flag OFF byte-identical; flag ON novel-rich<confirm-rich AND recent<stale; const collapses both (the gap precondition)',
  control: 'recent vs stale at matched mass & diversity — fails the day the constant secretly tracks novelty or the rate path stops',
  recordedAt: new Date().toISOString(),
};
let locks = existsSync(LOCKS) ? readFileSync(LOCKS, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
locks = locks.filter((l) => l.capability !== o.capability);
locks.push(lockLine);
writeFileSync(LOCKS, locks.map((l) => JSON.stringify(l)).join('\n') + '\n');

console.log(`recorded ${pid}: archive verdict→${o.verdict}, ledger +1, lock registered (${o.locks.join(', ')})`);
