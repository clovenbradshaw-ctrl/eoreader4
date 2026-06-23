// E001 builder — emits the BLIND stimulus and the HELD key, kept in separate
// files. Run once to (re)generate. The stimulus carries opaque item ids and the
// raw unit sequences only; the key carries the interpretation (which context is
// early/late, which probe is a newcomer, the predicted dissociation, the controls,
// the mechanism tag) and never enters the measurement run.
//
// The two contexts are matched on surface BY CONSTRUCTION: every step contributes
// exactly one sighting, so total γ-mass is identical; both use three distinct
// figures with three first-sightings, so distinct count and raw newcomer count are
// identical. Only the RECENCY of the newcomers differs.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// Figure tokens per sense. The recurring entity must COALESCE on repeat:
//   stream — hand-built units, the id IS the token (full control of sightings).
//   music  — pitch class is the recurring entity (ingestMusic), so a repeated
//            pitch class is the same figure, exactly like a repeated name in text.
const SENSES = {
  stream: { a: 'e1', b: 'e2', c: 'e3', newcomer: 'e9', returning: 'e1' },
  music:  { a: 'C4', b: 'D4', c: 'E4', newcomer: 'F#4', returning: 'C4' },
};

// early-burst: newcomers a,b,c early, then a confirmation plateau on c.
// late-burst:  a plateau on a, then newcomers b,c arriving just before the probe.
const earlyCtx = (s) => [s.a, s.b, s.c, s.c, s.c, s.c, s.c, s.c];
const lateCtx  = (s) => [s.a, s.a, s.a, s.a, s.a, s.a, s.b, s.c];

const items = [];
const key = {};
let n = 0;
for (const [sense, s] of Object.entries(SENSES)) {
  for (const [context, ctx] of [['early', earlyCtx(s)], ['late', lateCtx(s)]]) {
    for (const [probe, tok] of [['newcomer', s.newcomer], ['returning', s.returning]]) {
      const id = `it-${String(++n).padStart(2, '0')}`;
      const sequence = [...ctx, tok];          // probe appended; read at its cursor
      const cursor = ctx.length;               // = 8, the probe's step
      items.push({ id, sense, sequence, cursor });
      key[id] = { sense, context, probe };
    }
  }
}

const stimulus = {
  experiment: 'E001-novelty-reserve',
  note: 'Blind. Opaque item ids and raw unit sequences only. Which item is which '
      + 'is held in key.json and applied only at scoring time. Do not infer.',
  items,
};

const held = {
  experiment: 'E001-novelty-reserve',
  seedOfRecord: { kind: 'code-site', file: 'src/core/surprise.js', symbol: 'NOVELTY_RESERVE',
                  copy: 'src/perceiver/reading.js:NOVELTY' },
  items: key,
  // Predicted per-channel dissociation, read on the bayes (significance) channel
  // and the surprisal (novelty) channel. Positive margin = early MORE surprised
  // than late on a newcomer.
  predictions: {
    fixed:  'on a NEWCOMER probe, bayesBits(early) ≈ bayesBits(late) — flat (the gap)',
    signal: 'on a NEWCOMER probe, bayesBits(early) > bayesBits(late) by a clear margin (the fix)',
    direction: 'a reader fresh off a burst of newcomers is LESS surprised by another newcomer',
  },
  controls: {
    surface: 'distinct-figure count, raw-newcomer count, and total γ-mass are matched '
           + 'across early/late; a surface method is flat — only γ-decayed recency dissociates',
    mechanistic: 'the signal-vs-fixed change on a RETURNING probe ≪ on a NEWCOMER probe',
  },
  omnimodal: 'the newcomer dissociation direction replicates in BOTH senses (stream, music) '
           + 'through one shared reader; no per-sense code',
  mechanism: 'reserve = Σ_newcomers γ^(at-1-firstSeen) — the γ-decayed novelty rate as an '
           + 'amplitude through the unchanged Born step (surpriseAt/forwardDist)',
};

writeFileSync(join(HERE, 'stimulus.json'), JSON.stringify(stimulus, null, 2) + '\n');
writeFileSync(join(HERE, 'key.json'), JSON.stringify(held, null, 2) + '\n');
console.log(`E001 built: ${items.length} items across ${Object.keys(SENSES).length} senses.`);
