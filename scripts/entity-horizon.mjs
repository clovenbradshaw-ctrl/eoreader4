#!/usr/bin/env node
// entity-horizon — move 2: does a SELECTIVE horizon promote the rupture?
//
// Move 1 showed a wider temporal γ only DAMPS surprise (wide ≤ recency everywhere):
// at γ=0.95 the disowning falls 0.374 → 0.148, because a fat temporal window holds the
// recent DECLINE harder than the distant CARE. A temporal kernel cannot promote a line
// to a rupture. The entity horizon can: read a line against only the prior events of
// the figures it acts on — the disowning against Grete's own care arc, not the
// household's decline.
//
//   recency(c)  = bayes(c)                    # today: all figures, γ-decayed
//   entity(c)   = bayes(c | horizon=entity)   # only this line's figures' past
//   promote(c)  = entity(c) − recency(c)      # SIGNED. > 0 ⇒ more surprising against
//                                             #   its own arc than the recent mix ⇒
//                                             #   a figure betraying its own history.
//
// Gate: the disowning (and the apple wound) should PROMOTE (positive); pure novelty
// (the violin/lodger setup) should not — its surprise is against the world, not a
// figure's own past. If nothing promotes, the selective horizon is no better than the
// temporal one and the meaning-field idea has no lever. Read-only; default path
// untouched (horizon defaults to 'recency').
//
//   node scripts/entity-horizon.mjs [path] [--gamma 0.7] [--top 12] [--find "must go"]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingestText } from '../src/ingest/index.js';
import { readingAt } from '../src/read/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let file = null, gamma = 0.7, topN = 12, find = 'must go';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--gamma') gamma = Number(args[++i]);
  else if (a === '--top') topN = Number(args[++i]);
  else if (a === '--find') find = args[++i];
  else if (!a.startsWith('--')) file = a;
}
file = file || path.resolve(here, '../data/metamorphosis.txt');

const text = fs.readFileSync(file, 'utf8');
const doc = await ingestText(text);
const units = doc.units || doc.sentences || [];
const S = units.length;
const events = typeof doc.log.snapshot === 'function' ? doc.log.snapshot() : (doc.log.events || []);

// Labels + per-sentence figure participation, recomputed here so the script can show
// WHICH prior lines a cursor's entity horizon admits (the same rule readingAt uses).
const label = new Map();
for (const e of events) if (e.op === 'INS' && !label.has(e.id)) label.set(e.id, e.label);
const name = (id) => label.get(id) || id;
const figuresOf = (e) =>
  e.op === 'INS' ? [e.id]
  : (e.op === 'CON' || e.op === 'SIG') ? [e.src, e.tgt]
  : (e.op === 'DEF' && e.key === 'predicate') ? [e.id] : [];
const actorsAt = (c) => {
  const s = new Set();
  for (const e of events) if (e.sentIdx === c) for (const id of figuresOf(e)) s.add(id);
  return s;
};
const sentenceFigures = []; // c → Set of figure ids that fired in sentence c
for (let c = 0; c < S; c++) sentenceFigures[c] = new Set();
for (const e of events) if (e.sentIdx != null && sentenceFigures[e.sentIdx]) for (const id of figuresOf(e)) sentenceFigures[e.sentIdx].add(id);

const rows = [];
for (let c = 0; c < S; c++) {
  const recency = readingAt(doc, c, { gamma }).bayes;
  const entity  = readingAt(doc, c, { gamma, horizon: 'entity' }).bayes;
  rows.push({ c, recency, entity, promote: entity - recency });
}

const maxAbs = rows.reduce((m, r) => Math.max(m, Math.abs(r.promote)), 1e-9);
const clip = (s, n = 60) => { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const sbar = (x, w = 20) => {                       // signed bar: + grows right, − grows left
  const n = Math.round((Math.abs(x) / maxAbs) * w);
  return x >= 0 ? '·'.repeat(w) + '┃' + '+'.repeat(n).padEnd(w, ' ')
                : ' '.repeat(w - n) + '-'.repeat(n) + '┃' + '·'.repeat(w);
};

console.log(`# entity-horizon — ${path.basename(file)}  (${S} units)  γ=${gamma}\n`);
console.log(`  idx  recency  entity  promote  ${'(− against own arc)'.padStart(20)}  (+ betrays own arc)   line`);
for (const r of rows) {
  console.log(
    `  ${String(r.c).padStart(3)}  ${r.recency.toFixed(3)}   ${r.entity.toFixed(3)}  ${(r.promote >= 0 ? '+' : '') + r.promote.toFixed(3)}  ` +
    `${sbar(r.promote)}  ${clip(units[r.c])}`,
  );
}

const top = [...rows].sort((a, b) => b.promote - a.promote).slice(0, topN);
console.log(`\n## top ${topN} PROMOTIONS (entity ≫ recency — most surprising against the figure's OWN history)`);
for (const r of top) {
  console.log(`  s${String(r.c).padStart(3)}  promote +${r.promote.toFixed(3)}  (recency ${r.recency.toFixed(3)} → entity ${r.entity.toFixed(3)})  ${clip(units[r.c], 66)}`);
}

// Detailed breakdown at the rupture: the actors, and the prior lines each horizon reads
// the disowning against.
const target = units.findIndex(u => new RegExp(find, 'i').test(u));
if (target >= 0) {
  const r = rows[target];
  const act = actorsAt(target);
  console.log(`\n## the rupture — s${target}: "${clip(units[target], 80)}"`);
  console.log(`   acting figures: ${[...act].map(name).join(', ') || '—'}`);
  console.log(`   recency  bayes ${r.recency.toFixed(3)}   (read against the recent mixed window — the decline)`);
  console.log(`   entity   bayes ${r.entity.toFixed(3)}   (read against ONLY these figures' prior events)`);
  console.log(`   promotion ${r.promote >= 0 ? '+' : ''}${r.promote.toFixed(3)}  ${r.promote > 0 ? '← the selective horizon PROMOTES the rupture' : '(no promotion)'}`);
  const admitted = [], dropped = [];
  for (let c = 0; c < target; c++) {
    const fs_ = sentenceFigures[c];
    const hit = [...fs_].some(id => act.has(id));
    (hit ? admitted : dropped).push(c);
  }
  console.log(`   entity horizon ADMITS prior lines: ${admitted.map(c => 's' + c).join(' ')}`);
  for (const c of admitted) console.log(`       + s${c}  ${clip(units[c], 70)}`);
  console.log(`   entity horizon DROPS prior lines:  ${dropped.map(c => 's' + c).join(' ')}`);
}
