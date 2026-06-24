#!/usr/bin/env node
// credence-measure — the build gate of the source-trajectory spec (§12).
//
// "The cheap read-only measurement comes first. Before any reweighting touches
// retrieve or veto, run the three channels read-only over held-out sources and
// check that they separate the synthetic seeker, the liar, and the bullshitter.
// If they do not separate, the build stops there. Only on a positive measurement
// do the integration points turn on."
//
// This prints that measurement: the (M, O) coordinates and the call for each of
// the three synthetic types, plus a regime flip and the independence guard. It is
// the same thing tests/credence-separation.test.js asserts, made legible — run it
// to SEE the L (M separates the bullshitter; O separates the seeker from the liar)
// before trusting the gate.
//
//   node scripts/credence-measure.mjs

import { createCredenceBook, CLASS, NUL_O } from '../src/credence/index.js';

const lcg = (seed) => { let s = seed >>> 0; return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; }; };
const fmt = (x) => (x >= 0 ? ' ' : '') + x.toFixed(3);
const Ointerval = (O) => O === NUL_O ? '      NUL       ' : `[${fmt(O.lo)},${fmt(O.mean)},${fmt(O.hi)}]`;

const row = (name, st) => {
  const M = `[${fmt(st.M.lo)},${fmt(st.M.mean)},${fmt(st.M.hi)}]`;
  console.log(`  ${name.padEnd(12)} ${st.classification.padEnd(20)} M=${M}  O=${Ointerval(st.O)}`);
};

const book = createCredenceBook();

// SEEKER — coherent, survives independent triangulation, revises toward the record.
{ const rng = lcg(3);
  for (let i = 0; i < 30; i++) book.observeCoherence('seeker', 'news', 0.86 + 0.06 * (rng() - 0.5));
  for (let i = 0; i < 40; i++) book.observeCorroboration('seeker', 'news', 0.82 + 0.08 * (rng() - 0.5),
    { corroborators: [{ id: 'a' + i, w_indep: 1 }, { id: 'b' + i, w_indep: 1 }, { id: 'c' + i, w_indep: 1 }] });
  for (let i = 0; i < 14; i++) book.observeRevision('seeker', 'news', 0.45 + 0.25 * rng()); }

// LIAR — equally coherent (a real model), but the claims do not survive, and it doubles down.
{ const rng = lcg(5);
  for (let i = 0; i < 30; i++) book.observeCoherence('liar', 'news', 0.88 + 0.05 * (rng() - 0.5));
  for (let i = 0; i < 40; i++) book.observeCorroboration('liar', 'news', 0.12 + 0.08 * (rng() - 0.5),
    { corroborators: [{ id: 'x' + i, w_indep: 1 }, { id: 'y' + i, w_indep: 1 }] });
  for (let i = 0; i < 14; i++) book.observeRevision('liar', 'news', -0.3 + 0.08 * (rng() - 0.5)); }

// BULLSHITTER — incoherent, scored with NO corroboration at all (no truth signal).
{ const rng = lcg(11);
  for (let i = 0; i < 40; i++) book.observeCoherence('bs', 'news', 0.30 * rng());
  for (let i = 0; i < 15; i++) book.observeRevision('bs', 'news', 2 * rng() - 1); }

console.log('\nThe three types on the (M, O) plane — modelfulness M, orientation O:\n');
row('SEEKER', book.at('seeker', 'news'));
row('LIAR', book.at('liar', 'news'));
row('BULLSHITTER', book.at('bs', 'news'));

const defs = book.flushVerdicts().map(e => `${e.source_id}/${e.domain}`);
console.log(`\nDEF verdicts asserted (bullshitter only, O never gets one): ${JSON.stringify(defs)}`);

// A regime flip, dated.
{ const flip = createCredenceBook(); const rng = lcg(9);
  for (let i = 0; i < 25; i++) flip.observeCoherence('R', 'news', 0.88 + 0.05 * (rng() - 0.5));
  for (let i = 0; i < 25; i++) flip.observeCoherence('R', 'news', 0.10 + 0.10 * rng());
  const cp = flip.log.snapshot().find(e => e.kind === 'changepoint');
  const before = flip.at('R', 'news', { cursor: 24 }), after = flip.at('R', 'news');
  console.log(`\nRegime flip: break dated at cursor ${cp.cursor} (${cp.direction}); ` +
    `${before.classification} (M=${before.M.mean.toFixed(2)}) → ${after.classification} (M=${after.M.mean.toFixed(2)})`);
}

// The independence guard.
{ const sock = createCredenceBook(), ind = createCredenceBook();
  const against = { id: 'src', author: 'Y' };
  const sockC = Array.from({ length: 5 }, (_, i) => ({ id: 'p' + i, author: 'X', feed: 'W' }));
  const indC = Array.from({ length: 5 }, (_, i) => ({ id: 'q' + i }));
  for (let i = 0; i < 20; i++) { sock.observeCorroboration('Z', 'news', 0.9, { against, corroborators: sockC }); ind.observeCorroboration('Z', 'news', 0.9, { against, corroborators: indC }); }
  console.log(`\nIndependence guard: 5 sock-puppets → K-evidence ${sock.at('Z', 'news').evidence.corroboration_n.toFixed(1)}; ` +
    `5 independent → ${ind.at('Z', 'news').evidence.corroboration_n.toFixed(1)} (the cluster counts as ~one voice)\n`);
}
