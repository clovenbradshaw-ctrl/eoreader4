import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ingestAudio } from '../src/organs/in/audio.js';
import { readingAt } from '../src/perceiver/index.js';

// The audio adapter ingests a speech model's transcript — utterances of timed words —
// and emits the same operators onto the same spine text does. These pin what the
// front-end (transcribe.html) hands over: repeated words are one referent, the reading
// line is time, the ear's unifications become SYN merges, and every unit keeps its clock.

const TRANSCRIPT = {
  name: 'meeting.m4a', duration: 6, device: 'wasm',
  utterances: [
    { start: 0, end: 2, words: [
      { text: 'Darcy', start: 0.0, end: 0.4 },
      { text: 'opened', start: 0.5, end: 0.9 },
      { text: 'the', start: 1.0, end: 1.1 },
      { text: 'meeting', start: 1.2, end: 1.8 },
    ] },
    { start: 3, end: 6, words: [
      { text: 'Darcy', start: 3.0, end: 3.4, relisten: true },
      { text: 'the', start: 3.5, end: 3.6 },
      { text: 'the', start: 3.6, end: 3.7 },   // a stutter — one referent, not two
      { text: 'budget', start: 3.8, end: 4.4 },
    ] },
  ],
  merges: [{ a: 'darcy', b: 'darcey', via: 'coref' }],
};

test('audio adapter emits onto the same spine — utterances are units, words are referents', () => {
  const doc = ingestAudio(TRANSCRIPT);
  assert.equal(doc.modality, 'audio');
  assert.equal(doc.units.length, 2);
  // Distinct forms: darcy, opened, the, meeting, budget — repeats of "Darcy"/"the" fold.
  assert.equal(doc.projectGraph().entities.size, 5);
});

test('a repeated word is one referent, accumulating mass across utterances', () => {
  const doc = ingestAudio(TRANSCRIPT);
  assert.deepEqual(doc.mentions.get('darcy'), [0, 1]);   // sighted in both utterances
});

test('every unit keeps its clock — temporal grounding an EVA event can point at', () => {
  const doc = ingestAudio(TRANSCRIPT);
  assert.deepEqual(doc.timings[0], [0, 2]);
  assert.equal(doc.utteranceAt(3.5), 1);
  assert.deepEqual(doc.wordsInWindow(3, 4).map(w => w.text), ['Darcy', 'the', 'the', 'budget']);
});

test('the reading mode runs over a transcript with no change to the spine', () => {
  const doc = ingestAudio(TRANSCRIPT);
  const r = readingAt(doc, 1);
  assert.ok(typeof r.surprise === 'number');
});

test('a flat word list is cut into utterances on a long pause', () => {
  const doc = ingestAudio({ name: 'flat', words: [
    { text: 'one', start: 0, end: 0.3 },
    { text: 'two', start: 0.4, end: 0.7 },
    { text: 'three', start: 2.0, end: 2.3 },   // >0.9s gap → new utterance
  ] });
  assert.equal(doc.units.length, 2);
});
