// E001 measure — READ-ONLY. Emits every relevant channel per item over prior
// context only, causally. Touches no production code; the suite stays byte-
// identical. Runs each item through ONE shared reader (readingAt → surpriseAt →
// noveltyReserve) in two configurations: fixed reserve (the live default) and the
// signal-derived reserve (opts.signalReserve). The instrument is verified before
// any score is read: the organ must be live and the bayes channel must compute.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLog } from '../../../src/core/index.js';
import { ingestMusic } from '../../../src/organs/in/index.js';
import { readingAt } from '../../../src/perceiver/reading.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAMMA = 0.7;
const stimulus = JSON.parse(readFileSync(join(HERE, 'stimulus.json'), 'utf8'));

// The bare-membrane front-end: a hand-built INS log, the id IS the unit token, so
// sightings are under full control. This is the interior reading raw units.
const streamDoc = (sequence) => {
  const log = createLog({ docId: 'stream' });
  sequence.forEach((tok, i) => log.append({ op: 'INS', id: tok, label: tok, sentIdx: i }));
  return { docId: 'stream', modality: 'stream', units: sequence.slice(), sentences: sequence.slice(), log };
};

const docFor = (sense, sequence) =>
  sense === 'music' ? ingestMusic({ name: 'm', notes: sequence }) : streamDoc(sequence);

// Surface stats over the FIGURE field before the cursor — the loud signals the
// control matches: distinct figures, raw (undecayed) newcomer count, total γ-mass.
const surface = (doc, cursor) => {
  const events = doc.log.snapshot();
  const first = new Map(); let totalMass = 0; const seen = new Set();
  for (const e of events) {
    if (e.op !== 'INS' || e.sentIdx == null || e.sentIdx >= cursor) continue;
    if (!first.has(e.id)) first.set(e.id, e.sentIdx);
    seen.add(e.id);
    totalMass += Math.pow(GAMMA, cursor - 1 - e.sentIdx);
  }
  return { distinct: seen.size, rawNew: first.size, totalMass: round4(totalMass) };
};

const channels = (doc, cursor) => {
  const fix = readingAt(doc, cursor, {});
  const sig = readingAt(doc, cursor, { signalReserve: true });
  return {
    fixed:  { bayesBits: fix.bayesBits, surprisalBits: fix.surprisalBits, bayes: fix.bayes, surprise: fix.surprise },
    signal: { bayesBits: sig.bayesBits, surprisalBits: sig.surprisalBits, bayes: sig.bayes, surprise: sig.surprise },
  };
};

const out = { experiment: 'E001-novelty-reserve', gamma: GAMMA, items: [], instrument: {} };
for (const it of stimulus.items) {
  const doc = docFor(it.sense, it.sequence);
  out.items.push({ id: it.id, sense: it.sense, cursor: it.cursor,
                   surface: surface(doc, it.cursor), ...channels(doc, it.cursor) });
}

// --- Verify the instrument BEFORE the score is read (discipline step 5). -------
// The organ must be live (events on the log) and the bayes channel must compute
// (defined, not all-zero across items). Trace one item at the event level.
const senses = [...new Set(stimulus.items.map(i => i.sense))];
for (const sense of senses) {
  const probe = stimulus.items.find(i => i.sense === sense);
  const doc = docFor(sense, probe.sequence);
  const events = doc.log.snapshot();
  out.instrument[sense] = {
    organLive: events.length > 0,
    insEvents: events.filter(e => e.op === 'INS').length,
    sampleTrace: events.slice(0, 3).map(e => `${e.op} ${e.id ?? ''}@${e.sentIdx}`),
  };
}
const anyBayes = out.items.some(i => i.signal.bayesBits > 0 || i.fixed.bayesBits > 0);
out.instrument.bayesChannelComputed = anyBayes;

writeFileSync(join(HERE, 'measure-out.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`E001 measured: ${out.items.length} items. organs live: `
  + senses.map(s => `${s}=${out.instrument[s].organLive}`).join(' ')
  + ` bayesComputed=${anyBayes}`);

function round4(x) { return Math.round(x * 10000) / 10000; }
