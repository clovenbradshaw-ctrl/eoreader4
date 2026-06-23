// cycle-0001 — STIMULUS (blind). The novelty reserve: does the reader's reserved belief
// for an unseen unit track the recent RATE of newcomers, or is it blind to it?
//
// Two contexts, matched on total γ-mass (six deposits at the same decay positions), so the
// ONLY thing that differs is the novelty rate. An abstract comparable-ordered unit stream —
// no meaning, no labels — emitted as an INS-only log, so the SAME stimulus is read by the
// figure-field reader (text) AND the n-gram learner (the sense that reads melodies). The
// item identities and what each is FOR live only in the held key (key.json), never here.

import { createLog } from '../../src/core/log.js';

// An abstract unit stream → a doc the engine reads. Units carry no class, only identity+order.
export const unitStream = (ids) => {
  const log = createLog({ docId: 'cycle-0001' });
  ids.forEach((id, i) => log.append({ op: 'INS', id, label: id, sentIdx: i }));
  return { log, units: ids.map((_, i) => `u${i}`) };
};

// The blind items. Three probes, each a six-unit context + one probe unit at the cursor.
// (Which is churn, which is settled, which is the loud-surface control — held in key.json.)
export const ITEMS = [
  { id: 'A', context: ['a', 'b', 'c', 'd', 'e', 'f'], probe: 'z' },
  { id: 'B', context: ['a', 'a', 'a', 'a', 'a', 'a'], probe: 'z' },
  { id: 'C', context: ['a', 'a', 'a', 'a', 'a', 'a'], probe: 'a' },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const it of ITEMS) console.log(`item ${it.id}: ctx=[${it.context}] · probe=${it.probe}`);
}
