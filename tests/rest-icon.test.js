import { test } from 'node:test';
import assert from 'node:assert/strict';

import { restIconSvg, restStateLabel, REST_STATES } from '../src/ui/rest-icon.js';

// The rest glyph is pure presentation over the cycle's postures (docs/how-to-rest.md):
// a state name in, an SVG string out. No DOM — so it is tested as a string.

test('restIconSvg returns a well-formed SVG for every posture', () => {
  for (const s of REST_STATES) {
    const svg = restIconSvg(s);
    assert.match(svg, /^<svg /, `${s} → an <svg>`);
    assert.match(svg, /<\/svg>$/);
    assert.match(svg, /viewBox="0 0 24 24"/);
    assert.match(svg, /stroke="currentColor"/, 'the host palette drives the color');
    assert.match(svg, /aria-hidden="true"/, 'decorative by default');
  }
});

test('awake and surfing share the eye; resting and night share the moon', () => {
  // surfing folds onto the awake glyph (eyes open, looking out)…
  assert.equal(
    restIconSvg('surfing').replace('--awake', '--awake'),
    restIconSvg('awake'),
    'surfing draws the awake eye',
  );
  // …and night folds onto the resting glyph (asleep, integrating).
  assert.equal(restIconSvg('night'), restIconSvg('resting'), 'night draws the resting moon');
  // an unknown posture falls back to awake, never throwing
  assert.equal(restIconSvg('nonsense'), restIconSvg('awake'));
});

test('the eye, the blink, the moon and the settled moon are distinct glyphs', () => {
  const awake = restIconSvg('awake');
  const blink = restIconSvg('blink');
  const resting = restIconSvg('resting');
  const rested = restIconSvg('rested');
  const set = new Set([awake, blink, resting, rested]);
  assert.equal(set.size, 4, 'four distinct postures, four distinct glyphs');
  assert.match(awake, /circle/, 'the awake eye has an iris');
  assert.match(rested, /rest-icon--rested/, 'the settled moon carries its own class');
});

test('a title makes the glyph an accessible image', () => {
  const svg = restIconSvg('resting', { title: 'resting' });
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="resting"/);
  assert.match(svg, /<title>resting<\/title>/);
});

test('restStateLabel speaks each posture', () => {
  assert.equal(restStateLabel('blink'), 'blinking');
  assert.equal(restStateLabel('night'), 'resting');
  assert.equal(restStateLabel('rested'), 'rested');
  assert.equal(restStateLabel('surfing'), 'surfing');
});
