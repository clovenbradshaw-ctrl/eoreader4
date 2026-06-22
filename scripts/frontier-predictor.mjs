#!/usr/bin/env node
// frontier-predictor — one cursor §8 P0.2: read the document line forward PAST the
// frontier and confirm the prediction is not flat, and carries a MOVE.
//
// The whole one-cursor mechanism rests on one claim (§2): "generation = read past the
// frontier." The reader already returns the forward prediction for free (predicted +
// pNext, the γ-prior renormalised). Past the last existing unit there is no unit to
// check it against, so the system realises it. But the loop "only walks if the frontier
// predictor carries a move" (§9) — so P0.2 must confirm, BEFORE P3 is built, that at the
// frontier the prediction:
//   (a) is NOT FLAT — the prior concentrates mass on known atoms, not all on the
//       NOVELTY reserve (a flat prior is a dead seed: nothing to read off); and
//   (b) carries a MOVE — the top of p(next) includes a proposition (p:) or predicate
//       (d:) atom, or `predicted.bonds` is non-empty, not ONLY a figure (f:). The spec
//       is exact: "confirm it carries a move, not only a figure." A figure alone says
//       WHO acts next; a move says WHAT — and realize() needs the what.
//
// If the prior is flat or figure-only at the frontier, "generation has nothing to read
// off, and the seed and horizon are fixed before P3" (§8 P0). This script reads the
// frontier with the FULL prior (every real unit) by reading at one index past the last
// unit over a sentinel — so the prior is events < S = all of them, the true "past the
// frontier" the §2 loop occupies. Read-only; the default reading path is untouched.
//
//   node scripts/frontier-predictor.mjs [path] [--horizon entity|recency] [--top 8]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingestText } from '../src/organs/in/index.js';
import { readingAt } from '../src/perceiver/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let files = [], horizon = null, topN = 8;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--horizon') horizon = args[++i];
  else if (a === '--top') topN = Number(args[++i]);
  else if (!a.startsWith('--')) files.push(a);
}
if (!files.length) files = [path.resolve(here, '../data/metamorphosis.txt'), path.resolve(here, '../data/esker.txt')];

// FLAT means: the reserve (NOVELTY) holds most of the forward mass — the prior set up
// no expectation. A live prior pushes the reserve well below 1. The threshold is
// deliberately generous; we only need to distinguish "a seed exists" from "dead field."
const FLAT_RESERVE = 0.9;

const kindOf = (atom) => atom.startsWith('f:') ? 'figure' : atom.startsWith('p:') ? 'move·prop' : atom.startsWith('d:') ? 'move·pred' : 'other';
const isMove = (atom) => atom.startsWith('p:') || atom.startsWith('d:');

// frontierReading — read one index PAST the last real unit, so the prior is every real
// unit (events sentIdx < S). A sentinel '' unit extends `units` without an event, so the
// deposit at S is empty (no surprise) and `predicted`/`pNext` is the pure forward prior.
const frontierReading = (doc, opts) => {
  const units = doc.units || doc.sentences || [];
  const S = units.length;
  const frontierDoc = { ...doc, units: [...units, ''], sentences: undefined };
  return { S, r: readingAt(frontierDoc, S, { forward: true, ...opts }) };
};

let allPass = true;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const doc = await ingestText(text);
  const horizons = horizon ? [horizon] : ['recency', 'entity'];

  console.log(`\n# frontier-predictor — ${path.basename(file)}`);
  for (const h of horizons) {
    const { S, r } = frontierReading(doc, { horizon: h });
    const dist = r.pNext?.dist || [];
    const reserve = r.pNext?.reserve ?? 1;
    const top = dist.slice(0, topN);
    const moveAtoms = top.filter(([atom]) => isMove(atom));
    const figureAtoms = top.filter(([atom]) => atom.startsWith('f:'));

    const flat = reserve >= FLAT_RESERVE || dist.length === 0;
    const carriesMove = moveAtoms.length > 0 || (r.predicted?.bonds?.length || 0) > 0;
    const pass = !flat && carriesMove;
    allPass = allPass && pass;

    console.log(`\n## horizon='${h}' — frontier at index ${S} (after ${S} units)`);
    console.log(`   predicted.figures: ${(r.predicted?.figures || []).join(', ') || '—'}`);
    console.log(`   predicted.bonds:   ${(r.predicted?.bonds || []).join(' ; ') || '—'}`);
    console.log(`   p(next) reserve (unseen mass): ${reserve.toFixed(3)}   ${flat ? '← FLAT (dead seed)' : '← live'}`);
    console.log(`   top ${top.length} of p(next):`);
    for (const [atom, p] of top) {
      const kind = kindOf(atom);
      console.log(`      ${kind.padEnd(9)} p=${p.toFixed(3)}  ${atom}`);
    }
    console.log(`   figures in top: ${figureAtoms.length}   moves (prop/pred) in top: ${moveAtoms.length}`);
    console.log(`   GATE  not-flat: ${!flat ? 'PASS' : 'FAIL'}   carries-a-move: ${carriesMove ? 'PASS' : 'FAIL'}` +
                `   ⇒ ${pass ? 'PASS' : 'FAIL'}`);
    if (pass) {
      console.log(`         ⇒ the prior is alive at the frontier and carries a move — realize() has`);
      console.log(`           something to phrase. P3 (read past the frontier) is licensed for this horizon.`);
    } else if (flat) {
      console.log(`         ⇒ the seed is dead — fix the seed/horizon before P3 (§8 P0).`);
      if (h === 'entity') {
        // DIAGNOSIS: the entity horizon seeds `actors` from events AT the cursor line
        // (reading.js:68-76); at the frontier the cursor line is the not-yet-generated
        // one, so the actor-set is empty and the prior is filtered to nothing. The §2
        // loop specifies `{ horizon: 'entity' }` literally — that is the part to fix:
        // re-seed the frontier's entity horizon from the DEF target / the recency top
        // (§6 "read toward the referent under DEF"), not the empty current line.
        const recency = frontierReading(doc, { horizon: 'recency' }).r;
        const seedFigs = (recency.predicted?.figures || []).slice(0, 3);
        console.log(`         ⇒ CAUSE: the entity horizon's actor-seed is events at the frontier line`);
        console.log(`           (the line being generated) — which is empty, so it admits no prior.`);
        console.log(`           FIX (before P3): re-seed it from the DEF target / the recency top`);
        console.log(`           figures [${seedFigs.join(', ') || '—'}], which the recency prior already carries live.`);
      }
    } else {
      console.log(`         ⇒ figure-only: who-acts-next without a what. realize() would have only a`);
      console.log(`           subject, no predicate. Widen the basis or horizon before P3 (§8 P0).`);
    }
  }
}

console.log(`\n## VERDICT — §8 P0.2 gate`);
console.log(`   ${allPass
  ? 'PASS — at the frontier the prior is alive AND carries a move on every horizon tried.\n'
  + '          Generation has something to read off; P3 is licensed (quality of generation\n'
  + '          = quality of the reading, which this confirms is non-trivial at the frontier).'
  : 'MIXED/FAIL — at least one horizon is flat or figure-only at the frontier. Per §8 P0,\n'
  + '          fix the seed and the horizon before building P3 — generation can only read off\n'
  + '          a live, move-carrying prior.'}`);
