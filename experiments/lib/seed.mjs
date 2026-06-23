// Replayable random-article seed source for the evolution campaign.
//
// The article is NEVER the stimulus. It supplies raw VARIATION — a phenomenon, a subject, some
// names — that an experiment then channels into a blind, controlled test of a drawn cell. The
// randomness enters at the choice of phenomenon; the rigor stays in the constructed test.
// title+revision are recorded as the seed-of-record (in archive.jsonl) so a pressure that
// located a gap can be replayed exactly.
//
// Endpoints (no key): a single random summary, or a bulk title draw (namespace 0 = real
// articles only). CLI: `node experiments/lib/seed.mjs [n]` prints n summaries as JSONL.

const UA = { headers: { accept: 'application/json', 'user-agent': 'eoreader-evo/1.0 (campaign seed)' } };

export const randomSummary = async () => {
  const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary', UA);
  if (!res.ok) throw new Error(`random/summary ${res.status}`);
  const j = await res.json();
  return {
    title: j.title,
    revision: String(j.revision ?? ''),
    description: j.description ?? null,
    extract: j.extract ?? '',
    lang: j.lang ?? 'en',
  };
};

export const randomTitles = async (n = 10) => {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=${n}&format=json`;
  const res = await fetch(url, UA);
  if (!res.ok) throw new Error(`list=random ${res.status}`);
  const j = await res.json();
  return j.query.random.map((r) => r.title);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] || 2);
  for (let i = 0; i < n; i++) console.log(JSON.stringify(await randomSummary()));
}
