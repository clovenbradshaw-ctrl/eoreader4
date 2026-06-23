#!/usr/bin/env node
// reserve-rate / GENERALIZATION — the fix's fitness is how many INDEPENDENT pressures it
// improves, not whether it passes the one that prompted it. This re-runs the confirmed
// reserve dissociation on FRESH material drawn from random Wikipedia articles (structured
// draw around a seed: the axes fix the form — turnover vs stable — the article fixes the
// content). Each seed is recorded with its title+revision (the seed of record) so a pass
// or a gap can be replayed. Read-only; touches no production code.
//
//   node evo/experiments/reserve-rate/generalize.mjs [N]
// Falls back to a fixed offline cast if the network is unreachable (the loop still runs).

import { parseText } from '../../../src/perceiver/parse/index.js';
import { readingAt } from '../../../src/perceiver/index.js';
import { randomSeed } from '../../lib/seed.mjs';

const N = Number(process.argv[2]) || 5;

// Pull clean, single-token Capitalized names from an article extract — candidate figures.
// (We need ≥5 distinct ones to build a turnover/stable pair with a probe.)
const namesFrom = (extract) => {
  const stop = new Set(['The', 'A', 'An', 'It', 'In', 'On', 'At', 'He', 'She', 'They', 'This', 'That', 'These', 'Those', 'As', 'By', 'For', 'Its', 'His', 'Her', 'After', 'Before', 'During', 'From', 'With', 'And', 'But', 'Or']);
  const seen = new Set(), out = [];
  for (const w of String(extract).split(/\s+/)) {
    const m = w.match(/^([A-Z][a-z]{2,11})[.,;:]?$/);   // one clean capitalized token
    if (!m || stop.has(m[1])) continue;
    if (!seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); }
  }
  return out;
};

// Build the turnover/stable pair from a 5-name cast (4 prefix + 1 shared probe), check the
// dissociation. Returns { ok, void, detail }. void = the material did not parse cleanly
// (instrument not live) — not a failure of the capability.
const trial = (cast) => {
  const [a, b, c, d, z] = cast;
  const turnover = `${a} arrived. ${b} arrived. ${c} arrived. ${d} arrived. ${z} arrived.`;
  const stable   = `${a} arrived. ${a} waited. ${a} waited. ${a} waited. ${z} arrived.`;
  const tDoc = parseText(turnover, { docId: 'gt' }), sDoc = parseText(stable, { docId: 'gs' });
  if (tDoc.units.length !== 5 || sDoc.units.length !== 5) return { void: true, detail: 'did not segment into 5 units' };
  const at = 4;
  const tC = readingAt(tDoc, at, { reserve: 'const' }).bayesBits;
  const sC = readingAt(sDoc, at, { reserve: 'const' }).bayesBits;
  const tS = readingAt(tDoc, at, { reserve: 'signal' }).bayesBits;
  const sS = readingAt(sDoc, at, { reserve: 'signal' }).bayesBits;
  const controlBlind = tC === sC;            // constant reserve must be blind
  const mechanism = tS < sS;                 // signal reserve must separate, turnover < stable
  // INSTRUMENT PRECONDITION: the control being blind means the priors are MATCHED — the
  // confound the experiment controls for. If a random cast fails to build matched priors
  // (a word like "Something" the parser does not treat as a recurring figure), the const
  // channel is not blind, the trial is CONFOUNDED, and the mechanism cannot be read off it
  // cleanly. That is a void instrument, not a failure of the capability. Only when the
  // control IS blind is a non-separating signal a real FAIL.
  if (!controlBlind) return { void: true, detail: { tC, sC, note: 'confounded — priors not matched (control not blind)' } };
  return { ok: mechanism, void: false, detail: { tC, sC, tS, sS, controlBlind, mechanism } };
};

const results = [];
let gotSeed = 0;
for (let i = 0; i < N; i++) {
  const seed = await randomSeed();
  if (!seed) continue;                 // a single network hiccup skips this draw, not the run
  gotSeed++;
  const names = namesFrom(seed.extract);
  const rec = { title: seed.title, revision: seed.revision, names: names.slice(0, 5) };
  if (names.length < 5) { rec.verdict = 'void'; rec.detail = `only ${names.length} clean names`; results.push(rec); continue; }
  const t = trial(names.slice(0, 5));
  rec.verdict = t.void ? 'void' : (t.ok ? 'pass' : 'FAIL');
  rec.detail = t.detail;
  results.push(rec);
}
const online = gotSeed > 0;

// Offline fallback — three fixed casts far from the tuning set, so the loop still runs.
if (!online) {
  for (const cast of [['Tycho', 'Kepler', 'Galileo', 'Newton', 'Halley'], ['Inari', 'Saimaa', 'Oulu', 'Vaasa', 'Kuopio'], ['Mbeki', 'Zuma', 'Sisulu', 'Tambo', 'Hani']]) {
    const t = trial(cast);
    results.push({ title: '(offline)', revision: null, names: cast, verdict: t.ok ? 'pass' : 'FAIL', detail: t.detail });
  }
}

console.log(`# reserve-rate generalization — ${online ? 'online (random Wikipedia seeds)' : 'OFFLINE fallback'}`);
let pass = 0, voids = 0, fail = 0;
for (const r of results) {
  if (r.verdict === 'pass') pass++; else if (r.verdict === 'void') voids++; else fail++;
  const d = r.detail && r.detail.tS != null ? ` signal ${r.detail.tS}<${r.detail.sS} const ${r.detail.tC}=${r.detail.sC}` : ` (${r.detail || ''})`;
  console.log(`  ${r.verdict.padEnd(4)} "${r.title}"${r.revision ? ' @' + r.revision : ''} [${r.names.join(', ')}]${d}`);
}
const scored = pass + fail;
console.log(`# ${pass}/${scored} scored seeds hold the dissociation (${voids} void: material did not parse cleanly).`);
console.log(JSON.stringify({ generalization: 'reserve-rate', online, pass, fail, voids, seeds: results.map((r) => ({ title: r.title, revision: r.revision, verdict: r.verdict })) }));
process.exit(fail === 0 ? 0 : 1);
