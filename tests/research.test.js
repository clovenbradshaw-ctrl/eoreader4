import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  researchTerms, profileOf, curiosityOf, foldInto, leadsFrom, nextQuery,
  runCuriousResearch, runTurnWithResearch, researchAnnouncement,
} from '../src/turn/research.js';
import { admitWebSource } from '../src/ingest/websource.js';

// Curiosity-guided research (docs/curiosity-research.md): multi-hop web research steered by the
// engine's ONE surprise (core/surprise.js). Curiosity is D_KL(page ‖ what-we-know); the search
// follows the most surprising thread, up to a max number of hops, and STOPS when surprise dries
// up — it does not shotgun a fan-out of tangential queries. All offline: a fake `search`.

const webDoc = (text, web = {}) => ({ ...admitWebSource({ url: web.url || 'https://w/x', text }).doc, web: { url: 'https://w/x', ...web } });

// ── The curiosity metric IS the surprise core, pointed at the web ─────────────

test('researchTerms keeps topic words, drops function words', () => {
  const t = researchTerms('The X-Files revival is being made by Ryan Coogler in 2026.');
  assert.ok(t.includes('revival') && t.includes('coogler') && t.includes('ryan'));
  assert.ok(!t.includes('the') && !t.includes('by') && !t.includes('is') && !t.includes('2026'));
});

test('a page that only restates the prior is LOW curiosity; a page with a new figure is HIGH', () => {
  const prior = profileOf('The X-Files revival is a television series. The revival is a series.');
  const restate = curiosityOf(prior, profileOf('The X-Files revival is a series, a revival series.'));
  const novel   = curiosityOf(prior, profileOf('Ryan Coogler will direct the revival, said producer Carter.'));
  assert.ok(novel.bits > restate.bits, `a new figure surprises more than a restatement (${novel.bits} vs ${restate.bits})`);
  // and the surprise NAMES what was new — those are the leads
  assert.ok(novel.by.coogler > 0 || novel.by.carter > 0, 'the new figures carry the KL contribution');
});

test('curiosityOf is the shared surprise core — an empty prior opens at zero (no name-snow)', () => {
  const { bits } = curiosityOf(new Map(), profileOf('anything at all here'));
  assert.equal(bits, 0, 'the first arrival has no prior to diverge from — the honest opening');
});

test('foldInto γ-decays incumbents and deposits the arrival (the running knowledge state)', () => {
  const prior = new Map([['a', 10], ['b', 4]]);
  const next = foldInto(prior, new Map([['b', 1], ['c', 2]]), 0.5);
  assert.equal(next.get('a'), 5, 'a decayed by γ=0.5');
  assert.equal(next.get('b'), 4 * 0.5 + 1, 'b decayed then took its deposit');
  assert.equal(next.get('c'), 2, 'the newcomer deposits at full mass');
  assert.equal(prior.get('a'), 10, 'the input prior is untouched');
});

test('leadsFrom ranks by belief moved and drops already-seen leads', () => {
  const leads = leadsFrom({ coogler: 0.4, carter: 0.1, revival: 0.9 }, { seen: new Set(['revival']), max: 2 });
  assert.deepEqual(leads.map(l => l.term), ['coogler', 'carter'], 'heaviest first, seen "revival" dropped');
});

test('nextQuery keeps the thread coherent — the lead rides WITH the anchor, never bare', () => {
  assert.equal(nextQuery('X-Files revival', { term: 'coogler' }), 'X-Files revival coogler');
  assert.equal(nextQuery('X-Files revival', { term: 'revival' }), 'X-Files revival', 'no duplication when the anchor already has it');
});

// ── The loop: best-first over curiosity, capped hops, anti-shotgun stop ───────

test('the walk follows the most surprising thread across hops, up to maxHops', async () => {
  // Hop 1 (seed) introduces Coogler; hop 2 (chasing Coogler) introduces Wakanda; the walk should
  // keep digging the live thread rather than firing every term at once.
  // A page ABOUT Coogler says "Coogler" a lot — that mass is what lifts it above the other seed
  // terms, so the walk's most-surprising thread is the one with the real signal behind it.
  const pages = {
    'x-files revival': 'Coogler, Coogler, Coogler. The X-Files revival will be directed by Coogler.',
    'x-files revival coogler': 'Coogler directed Wakanda, Wakanda, Wakanda; now Coogler takes the revival.',
    'x-files revival wakanda': 'Wakanda is a fictional Marvel nation, ruled by the Panther, Panther, Panther.',
  };
  const queries = [];
  const search = async (q) => { queries.push(q); const text = pages[q.toLowerCase()]; return text ? [{ doc: webDoc(text) }] : []; };

  const out = await runCuriousResearch('X-Files revival', { search, maxHops: 3, curiosityFloor: 0.05, patience: 3, k: 1 });
  assert.equal(out.hops[0].query, 'X-Files revival', 'seed first');
  assert.ok(queries.some(q => /coogler/i.test(q)), 'it chased the surprising figure Coogler');
  assert.ok(queries.some(q => /wakanda/i.test(q)), 'and then the deeper thread Wakanda that Coogler opened');
  assert.ok(out.docs.length >= 2, 'the kept pages joined the ground');
});

test('maxHops is a hard ceiling — the walk never exceeds it', async () => {
  // Every page is endlessly surprising (fresh tokens each hop), so only the cap can stop it.
  let n = 0;
  const search = async () => { n += 1; return [{ doc: webDoc(`fresh figure number ${'alpha'.repeat(n)} entity${n} place${n} event${n}`) }]; };
  const out = await runCuriousResearch('seed topic', { search, maxHops: 2, curiosityFloor: 0.01, k: 1 });
  assert.equal(out.hops.length, 2, 'stopped at exactly maxHops');
});

test('NOT shotgunning: a dead (sub-floor) thread is dropped and the seam mines out (patience)', async () => {
  // The seed is rich; every follow-up just restates it (zero new surprise). The walk must NOT keep
  // firing tangential queries — after `patience` dead threads it stops, well short of maxHops.
  const seedText = 'The X-Files revival is a television series produced by Carter for the network.';
  const search = async (q) => {
    if (/coogler|carter|revival television|network|series/i.test(q) && q.toLowerCase() !== 'x-files revival')
      return [{ doc: webDoc('The revival is a television series. A series, the revival, on the network.') }]; // restatement → ~0 curiosity
    return [{ doc: webDoc(seedText) }];
  };
  const out = await runCuriousResearch('X-Files revival', { search, maxHops: 8, curiosityFloor: 0.2, patience: 2, k: 1 });
  assert.ok(out.hops.length < 8, `stopped early, not the full fan-out (took ${out.hops.length} hops)`);
  assert.ok(out.hops.some(h => !h.kept), 'at least one thread was judged dead and dropped');
  assert.ok(out.docs.length >= 1, 'the seed page is still kept as the answer ground');
});

test('the seed is always kept as ground even if its curiosity is below the floor', async () => {
  const search = async () => [{ doc: webDoc('a plain page') }];
  const out = await runCuriousResearch('plain topic', { search, maxHops: 1, curiosityFloor: 5, k: 1 });
  assert.equal(out.hops[0].kept, true, 'the seed hop is the ground, not a lead — kept regardless of floor');
  assert.equal(out.docs.length, 1);
});

test('a failed/empty search degrades to no docs, no throw', async () => {
  const search = async () => { throw new Error('network down'); };
  const out = await runCuriousResearch('topic', { search, maxHops: 3 });
  assert.deepEqual(out.docs, []);
  assert.equal(out.hops.length, 1, 'one hop attempted, recorded as a dead thread');
  assert.equal(out.hops[0].kept, false);
});

test('a never-repeats-query guarantee: the same lead is never fetched twice', async () => {
  const queries = [];
  const search = async (q) => { queries.push(q.toLowerCase()); return [{ doc: webDoc('Coogler Coogler Wakanda Carter revival figures') }]; };
  await runCuriousResearch('X-Files revival', { search, maxHops: 5, curiosityFloor: 0.01, k: 1 });
  assert.equal(new Set(queries).size, queries.length, 'no query was issued twice');
});

// ── The orchestrator: gather, fold into scope, answer in one grounded pass ────

test('runTurnWithResearch folds the kept pages into the turn scope and rides a trace back', async () => {
  const pages = {
    'who directs the x-files revival': 'The X-Files revival will be directed by Ryan Coogler.',
    'who directs the x-files revival coogler': 'Coogler, the Wakanda director, replaces Carter on the revival.',
  };
  const search = async (q) => { const t = pages[q.toLowerCase()]; return t ? [{ doc: webDoc(t, { title: q }) }] : []; };
  const calls = [];
  const runTurnImpl = async (args) => { calls.push(args); return { answer: 'Ryan Coogler.', route: 'grounded', sources: [0] }; };

  const out = await runTurnWithResearch(
    { question: 'who directs the x-files revival', docs: [] },
    { search, runTurnImpl, maxHops: 2, curiosityFloor: 0.05, k: 1 });

  assert.equal(out.answer, 'Ryan Coogler.');
  assert.ok(calls[0].docs.length >= 1, 'the gathered web pages joined the grounding scope');
  assert.equal(calls[0].groundGraph, true, 'the meaning graph of the gather is fed to the talker');
  assert.ok(out.research.results >= 1 && out.research.kept >= 1, 'the research trace reports what was kept');
  assert.equal(out.research.seed, 'who directs the x-files revival');
});

test('runTurnWithResearch with no gather just runs the turn (no scope change)', async () => {
  const search = async () => [];
  const calls = [];
  const runTurnImpl = async (args) => { calls.push(args); return { answer: 'from memory', route: 'chat' }; };
  const out = await runTurnWithResearch({ question: 'q', docs: [] }, { search, runTurnImpl, maxHops: 3 });
  assert.equal(out.answer, 'from memory');
  assert.equal(out.research.results, 0);
  assert.equal(calls[0].groundGraph, undefined, 'an empty gather does not touch the turn args');
});

test('researchAnnouncement is a first-person, pre-walk beat naming the seed and the hop budget', () => {
  const line = researchAnnouncement('X-Files revival', { maxHops: 4 });
  assert.match(line, /follow what surprises me/);
  assert.match(line, /4 hops/);
  assert.match(line, /X-Files revival/);
  assert.equal(researchAnnouncement('   '), null);
});
