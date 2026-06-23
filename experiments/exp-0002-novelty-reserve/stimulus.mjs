// p001 · BLIND STIMULUS — the novelty reserve (the brief's exemplar).
//
// Target cell: EVA/REC (Interpretation band) — the protention, the belief reserved
// for the as-yet-unseen. Modality: text + music (+ a modality-neutral isolator).
// Kind: discrimination. Level: significance. Horizon: across-a-window.
//
// Seed of record (structured-draw, way #3): "Stefanos Kanellos" (rev 1342672544),
// a Greek scholar/revolutionary of the Filiki Eteria. The seed supplies the cast of
// concrete labels; the STRUCTURE (matched-mass dense vs barren) is the constructed
// rigor. No labels in this file say which item is which — that lives in the held key.
//
// The contrast. Two prior contexts are built with the SAME number of arrivals (one
// INS per step → identical γ-decayed prior MASS at the probe), differing only in
// their recent NOVELTY RATE:
//   • dense   — a NEW atom arrives every step (newcomers keep coming).
//   • barren  — the SAME atom repeats every step (nothing new ever comes).
//   • mid     — a few newcomers up front, then repeats (an intermediate rate).
// At a probe step a genuine newcomer arrives in all of them. The question: does the
// reader's surprise at that newcomer depend on whether newcomers had been arriving?
//
// The loud-surface control. A pair where the cheap surface signal (prior MASS /
// step count) differs while the novelty rate is held ~0 (both barren, different
// length). The fixed reserve already separates these BY MASS — so a measurement
// that fires here is reading mass, not the mechanism. The matched-mass items are
// the real test: only a novelty-RATE reader separates them.

import { createLog } from '../../src/core/log.js';
import { ingestMusic } from '../../src/organs/in/music.js';
import { parseText } from '../../src/perceiver/parse/pipeline.js';

// The cast, drawn from the seed's domain (Greek-revolution era). Distinct labels
// are the dense newcomers; one label is the barren repeater; one is held back as
// the probe newcomer common to every item.
const CAST  = ['Stefanos', 'Kanellos', 'Filiki', 'Eteria', 'Hellas', 'Phanari'];
const REPEAT = 'Kanellos';
const PROBE  = 'Ypsilantis';   // the genuine newcomer that arrives at the probe step

// A modality-neutral doc from an explicit INS schedule: ids[k] is the atom that
// arrives at step k (one INS per step → one unit of deposit per step). The probe
// newcomer is appended last; the probe cursor is that last step.
const neutralDoc = (ids, probe) => {
  const log = createLog({ docId: 'p001' });
  ids.forEach((id, k) => log.append({ op: 'INS', id, label: id, sentIdx: k }));
  const at = ids.length;
  log.append({ op: 'INS', id: probe, label: probe, sentIdx: at });
  return { doc: { log, units: Array.from({ length: at + 1 }, (_, i) => `u${i}`) }, cursor: at };
};

const K = 6;
const distinct = CAST.slice(0, K);                 // 6 distinct → dense
const barren   = Array.from({ length: K }, () => REPEAT);
const mid      = [CAST[0], CAST[1], CAST[2], CAST[0], CAST[1], CAST[2]]; // 3 newcomers then repeats

// --- the modality-neutral mechanism isolator (exact matched mass) ------------
const neutral = () => ([
  { id: 'neutral-dense',  modality: 'neutral', group: 'matched', ...neutralDoc(distinct, PROBE) },
  { id: 'neutral-mid',    modality: 'neutral', group: 'matched', ...neutralDoc(mid,      PROBE) },
  { id: 'neutral-barren', modality: 'neutral', group: 'matched', ...neutralDoc(barren,   PROBE) },
  // loud-surface control: novelty rate held ~0 (both barren), MASS differs by length
  { id: 'neutral-barren-short', modality: 'neutral', group: 'control', ...neutralDoc(barren.slice(0, 2), PROBE) },
  { id: 'neutral-barren-long',  modality: 'neutral', group: 'control', ...neutralDoc(barren,             PROBE) },
]);

// --- SENSE A · MUSIC (real organ) --------------------------------------------
// Pitch class is the recurring entity; the surprisal channel's figure-mass is fed
// by INS only (one per note), so dense and barren are matched on mass. Dense = a new
// pitch class each note; barren = two pitch classes alternating (same total mass,
// far fewer first-appearances). The probe is a pitch class unheard in both.
const NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4'];
const musicDoc = (notes, probe) => {
  const doc = ingestMusic({ name: 'p001-music', notes: [...notes, probe] });
  return { doc, cursor: notes.length };
};
const music = () => ([
  { id: 'music-dense',  modality: 'music', group: 'omni', ...musicDoc(NOTES, 'B4') },
  { id: 'music-barren', modality: 'music', group: 'omni', ...musicDoc(['C4', 'G4', 'C4', 'G4', 'C4', 'G4'], 'B4') },
]);

// --- SENSE B · TEXT (real organ) ---------------------------------------------
// Simple intransitive sentences, one entity each. Dense = a new name per sentence;
// barren = the same name repeated. parseText's own mass accounting is reported by
// the measure (not assumed matched); the dissociation is read on the reserve the
// engine forms, which is what the claim is about.
const textDoc = (names, probe) => {
  const text = [...names, probe].map(n => `${n} arrived.`).join(' ');
  const doc = parseText(text, { docId: 'p001-text' });
  return { doc, cursor: names.length };
};
const text = () => ([
  { id: 'text-dense',  modality: 'text', group: 'omni', ...textDoc(['Andreas', 'Dimitrios', 'Georgios', 'Nikolaos', 'Petros', 'Spyridon'], 'Theodoros') },
  { id: 'text-barren', modality: 'text', group: 'omni', ...textDoc(['Dimitrios', 'Dimitrios', 'Dimitrios', 'Dimitrios', 'Dimitrios', 'Dimitrios'], 'Theodoros') },
]);

export const items = () => [...neutral(), ...music(), ...text()];

export const seedOfRecord = [{ title: 'Stefanos Kanellos', revision: '1342672544' }];
