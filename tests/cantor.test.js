import { test } from 'node:test';
import assert from 'node:assert/strict';

import { profile, compile, channelsFor } from '../src/thalamus/index.js';
import { toScoreSpec, freqOf, gainOf, playScore } from '../src/thalamus/cantor/index.js';

// the §7 donations data, compiled to the ear
const donations = () => {
  const recipients = ['CM-1', 'CM-2', 'CM-3'];
  return Array.from({ length: 12 }, (_, i) => ({
    date: `2026-${String((i % 12) + 1).padStart(2, '0')}-05`,
    donor: `donor-${i}`,
    recipient: recipients[i % 3],
    amount: [500, 50000, 250, 1200][i % 4],
    days_to_nearest_vote: [30, 1, 12, 0][i % 4],
  }));
};
const earSpec = () => {
  const rows = donations();
  const vars = profile(rows, { amount: { importance: 0.9 }, days_to_nearest_vote: { importance: 0.95 } });
  return { rows, map: compile(vars, channelsFor('auditory')) };
};

// ── the physics (L3 inverses) ─────────────────────────────────────────────────
test('freqOf places data linearly on the mel scale, monotonic in Hz', () => {
  assert.equal(freqOf(0, [220, 880]), 220);
  assert.equal(freqOf(1, [220, 880]), 880);
  const mid = freqOf(0.5, [220, 880]);
  assert.ok(mid > 220 && mid < 880);
  assert.ok(mid < (220 + 880) / 2, 'mel midpoint sits BELOW the arithmetic mean (perceptual, not linear-Hz)');
});

test('gainOf is monotonic and tops out at 1.0', () => {
  assert.equal(gainOf(1, [45, 90]), 1);
  assert.ok(gainOf(0, [45, 90]) < gainOf(0.5, [45, 90]));
  assert.ok(gainOf(0.5, [45, 90]) < 1);
});

// ── toScoreSpec: a deterministic, grounded score ──────────────────────────────
test('every donation becomes a click on the time axis, carrying a data ref', () => {
  const { rows, map } = earSpec();
  const score = toScoreSpec(map, rows, { duration: 8 });
  assert.equal(score.events.length, rows.length);
  assert.ok(score.events.every((e) => e.ref.startsWith('row:')), 'each event traces to its row');
  assert.ok(score.events.every((e) => e.t >= 0 && e.t <= 8), 'onsets lie on the time axis');
  assert.ok(score.channels.includes('onset'), 'date drove onset');
  assert.ok(score.provenance.mapspec_hash?.startsWith('fnv:'), 'the score carries the claim it lowered');
});

test('the pitch channel varies with its variable; a rush before a vote is a tight cluster', () => {
  const { rows, map } = earSpec();
  const score = toScoreSpec(map, rows, { duration: 8, pitchRange: [220, 880] });
  const freqs = new Set(score.events.map((e) => e.freq));
  assert.ok(freqs.size > 1, 'pitch is not constant — it carries the finding variable');
  assert.ok(score.events.every((e) => e.freq >= 220 && e.freq <= 880));
});

test('toScoreSpec is deterministic — same claim + data ⇒ same score', () => {
  const { rows, map } = earSpec();
  assert.deepEqual(toScoreSpec(map, rows), toScoreSpec(map, rows));
});

test('onsets honour the log normalization the binding carries (heavy tail compressed)', () => {
  // a log-wide domain (1→1000) drives onset; log-compression pushes the low values apart and
  // squeezes the high tail, so the gap 1→10 is WIDER in time than 100→1000.
  const rows = [{ v: 1 }, { v: 10 }, { v: 100 }, { v: 1000 }];
  const map = compile(profile(rows, { v: { role: 'domain', temporal: 'event' } }), channelsFor('auditory'));
  const onset = map.bindings.find((b) => b.channel === 'onset');
  assert.equal(onset.normalize, 'log', 'a 1→1000 span is log-normalized');
  const ts = toScoreSpec(map, rows, { duration: 10 }).events.map((e) => e.t).sort((a, b) => a - b);
  const gaps = ts.slice(1).map((t, i) => t - ts[i]);
  // log compression turns the geometric series into an EVENLY-spaced one — the heavy tail no
  // longer crushes 1/10/100 into the first instant (linear would give gaps ~0.01, 0.09, 9.0s).
  assert.ok(Math.max(...gaps) / Math.min(...gaps) < 1.5, 'onsets are near-evenly spread, not crushed');
  assert.ok(Math.min(...gaps) > 1, 'even the low-end values get real separation in time');
});

// ── playScore: schedules onto an injected (fake) AudioContext ──────────────────
test('playScore schedules one oscillator per event on the injected context', () => {
  const { rows, map } = earSpec();
  const score = toScoreSpec(map, rows, { duration: 4 });

  const started = [];
  const fakeParam = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} });
  const fakeCtx = {
    currentTime: 0,
    destination: { name: 'out' },
    createOscillator: () => ({ type: 'sine', frequency: fakeParam(), connect() {}, start(t) { started.push(t); }, stop() {} }),
    createGain:       () => ({ gain: fakeParam(), connect() {} }),
    createStereoPanner: () => ({ pan: fakeParam(), connect() {} }),
  };

  const handle = playScore(score, fakeCtx, { when: 0 });
  assert.equal(started.length, score.events.length, 'one voice per event');
  assert.ok(started.every((t) => t >= 0), 'all scheduled at or after now');
  assert.equal(typeof handle.stop, 'function');
  handle.stop();
});

test('playScore rejects a missing audio context', () => {
  assert.throws(() => playScore({ events: [] }, null), /AudioContext/);
});
