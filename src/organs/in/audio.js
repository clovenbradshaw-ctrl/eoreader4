// The audio-transcription adapter — a speech model's transcript, onto the spine.
//
// The image adapter ingests a vision model's *already-extracted* detections; this
// is its ear. A speech model (whisper, any — nothing bundled here) has already
// turned the waveform into UTTERANCES of timed WORDS. The DSP, the segmentation,
// the second-witness relisten and the acoustic term-unification all happen in the
// front-end sense organ (transcribe.html) — the cochlea. This adapter takes the
// bare product of that hearing and emits the SAME operators onto the SAME log:
//
//   • each word is an INS of its normalized surface — so "Darcy" said again is the
//     SAME referent, the way every "Gregor" tokenizes to one entity (organs/in/music.js);
//     sightings accumulate γ-mass exactly as repeated mentions do in text;
//   • a CON bonds each word to the next along the READING LINE OF TIME, labelled by
//     the silence between them — `then` when they run on, `pause` across a breath.
//     Adjacency in time is speech's reading order, never a semantic judgement;
//   • a SYN merge is emitted for every unification the ear already made — near
//     spellings the acoustic gate proved one word, coref links the referent
//     unifier proposed — so distinct surfaces collapse to one entity on the spine
//     (the same union-find `read/equivalence.js` runs, supplied here rather than discovered).
//
// What plain text cannot carry, this doc does: every unit keeps its [start,end] in
// seconds, so an EVA event can point at *when* a passage was said, and a caller can
// replay the exact span. Nothing here decides what was meant; the engine's own fold
// reads the transcript the way it reads a novel.

import { createLog }         from '../../core/index.js';
import { projectGraph }      from '../../core/index.js';
import { createConventions } from '../../core/conventions/index.js';
import { tok }               from '../../perceiver/parse/index.js';

const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

// A long enough silence to read as a breath group / paragraph break, in seconds.
const PARA_GAP = 0.9;

// Accept either the nested shape the front-end emits ({ utterances:[{words:[…]}] })
// or a flat word list ({ words:[…] }); normalize to utterances of timed words.
const asUtterances = (transcript) => {
  if (Array.isArray(transcript.utterances) && transcript.utterances.length) {
    return transcript.utterances.map(u => ({
      start: u.start ?? (u.words?.[0]?.start ?? 0),
      end:   u.end   ?? (u.words?.[u.words.length - 1]?.end ?? u.start ?? 0),
      words: (u.words || []).map(w => ({ ...w, norm: norm(w.text) })).filter(w => w.norm),
    })).filter(u => u.words.length);
  }
  // Flat words → split into utterances on a long pause.
  const words = (transcript.words || []).map(w => ({ ...w, norm: norm(w.text) })).filter(w => w.norm);
  const utts = [];
  let cur = null, lastEnd = null;
  for (const w of words) {
    if (!cur || (lastEnd != null && (w.start ?? lastEnd) - lastEnd >= PARA_GAP)) {
      cur = { start: w.start ?? 0, end: w.end ?? w.start ?? 0, words: [] };
      utts.push(cur);
    }
    cur.words.push(w);
    cur.end = w.end ?? w.start ?? cur.end;
    lastEnd = cur.end;
  }
  return utts;
};

export const ingestAudio = (transcript = {}) => {
  const {
    name = `audio-${Date.now()}`,
    duration = 0,
    device = null,
    // Unifications the ear already made: near-spelling / coref surface pairs the
    // acoustic gate or the referent unifier proved one word. Emitted as SYN merges.
    merges = [],   // [{ a, b, via?, P? }] — surfaces or normalized forms
  } = transcript;

  const utterances = asUtterances(transcript);

  const log = createLog({ docId: name });
  const units = [];             // one per utterance, the display line
  const sentences = [];         // utterance text, for embeddings / tok
  const timings = [];           // per-utterance [start, end] in seconds
  const tokens = [];            // flat, time-ordered, with id + [start,end]
  const mentions = new Map();

  let prev = null;              // previous word's entity id, to lay the reading line
  let prevEnd = null;

  utterances.forEach((u, unitIdx) => {
    const surfaces = [];
    for (const w of u.words) {
      const id = w.norm;                       // the recurring entity — repeats unify by mass
      log.append({ op: 'INS', id, label: w.text, sentIdx: unitIdx });
      mentions.set(id, [...(mentions.get(id) || []), unitIdx]);
      // A word the second witness re-heard is marked, so a reader can see which
      // surfaces the ear corrected — a groundable predicate, not a judgement.
      if (w.relisten) log.append({ op: 'DEF', id, key: 'relisten', value: 'true', sentIdx: unitIdx });

      // The reading line of time: bond to the previous word, labelled by the gap.
      if (prev && prev !== id) {
        const gap = (w.start ?? u.start) - (prevEnd ?? u.start);
        log.append({ op: 'CON', src: prev, tgt: id, via: gap >= PARA_GAP ? 'pause' : 'then', sentIdx: unitIdx });
      }
      prev = id;
      prevEnd = w.end ?? w.start ?? prevEnd;

      surfaces.push(w.text);
      tokens.push({ id, text: w.text, norm: w.norm, start: w.start ?? u.start, end: w.end ?? u.end, unitIdx, relisten: !!w.relisten });
    }
    units.push(`${surfaces.join(' ')} (${u.start.toFixed(1)}s)`);
    sentences.push(surfaces.join(' '));
    timings.push([u.start, u.end]);
  });

  // SYN merges — the unifications the ear handed us. Union-find collapses the
  // near-spellings and coref links the acoustic gate already proved one referent.
  for (const m of merges) {
    const a = norm(m.a), b = norm(m.b);
    if (a && b && a !== b) log.append({ op: 'SYN', kind: 'merge', from: a, to: b, via: m.via || 'heard-same', sentIdx: 0 });
  }

  const tokensBySentence = sentences.map(s => new Set(tok(s)));

  const doc = {
    docId: name, modality: 'audio',
    duration, device,
    units, sentences, timings, tokens, utterances, tokensBySentence,
    log, mentions,
    conventions: createConventions(),
    // The universal contract's metadata slot (organs/in: every doc carries one). A
    // clip's front matter is its container tags (title, speaker, date) plus the
    // pipeline that heard it — passed in by the caller; the waveform carries none.
    metadata: transcript.metadata || {},
    projectGraph: (frame = {}) => projectGraph(log, frame),
  };

  // Temporal grounding: the utterance sounding at time t, and the words in a window.
  // This is what an EVA event points at when it wants to replay a passage.
  doc.utteranceAt = (t) => {
    for (let i = 0; i < timings.length; i++) if (t >= timings[i][0] - 0.05 && t <= timings[i][1] + 0.05) return i;
    return -1;
  };
  doc.wordsInWindow = (a, b) => tokens.filter(w => w.end > a && w.start < b);

  // Cached per embedder organ — hash-space and MiniLM-space vectors are not
  // interchangeable, so a single unkeyed cache would return the wrong space to a
  // later caller (see organs/in/text.js).
  const vecByOrgan = new Map();
  doc.sentenceEmbeddings = async (embedder) => {
    const key = embedder?.id || 'default';
    if (!vecByOrgan.has(key)) vecByOrgan.set(key, Promise.all(sentences.map(s => embedder.embed(s))));
    return vecByOrgan.get(key);
  };

  return doc;
};
