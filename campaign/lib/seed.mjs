// The seed source — random Wikipedia, the variation the campaign channels.
//
// Do NOT draw phenomena from imagination; that keeps the engine inside the
// designer's head. Pull the seed from outside it. Each cycle fetches one or two
// random Wikipedia articles; the article supplies the *content*, the sampler's
// axes supply the *form*. The random article is never the stimulus itself — its
// phenomenon is extracted and a minimal blind stimulus is constructed around it.
//
// The endpoint is a single GET, no key:
//   https://en.wikipedia.org/api/rest_v1/page/random/summary   (303 → the article)
// It returns { title, extract, description, revision, lang, content_urls }. The
// `title` and `revision` are the SEED OF RECORD — recorded so a pressure that
// located a gap can be replayed exactly. We also persist the `extract` so replay
// is deterministic offline (a later revision would drift).
//
// Run: node campaign/lib/seed.mjs [n]        draw n fresh seeds, persist to seeds.json
//      node campaign/lib/seed.mjs --list     show the recorded seeds of record

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEEDS = join(HERE, '..', 'seeds.json');
const UA = 'eoreader-campaign/1.0 (continuous-evolution research; contact via repo)';
const RANDOM = 'https://en.wikipedia.org/api/rest_v1/page/random/summary';

const loadSeeds = () => (existsSync(SEEDS) ? JSON.parse(readFileSync(SEEDS, 'utf8')) : {});
const saveSeeds = (m) => { mkdirSync(dirname(SEEDS), { recursive: true }); writeFileSync(SEEDS, JSON.stringify(m, null, 2) + '\n'); };

// One fresh random article. Follows the 303 to the concrete summary. Returns the
// minimal seed of record plus the extract (persisted for offline replay).
export const drawSeed = async () => {
  const res = await fetch(RANDOM, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`random draw failed: HTTP ${res.status}`);
  const j = await res.json();
  const seed = {
    title: j.title,
    revision: String(j.revision ?? ''),
    lang: j.lang || 'en',
    description: j.description || '',
    extract: j.extract || '',
    drawnAt: new Date().toISOString(),
  };
  const all = loadSeeds();
  all[seed.title] = seed;        // keyed by title; the revision pins the version
  saveSeeds(all);
  return seed;
};

export const drawSeeds = async (n = 1) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push(await drawSeed());
  return out;
};

// Replay: the recorded seed of record (no network). The extract is the version
// that was actually drawn, so a stimulus built from it is reproducible.
export const recordedSeed = (title) => {
  const all = loadSeeds();
  if (!all[title]) throw new Error(`no recorded seed for "${title}" — draw it first or check seeds.json`);
  return all[title];
};

export const recordedTitles = () => Object.keys(loadSeeds());

// Pull a rough cast of capitalized multi-letter tokens from an extract — the
// concrete labels a stimulus can be built from (names, places, terms). Form-free:
// it only harvests surface tokens; the experiment decides what to do with them.
export const castFrom = (extract, n = 8) => {
  const seen = new Set();
  const out = [];
  for (const w of String(extract).split(/\s+/)) {
    const t = w.replace(/[^A-Za-z]/g, '');
    if (t.length >= 3 && /^[A-Z]/.test(t) && !seen.has(t)) { seen.add(t); out.push(t); }
    if (out.length >= n) break;
  }
  return out;
};

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (arg === '--list') {
    const all = loadSeeds();
    for (const [title, s] of Object.entries(all)) console.log(`${s.revision.padStart(12)}  ${title}  —  ${s.description}`);
    process.exit(0);
  }
  const n = Number(arg) || 1;
  drawSeeds(n).then(seeds => {
    for (const s of seeds) {
      console.log(`\n${s.title}  (rev ${s.revision})  —  ${s.description}`);
      console.log(`  ${s.extract.slice(0, 220)}`);
      console.log(`  cast: ${castFrom(s.extract).join(', ')}`);
    }
  }).catch(e => { console.error('draw failed:', e.message); process.exit(1); });
}
