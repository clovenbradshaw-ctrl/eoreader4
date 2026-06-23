// Draw pressures — the EXPLORE step. Each cycle: sample the axes, fetch one or two
// random seeds, compose a pressure descriptor, score its novelty against the archive,
// and append it. Difficulty is filled in by the experiment that runs the pressure
// (it is a property of the live engine's response, not knowable at draw time).
//
//   node lab/draw.mjs [nCycles=1] [seedsPerCycle=2]
//
// The draw-seed of record is derived from the wall clock so each run is a fresh draw;
// it is stored on the pressure so the axes are replayable, and the Wikipedia seed
// titles+revisions are stored so the CONTENT is replayable (lab/lib/seed.mjs caches).

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchSeeds } from './lib/seed.mjs';
import { drawAxes, pickRecipe, rng, fingerprint, noveltyAgainst } from './lib/sampler.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ARCHIVE = join(HERE, 'pressure-archive.jsonl');

const readArchive = () =>
  (existsSync(ARCHIVE) ? readFileSync(ARCHIVE, 'utf8').trim().split('\n').filter(Boolean) : []).map((l) => JSON.parse(l));

const nCycles = Number(process.argv[2] || 1);
const seedsPer = Number(process.argv[3] || 2);

const archive = readArchive();
const archiveFps = archive.map((p) => new Set(p.seedFingerprint || []));

for (let c = 0; c < nCycles; c++) {
  const drawSeed = (Date.now() ^ (c * 0x9e3779b1)) >>> 0;
  const axes = drawAxes(drawSeed);
  const r = rng(drawSeed ^ 0x55555555);
  const recipe = pickRecipe(r, seedsPer);

  let seeds;
  try {
    seeds = await fetchSeeds(recipe === 'orthogonal-collision' ? 2 : seedsPer >= 2 ? 2 : 1);
  } catch (e) {
    console.error(`cycle ${c}: seed fetch failed (${e.message}). Skipping — randomness lives in the seed, so no seed, no draw.`);
    continue;
  }

  const fp = seeds.reduce((acc, s) => { for (const t of fingerprint(s)) acc.add(t); return acc; }, new Set());
  const novelty = Number(noveltyAgainst(fp, archiveFps).toFixed(3));

  const pressure = {
    id: `P${String(archive.length + 1).padStart(3, '0')}`,
    drawnAt: new Date().toISOString(),
    drawSeed,
    axes,
    recipe,
    seedsOfRecord: seeds.map((s) => ({ title: s.title, revision: s.revision, description: s.description })),
    seedFingerprint: [...fp].slice(0, 120),
    novelty,
    difficulty: null, // filled by the experiment that runs this pressure
    verdict: 'drawn', // drawn → built → confirmed | gap | flat | void
    experiment: null,
  };

  appendFileSync(ARCHIVE, JSON.stringify(pressure) + '\n');
  archive.push(pressure); archiveFps.push(fp);
  console.log(`${pressure.id}  ${axes.target.padEnd(11)} ${recipe.padEnd(21)} ${axes.modality.padEnd(14)} ${axes.kind.padEnd(14)} novelty=${novelty}`);
  console.log(`     seeds: ${seeds.map((s) => `${s.title}${s.revision ? '@' + s.revision : ''}`).join('  ×  ')}`);
}
