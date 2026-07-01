import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  profile, compile, critique, critiqueBySeverity,
  channelsFor, VISUAL_CHANNELS, AUDITORY_CHANNELS,
  makeVariable, makeMapSpec, mapSpecHash, validateMapSpec,
} from '../src/thalamus/index.js';

const chanById = (chans, id) => chans.find((c) => c.id === id);
const bindOf = (spec, variable) => spec.bindings.find((b) => b.variable === variable);

// ── profiling: infer variable types from values (SIG) ─────────────────────────
test('profile infers role / measurement / temporal / distribution from columns', () => {
  const rows = [
    { date: '2026-01-05', amount: 5,     donor: 'Acme',   days_to_vote: 40 },
    { date: '2026-02-11', amount: 50000, donor: 'Globex', days_to_vote: 1  },
    { date: '2026-03-02', amount: 250,   donor: 'Acme',   days_to_vote: 12 },
  ];
  const vars = Object.fromEntries(profile(rows).map((v) => [v.id, v]));
  assert.equal(vars.date.role, 'domain');
  assert.equal(vars.date.temporal, 'event');
  assert.equal(vars.amount.role, 'measure');
  assert.equal(vars.amount.measurement, 'ratio');
  assert.equal(vars.amount.distribution_hint, 'log', 'a value spanning 5→50000 is log-wide');
  assert.equal(vars.donor.measurement, 'nominal');
  assert.equal(vars.donor.cardinality, 2);
});

test('hints override inference (the finding supplies importance)', () => {
  const rows = [{ amount: 1 }, { amount: 2 }];
  const [v] = profile(rows, { amount: { importance: 0.95 } });
  assert.equal(v.importance, 0.95);
});

// ── compile: the deterministic CSP over the laws ──────────────────────────────
test('L1 — a nominal never lands on an ordered (magnitude) channel', () => {
  const vars = [makeVariable({ id: 'kind', measurement: 'nominal', cardinality: 3, categories: ['a', 'b', 'c'] })];
  const spec = compile(vars, VISUAL_CHANNELS);
  const b = bindOf(spec, 'kind');
  assert.ok(b, 'it maps');
  assert.equal(chanById(VISUAL_CHANNELS, b.channel).order, 'categorical', 'onto a categorical channel, not position/size');
});

test('L4/pass-1 — the time DOMAIN takes the most effective axis (position_x)', () => {
  const vars = profile([
    { date: '2026-01-01', amount: 3 },
    { date: '2026-06-01', amount: 9 },
  ], { amount: { importance: 0.9 } });
  const spec = compile(vars, VISUAL_CHANNELS);
  assert.equal(bindOf(spec, 'date').channel, 'position_x', 'the frame is defined by the domain first');
});

test('L3 — a magnitude on the size channel carries the sqrt (area) transfer', () => {
  // a backend whose marks are points advertises size but not bar-length; compile onto it
  const pointCatalog = VISUAL_CHANNELS.filter((c) => ['size', 'lightness'].includes(c.id));
  const vars = [makeVariable({ id: 'amount', measurement: 'ratio', range: [1, 1000], distribution_hint: 'skewed', importance: 0.8 })];
  const b = bindOf(compile(vars, pointCatalog), 'amount');
  assert.equal(b.channel, 'size');
  assert.equal(b.transfer, 'sqrt', 'area encoding is √-corrected');
  assert.match(b.reason, /log-compressed/, 'the skewed data is compressed before the channel');
});

test('L5 — a high-cardinality nominal exceeds every categorical channel → unmapped', () => {
  const donors = Array.from({ length: 40 }, (_, i) => ({ donor: `d${i}` }));
  const vars = profile(donors);
  const spec = compile(vars, VISUAL_CHANNELS);
  assert.ok(spec.unmapped.includes('donor'), 'identity becomes a label-on-demand, honestly unmapped');
  assert.equal(bindOf(spec, 'donor'), undefined);
});

test('L8 — a quarantined-valence channel is not chosen unless declared', () => {
  // only dissonance (valence .95) is offered for a magnitude; compile must refuse it
  const vars = [makeVariable({ id: 'evictions', measurement: 'ratio', range: [0, 100], importance: 1 })];
  const spec = compile(vars, [chanById(AUDITORY_CHANNELS, 'dissonance')]);
  assert.ok(spec.unmapped.includes('evictions'), 'no honest channel → unmapped, not a rhetorical lie');

  const declared = compile(vars, [chanById(AUDITORY_CHANNELS, 'dissonance')], {
    valence_declarations: [{ channel: 'dissonance', variable: 'evictions', justification: 'the story IS the tension' }],
  });
  assert.equal(bindOf(declared, 'evictions')?.channel, 'dissonance', 'a declaration unlocks it');
});

// ── critique: the linter over a hand-edited spec ──────────────────────────────
test('critique catches an order violation an edit introduced', () => {
  const vars = [makeVariable({ id: 'kind', measurement: 'nominal', cardinality: 3 })];
  // a reader re-patches kind onto position_x (nominal → ordered): L1 error
  const bad = makeMapSpec({ bindings: [{ variable: 'kind', channel: 'position_x', transfer: 'linear', polarity: 'more_right' }] });
  const vio = critique(bad, { channels: VISUAL_CHANNELS, variables: vars });
  const { errors } = critiqueBySeverity(vio);
  assert.ok(errors.some((e) => e.rule === 'L1'), 'nominal-on-ordered is flagged');
});

test('critique flags amount→loudness: capacity + valence (the doc\'s blocked case)', () => {
  const vars = [makeVariable({ id: 'amount', measurement: 'ratio', range: [1, 50000], distribution_hint: 'skewed' })];
  const bad = makeMapSpec({ modality: 'auditory', bindings: [{ variable: 'amount', channel: 'loudness', transfer: 'linear', polarity: 'more_loud' }] });
  const vio = critique(bad, { channels: AUDITORY_CHANNELS, variables: vars });
  assert.ok(vio.some((e) => e.rule === 'L5'), 'skewed mass hides in ~5 loudness levels');
  assert.ok(vio.some((e) => e.rule === 'L8'), 'loudness carries urgency valence');
  assert.ok(vio.some((e) => e.rule === 'L3'), 'a skewed variable on a linear transfer');
});

// ── §7 worked example: "Downtown Money", compiled to eye and ear from one profile ─────
test('worked example — donations timed to votes compile honestly (visual + auditory)', () => {
  // many DISTINCT donors → identity genuinely exceeds any categorical channel's capacity
  const recipients = ['CM-1', 'CM-2', 'CM-3'];
  const rows = Array.from({ length: 14 }, (_, i) => ({
    date: `2026-${String((i % 12) + 1).padStart(2, '0')}-05`,
    donor: `donor-${i}`,                          // 14 distinct — over every categorical cap
    recipient: recipients[i % 3],                 // 3 distinct — fits a categorical channel
    amount: [500, 50000, 250, 1200][i % 4],
    days_to_nearest_vote: [30, 1, 12, 0][i % 4],
  }));
  const finding = { amount: { importance: 0.9 }, days_to_nearest_vote: { importance: 0.95 } };
  const vars = profile(rows, finding);

  // visual target
  const eye = compile(vars, channelsFor('visual'));
  assert.equal(validateMapSpec(eye).length, 0, 'structurally valid');
  assert.equal(critiqueBySeverity(critique(eye, { channels: channelsFor('visual'), variables: vars })).errors.length, 0, 'no law broken');
  assert.equal(bindOf(eye, 'date').channel, 'position_x', 'time on the most effective axis');
  assert.ok(bindOf(eye, 'amount'), 'the skewed money magnitude is carried on an ordered channel');
  assert.ok(eye.unmapped.includes('donor'), 'high-card identity honestly unmapped');
  assert.ok(eye.provenance.mapspec_hash.startsWith('fnv:'), 'the claim is content-addressed');

  // auditory target — the SAME variables, a different catalog
  const ear = compile(vars, channelsFor('auditory'));
  assert.equal(critiqueBySeverity(critique(ear, { channels: channelsFor('auditory'), variables: vars })).errors.length, 0);
  assert.equal(bindOf(ear, 'date').channel, 'onset', 'events become clicks on the time axis');
  assert.notEqual(bindOf(ear, 'days_to_nearest_vote'), undefined, 'the finding variable is heard');

  // modality-independence: one finding, two honest renderings
  assert.equal(eye.modality, 'visual');
  assert.equal(ear.modality, 'auditory');
});

test('mapSpecHash is stable and provenance-independent', () => {
  const vars = [makeVariable({ id: 'a', role: 'domain', measurement: 'interval', range: [0, 1] })];
  const s1 = compile(vars, VISUAL_CHANNELS, { data_ref: 'ds1' });
  const s2 = compile(vars, VISUAL_CHANNELS, { data_ref: 'ds2' });
  assert.equal(mapSpecHash(s1), mapSpecHash(s2), 'same claim, different provenance → same hash');
});
