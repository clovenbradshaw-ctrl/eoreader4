#!/usr/bin/env node
// READ-ONLY measurement for cycle 002. Parses each item and emits, per probe word: did a bond
// (CON/SIG) form to it, and did it enter the proposition field as a figure atom. Touches no
// production code; writes out.json. Verifies the instrument before emitting.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseText } from '../../../src/perceiver/parse/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const { items } = JSON.parse(readFileSync(join(HERE, 'stimulus.json'), 'utf8'));

const fieldAtoms = (events) => {
  const atoms = new Set();
  for (const e of events) {
    if (e.op === 'INS') atoms.add(`f:${e.id}`);
    else if (e.op === 'CON' || e.op === 'SIG') { atoms.add(`f:${e.src}`); atoms.add(`f:${e.tgt}`); atoms.add(`p:${e.src}|${e.via||''}|${e.tgt}`); }
  }
  return atoms;
};

// ── Instrument verification ──────────────────────────────────────────────────
{
  const d = parseText('Duane carried Morgan.', { docId: 'verify' });
  const ev = d.log.snapshot ? d.log.snapshot() : d.log.events;
  const bonds = ev.filter(e => e.op === 'CON' || e.op === 'SIG');
  if (!bonds.length) throw new Error('INSTRUMENT DEAD: a clear patient (Morgan) formed no bond');
  console.log(`# instrument: parse organ live — "Duane carried Morgan." → ${bonds.map(b=>`${b.src}-${b.via}-${b.tgt}`).join(', ')}`);
}

const out = {};
for (const [id, { text, probe }] of Object.entries(items)) {
  const doc = parseText(text, { docId: id });
  const events = doc.log.snapshot ? doc.log.snapshot() : doc.log.events;
  const p = probe.toLowerCase();
  const bonds = events.filter(e => e.op === 'CON' || e.op === 'SIG');
  const bondedToProbe = bonds.some(b => String(b.tgt).toLowerCase().includes(p) || String(b.src).toLowerCase().includes(p));
  const atoms = fieldAtoms(events);
  const inField = [...atoms].some(a => a.toLowerCase().includes(p));
  out[id] = { probe, bonded: bondedToProbe, inField, bonds: bonds.map(b => `${b.src}-${b.via}-${b.tgt}`) };
  console.log(`  ${id}: "${text}"  probe='${probe}'  bonded=${bondedToProbe}  inField=${inField}`);
}
writeFileSync(join(HERE, 'out.json'), JSON.stringify(out, null, 2));
console.log('# wrote out.json');
