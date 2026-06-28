// cross-source.js — nameless referent identity for the cross-source memory fold.
//
// Identity is NOT the display token. Every referent in the cross-source memory log is a
// NAMELESS hashId; "Heat" is only a LABEL hanging off it. The log carries the hash, never
// the bare word — there is no context-free `heat` node for two unrelated senses to collide
// on (the failure this fixes: `idFor("Heat") → "heat"` in every source, so the 1995 film
// and the weather phenomenon were the same node before a single discriminator was read).
//
// Two sources that both name "Heat" are coreferent BY DEFAULT — one referent, one hash —
// but that coreference is DEFEASIBLE. When a source anchors ≥3 of its OWN specific referents
// to the name while sharing NEITHER a proper-noun coref NOR a topic term with the others
// (the "different thing wearing the same letters" reading already used for wiki enrichment,
// app.dc.js#wikiBest), the default is DEFEATED and the name FORKS into a second nameless
// referent. The SENSE that tells them apart ("a 1995 film") rides as a defeasible DEF on the
// referent — `weather.heat` is a DEF on a referent, not a namespace baked into its identity.
//
// Defeasibility is inherent in the fold: rebuild recomputes this over ALL pages every time,
// so reading a later bridging source (one that shares context with both) collapses the two
// components back into one referent — the fork is overturned, never ossified.
//
// BOUND (deferred, named honestly): this resolves coreference per SOURCE, not per MENTION.
// A single document that uses "heat" for both the film AND the 105° summer weather is one
// referent at this layer. Splitting a name WITHIN a document by local context lives in the
// parser's admission (createEntityAdmission, where every mention of a name is currently
// forced to one id) and is out of scope for the cross-source fold.

// Deliberately mirrors the perceiver's idFor (parse/entities.js) and asterisk.js#normLabel:
// lowercase, spaces→'-', strip to [a-z0-9-]. Duplicated, not imported, so this reader-layer
// module stays dependency-free — the same discipline asterisk.js documents for normLabel.
const senseIdFor = (label) =>
  String(label ?? '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// cyrb53 — small, fast, deterministic string hash. No Math.random / Date (both would break
// resume and golden parity); the same (anchor url, baseId) always yields the same hash.
const senseHash = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};
// The nameless referent id: an 'e' tag + a hash of the referent's anchor (its earliest
// source) and its base label. Carries no readable token — the display name lives on `label`.
const referentId = (anchorUrl, baseId) => 'e' + senseHash(String(anchorUrl) + ' ' + String(baseId));

// Topic stoplist — function words and a few ubiquitous content words that carry no sense.
const SENSE_STOP = new Set(
  ('the of and a an to in on for is are was were be been being it its this that these those with as at by from or nor but so yet not no into over under out up down off about after before then than thus also who which what when where while there here they them his her she he you your our we us my are has have had will would can could should may might must does did done only just more most some any all each both few many much such own same other another into onto upon also very then them this that with into your their there about above below between through during without within along across around because although though however therefore moreover furthermore meanwhile nonetheless nevertheless said says say according new news page site source sources read reading').split(/\s+/),
);

// The disambiguated-title reading: a source TITLED `Base (qualifier)` declares its own sense
// for `Base` — "Heat (1995 film)" says the bare "Heat" in this article is the film. This is
// strong evidence the name should fork, and the qualifier is the ready-made sense DEF.
const DISAMB_TITLE = /^\s*(.+?)\s*\(([^)]{2,40})\)/;
const senseDisamb = (title) => {
  const m = String(title || '').match(DISAMB_TITLE);
  if (!m) return null;
  const base = m[1].trim(), qualifier = m[2].trim();
  if (!base || base.length > 60) return null;
  return { base, qualifier, baseId: senseIdFor(base) };
};

const VOID = '[void]';
// One page's context: every referent id it carries (the universe to re-key), the proper-noun
// set and topic-term set used to test coreference, and per-id labels + sighting counts.
const senseContext = (pg) => {
  const labelOf = new Map(), sightings = new Map(), allIds = new Set();
  const note = (v) => { if (typeof v === 'string' && v && v !== VOID) allIds.add(v); };
  for (const e of pg.events || []) {
    note(e.id); note(e.src); note(e.tgt); note(e.from); note(e.to); note(e.node);
    if (e.subject) note(e.subject.id);
    if (e.object) note(e.object.id);
    if (e.op === 'INS' && e.id != null && e.id !== VOID) {
      if (!labelOf.has(e.id)) labelOf.set(e.id, e.label ?? e.id);
      sightings.set(e.id, (sightings.get(e.id) || 0) + 1);
    }
  }
  const proper = new Set();
  for (const id of allIds) {
    const lab = String(labelOf.get(id) ?? '');
    if (!/^https?:/i.test(lab)) proper.add(id);
  }
  const freq = new Map();
  for (const s of pg.sentences || [])
    for (const w of (String(s || '').toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []))
      if (!SENSE_STOP.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
  const topic = new Set();
  for (const [w, n] of freq) if (n >= 2) topic.add(w);
  return { labelOf, sightings, proper, topic, allIds, title: pg.title || '', url: pg.url };
};

// referentMap(pages) — assign every referent id in the master log a nameless hash, forking a
// name into multiple referents where the default cross-source coreference is defeated.
//
// Returns:
//   remap  Map<url, Map<baseId, { id, label, sense }>>   re-key plan for rebuild
//   forks  Array<{ url, baseId, id, label, sense, pages }>   referents born from a defeat
export const referentMap = (pages) => {
  const ctx = pages.map(senseContext);
  const dis = pages.map((p) => senseDisamb(p.title));

  // Universe of base ids → the page indices that bear them.
  const byId = new Map();
  ctx.forEach((c, i) => {
    for (const id of c.allIds) {
      let arr = byId.get(id); if (!arr) byId.set(id, (arr = []));
      arr.push(i);
    }
  });

  const remap = new Map();
  const forks = [];
  const ensure = (url) => remap.get(url) || remap.set(url, new Map()).get(url);

  // Coreference evidence between two sources for one name: a SHARED specific referent
  // (proper-noun coref, the name itself excluded — it is the thing in question) OR ≥2 shared
  // topic terms. Either licenses the default "same referent"; neither leaves them separable.
  const corroborates = (baseId, i, j) => {
    const a = ctx[i], b = ctx[j];
    for (const x of a.proper) if (x !== baseId && b.proper.has(x)) return true;
    let t = 0; for (const w of a.topic) if (b.topic.has(w)) { if (++t >= 2) return true; }
    return false;
  };
  // Rich enough to stand alone: a source that anchors ≥3 of its own specific referents to the
  // name (the articleConflict floor) — a confident "different thing", not mere sparsity.
  const selfStanding = (i, baseId) => {
    let n = 0; for (const x of ctx[i].proper) if (x !== baseId && ++n >= 3) return true; return false;
  };

  for (const [baseId, idxs] of byId) {
    let groups;
    if (idxs.length < 2) {
      groups = [idxs];
    } else {
      // Components of mutually-corroborating sources.
      const parent = new Map(idxs.map((i) => [i, i]));
      const find = (x) => { while (parent.get(x) !== x) x = parent.get(x); return x; };
      for (let a = 0; a < idxs.length; a++)
        for (let b = a + 1; b < idxs.length; b++)
          if (corroborates(baseId, idxs[a], idxs[b])) {
            const ra = find(idxs[a]), rb = find(idxs[b]);
            if (ra !== rb) parent.set(ra, rb);
          }
      const comps = new Map();
      for (const i of idxs) { const r = find(i); (comps.get(r) || comps.set(r, []).get(r)).push(i); }
      const compList = [...comps.values()];
      if (compList.length < 2) {
        groups = [idxs];
      } else {
        // The dominant component (most sightings of the name) keeps the default referent; a
        // non-corroborating component FORKS only when it is a confident "different thing"
        // (self-standing, or a source that disambiguates the name in its own title). Sparse
        // disjoint components fold back into the main referent — defeasibility must not
        // over-fire into splitting on thin evidence.
        const sightOf = (c) => c.reduce((s, i) => s + (ctx[i].sightings.get(baseId) || 0), 0);
        compList.sort((x, y) => sightOf(y) - sightOf(x));
        groups = [[...compList[0]]];
        for (let k = 1; k < compList.length; k++) {
          const c = compList[k];
          const distinct = c.every((i) => selfStanding(i, baseId))
            || c.some((i) => dis[i] && dis[i].baseId === baseId);
          if (distinct) groups.push(c);
          else groups[0] = groups[0].concat(c);
        }
      }
    }

    const forked = groups.length > 1;
    for (const g of groups) {
      const anchor = Math.min(...g);
      const label = ctx[anchor].labelOf.get(baseId) ?? baseId;
      const id = referentId(pages[anchor].url, baseId);
      // The sense — a defeasible DEF — is only meaningful where the name forked. Read it from
      // the disambiguating title if a member declares one ("1995 film"); else left null.
      let sense = null;
      if (forked) {
        const dp = g.find((i) => dis[i] && dis[i].baseId === baseId);
        sense = dp != null ? dis[dp].qualifier : null;
      }
      for (const i of g) ensure(pages[i].url).set(baseId, { id, label, sense });
      if (forked) forks.push({ url: pages[anchor].url, baseId, id, label, sense, pages: g.map((i) => pages[i].url) });
    }
  }

  return { remap, forks };
};
