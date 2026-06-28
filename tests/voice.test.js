import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  personalityDirection, projectPersonality, loadVoiceCartridge, cartridgeBias,
} from '../src/write/voice.js';

// Personality is the Horizon's DEPARTURE from σ projected to tokens. The load-bearing claim is
// mechanical: at ρ = σ (maximally mixed) every Born weight is 1/d, every coefficient (λ_i − 1/d)
// is zero, and the voice is characterless by construction.

const sigma = (d) => Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => (i === j ? 1 / d : 0)));
const departed = [[0.8, 0, 0], [0, 0.1, 0], [0, 0, 0.1]];   // a Horizon that has committed
const conceptMap = { firstTokenOf: (l) => (l === 'grete' ? 13 : null) };

test('personalityDirection ≡ 0 at ρ = σ — characterless by construction', () => {
  const dir = personalityDirection(sigma(3));
  for (const x of dir) assert.ok(Math.abs(x) < 1e-9, 'no standing tilt at the ground');
});

test('personalityDirection ≠ 0 once ρ has departed σ', () => {
  const dir = personalityDirection(departed);
  assert.ok(dir.some(x => Math.abs(x) > 1e-3), 'a committed Horizon carries a tilt');
});

test('projectPersonality — empty at ρ = σ, lands a figure once departed', () => {
  const acts = new Map([['grete', [1, 0, 0]]]);
  assert.equal(projectPersonality({ rho: sigma(3), figureActivations: acts, conceptMap }).size, 0);
  const map = projectPersonality({ rho: departed, figureActivations: acts, conceptMap });
  assert.ok(map.has(13) && map.get(13) !== 0, 'the salient-to-ρ figure is biased on its token');
});

test('projectPersonality — a figure with no token is skipped', () => {
  const acts = new Map([['nobody', [1, 0, 0]]]);
  assert.equal(projectPersonality({ rho: departed, figureActivations: acts, conceptMap }).size, 0);
});

test('the contrastive cartridge loads to a finite token-bias map', () => {
  const cart = loadVoiceCartridge({ meta: { kind: 'demo' }, tokens: { '7': 0.5, '9': -0.3, 'x': 1 } });
  assert.equal(cart.size, 2, 'non-integer ids dropped');
  const bias = cartridgeBias(cart, 2);
  assert.equal(bias.get(7), 1.0);
  assert.equal(bias.get(9), -0.6);
});
