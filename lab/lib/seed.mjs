// The random seed — variation pulled from OUTSIDE the designer's head.
//
// The campaign's one rule is that randomness lives in the PRESSURE, never in the
// test. This module is where the randomness enters: a single GET against
// Wikipedia's random-article endpoint. The article is never the stimulus; it is
// raw variation whose SUBJECT a sampler channels into a blind experiment. Every
// fetched seed is recorded (title + revision) so a pressure that located a gap can
// be replayed exactly — the seed of record.
//
// Wikimedia rate-limits the shared egress IP hard when no descriptive User-Agent
// is sent (it returns an HTML "too many requests" page, not JSON). A proper UA per
// their API etiquette plus exponential backoff is the difference between a block
// and a draw. Every successful fetch is cached under lab/seeds/ so a replay never
// re-hits the network and the archive stays reproducible offline.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(HERE, '..', 'seeds');
const UA = 'eoreader4-evolution/0.1 (https://github.com/clovenbradshaw-ctrl/eoreader4; michael.t.lacy@gmail.com) node-fetch';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A single fetch with the etiquette UA and bounded exponential backoff. Returns
// parsed JSON or throws after the last try. The block page is text/html, not JSON,
// so a non-JSON content-type is treated as a soft rate-limit and retried.
async function getJSON(url, { tries = 5, base = 1500 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA, Accept: 'application/json' } });
      const ct = r.headers.get('content-type') || '';
      if (r.ok && ct.includes('json')) return await r.json();
      lastErr = new Error(`status ${r.status} ct ${ct}: ${(await r.text()).slice(0, 80)}`);
    } catch (e) { lastErr = e; }
    if (i < tries - 1) await sleep(base * 2 ** i + Math.floor(Math.random() * 400));
  }
  throw lastErr;
}

if (!existsSync(SEED_DIR)) mkdirSync(SEED_DIR, { recursive: true });

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60).toLowerCase();

// Fetch one random article summary and cache it as the seed of record.
//   { title, extract, description, revision, lang, url, fetchedAt }
export async function fetchRandomSeed() {
  const j = await getJSON('https://en.wikipedia.org/api/rest_v1/page/random/summary');
  const seed = {
    title: j.title,
    extract: j.extract || '',
    description: j.description || '',
    revision: j.revision || (j.content_urls ? null : null),
    lang: j.lang || 'en',
    url: j.content_urls?.desktop?.page || null,
    fetchedAt: new Date().toISOString(),
  };
  const file = join(SEED_DIR, `${slug(seed.title)}-${seed.revision || 'norev'}.json`);
  writeFileSync(file, JSON.stringify(seed, null, 2));
  return seed;
}

// Draw N seeds, spaced so the shared IP is not throttled. Used for orthogonal
// collisions (two independent subjects forced into one stimulus).
export async function fetchSeeds(n = 1, { spacingMs = 1200 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(await fetchRandomSeed());
    if (i < n - 1) await sleep(spacingMs);
  }
  return out;
}

// Replay: load a previously cached seed by title (or title-substring), so a
// recorded pressure re-runs on the same material without the network.
export function loadCachedSeed(match) {
  const files = readdirSync(SEED_DIR).filter((f) => f.endsWith('.json'));
  const hit = files.find((f) => f.includes(slug(match))) || files.find((f) => f.toLowerCase().includes(match.toLowerCase()));
  if (!hit) throw new Error(`no cached seed matching "${match}" in ${SEED_DIR}`);
  return JSON.parse(readFileSync(join(SEED_DIR, hit), 'utf8'));
}

export function listCachedSeeds() {
  if (!existsSync(SEED_DIR)) return [];
  return readdirSync(SEED_DIR).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(SEED_DIR, f), 'utf8')));
}
