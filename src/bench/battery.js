// The frozen battery — targets, gold notes, and angles for Metamorphosis
// (docs/surfing-success.md §2, §3). Authored once against the live pipeline's
// own extraction over data/metamorphosis.txt, then frozen. This is the one human
// judgment in the loop, and — with no talker to smooth over a thin battery — it is
// the ENTIRE definition of success, so the forbidden lists, the silence markers,
// and the zero-overlap paraphrases are here from the first draft.
//
// A gold note is not prose. It is the structured content a correct note must carry:
//
//   required   { entities:[id], relations:[{src,tgt,type|via,symmetric?}],
//                spans:[sentenceIdx], frameTurn:{layer?,near} }
//   forbidden  { entities:[id], relations:[{src,tgt,type}], tokens:[str] }
//   silence    { slot, tokens:[str] }    — the text leaves this empty; the note must too
//   angles     6–12 phrasings: direct/oblique, named/role-only, forward/reverse,
//              word-overlap/zero-overlap, plus a near-miss DECOY that should pivot
//              elsewhere (its gold is another target's note).
//
// A seed battery — four targets exercising every scoring channel (relation recall,
// entity+relation, significance frame-turn, silence). Extend toward the spec's
// 15–30 by adding entries of the same shape; nothing else changes.

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const CORPUS_PATH = path.resolve(here, '../../data/metamorphosis.txt');

// Species names the text never states — the silence slot. "Vermin" is the only word
// the book uses, and it names no species; a note that fills this slot fabricated it.
const SPECIES = Object.freeze(['beetle', 'cockroach', 'insect', 'roach', 'bug', 'dung', 'ant', 'spider', 'fly']);

export const TARGETS = Object.freeze({

  // ── T1 · the sibling relation ────────────────────────────────────────────
  // Grete is Gregor's sister. The relation is symmetric (the sibling primitive),
  // so either direction satisfies it. Hit from many angles, including one naming
  // neither party and a zero-overlap paraphrase that only meaning can pivot.
  sibling: {
    kind: 'relation',
    required: {
      entities: ['gregor-samsa', 'grete'],
      relations: [{ src: 'gregor-samsa', tgt: 'grete', type: 'sibling', symmetric: true }],
      spans: [16],
    },
    forbidden: {
      relations: [
        { src: 'gregor-samsa', tgt: 'grete', type: 'parent' },
        { src: 'gregor-samsa', tgt: 'grete', type: 'spouse' },
        { src: 'gregor-samsa', tgt: 'grete', type: 'child' },
      ],
      tokens: [],
    },
    angles: [
      'Who is Grete to Gregor?',
      'What is Gregor to Grete?',
      'Does Gregor have a sibling?',
      "Who is Gregor's sister?",
      'Name Gregor Samsa family members.',
      'What is the relationship between the two Samsa children?',
      'Which young woman shares the household and parents of the salesman?', // zero-overlap paraphrase
      { text: 'Who brought Gregor the bowl of milk?', decoy: 'caretaker' },  // near-miss → pivots to T2
    ],
  },

  // ── T2 · the caretaker relation ───────────────────────────────────────────
  // Grete tends Gregor — she alone enters the room and feeds him. A directed
  // Grete → Gregor edge in the feeding region.
  caretaker: {
    kind: 'relation',
    required: {
      entities: ['grete', 'gregor-samsa'],
      relations: [{ src: 'grete', tgt: 'gregor-samsa' }],   // any verb — the act, not the word
      spans: [17],
    },
    forbidden: { tokens: SPECIES.slice() },
    angles: [
      'Who takes care of Gregor?',
      'Who feeds Gregor?',
      'Who brings Gregor food?',
      "Who enters Gregor's room?",
      'Which family member looks after the transformed Gregor?',
      'Who opened the window for Gregor?',
    ],
  },

  // ── T3 · the significance turn: patience breaks at the disowning ──────────
  // The reading's frame restructures where the family gives up — a proposition
  // REC near the disowning. A significance target: the gold carries a frame turn.
  disowning: {
    kind: 'significance',
    required: {
      entities: ['grete', 'gregor-samsa'],
      relations: [{ src: 'grete', tgt: 'gregor-samsa' }],   // Grete turns on Gregor at the break
      spans: [33],
      frameTurn: { layer: 'proposition', near: 31 },
    },
    forbidden: { tokens: SPECIES.slice() },
    angles: [
      'Why does the family decide to get rid of Gregor?',
      'When does Grete give up on Gregor?',
      'What makes the family stop trying?',
      "What is the turning point in the family's attitude?",
      'Does anyone defend Gregor at the end?',
      'Why do they want the creature gone?',
    ],
  },

  // ── T4 · the silence: the species is never stated ─────────────────────────
  // The text says "vermin" and never a species. The note must mark the slot void
  // (carry no species) — asserting one is false certainty and fails the probe. The
  // angles deliberately put species words in the QUESTION; a sound note still
  // refuses to put them in the answer.
  species: {
    kind: 'silence',
    required: {
      entities: ['gregor-samsa'],
      spans: [0],
    },
    forbidden: { tokens: [] },
    silence: { slot: 'species', tokens: SPECIES.slice() },
    angles: [
      'What kind of insect is Gregor?',
      'What species did Gregor become?',
      'Is Gregor a cockroach or a beetle?',
      'What sort of creature did Gregor turn into?',
      'What animal is the vermin?',
      'Name the bug Gregor became.',
    ],
  },
});
