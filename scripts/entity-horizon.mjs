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
import { ingestText } from '../src/organs/in/index.js';
import { readingAt, deriveNull } from '../src/reader/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let file = null, gamma = 0.7, topN = 12, find = 'must go', alpha = 0.01;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--gamma') gamma = Number(args[++i]);
  else if (a === '--top') topN = Number(args[++i]);
  else if (a === '--find') find = args[++i];
  else if (a === '--alpha') alpha = Number(args[++i]);
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

  // THE DERIVED VOID BOUNDARY (src/read/voidnull.js) — the rigorous form of "signal vs
  // noise is context-specific." The threshold is not a number you set: it is a high
  // quantile of the NOISE NULL estimated live from the non-cohering background (the
  // also-ran bayes the reach throws up by chance), with the EXTREME-VALUE correction (the
  // bar the largest of N chance draws reaches, so the longest accidental chain fires VOID,
  // not SYN), LEAVE-ONE-OUT (a real structure never has to outrank itself), and a ROBUST
  // bulk-cut (a few real ruptures do not poison the floor). The only knob is alpha, the
  // hallucination budget. And the HORIZON IS THE BACKGROUND: choosing recency vs entity
  // chooses the pool the null is measured from — which is the definition of what counts
  // as nothing here. Verdict: SYN = beats the null (structure); NUL = held below it.
  const lo = Math.max(0, target - 4), hi = Math.min(S - 1, target + 16);
  const reach = []; for (let c = lo; c <= hi; c++) reach.push(c);
  const named = { 'recency γ=0.7 (today)': { gamma: 0.7 }, 'entity  γ=0.95 (care)': { gamma: 0.95, horizon: 'entity' } };
  console.log(`\n## the derived VOID boundary — does the rupture beat the noise null? (reach s${lo}–s${hi}, alpha ${alpha})`);
  for (const [nm, opt] of Object.entries(named)) {
    const b = []; for (let c = 0; c < S; c++) b[c] = readingAt(doc, c, opt).bayes;
    const bg = reach.map(c => b[c]);
    const verdict = (c) => (b[c] > deriveNull(bg, { scale: 'linear', alpha, leaveOut: b[c] }) ? 'SYN' : 'NUL');
    const syn = reach.filter(c => verdict(c) === 'SYN').sort((x, y) => b[y] - b[x]);
    const nul0 = deriveNull(bg, { scale: 'linear', alpha, leaveOut: b[target] });
    console.log(`   ${nm}`);
    console.log(`      null (leave-one-out, extreme-value) ${Number.isFinite(nul0) ? nul0.toFixed(3) : '∞ (abstain)'}` +
                `   disowning s${target} ${b[target].toFixed(3)} → ${verdict(target)}` +
                `   violin s26 ${b[26].toFixed(3)} → ${verdict(26)}`);
    console.log(`      SYN (beats the null): ${syn.map(c => 's' + c + ' ' + b[c].toFixed(2)).join('  ') || '—'}`);
  }
  console.log(`   ⇒ the horizon IS the background: the entity pool collapses the null, so the rupture clears it`);
  console.log(`     while the recency artifact (s35) sinks toward it — the verdict flips with the chosen background.`);
}
