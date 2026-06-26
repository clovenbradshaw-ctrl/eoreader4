import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createConjecturer } from '../src/surfer/index.js';

// Meaning is conjectured by a self, not extracted. These tests check the three things that
// earn the word "self": the conjecture is FALLIBLE (can be overturned by what follows),
// OWNED (mine, and unable to witness itself — only the world refutes it), and PERSPECTIVAL
// (two histories, two meanings for the same relation).

test('a meaning is posited on first sight (abduction), not read off a corpus', () => {
  const self = createConjecturer();
  const r = self.meet('gleamed', 'light');
  assert.equal(r.status, 'posited', 'the first sight is a guess');
  assert.equal(self.meaningOf('gleamed').predicts, 'light', 'meaning is the inferential role it licenses');
  assert.equal(self.meaningOf('gleamed').conjecturedNotExtracted, true);
});

test('FALLIBLE: a sustained refutation overturns the conjecture (what a table cannot do)', () => {
  const self = createConjecturer();
  self.meet('left', 'place');           // posit: left → place
  self.meet('left', 'place');           // corroborate (support 2)
  self.meet('left', 'place');           // corroborate (support 3)
  assert.equal(self.meaningOf('left').predicts, 'place');
  // now the world keeps doing something else — refutation accrues until it outweighs support
  let last;
  for (let i = 0; i < 4; i++) last = self.meet('left', 'object');   // "left an object" (gave/bequeathed)
  assert.equal(last.status, 'overturned', 'the conjecture is refuted and replaced');
  assert.equal(self.meaningOf('left').predicts, 'object', 'the self now means something else by it');
  assert.equal(self.meaningOf('left').revisions, 1, 'the overturn is recorded');
});

test('a single refutation only strains a well-corroborated conjecture; it does not overturn it', () => {
  const self = createConjecturer();
  for (let i = 0; i < 5; i++) self.meet('ran', 'motion');   // strongly held
  const r = self.meet('ran', 'manage');                     // "ran a shop" — one off-prediction
  assert.equal(r.status, 'strained', 'one refutation does not overturn a corroborated meaning');
  assert.equal(self.meaningOf('ran').predicts, 'motion', 'the held conjecture survives a single counter-case');
});

test('OWNED: the conjecture is mine and cannot witness itself — only the world can refute it', () => {
  const self = createConjecturer();
  const r = self.meet('seemed', 'quality');
  assert.equal(r.mine, true, 'the guess is mine (reafference, enactor door)');
  assert.equal(r.witnessedBy, true, 'the consequence is exafferent — the world, which CAN witness');
  const m = self.meaningOf('seemed');
  assert.equal(m.mine, true);
  assert.equal(m.canWitnessItself, false, 'my guess cannot confirm itself — the self/world line holds');
});

test('PERSPECTIVAL: two selves with different histories mean different things by the same word', () => {
  const a = createConjecturer();
  const b = createConjecturer();
  for (let i = 0; i < 3; i++) a.meet('charged', 'motion');   // a read battles: charged → rushed
  for (let i = 0; i < 3; i++) b.meet('charged', 'price');    // b read commerce: charged → a fee
  assert.notEqual(a.meaningOf('charged').predicts, b.meaningOf('charged').predicts,
    'the same relation means different things to selves with different reading histories');
  assert.equal(a.meaningOf('charged').predicts, 'motion');
  assert.equal(b.meaningOf('charged').predicts, 'price');
});

test('confidence is corroboration vs refutation, not raw frequency', () => {
  const self = createConjecturer();
  self.meet('held', 'possession');                 // support 1
  self.meet('held', 'possession');                 // support 2
  self.meet('held', 'belief');                     // strain 1
  const m = self.meaningOf('held');
  assert.ok(m.confidence > 0.5 && m.confidence < 1, 'a contested conjecture is held with less than full confidence');
  assert.equal(m.predicts, 'possession', 'still the surviving guess');
});
