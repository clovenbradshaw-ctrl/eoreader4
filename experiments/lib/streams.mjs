// Shared builders for the campaign: turn an item into a live doc through the right
// organ, and read the reserve channel + the figure-newcomer series off it. Read-only:
// imports production code, mutates nothing, runs no production write path.

import { createLog } from '../../src/core/index.js';
import { ingestText, ingestMusic } from '../../src/organs/in/index.js';
import { readingAt } from '../../src/perceiver/index.js';

// The bare "membrane" organ: a stream of INS marks, one atom per step, nothing else.
// This is the purest input the interior can read — comparable + ordered and no more —
// so it isolates the mechanism with no organ-specific bond/predicate mass in the way.
export const synthDoc = (atomSeq, name = 'membrane') => {
  const log = createLog({ docId: name });
  atomSeq.forEach((a, i) => log.append({ op: 'INS', id: String(a), label: String(a), sentIdx: i }));
  return {
    docId: name, modality: 'membrane',
    units: atomSeq.map((a, i) => `${a}@${i}`),
    sentences: atomSeq.map(String),
    log,
    projectGraph: () => ({ entities: new Map(), edges: [] }),
  };
};

// Build a live doc from a stimulus item via the modality's real organ.
export const buildDoc = async (item) => {
  if (item.modality === 'text')   return await ingestText(item.input, {});
  if (item.modality === 'music')  return ingestMusic({ name: item.id, notes: item.input });
  if (item.modality === 'membrane') return synthDoc(item.input, item.id);
  throw new Error(`unknown modality ${item.modality}`);
};

const lengthOf = (doc) => (doc.units?.length ?? doc.sequence?.length ?? doc.sentences?.length ?? 0);

// The reserve channel at a cursor. mode 'constant' = the live NOVELTY_RESERVE path;
// mode 'context' = the signal-derived amplitude (a no-op until the fix is threaded on,
// so this same script measures the GAP before and the CAPABILITY after).
export const reserveAt = (doc, cursor, mode = 'constant') => {
  const r = readingAt(doc, cursor, { forward: true, reserve: mode });
  return r.pNext?.reserve ?? null;
};

// The figure-newcomer series: for each cursor c, isNewcomer(c) = the arrival at step c
// introduces a figure id whose FIRST INS is at c. Modality-blind (text entities, music
// pitch classes, membrane atoms are all figure ids). Used by the generalization metric:
// does the reserve at c predict that step c brings a newcomer?
export const figureNewcomerSeries = (doc) => {
  const events = typeof doc.log.snapshot === 'function' ? doc.log.snapshot() : (doc.log.events || []);
  const firstIns = new Map();
  for (const e of events) {
    if (e.op === 'INS' && e.sentIdx != null && !firstIns.has(e.id)) firstIns.set(e.id, e.sentIdx);
  }
  const S = lengthOf(doc);
  const firstSteps = new Set(firstIns.values());
  // a newcomer arrives at c iff some figure's first INS is exactly c
  const isNewcomer = Array.from({ length: S }, (_, c) => firstSteps.has(c));
  return { isNewcomer, S, distinct: firstIns.size };
};

export const streamLength = lengthOf;
