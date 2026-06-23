// The outside-in seed — random Wikipedia, the variation the engine did not choose.
//
// The article supplies the CONTENT; the axes (lib/pressure.mjs) supply the FORM. The
// random article is never the stimulus itself: it would be mangled prose with no place
// to plant a contrast. Extract the phenomenon, then build a minimal blind stimulus
// around it. `title` and `revision` are the SEED OF RECORD — recorded in the archive so
// a pressure that located a gap replays exactly.
//
// Endpoints (no key): a single GET to the REST summary for one article; the action API
// for a bulk title draw. Namespace zero keeps it to real articles, not talk/category.

const UA = 'eoreader-evo/0.1 (continuous-evolution research harness)';

// One random article → { title, revision, lang, description, extract, url }.
export const randomArticle = async () => {
  const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary',
    { headers: { 'User-Agent': UA } });          // 303-redirects to the drawn page; fetch follows
  if (!r.ok) throw new Error(`wiki random: ${r.status}`);
  const d = await r.json();
  return {
    title: d.title,
    revision: d.revision,
    lang: d.lang,
    description: d.description || '',
    extract: d.extract || '',
    url: d.content_urls?.desktop?.page || '',
  };
};

// Two independent draws — the ORTHOGONAL COLLISION source: the first phenomenon told in
// the structure of the second. Two draws colliding is a far wider space than either alone.
export const randomPair = async () => Promise.all([randomArticle(), randomArticle()]);

// A bulk title draw for cheaper seeding (no extracts) — { title, id } each.
export const randomTitles = async (n = 10) => {
  const u = `https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=${n}&format=json`;
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`wiki titles: ${r.status}`);
  const d = await r.json();
  return (d.query?.random || []).map(x => ({ title: x.title, id: x.id }));
};

// The seed of record — the minimal replayable provenance an archive line carries.
export const seedOfRecord = (...articles) =>
  articles.map(a => ({ title: a.title, revision: a.revision ?? null }));

if (import.meta.url === `file://${process.argv[1]}`) {
  const pair = process.argv.includes('--pair');
  const arts = pair ? await randomPair() : [await randomArticle()];
  for (const a of arts) {
    console.log(`\n● ${a.title}  (rev ${a.revision}, ${a.lang})`);
    if (a.description) console.log(`  ${a.description}`);
    if (a.extract) console.log(`  ${a.extract.slice(0, 220)}${a.extract.length > 220 ? '…' : ''}`);
  }
  console.log('\nseed of record:', JSON.stringify(seedOfRecord(...arts)));
}
