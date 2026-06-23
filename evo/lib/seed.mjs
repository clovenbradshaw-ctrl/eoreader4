// The outside-in seed — random Wikipedia, the variation no one chose.
//
// Do not draw phenomena from imagination; that keeps the engine inside the
// designer's head. Pull the seed from outside it. The article is raw variation;
// the axes (rng.mjs) supply the form. The random article is NEVER the stimulus —
// the phenomenon is extracted and a minimal blind stimulus is built around it.
// Record `title` and `revision` as the SEED OF RECORD so a pressure that located
// a gap can be replayed exactly.

const SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/random/summary';
const BULK = 'https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=10&format=json';

// One random article: { title, extract, description, revision, lang }.
export const randomArticle = async () => {
  const r = await fetch(SUMMARY, { headers: { 'accept': 'application/json' } });
  if (!r.ok) throw new Error(`random/summary ${r.status}`);
  const j = await r.json();
  return {
    title: j.title,
    extract: j.extract || '',
    description: j.description || '',
    revision: j.revision || null,
    lang: j.lang || 'en',
  };
};

// Two independent draws, for the ORTHOGONAL COLLISION (the richest source): the
// first phenomenon described in the structure of the second.
export const twoArticles = async () => Promise.all([randomArticle(), randomArticle()]);

// Bulk title draw (namespace 0 = real articles).
export const randomTitles = async (n = 10) => {
  const r = await fetch(BULK, { headers: { 'accept': 'application/json' } });
  if (!r.ok) throw new Error(`list=random ${r.status}`);
  const j = await r.json();
  return (j.query?.random || []).slice(0, n).map(x => ({ title: x.title, id: x.id }));
};

// Network may be closed by the environment's policy. A cycle that needs a seed
// and cannot reach the endpoint falls back to an INSIDE-OUT draw (a random code
// site) rather than skipping — both sources are first-class.
export const trySeed = async () => {
  try { return { ok: true, articles: await twoArticles() }; }
  catch (e) { return { ok: false, error: e.message }; }
};
