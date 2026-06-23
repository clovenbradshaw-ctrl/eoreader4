// READ-ONLY measurement for exp/001-novelty-baserate. Touches no production code;
// the test suite stays byte-identical. Emits per-item channels over PRIOR context only
// (each item sees just the units before its cursor). It never reads key.json.
//
//   node campaign/exp/001-novelty-baserate/measure.mjs           print channels (JSON)
//   node campaign/exp/001-novelty-baserate/measure.mjs --trace   + event-level trace + instrument check
//
// Channels per item:
//   live_bayesBits    significance surprise at the cursor under the LIVE reader (constant reserve)
//   signal_bayesBits  significance surprise at the cursor under opts.signalNovelty (derived reserve)
//   noveltyAmp        the derived reserve amplitude itself (the instrument)
//   massAtCursor      total γ-decayed figure mass before the cursor (the cheap surface signal)
//   newcomerAtCursor  did a genuinely-new atom arrive AT the cursor (the thing being read)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseText } from '../../../src/perceiver/parse/index.js';
import { readingAt } from '../../../src/perceiver/index.js';
import { ingestMusic } from '../../../src/organs/in/music.js';
import { noveltyAmplitude } from '../../../src/core/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const stimulus = JSON.parse(readFileSync(join(here, 'stimulus.json'), 'utf8'));
const GAMMA = 0.7;   // the reader's default horizon (reading.js GAMMA)

const docOf = (it) =>
  it.modality === 'text'  ? parseText(it.lines.join(' '), { docId: it.item })
: it.modality === 'music' ? ingestMusic({ name: it.item, notes: it.notes })
: (() => { throw new Error(`no organ for modality ${it.modality}`); })();

// Read-only re-derivation of the front-end map (figures + propositions) so the measure
// can report the amplitude and mass independently of the reader it is measuring.
const fieldOf = (doc, at, g = GAMMA) => {
  const evs = doc.log.snapshot ? doc.log.snapshot() : (doc.log.events || []);
  let mass = 0;
  const first = new Map();
  const note = (a, s) => { const p = first.get(a); if (p === undefined || s < p) first.set(a, s); };
  for (const e of evs) {
    if (e.sentIdx == null || e.sentIdx > at) continue;
    if (e.sentIdx < at && e.op === 'INS') mass += Math.pow(g, at - 1 - e.sentIdx);
    if (e.op === 'INS') note(`f:${e.id}`, e.sentIdx);
    else if (e.op === 'CON' || e.op === 'SIG') {
      note(`f:${e.src}`, e.sentIdx); note(`f:${e.tgt}`, e.sentIdx);
      note(`p:${e.src}|${e.via || ''}|${e.tgt}`, e.sentIdx);
    } else if (e.op === 'DEF' && e.key === 'predicate') {
      note(`f:${e.id}`, e.sentIdx); note(`d:${e.id}|${e.value}`, e.sentIdx);
    }
  }
  const newcomerAtCursor = [...first.values()].some(s => s === at);
  return { mass: round(mass), amp: round(noveltyAmplitude(first.values(), at, g)), newcomerAtCursor };
};

export const runMeasure = () => stimulus.items.map((it) => {
  const doc = docOf(it);
  if (doc.modality !== it.modality) throw new Error(`instrument: organ mismatch on ${it.item}`);
  const { mass, amp, newcomerAtCursor } = fieldOf(doc, it.cursor);
  return {
    item: it.item,
    modality: it.modality,
    live_bayesBits:   readingAt(doc, it.cursor).bayesBits,
    signal_bayesBits: readingAt(doc, it.cursor, { signalNovelty: true }).bayesBits,
    noveltyAmp: amp,
    massAtCursor: mass,
    newcomerAtCursor,
  };
});

const round = (x) => Math.round(x * 1000) / 1000;

// --- instrument verification (run before any scoring) ---
const verifyInstrument = (rows) => {
  const problems = [];
  for (const r of rows) {
    if (!r.newcomerAtCursor) problems.push(`${r.item}: no newcomer at cursor — the channel reads nothing`);
    if (!Number.isFinite(r.live_bayesBits) || !Number.isFinite(r.signal_bayesBits))
      problems.push(`${r.item}: a channel did not compute (non-finite)`);
  }
  if (rows.every(r => r.signal_bayesBits === 0)) problems.push('signal channel all-zero — starved or dormant');
  if (rows.every(r => r.live_bayesBits === r.signal_bayesBits))
    problems.push('signal === live on every item — the gated path never engaged');
  return problems;
};

if (process.argv[1] && process.argv[1].endsWith('measure.mjs')) {
  const rows = runMeasure();
  const problems = verifyInstrument(rows);
  console.log(JSON.stringify({ id: stimulus.id, rows }, null, 2));
  if (process.argv.includes('--trace')) {
    console.error('\n--- instrument ---');
    console.error(problems.length ? problems.map(p => '  VOID: ' + p).join('\n') : '  organs live, channels computed, newcomer present on every item');
    // Trace one high-amp and one low-amp item at the event level (positive / negative).
    const hi = [...rows].sort((a, b) => b.noveltyAmp - a.noveltyAmp)[0];
    const lo = [...rows].sort((a, b) => a.noveltyAmp - b.noveltyAmp)[0];
    for (const r of [hi, lo]) {
      const it = stimulus.items.find(x => x.item === r.item);
      const doc = docOf(it);
      const evs = (doc.log.snapshot ? doc.log.snapshot() : doc.log.events).filter(e => e.sentIdx === it.cursor);
      console.error(`\n  ${r.item} (amp=${r.noveltyAmp}) deposit @cursor ${it.cursor}:`);
      for (const e of evs) console.error('   ', JSON.stringify({ op: e.op, id: e.id, src: e.src, tgt: e.tgt, via: e.via }));
      console.error(`    live=${r.live_bayesBits}  signal=${r.signal_bayesBits}`);
    }
  }
  if (problems.length && process.argv.includes('--strict')) process.exit(1);
}
