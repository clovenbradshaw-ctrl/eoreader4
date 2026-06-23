// The campaign harness — run the standing regression locks, or one experiment.
//
//   node campaign/run.mjs            run every lock in campaign/locks/ (the guard)
//   node campaign/run.mjs <exp-id>   run exp/<id>/measure.mjs then exp/<id>/score.mjs
//
// Locks are runnable checks that exit non-zero if a confirmed capability — its
// dissociation AND its control — has regressed. They are the day-the-precondition-
// changes alarm; a run that fires on the noise or swings across the control fails
// the lock rather than passing. The harness is read-only: it never mutates engine
// state, only spawns the lock/experiment scripts and reports their exit codes.

import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const node = process.execPath;

const run = (file) => spawnSync(node, [file], { stdio: 'inherit' }).status ?? 1;

const arg = process.argv[2];
if (arg) {
  const dir = join(here, 'exp', arg);
  if (!existsSync(dir)) { console.error(`no experiment ${arg}`); process.exit(2); }
  let bad = 0;
  for (const f of ['measure.mjs', 'score.mjs']) {
    const p = join(dir, f);
    if (existsSync(p)) { console.log(`\n=== ${arg}/${f} ===`); bad += run(p) ? 1 : 0; }
  }
  process.exit(bad ? 1 : 0);
}

const locksDir = join(here, 'locks');
const locks = existsSync(locksDir) ? readdirSync(locksDir).filter(f => f.endsWith('.mjs')).sort() : [];
if (!locks.length) { console.log('no regression locks yet'); process.exit(0); }

let failed = 0;
for (const lock of locks) {
  console.log(`\n=== lock: ${lock} ===`);
  if (run(join(locksDir, lock))) failed++;
}
console.log(`\n${locks.length - failed}/${locks.length} locks green`);
process.exit(failed ? 1 : 0);
