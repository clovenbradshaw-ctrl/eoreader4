// The continuous loop — one cycle per invocation.
//
// Each cycle: (1) run the NO-REGRESSION gate — re-score every confirmed experiment
// in the archive; a fix's fitness is that it breaks none. (2) DRAW the next
// pressure (seeded, replayable), choosing explore vs exploit. (3) For an outside-in
// draw, pull a seed (one or two random articles) so the next experiment has its
// content; for inside-out, name a cold code site. The draw decides what gets
// stressed; the held key, the control, and the parity gate decide what counts.
//
// Randomness lives in the pressure, never in the test. This driver never edits the
// engine and never decides a verdict — it sets up the next blind experiment and
// guards the ones already won.

import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRng, drawPressure } from './lib/rng.mjs';
import { readArchive, readCoverage, appendPressure } from './lib/archive.mjs';
import { trySeed } from './lib/seed.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXP = join(HERE, 'experiments');

// --- (1) the no-regression gate: re-score every confirmed experiment. ---------
const scoreAll = () => {
  const results = [];
  for (const id of readdirSync(EXP)) {
    const scorer = join(EXP, id, 'score.mjs');
    const measure = join(EXP, id, 'measure.mjs');
    if (!existsSync(scorer)) continue;
    try {
      if (existsSync(measure)) execFileSync('node', [measure], { stdio: 'ignore' });
      execFileSync('node', [scorer], { stdio: 'ignore' });
      results.push({ id, status: 'GREEN' });
    } catch (e) {
      // exit 2 = LOCATED-GAP (an honest negative, not a regression); else RED.
      results.push({ id, status: e.status === 2 ? 'GAP' : 'RED' });
    }
  }
  return results;
};

// --- (2) draw the next pressure, biased toward cold regions / the edge. --------
const drawNext = (cycle) => {
  const archive = readArchive();
  const coverage = readCoverage();
  const rng = makeRng((Date.now() ^ (cycle * 2654435761)) >>> 0);
  // Exploit a located gap with some probability; else explore a wild draw.
  const gaps = archive.filter(p => p.verdict === 'LOCATED-GAP' || p.verdict === 'PARTIAL');
  const exploit = gaps.length && rng() < 0.4;
  const mode = exploit ? 'exploit' : (rng() < 0.5 ? 'inside-out' : 'outside-in');
  const draw = drawPressure(rng);
  return { mode, draw, coldSites: coldRegions(coverage), exploitTarget: exploit ? gaps[Math.floor(rng() * gaps.length)].id : null };
};

// Cold regions: interior sites the archive's runs have not exercised much.
const CANDIDATE_SITES = [
  'src/core/voidnull.js#deriveNull', 'src/core/voidnull.js#extremeValueZ',
  'src/core/project.js#projectGraph', 'src/fold/integral.js', 'src/predict/predictor.js#FLAT_CONCENTRATION',
  'src/core/surprise.js#forwardDist', 'src/perceiver/reading.js#GAMMA', 'src/classify/bands.js',
];
const coldRegions = (cov) => CANDIDATE_SITES.filter(s => !(s in cov)).slice(0, 4);

// --- run one cycle ------------------------------------------------------------
const cycle = readArchive().length + 1;
console.log(`\n=== evo cycle ${cycle} ===`);

const gate = scoreAll();
console.log('no-regression gate:', gate.map(r => `${r.id}:${r.status}`).join(' '));
const regressed = gate.filter(r => r.status === 'RED');
if (regressed.length) {
  console.error('REGRESSION — confirmed capability broke:', regressed.map(r => r.id).join(', '));
  process.exit(1);
}

const next = drawNext(cycle);
console.log('next pressure:', JSON.stringify(next.draw));
console.log('mode:', next.mode, next.exploitTarget ? `(exploit ${next.exploitTarget})` : '');
console.log('cold interior sites to bias toward:', next.coldSites.join(', ') || '(none)');

if (next.mode === 'outside-in') {
  const seed = await trySeed();
  if (seed.ok) console.log('seed of record:', seed.articles.map(a => `${a.title}@${a.revision}`).join('  ✕  '),
    '\n(orthogonal collision: force the first phenomenon into the structure of the second)');
  else console.log('network closed (' + seed.error + ') → fall back to the inside-out draw above');
}
console.log('cycle complete: archive green, next pressure drawn. Build the blind experiment for it.');
