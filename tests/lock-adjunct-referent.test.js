import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/perceiver/parse/index.js';
import { createConventions } from '../src/core/conventions/index.js';

// REGRESSION LOCK — confirmed capability (experiments/cycles/002-adjunct-referent): a CON/SIG
// bond binds two REFERENTS; a directional/temporal adjunct in the verb's object slot does not
// bond and does not seed the proposition field. Written to FAIL if the parser regresses to
// lifting adjuncts — and the control (patients must still bond) is here, so a fix that abstains
// by simply dropping the object slot fails too.

const bondsAndField = (text) => {
  const doc = parseText(text, { docId: 'lk' });
  const ev = doc.log.snapshot ? doc.log.snapshot() : doc.log.events;
  const bonds = ev.filter(e => e.op === 'CON' || e.op === 'SIG').map(e => `${e.src}-${e.via}-${e.tgt}`);
  const field = new Set();
  for (const e of ev) {
    if (e.op === 'INS') field.add(`f:${e.id}`);
    else if (e.op === 'CON' || e.op === 'SIG') { field.add(`f:${e.src}`); field.add(`f:${e.tgt}`); }
  }
  return { bonds, field: [...field] };
};
const hits = (xs, w) => xs.some(x => x.toLowerCase().includes(w));

test('adjuncts in the object slot do NOT bond and do NOT enter the field', () => {
  for (const [text, adj] of [['Duane sailed north.', 'north'], ['Duane sailed home.', 'home'],
    ['Duane sailed at dawn.', 'dawn'], ['Pike marched south.', 'south'], ['Duane drifted west.', 'west']]) {
    const { bonds, field } = bondsAndField(text);
    assert.ok(!hits(bonds, adj), `'${adj}' must not be a bond endpoint in "${text}" — got ${JSON.stringify(bonds)}`);
    assert.ok(!hits(field, adj), `'${adj}' must not enter the proposition field in "${text}"`);
  }
});

test('CONTROL: a real patient in the SAME surface slot still bonds (no recall loss)', () => {
  for (const text of ['Duane carried Morgan.', 'Duane guarded Morgan.', 'Pike chased Morgan.']) {
    const { bonds } = bondsAndField(text);
    assert.ok(hits(bonds, 'morgan'), `the patient Morgan must still bond in "${text}" — got ${JSON.stringify(bonds)}`);
  }
  // and a capitalized place is still a figure (the figure path owns names; unaffected).
  assert.ok(hits(bondsAndField('Duane sailed to Boston.').field, 'boston'), 'Boston stays a referent');
});

test('the adjunct class is a seed, defeasible and learnable like every register', () => {
  const c = createConventions();
  assert.equal(c.isAdjunct('north'), true, 'seeded');
  assert.equal(c.isAdjunct('Morgan'.toLowerCase()), false, 'a name is not an adjunct');
  // learnable: a document can teach its own adjunct.
  assert.equal(c.isAdjunct('starboard'), false);
  c.learnAdjunct('starboard');
  assert.equal(c.isAdjunct('starboard'), true, 'a learned adjunct occupies the same slot');
  // defeasible: a seed can lose.
  c.defeat('adjunct', 'north');
  assert.equal(c.isAdjunct('north'), false, 'a defeated seed answers false');
  // priors OFF → the seed is gone (not load-bearing structure).
  assert.equal(createConventions({ seeds: false }).isAdjunct('north'), false);
});
