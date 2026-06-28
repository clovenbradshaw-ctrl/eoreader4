// Curiosity-guided research — multi-hop web research that follows the engine's own surprise.
// (docs/curiosity-research.md; the multi-hop sibling of the single-shot path in web.js.)
//
// The `auto` web path (app.js) fires ONE query, folds its results into the scope, and answers.
// That is enough to fill a single gap, but a real question often opens further questions: a
// fetched page names a person, a place, a reboot, a date the engine had never seen — and the
// honest next move is to go ask about THAT. Doing it blindly is shotgunning: fire a fan-out of
// follow-up queries on every term and drown the answer in tangential pages. This does the
// opposite. It expands exactly ONE thread per hop — the most SURPRISING one — and stops the
// moment surprise dries up.
//
// CURIOSITY IS NOT A NEW METRIC. It is the engine's ONE surprise (core/surprise.js,
// docs/spec-one-surprise.md) pointed at the web: D_KL(posterior ‖ prior) of a freshly fetched
// page against the γ-decayed profile of everything read so far. A page that only restates what
// we know moves belief by ~0 bits (low curiosity → a dead thread); a page that introduces a new
// figure, claim, or relation moves belief a finite positive amount (high curiosity → follow it).
// And the SAME computation hands back WHAT was surprising: `bayesBy`, the per-dimension KL
// contribution, names the atoms belief moved toward — those atoms ARE the next leads. So the
// search is steered by the measured gap, not by a keyword heuristic — active inference
// (docs/web-search.md "fire where expected information gain is highest"), run as a loop.
//
// Pure but for the injected `search` (and the surprise core it imports): the front-end map from
// page text into the surprise basis, the best-first frontier, the curiosity floor, and the hop
// trace are all testable with a fake search and a hand-advanced budget — no model, no network.

import { surpriseAt } from '../core/surprise.js';
import { normalizeQuery } from '../ui/prefetch.js';
import { runTurn } from './pipeline.js';

// The content terms that carry a page's topic — the surprise BASIS for the web front-end. This
// is the same discipline web.js uses for its lexical witness check: drop function words, keep
// the words that distinguish one page from another. Embedder-free and offline by construction,
// so the curiosity measure runs in a unit test exactly as it does in the browser. (The full
// engine has a richer proposition/figure basis in reading.js; a research hop works off raw
// fetched prose before the heavy parse, so the term basis is the honest, cheap front-end here.)
const STOP = new Set(('the a an of to in on for and or but is are was were be been being with as at by from this that ' +
  'these those it its his her their your our my we you they he she them then than so not no yes do does did has have ' +
  'had will would can could should about into over under more most some any all what who whom whose when where why ' +
  'which how there here just only also very much many out up off down new news said says say one two three first ' +
  'last year years day days time times back like get got make made well still even now per via amid').split(/\s+/));

export const researchTerms = (s) =>
  (String(s || '').toLowerCase().match(/[a-z][a-z0-9'’-]{2,}/g) || []).filter(t => !STOP.has(t));

// profileOf(text) → Map<term, mass> — a page reduced to its term-frequency profile, the unit a
// hop deposits into the running knowledge state. Repetition is signal (a page ABOUT Coogler says
// "Coogler" many times), so mass is the raw count, not a set.
export const profileOf = (text) => {
  const m = new Map();
  for (const t of researchTerms(text)) m.set(t, (m.get(t) || 0) + 1);
  return m;
};

// curiosityOf(prior, arrival, { gamma, novelty }) → { bits, by } — the engine's ONE surprise,
// renamed for the call site. `bits` is D_KL(posterior ‖ prior) in bits: how far this page moved
// belief = how curious-worthy it is. `by` is the per-term KL contribution: WHICH terms belief
// moved toward = the leads worth chasing. A thin wrapper so research speaks "curiosity" while the
// arithmetic stays the one shared core — a drift in surpriseAt is a drift here, by construction.
export const curiosityOf = (prior, arrival, { gamma = 0.8, novelty } = {}) => {
  const { bayesBits, bayesBy } = surpriseAt(prior, arrival, { gamma, ...(novelty != null ? { novelty } : {}) });
  return { bits: bayesBits, by: bayesBy };
};

// foldInto(prior, arrival, gamma) → the NEW profile after this hop: every incumbent decays by γ,
// every term the page delivered deposits its mass. This is exactly the posterior mass surpriseAt
// formed internally (γ·prior + arrival) — the running, γ-decayed state of what the research has
// read. γ is the horizon ACROSS HOPS: at 0.8 a term first seen four hops ago still carries ~0.4
// of its mass, so an early thread keeps biasing surprise without pinning it forever. Returns a
// fresh Map; the input prior is untouched.
export const foldInto = (prior, arrival, gamma = 0.8) => {
  const next = new Map();
  for (const [k, m] of prior) next.set(k, gamma * m);
  for (const [k, m] of arrival) next.set(k, (next.get(k) || 0) + m);
  return next;
};

// leadsFrom(by, { seen, max }) → the surprising terms worth a hop, ranked by how much belief
// moved toward them, with the ones already chased (or already in a prior query) dropped. This is
// the anti-shotgun valve at the term level: of everything a page surfaced, only the few HEAVIEST
// surprises become candidate threads, never the long tail.
export const leadsFrom = (by, { seen = new Set(), max = 4 } = {}) =>
  Object.entries(by || {})
    .filter(([term, w]) => w > 0 && !seen.has(term))
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([term, weight]) => ({ term, weight }));

// nextQuery(anchor, lead) → the query that chases ONE lead, kept coherent by the anchor (the
// research's standing subject). A bare surprising term ("Coogler") goes to the world with no
// subject and matches a namesake — the same failure proposeWebSearch guards against (web.js). So
// the lead rides WITH the anchor: "X-Files revival" + "Coogler" → "X-Files revival Coogler". One
// thread, sharpened — not a bag of every surprising word at once.
export const nextQuery = (anchor, lead) => {
  const a = String(anchor || '').trim();
  const t = String(lead?.term || lead || '').trim();
  if (!t) return a;
  if (!a) return t;
  return a.toLowerCase().includes(t.toLowerCase()) ? a : `${a} ${t}`;
};

// runCuriousResearch(seed, opts) → { docs, hops, frontier, prior } — the loop.
//
//   seed     the first query (the formulated search query for the user's turn)
//   search   async (query, opts) → admitted[] — the real fetch+admit (searchAndAdmit, bound to
//            the session web client). The ONLY effectful dependency; injected so this is offline-
//            testable with a fake.
//   anchor   the standing subject that keeps every hop's query coherent (defaults to the seed)
//   maxHops  the hard ceiling on hops — "max number of hops". Default 4.
//   gamma    the cross-hop horizon for the γ-decayed prior. Default 0.8.
//   curiosityFloor  bits below which a hop is judged a DEAD thread: it taught us nothing new, so
//            we neither fold it into the prior as fresh knowledge nor spawn leads from it. The
//            anti-shotgun stop — chasing sub-floor leads is just noise. Default 0.15 bits.
//            (The SEED hop is always kept, floor or not — it is the answer's ground, not a lead.)
//   k        results per hop, passed through to search. Default 3 — focused, not a fan-out.
//   searchOpts  extra options merged into every search call (e.g. { kind:'auto', fetchPages }).
//
// BEST-FIRST, not breadth-first: the frontier is a priority list keyed by EXPECTED curiosity (the
// KL contribution that surfaced the lead). Each hop pops the single most promising thread, fetches
// it, and measures REALIZED curiosity against the running prior. A surprising page folds in and
// pushes its own leads (deeper threads can now out-rank shallow ones — the search follows where the
// information actually is); a flat page is dropped and the loop falls back to the next-best thread.
// It ends when the budget is spent, the frontier empties (nothing left to be curious about), or a
// run of `patience` consecutive dead threads says the seam is mined out.
export const runCuriousResearch = async (seed, {
  search,
  anchor = seed,
  maxHops = 4,
  gamma = 0.8,
  curiosityFloor = 0.15,
  patience = 2,
  k = 3,
  searchOpts = {},
  onHop = null,           // (｛ index, query, term ｝) → void — a progress beat fired before each hop's fetch
} = {}) => {
  const q0 = String(seed || '').trim();
  if (typeof search !== 'function' || !q0) return { docs: [], hops: [], frontier: [], prior: new Map() };

  let prior = new Map();
  const docs = [];
  const hops = [];
  const visited = new Set();          // normalized queries already fetched — never re-fetch
  const seenLeads = new Set();        // lead terms already chased or already in a query — never re-chase
  for (const t of researchTerms(anchor)) seenLeads.add(t);   // the anchor's own words are not "discoveries"

  // The frontier: { query, term, priority }. The seed leads at +∞ so it is always explored first;
  // discovered leads enter at their realized KL contribution. Kept as a plain array, popped by max.
  const frontier = [{ query: q0, term: null, priority: Infinity }];
  const pushLead = (lead) => {
    const query = nextQuery(anchor, lead);
    const key = normalizeQuery(query);
    if (visited.has(key) || seenLeads.has(lead.term)) return;
    frontier.push({ query, term: lead.term, priority: lead.weight });
  };
  const popBest = () => {
    let bi = -1, best = -Infinity;
    for (let i = 0; i < frontier.length; i++) if (frontier[i].priority > best) { best = frontier[i].priority; bi = i; }
    return bi < 0 ? null : frontier.splice(bi, 1)[0];
  };

  let dead = 0;
  while (hops.length < maxHops && frontier.length) {
    const node = popBest();
    const key = normalizeQuery(node.query);
    if (visited.has(key)) continue;
    visited.add(key);
    if (node.term) seenLeads.add(node.term);
    if (onHop) { try { onHop({ index: hops.length + 1, query: node.query, term: node.term }); } catch { /* a progress beat must never break the walk */ } }

    let admitted = [];
    try { admitted = await search(node.query, { k, ...searchOpts }); } catch { admitted = []; }
    const hopDocs = (admitted || []).map(a => a?.doc).filter(Boolean);

    // Measure curiosity: the surprise of THIS hop's pages, taken together, against everything
    // read so far. An empty fetch is a zero-curiosity dead thread (and contributes no ground).
    const arrival = profileOf(hopDocs.map(d => pageText(d)).join('\n'));
    const isSeed = node.priority === Infinity;
    const { bits, by } = arrival.size ? curiosityOf(prior, arrival, { gamma }) : { bits: 0, by: {} };

    const alive = isSeed || bits >= curiosityFloor;     // the seed is always kept as the answer's ground
    if (alive && hopDocs.length) {
      docs.push(...hopDocs);
      prior = foldInto(prior, arrival, gamma);          // this hop is now part of what we know
      const leads = leadsFrom(by, { seen: seenLeads, max: 4 });
      for (const lead of leads) { pushLead(lead); seenLeads.add(lead.term); }
      hops.push({ query: node.query, term: node.term, curiosity: round(bits), results: hopDocs.length,
                  leads: leads.map(l => l.term), kept: true });
      dead = 0;
    } else {
      // A dead thread: fetched, but moved belief less than the floor (or fetched nothing). We do
      // NOT fold it in and do NOT spawn leads from it — that is the discipline that keeps the loop
      // from wandering into ever-more-tangential pages. Recorded so the trace is honest.
      hops.push({ query: node.query, term: node.term, curiosity: round(bits), results: hopDocs.length,
                  leads: [], kept: false });
      if (++dead >= patience) break;                    // the seam is mined out — stop early, before maxHops
    }
  }

  return { docs, hops, frontier, prior };
};

// The prose a hop reads from an admitted doc: the parsed text, falling back to the source's
// excerpt. admitWebSource parses the full page into `doc.text`; a snippet-only result still
// carries an excerpt on its web metadata.
const pageText = (doc) =>
  String(doc?.text || doc?.web?.excerpt || doc?.excerpt || '');

// runTurnWithResearch(args, opts) → { ...turn, research } — the inverted-flow orchestrator: gather
// the web by a curiosity WALK first (instead of the single-shot search the `auto` path runs), fold
// every kept page into the turn's scope, then answer in ONE grounded pass over [web + docs]. The
// answer therefore stands on a SEAM the engine mined by following its own surprise, and the
// `research` trace (hops + curiosity per hop) rides back for the transparency surface. `runTurnImpl`
// and `search` are injected, so the whole flow is testable without a model or the network.
export const runTurnWithResearch = async (args, {
  search,
  runTurnImpl = runTurn,
  seed,
  maxHops = 4,
  gamma = 0.8,
  curiosityFloor = 0.15,
  k = 3,
  searchOpts = { kind: 'auto', fetchPages: true },
} = {}) => {
  const q0 = String(seed || args?.question || '').trim();
  const walk = await runCuriousResearch(q0, { search, anchor: q0, maxHops, gamma, curiosityFloor, k, searchOpts });

  const baseDocs = args?.docs || (args?.doc ? [args.doc] : []);
  const turnArgs = walk.docs.length
    ? { ...args, doc: undefined, docs: [...baseDocs, ...walk.docs], groundGraph: true }
    : args;
  const turn = await runTurnImpl(turnArgs);

  return {
    ...turn,
    research: {
      seed: q0,
      hops: walk.hops,
      kept: walk.hops.filter(h => h.kept).length,
      results: walk.docs.length,
      sources: walk.docs.map(d => ({
        docId: d.docId, title: d.web?.title || d.title || '', url: d.web?.url || d.web?.final_url || '',
        fetched_at: d.web?.fetched_at || null,
      })),
    },
  };
};

// researchAnnouncement(seed, { maxHops }) → the first-person "let me dig into this" beat, the
// multi-hop sibling of searchAnnouncement (propose.js). Said the moment a curiosity walk starts,
// so the (slower, multi-fetch) gather reads as purposeful. Pure string-mapping, no model call.
export const researchAnnouncement = (seed, { maxHops = 4 } = {}) => {
  const q = String(seed || '').trim();
  if (!q) return null;
  return `Let me look into this — I'll follow what surprises me, up to ${maxHops} hops. Starting with “${q}”…`;
};

const round = (x) => Math.round(x * 100) / 100;
