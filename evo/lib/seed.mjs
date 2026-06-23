// The random seed — pressure from OUTSIDE the designer's head.
//
// Each cycle pulls one or two random Wikipedia articles. The article is raw
// variation; the axes (sample.mjs) supply the form. The article is NEVER the
// stimulus itself — a phenomenon is extracted from it and a minimal blind
// stimulus is constructed around a drawn cell. We record `title` and `revision`
// as the SEED OF RECORD so a pressure that located a gap can be replayed exactly.
//
// Endpoints (no key, namespace 0 = real articles only):
//   single  https://en.wikipedia.org/api/rest_v1/page/random/summary
//   bulk    https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=N&format=json

const UA = 'eoreader-evo/1.0 (continuous-evolution harness; contact via repo)';

const getJSON = async (url, { tries = 4 } = {}) => {
  let wait = 500;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, redirect: 'follow' });
      if (r.ok) return await r.json();
    } catch { /* network — retry with backoff */ }
    await new Promise((res) => setTimeout(res, wait));
    wait *= 2;
  }
  return null;
};

// One random article summary. Returns the seed-of-record fields plus the extract,
// or null if the network is unreachable (the loop then falls to an inside-out draw).
export const randomSeed = async () => {
  const j = await getJSON('https://en.wikipedia.org/api/rest_v1/page/random/summary');
  if (!j || !j.title) return null;
  return {
    title: j.title,
    revision: j.revision ?? null,
    description: j.description ?? null,
    extract: j.extract ?? '',
    lang: j.lang ?? 'en',
    url: j.content_urls?.desktop?.page ?? null,
    fetchedAt: new Date().toISOString(),
  };
};

// N random article titles+revisions (bulk, cheap) — for orthogonal collision, where
// two independent draws are forced into one stimulus.
export const randomTitles = async (n = 2) => {
  const j = await getJSON(`https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=${n}&format=json`);
  const items = j?.query?.random;
  if (!Array.isArray(items)) return [];
  return items.map((it) => ({ title: it.title, id: it.id }));
};

// CLI: `node evo/lib/seed.mjs` prints one seed; `node evo/lib/seed.mjs 3` prints 3 titles.
if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2]);
  if (Number.isFinite(n) && n > 0) console.log(JSON.stringify(await randomTitles(n), null, 2));
  else console.log(JSON.stringify(await randomSeed(), null, 2));
}
