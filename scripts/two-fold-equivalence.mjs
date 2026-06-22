#!/usr/bin/env node
// two-fold-equivalence — one cursor §8 P0.1: are the reader's γ-prior and the
// writer's integral the SAME standing state computed twice?
//
// The one-cursor spec §4 claims `readingAt`'s prior (src/perceiver/reading.js) and
// `write/fold.js`'s integral are "the same standing state computed twice," and P4
// proposes to DELETE the second fold and read the dossier off the reader. P0.1 is the
// gate that must clear FIRST: run the same arrivals through both standing-weight
// kernels and confirm the readout matches. The spec is explicit about the stakes —
// "If they diverge, reconcile γ and the decay before any collapse, or P4 is unsound."
//
// The two kernels, verbatim from source:
//
//   reading.js:93   w = γ^(at − 1 − sentIdx),  over events with sentIdx <  at   (γ=0.7)
//   fold.js:102     w = γ^(t  −      e.t   ),  over events with e.t     <= t    (γ=0.8)
//
// Three axes can diverge, and the gate checks each:
//   1. γ        the decay constant            0.7 (reading) vs 0.8 (fold)
//   2. clock    the recency exponent + reach  at−1−sentIdx, prior EXCLUDES the cursor
//                                             line  vs  t−e.t, integral INCLUDES it.
//                                             An off-by-one of exactly one γ-step.
//   3. basis    what an arrival deposits       reading: figure presence + propositions
//                                             in one flat profile.  fold: firm
//                                             descriptors per referent, voids held in a
//                                             separate `open` list.
//
// Axes 1–2 are the "reconcile γ and the decay" the spec names: they are PURE kernel,
// and the controlled experiment below proves the two readouts become byte-identical
// the moment both are aligned — so the divergence is exactly (γ, clock), nothing more.
// Axis 3 is the structural reconciliation P4 itself performs (read the dossier off the
// reader). The VERDICT: collapsible, but NOT collapsible as-is.
//
//   node scripts/two-fold-equivalence.mjs [path] [--at 12]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingestText } from '../src/organs/in/index.js';
import { readingAt } from '../src/perceiver/index.js';
import { createFold } from '../src/write/fold.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let file = null, at = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--at') at = Number(args[++i]);
  else if (!a.startsWith('--')) file = a;
}
file = file || path.resolve(here, '../data/metamorphosis.txt');

// The two kernels, transcribed from source so the script reads the same decay the
// engine does (the closed forms; see the file:line citations above).
const GAMMA_READING = 0.7;   // reading.js:22
const GAMMA_FOLD    = 0.8;   // fold.js:37
const readingW = (c, k, g = GAMMA_READING) => (k < c ? Math.pow(g, c - 1 - k) : 0);   // prior excludes c
const foldW    = (t, k, g = GAMMA_FOLD)    => (k <= t ? Math.pow(g, t - k)     : 0);   // integral includes t

const fx = (x) => (Number.isFinite(x) ? x.toFixed(4) : '—');
const eq = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

console.log(`# two-fold-equivalence — one cursor §8 P0.1\n`);
console.log(`  reading.js prior   w = γ^(at−1−sentIdx),  sentIdx <  at,  γ=${GAMMA_READING}`);
console.log(`  fold.js  integral  w = γ^(t − e.t),       e.t     <= t,   γ=${GAMMA_FOLD}\n`);

// ── Axis 1+2: the controlled kernel experiment (the rigorous gate) ──────────────
// A single arrival at line k, queried at cursor c. Tabulate the standing weight each
// kernel assigns it as it recedes, and the ratio. This isolates (γ, clock) from any
// basis or adapter question — it is pure decay math from each file.
const C = 8;
console.log(`## controlled: one arrival at line k, standing weight read at cursor c=${C}`);
console.log(`   (the same event, fed to both kernels, as it recedes from the cursor)\n`);
console.log(`     k   reading γ^(c−1−k)   fold γ^(c−k)    ratio fold/read   agree?`);
let anyDiverge = false;
for (let k = C; k >= 0; k--) {
  const r = readingW(C, k);
  const f = foldW(C, k);
  const ratio = r > 0 ? f / r : Infinity;
  const agree = eq(r, f);
  if (!agree) anyDiverge = true;
  console.log(
    `    ${String(k).padStart(2)}   ${fx(r).padStart(14)}   ${fx(f).padStart(11)}   ` +
    `${(Number.isFinite(ratio) ? ratio.toFixed(4) : '∞').padStart(13)}   ${agree ? '=' : '≠'}`);
}
console.log(`\n   ⇒ as shipped, the two readouts ${anyDiverge ? 'DIVERGE' : 'agree'} on the same arrival.`);

// The decomposition: which axis carries the divergence, and does aligning it close.
console.log(`\n## decomposition — align one axis at a time (arrival at k=c−3=${C - 3}, cursor c=${C})`);
const k0 = C - 3;
const asShipped   = { r: readingW(C, k0, GAMMA_READING), f: foldW(C, k0, GAMMA_FOLD) };
const gammaOnly   = { r: readingW(C, k0, 0.75),          f: foldW(C, k0, 0.75) };          // unify γ only
const clockOnly   = { r: readingW(C, k0, GAMMA_READING), f: foldW(C - 1, k0, GAMMA_FOLD) }; // shift fold clock −1 only
const bothAligned = { r: readingW(C, k0, 0.75),          f: foldW(C - 1, k0, 0.75) };        // unify γ AND align clock
const row = (label, o) =>
  console.log(`   ${label.padEnd(34)} reading ${fx(o.r)}  fold ${fx(o.f)}   ${eq(o.r, o.f) ? '→ EQUAL' : '→ diverge'}`);
row('as shipped (γ 0.7 vs 0.8, clock off)', asShipped);
row('unify γ only (0.75 / 0.75)',            gammaOnly);
row('align clock only (fold t := at−1)',     clockOnly);
row('unify γ AND align clock',               bothAligned);
console.log(`\n   ⇒ the divergence is EXACTLY (γ, clock): unify the decay constant and remove the`);
console.log(`     one-step clock offset (the reader's prior excludes the cursor line; the`);
console.log(`     integral includes it) and the standing weight is byte-identical. Reconcile`);
console.log(`     both BEFORE the collapse (§8 P4), or P4 is unsound.`);

// ── Axis 3: the basis — what each fold actually HOLDS, in situ ───────────────────
// Illustrative, on the real document: the reader's prior is figure presence; the
// integral is per-referent firm descriptors with voids held apart. Same events, two
// different views — the structural reconciliation P4 performs (read the dossier off
// the reader's state), not a kernel bug. Defensive: skips gracefully on any shape gap.
const text = fs.readFileSync(file, 'utf8');
const doc = await ingestText(text);
const units = doc.units || doc.sentences || [];
const S = units.length;
const cursor = Number.isFinite(at) ? Math.max(0, Math.min(S - 1, at)) : Math.floor(S * 0.7);
const events = typeof doc.log.snapshot === 'function' ? doc.log.snapshot() : (doc.log.events || []);

console.log(`\n## basis (in situ) — ${path.basename(file)} (${S} units), standing readout at cursor ${cursor}`);
try {
  // Feed the SAME log events to fold.js's integral.
  const fold = createFold();
  const label = new Map();
  for (const e of events) if (e.op === 'INS' && !label.has(e.id)) label.set(e.id, e.label);
  for (const e of events) {
    if (e.sentIdx == null || e.sentIdx > cursor) continue;
    if (e.op === 'INS') fold.update({ op: 'INS', site: e.id, t: e.sentIdx }, { head: e.label });
    else if (e.op === 'CON' || e.op === 'SIG') fold.update({ op: 'CON', sites: [e.src, e.tgt], attr: e.via, res: 'firm', t: e.sentIdx });
    else if (e.op === 'DEF' && e.key === 'predicate') fold.update({ op: 'DEF', site: e.id, attr: e.value, res: 'firm', t: e.sentIdx });
  }
  // The reader's prior, as a forward profile (the f: atoms are figure presence).
  const r = readingAt(doc, cursor, { forward: true });
  const figs = (r.pNext?.dist || []).filter(([atom]) => atom.startsWith('f:')).slice(0, 6);
  console.log(`\n   READER  (reading.js prior — figure presence, renormalised p):`);
  for (const [atom, p] of figs) console.log(`      ${(label.get(atom.slice(2)) || atom.slice(2)).padEnd(22)} p=${p.toFixed(3)}`);

  console.log(`\n   WRITER  (fold.js integral — per-referent dossier, firm descriptors + held-open voids):`);
  const ranked = [...fold.refs.keys()]
    .map(h => ({ h, d: fold.dossierOf(h, cursor) }))
    .filter(x => x.d.descriptors.length || x.d.open.length)
    .sort((a, b) => (b.d.descriptors[0]?.w || 0) - (a.d.descriptors[0]?.w || 0))
    .slice(0, 6);
  if (!ranked.length) console.log(`      (no firm descriptors recorded at this cursor — the document's edges did not route to the integral)`);
  for (const { h, d } of ranked) {
    const desc = d.descriptors.slice(0, 3).map(x => `${x.attr}·${x.w.toFixed(2)}`).join(', ');
    const open = d.open.length ? `   ⟂open: ${d.open.map(x => x.attr).join('; ')}` : '';
    console.log(`      ${String(d.head).padEnd(22)} ${desc || '—'}${open}`);
  }
  console.log(`\n   ⇒ the reader holds PRESENCE (who), the integral holds DESCRIPTORS (what), voids apart.`);
  console.log(`     Same events, two views: P4's job is to read the dossier off the reader's state,`);
  console.log(`     which only becomes sound once axes 1–2 are reconciled.`);
} catch (err) {
  console.log(`   (in-situ basis pass skipped: ${err.message})`);
}

// ── VERDICT ──────────────────────────────────────────────────────────────────────
const gammaDiverges = GAMMA_READING !== GAMMA_FOLD;
const clockDiverges = !eq(readingW(C, k0, 0.75), foldW(C, k0, 0.75));   // same γ, still off by the clock
const collapsibleAfterFix = eq(bothAligned.r, bothAligned.f);
console.log(`\n## VERDICT — §8 P0.1 gate`);
console.log(`   γ divergent (0.7 vs 0.8) ......... ${gammaDiverges ? 'YES — reconcile' : 'no'}`);
console.log(`   clock divergent (off-by-one) ..... ${clockDiverges ? 'YES — reconcile' : 'no'}`);
console.log(`   collapsible once both aligned .... ${collapsibleAfterFix ? 'YES' : 'NO'}`);
const pass = !gammaDiverges && !clockDiverges;
console.log(`\n   GATE: ${pass ? 'PASS — the folds are the same state; P4 may proceed.'
                              : 'FAIL — the folds are NOT the same state as shipped.'}`);
if (!pass) {
  console.log(`         Reconcile γ and the decay clock before the collapse (§8 P4). The`);
  console.log(`         controlled experiment shows that, once reconciled, the readout is`);
  console.log(`         byte-identical — so the collapse is sound AFTER the reconciliation,`);
  console.log(`         and unsound before it. This is the measurement coming back negative,`);
  console.log(`         exactly as §8 P0 anticipates.`);
}
