// koine/channels — the perceptual channel catalogs each render backend advertises.
//
// A channel is typed by its perceptual character (schema.js → makeChannel): its ORDER (can it
// carry magnitude, category, or a cycle), its TIME character (does it hold a value or mark an
// event), its CAPACITY (JND-distinguishable levels), the perceptual TRANSFER to invert (L3),
// its POLARITY convention, its VALENCE (rhetorical load — quarantined above threshold, L8),
// which channels it is INTEGRAL with (can't be read independently, L6), and its EFFECTIVENESS
// for magnitude (Cleveland–McGill for the eye; Walker/earcon work for the ear, L4). compile()
// reads these tables; it hard-codes none of it — a new backend is a new table, nothing else.
//
// The auditory table is CANTOR's DECLARED capability (docs/koine.md §8 Q1). The descriptors
// exist so the compiler can target the ear today; the renderer that turns a ScoreSpec into
// Web Audio is deferred. Declaring a channel costs nothing and commits no sound.

import { makeChannel } from './schema.js';

// ── VISUAL — the standard Bertin visual variables, typed. This is perceptual science, not any
// one backend's API: LIMNER is a candidate that can drive position/size/lightness today, but a
// canvas/WebGL/DOM backend would advertise the SAME table. Effectiveness is the elementary-
// perceptual-task ranking (Cleveland–McGill): position > length > area > lightness > hue. ────
export const VISUAL_CHANNELS = Object.freeze([
  makeChannel({ id: 'position_x', modality: 'visual', order: 'ordered', capacity: 200, transfer: 'linear', polarity: 'more_right', valence: 0,    effectiveness: 1.00 }),
  makeChannel({ id: 'position_y', modality: 'visual', order: 'ordered', capacity: 200, transfer: 'linear', polarity: 'more_up',    valence: 0,    effectiveness: 0.98 }),
  makeChannel({ id: 'length',     modality: 'visual', order: 'ordered', capacity: 20,  transfer: 'linear', polarity: 'more_long',  valence: 0,    effectiveness: 0.80 }),
  makeChannel({ id: 'size',       modality: 'visual', order: 'ordered', capacity: 8,   transfer: 'sqrt',   polarity: 'more_big',   valence: 0,    effectiveness: 0.70 }),
  makeChannel({ id: 'lightness',  modality: 'visual', order: 'ordered', capacity: 6,   transfer: 'cieL',   polarity: 'more_dark',  valence: 0.15, effectiveness: 0.55, integral_with: ['hue'] }),
  makeChannel({ id: 'warm_cool',  modality: 'visual', order: 'ordered', capacity: 6,   transfer: 'linear', polarity: 'more_warm',  valence: 0.50, effectiveness: 0.45 }),
  makeChannel({ id: 'hue',        modality: 'visual', order: 'categorical', capacity: 8, transfer: 'linear', polarity: null,       valence: 0.30, effectiveness: 0.60, integral_with: ['lightness'] }),
  makeChannel({ id: 'shape',      modality: 'visual', order: 'categorical', capacity: 6, transfer: 'linear', polarity: null,       valence: 0,    effectiveness: 0.50 }),
  makeChannel({ id: 'chroma',     modality: 'visual', order: 'cyclic',   capacity: 8,   transfer: 'linear', polarity: null,        valence: 0.25, effectiveness: 0.45 }),
]);

// ── AUDITORY — CANTOR's declared channels. For magnitude: pitch > tempo ≈ loudness > timbre;
// events ride onset-timing. mode/dissonance carry heavy valence and are quarantined (L8). ───
export const AUDITORY_CHANNELS = Object.freeze([
  makeChannel({ id: 'onset',      modality: 'auditory', order: 'ordered', time_character: 'transient', capacity: 200, transfer: 'linear', polarity: 'more_soon', valence: 0,    effectiveness: 0.85 }),
  makeChannel({ id: 'pitch',      modality: 'auditory', order: 'ordered', time_character: 'sustained', capacity: 7,   transfer: 'mel',    polarity: 'more_high', valence: 0.10, effectiveness: 0.90, integral_with: ['loudness'] }),
  makeChannel({ id: 'tempo',      modality: 'auditory', order: 'ordered', time_character: 'transient', capacity: 5,   transfer: 'linear', polarity: 'more_fast', valence: 0.30, effectiveness: 0.65 }),
  makeChannel({ id: 'loudness',   modality: 'auditory', order: 'ordered', time_character: 'sustained', capacity: 5,   transfer: 'sone',   polarity: 'more_loud', valence: 0.40, effectiveness: 0.60, integral_with: ['pitch'] }),
  makeChannel({ id: 'pan',        modality: 'auditory', order: 'ordered', time_character: 'sustained', capacity: 5,   transfer: 'linear', polarity: 'more_right', valence: 0,    effectiveness: 0.50, attentional: 'background' }),
  makeChannel({ id: 'timbre',     modality: 'auditory', order: 'categorical', time_character: 'sustained', capacity: 6, transfer: 'linear', polarity: null,      valence: 0.30, effectiveness: 0.50 }),
  makeChannel({ id: 'mode',       modality: 'auditory', order: 'ordered', time_character: 'sustained', capacity: 2,   transfer: 'linear', polarity: 'more_major', valence: 0.90, effectiveness: 0.20 }),
  makeChannel({ id: 'dissonance', modality: 'auditory', order: 'ordered', time_character: 'sustained', capacity: 4,   transfer: 'linear', polarity: 'more_tense', valence: 0.95, effectiveness: 0.30 }),
]);

// channelsFor(modality) — the catalog a target draws from. 'cross' offers both, so a finding
// can be compiled to eye and ear from one call (the modality-independence proof, docs/koine.md).
export const channelsFor = (modality = 'visual') => {
  if (modality === 'auditory') return AUDITORY_CHANNELS;
  if (modality === 'cross')    return Object.freeze([...VISUAL_CHANNELS, ...AUDITORY_CHANNELS]);
  return VISUAL_CHANNELS;
};

// The quarantine threshold (L8b): a channel whose valence exceeds this may not carry magnitude
// unless the caller declares it with a justification. Warm/cool (0.50) reads as a soft warning;
// minor-mode (0.90) and dissonance (0.95) are blocked outright.
export const VALENCE_QUARANTINE = 0.70;
