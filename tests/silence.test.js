import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  profile, compile, critique, critiqueBySeverity, channelsFor, makeVariable, makeMapSpec,
  ABSENCE_KINDS, isAbsenceVar,
} from '../src/thalamus/index.js';
import { toScoreSpec, playScore } from '../src/thalamus/cantor/index.js';

// A donations dataset where some rows are ABSENCES: a FOIA that should have returned a record and
// did not (amount is a NUL), each tagged with WHICH kind of nothing it is.
const withAbsences = () => ([
  { date: '2026-01-05', amount: 500,   absence_kind: '' },
  { date: '2026-02-05', amount: null,  absence_kind: 'destroyed' },      // existed, removed
  { date: '2026-03-05', amount: 250,   absence_kind: '' },
  { date: '2026-04-05', amount: null,  absence_kind: 'never_created' },  // an omission
  { date: '2026-05-05', amount: null,  absence_kind: 'withheld' },       // held out of reach
]);

// ── the type guard: absence is nominal, so it routes to a categorical rest, never a magnitude ──
test('an absence variable routes to the rest_character channel', () => {
  const vars = profile(withAbsences(), { amount: { importance: 0.9 }, absence_kind: { importance: 0.8 } });
  const kindVar = vars.find((v) => v.id === 'absence_kind');
  assert.ok(isAbsenceVar(kindVar), 'its categories are the kinds of nothing');
  const spec = compile(vars, channelsFor('auditory'));
  const b = spec.bindings.find((x) => x.variable === 'absence_kind');
  assert.equal(b.channel, 'rest_character', 'silence is absence\'s canonical home');
});

test('a plain nominal never becomes rests; rest_character is reserved for absence', () => {
  const rows = [{ recipient: 'CM-1' }, { recipient: 'CM-2' }, { recipient: 'CM-3' }];
  const spec = compile(profile(rows), channelsFor('auditory'));
  const b = spec.bindings.find((x) => x.variable === 'recipient');
  assert.notEqual(b?.channel, 'rest_character', 'a real category is a timbre, not a silence');
});

test('routing absence to a MAGNITUDE channel is forbidden (no "more absent")', () => {
  const kindVar = makeVariable({ id: 'absence_kind', measurement: 'nominal', cardinality: 3, categories: [...ABSENCE_KINDS] });
  // a hand-edit that put the kinds of nothing on loudness — an order the world does not contain
  const bad = makeMapSpec({ modality: 'auditory', bindings: [{ variable: 'absence_kind', channel: 'loudness', transfer: 'linear', polarity: 'more_loud' }] });
  const { errors } = critiqueBySeverity(critique(bad, { channels: channelsFor('auditory'), variables: [kindVar] }));
  assert.ok(errors.some((e) => e.rule === 'L1'), 'nominal-on-ordered fabricates a magnitude — blocked');
});

// ── the three timbres of nothing, in the score ────────────────────────────────
test('each kind of absence becomes a rest with its own character; present rows are notes', () => {
  const rows = withAbsences();
  const vars = profile(rows, { amount: { importance: 0.9 }, absence_kind: { importance: 0.8 } });
  const score = toScoreSpec(compile(vars, channelsFor('auditory')), rows, { duration: 10 });

  const byRef = Object.fromEntries(score.events.map((e) => [e.ref, e]));
  assert.equal(byRef['row:0'].kind, 'note', 'a real donation sounds');
  assert.equal(byRef['row:1'].kind, 'rest');
  assert.equal(byRef['row:1'].character, 'decay',  'destroyed → a fading ghost');
  assert.equal(byRef['row:3'].character, 'clean',  'never-created → a clean gap');
  assert.equal(byRef['row:4'].character, 'loaded', 'withheld → a loaded tension');
});

test('a bare NUL with no stated kind reads as a clean gap', () => {
  const rows = [{ date: '2026-01-01', amount: 5 }, { date: '2026-02-01', amount: null }];
  const vars = profile(rows, { amount: { importance: 0.9 } });
  const score = toScoreSpec(compile(vars, channelsFor('auditory')), rows, { duration: 4 });
  const missing = score.events.find((e) => e.ref === 'row:1');
  assert.equal(missing.kind, 'rest');
  assert.equal(missing.character, 'clean');
});

test('toScoreSpec with absences stays deterministic', () => {
  const rows = withAbsences();
  const map = compile(profile(rows, { amount: { importance: 0.9 }, absence_kind: { importance: 0.8 } }), channelsFor('auditory'));
  assert.deepEqual(toScoreSpec(map, rows), toScoreSpec(map, rows));
});

// ── playScore sounds the silences: clean is truly silent, loaded beats with two voices ─────────
test('playScore renders the three silences distinctly on an injected context', () => {
  const score = { duration: 3, events: [
    { kind: 'rest', ref: 'a', t: 0, dur: 0.3, character: 'clean',  freq: 220, gain: 0, pan: 0 },
    { kind: 'rest', ref: 'b', t: 1, dur: 0.3, character: 'decay',  freq: 220, gain: 0, pan: 0 },
    { kind: 'rest', ref: 'c', t: 2, dur: 0.3, character: 'loaded', freq: 220, gain: 0, pan: 0 },
  ] };
  let oscs = 0;
  const fakeParam = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const fakeCtx = {
    currentTime: 0, destination: {},
    createOscillator: () => { oscs++; return { type: 'sine', frequency: fakeParam(), detune: fakeParam(), connect() {}, start() {}, stop() {} }; },
    createGain:       () => ({ gain: fakeParam(), connect() {} }),
    createStereoPanner: () => ({ pan: fakeParam(), connect() {} }),
  };
  playScore(score, fakeCtx, { when: 0 });
  // clean → 0 voices, decay → 1, loaded → 2 (beating). Total 3.
  assert.equal(oscs, 3, 'clean schedules no voice; decay one; loaded two');
});
