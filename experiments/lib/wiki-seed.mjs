// The outside-in seed source. Pulls variation from outside the designer's head:
// a random Wikipedia article supplies the CONTENT, the experiment's axes supply the
// FORM. The article is never the stimulus itself — we extract a phenomenon and build
// a minimal blind stimulus around it. We record `title` and `revision` as the seed of
// record so a pressure that located a gap can be replayed exactly.
//
//   GET https://en.wikipedia.org/api/rest_v1/page/random/summary   (no key)
//
// Seeds are cached under experiments/seeds/ keyed by title+revision so a replay reads
// the archived seed, not a fresh draw.

import { mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(HERE, '..', 'seeds');

const slug = (s) => String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60);

// Fetch one random article summary. Returns { title, revision, lang, description, extract }.
export const fetchRandomArticle = async () => {
  const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary',
    { headers: { accept: 'application/json' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`wiki random ${res.status}`);
  const j = await res.json();
  return { title: j.title, revision: j.revision, lang: j.lang,
           description: j.description || '', extract: j.extract || '' };
};

// Fetch and persist a seed of record. Returns the seed with its on-disk path.
export const drawSeed = async () => {
  if (!existsSync(SEED_DIR)) mkdirSync(SEED_DIR, { recursive: true });
  const art = await fetchRandomArticle();
  const file = join(SEED_DIR, `${slug(art.title)}-${art.revision}.json`);
  writeFileSync(file, JSON.stringify(art, null, 2) + '\n');
  return { ...art, file };
};

// Replay a previously-archived seed by title+revision (exact replay) or read all.
export const loadSeeds = () => {
  if (!existsSync(SEED_DIR)) return [];
  return readdirSync(SEED_DIR).filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(SEED_DIR, f), 'utf8')));
};
