#!/usr/bin/env node
// READ-ONLY measurement for cycle 001. Touches no production code; emits per-item channels
// over prior context only, causally (item k's reserve reads steps < k). Writes out.json.
// Verifies the instrument before emitting: organ live, channel computed, one ±item traced.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseText } from '../../../src/perceiver/parse/index.js';
import { readingAt } from '../../../src/perceiver/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ALPHA = 0.05;
const { streams } = JSON.parse(readFileSync(join(HERE, 'stimulus.json'), 'utf8'));

// The proposition-basis deposit at a step — the atoms reading.js folds into priorProp.
const depositAt = (events, k) => {
  const s = new Set();
  for (const e of events) { if (e.sentIdx !== k) continue;
    if (e.op === 'INS') s.add(`f:${e.id}`);
    else if (e.op === 'CON' || e.op === 'SIG') { s.add(`f:${e.src}`); s.add(`f:${e.tgt}`); s.add(`p:${e.src}|${e.via||''}|${e.tgt}`); }
    else if (e.op === 'DEF' && e.key === 'predicate') { s.add(`f:${e.id}`); s.add(`d:${e.id}|${e.value}`); }
  }
  return s;
};

// ── Instrument verification ───────────────────────────────────────────────────────
const probe = parseText(streams.stream_t.join(' '), { docId: 'verify' });
const pe = probe.log.snapshot ? probe.log.snapshot() : probe.log.events;
const insWithIdx = pe.filter(e => e.op === 'INS' && e.sentIdx != null);
if (!insWithIdx.length) throw new Error('INSTRUMENT DEAD: text organ emitted no INS with sentIdx');
const pn = readingAt(probe, 5, { forward: true, calibrateReserve: true, alpha: ALPHA }).pNext;
if (!pn || typeof pn.reserve !== 'number') throw new Error('INSTRUMENT DEAD: pNext.reserve not computed');
console.log('# instrument: text organ live (INS+sentIdx), pNext.reserve computed.');
// Trace one + (novel) and one − (recurrence) item at the event level.
{
  const ev = probe.log.snapshot ? probe.log.snapshot() : probe.log.events;
  const dep2 = depositAt(ev, 2), dep1 = depositAt(ev, 1);
  console.log(`# trace +item k=2 deposit: [${[...dep2].join(', ')}]  (Gabin is basis-new → novel step)`);
  console.log(`# trace -item k=1 deposit: [${[...dep1].join(', ')}]  (all atoms already in basis → recurrence)`);
}

// ── Measurement ───────────────────────────────────────────────────────────────────
const out = {};
for (const [id, units] of Object.entries(streams)) {
  const doc = parseText(units.join(' '), { docId: id });
  const events = doc.log.snapshot ? doc.log.snapshot() : doc.log.events;
  const basis = new Set();
  let cumNovel = 0;
  const rows = [];
  for (let k = 0; k < units.length; k++) {
    const dep = depositAt(events, k);
    let novel = 0; for (const a of dep) if (!basis.has(a)) { novel = 1; basis.add(a); }
    cumNovel += novel;
    const fixed = readingAt(doc, k, { forward: true }).pNext.reserve;
    const born  = readingAt(doc, k, { forward: true, calibrateReserve: true, alpha: ALPHA }).pNext.reserve;
    rows.push({ k, novel, fixed: round(fixed), born: round(born), cumRate: round(cumNovel / (k + 1)) });
  }
  out[id] = rows;
}
function round(x) { return Math.round(x * 1000) / 1000; }
writeFileSync(join(HERE, 'out.json'), JSON.stringify({ alpha: ALPHA, streams: out }, null, 2));
console.log(`# wrote out.json (${Object.keys(out).length} streams).`);
for (const [id, rows] of Object.entries(out)) {
  const last = rows[rows.length - 1], mid = rows[5];
  console.log(`  ${id}: final fixed=${last.fixed} born=${last.born} cumRate=${last.cumRate} | unit5 born=${mid.born}`);
}
