import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCorefField } from '../src/parse/coref.js';
import { areDisjoint } from '../src/read/relation-types.js';

// The standing-descriptor channel, at the FIELD layer. These exercise the
// mechanism the pipeline wiring will drive: a role epithet ("his sister")
// accumulates discourse-wide and binds to a later-introduced NAME by role, never
// by recency or adjacency. The conflict predicate is INJECTED — here the real
// bridge `areDisjoint`, the way the (holon-aware) wiring layer would pass it —
// so coref never imports the algebra. roleKeys ("sister"/"mother") happen to be
// surface nouns the bridge types, so areDisjoint is a drop-in rolesConflict.

const rolesConflict = (a, b) => areDisjoint(a, b);

// ---------------------------------------------------------------------------
// The §8 invariant: descriptor mass is warmth, never witness.

test('a descriptor binds at the conversational tier — it can never clear the grounded floor', () => {
  const f = createCorefField();
  // "his sister" fires across the discourse; Grete the NAME is never grounded here.
  for (const i of [71, 110, 150, 188]) f.noteDescriptor('sister', i, 'gregor-samsa');
  const bond = f.unifyDescriptor('sister', 'grete', 189, { compatible: true });
  assert.equal(bond.id, 'grete');
  assert.equal(bond.via, 'descriptor:sister');
  assert.ok(bond.w > 0);
  // The warmth lands in the conversational channel only.
  const cand = f.field(189).find(c => c.id === 'grete');
  assert.ok(cand.conversational > 0, 'descriptor deposits conversational warmth');
  assert.equal(cand.grounded, 0, 'no grounded mass was invented');
  // So the subtract-and-check refuses it as a floor-clearing reading.
  assert.equal(f.survivesSubtraction('grete', 189, 0), false);
  assert.deepEqual(f.fieldGrounded(189), [], 'grounded field is empty — warmth cannot move it');
});

// ---------------------------------------------------------------------------
// The live Grete / Mrs Samsa case: same gender, separated by ROLE alone.

test('role exclusivity separates two same-gender referents (no gender channel needed)', () => {
  const f = createCorefField({ rolesConflict });
  // Both standing descriptions accumulate over the discourse.
  for (const i of [71, 120, 180]) f.noteDescriptor('sister', i, 'gregor-samsa');
  for (const i of [90, 140, 185]) f.noteDescriptor('mother', i, 'grete');   // "Grete ... her mother"

  // Mrs Samsa is admitted and unifies with 'mother'.
  const m = f.unifyDescriptor('mother', 'mrs-samsa', 186, { compatible: true });
  assert.equal(m.id, 'mrs-samsa');

  // She is now the mother — role exclusivity refuses her the disjoint 'sister'.
  assert.equal(f.unifyDescriptor('sister', 'mrs-samsa', 187, { compatible: true }), null);

  // Grete, bearing no conflicting role, binds 'sister' cleanly.
  const s = f.unifyDescriptor('sister', 'grete', 189, { compatible: true });
  assert.equal(s.id, 'grete');

  // The warmth landed where it should and nowhere else.
  assert.ok(f.field(189).find(c => c.id === 'grete').conversational > 0);
  const mrs = f.field(189).find(c => c.id === 'mrs-samsa');
  assert.ok(!mrs || mrs.conversational === 0 || mrs.id !== 'grete');
});

test('without an injected predicate the field asserts no conflict (a leaf claims no knowledge)', () => {
  const f = createCorefField();                              // default rolesConflict → false
  for (const i of [10, 20]) f.noteDescriptor('mother', i);
  for (const i of [11, 21]) f.noteDescriptor('sister', i);
  assert.ok(f.unifyDescriptor('mother', 'x', 22, { compatible: true }));
  // No predicate ⇒ no role exclusivity; the field cannot know sister⊥mother.
  assert.ok(f.unifyDescriptor('sister', 'x', 23, { compatible: true }));
});

// ---------------------------------------------------------------------------
// The guards.

test('the binding guards: owner-distinctness, compatibility, staleness, one-bearer', () => {
  // can't be your own sister
  const a = createCorefField();
  a.noteDescriptor('sister', 50, 'gregor-samsa');
  assert.equal(a.unifyDescriptor('sister', 'gregor-samsa', 60, { compatible: true }), null);

  // an incompatible candidate (caller's gender/role gate) never binds
  const b = createCorefField();
  b.noteDescriptor('sister', 50);
  assert.equal(b.unifyDescriptor('sister', 'grete', 60, { compatible: false }), null);

  // a role gone silent past descMaxDist is too stale to bind
  const c = createCorefField({ descMaxDist: 10 });
  c.noteDescriptor('sister', 10);
  assert.equal(c.unifyDescriptor('sister', 'grete', 60, { compatible: true }), null);

  // one bearer per role: a second name is refused (the documented caveat)
  const d = createCorefField();
  d.noteDescriptor('sister', 50);
  assert.ok(d.unifyDescriptor('sister', 'grete', 60, { compatible: true }));
  assert.equal(d.unifyDescriptor('sister', 'anna', 61, { compatible: true }), null);
});

test('a named owner is sticky and beats a later pronoun-guessed owner', () => {
  const f = createCorefField();
  f.noteDescriptor('sister', 122, 'gregor-samsa', { named: true });  // "Gregor's sister" — a NAMED owner
  f.noteDescriptor('sister', 130, 'klaus-wrong');                    // a later pronoun guess must not overwrite
  // The owner-distinctness guard still keys on the sticky named owner.
  assert.equal(f.unifyDescriptor('sister', 'gregor-samsa', 140, { compatible: true }), null);
});
