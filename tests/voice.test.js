import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  personalityDirection, projectPersonality, loadVoiceCartridge, cartridgeBias,
  PANTHEON, loadPantheon, mountPersonality, capNorm, orthogonality, defaultPantheonBank,
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

// ── THE PANTHEON (spec-the-pantheon.md) ──────────────────────────────────────────────────
test('the roster is the corrected nine, with caps asymmetric by risk', () => {
  assert.deepEqual(Object.keys(PANTHEON), ['NUL', 'SIG', 'INS', 'SEG', 'CON', 'SYN', 'DEF', 'EVA', 'REC']);
  assert.equal(PANTHEON.NUL.god, 'Chaos');
  assert.equal(PANTHEON.REC.god, 'Mnemosyne');
  assert.ok(PANTHEON.SIG.cap < PANTHEON.DEF.cap, 'Apollo (claims most) capped tighter than Thoth (colors least)');
});

const bakedBank = () => loadPantheon({ gods: {
  DEF: { tokens: { '5': 3, '6': 4 } },   // Thoth, cap 1.0
  SEG: { tokens: { '5': 3, '6': 4 } },   // Terminus, cap 0.7
} });

test('mountPersonality — auto-mounts the cell\'s Act cartridge, Born-weighted under the cap', () => {
  const bank = bakedBank();
  const full = mountPersonality({ cell: { act: 'DEF' }, weights: { act: 1 }, bank, budget: 100 });
  assert.equal(full.bias.get(5), 3);                          // cap 1.0 × weight 1
  assert.equal(full.mounted[0].god, 'Thoth');
  const capped = mountPersonality({ cell: { act: 'SEG' }, weights: { act: 1 }, bank, budget: 100 });
  assert.ok(capped.bias.get(5) < full.bias.get(5), 'the tighter cap colors less for the same vector');
});

test('mountPersonality — Born weight scales the contribution', () => {
  const bank = bakedBank();
  const hi = mountPersonality({ cell: { act: 'DEF' }, weights: { act: 1.0 }, bank, budget: 100 }).bias.get(5);
  const lo = mountPersonality({ cell: { act: 'DEF' }, weights: { act: 0.5 }, bank, budget: 100 }).bias.get(5);
  assert.ok(lo < hi, 'a subordinate coordinate only colors');
});

test('the budget caps the summed personality vector (the degeneracy cliff)', () => {
  const v = new Map([[1, 6], [2, 8]]);                        // L2 = 10
  capNorm(v, 5);
  assert.ok(Math.abs(Math.hypot(v.get(1), v.get(2)) - 5) < 1e-9, 'norm clamped to the ceiling');
});

test('NUL-on-VOID — Chaos mounts locked', () => {
  const bank = loadPantheon({ gods: { NUL: { tokens: { '3': 2 } } } });
  const m = mountPersonality({ cell: { act: 'NUL', locked: true }, weights: { act: 1 }, bank, budget: 100 });
  assert.equal(m.mounted[0].god, 'Chaos');
  assert.equal(m.mounted[0].locked, true, 'the governance lock is recorded on the mount');
});

test('register-orthogonality — the REC vs Stance-defeat independence gate', () => {
  assert.ok(Math.abs(orthogonality(new Map([[1, 1], [2, 1]]), new Map([[1, 1], [2, 1]])) - 1) < 1e-9);
  assert.equal(orthogonality(new Map([[1, 1]]), new Map([[2, 1]])), 0, 'disjoint cartridges are orthogonal');
});

test('defaultPantheonBank — empty vectors ⇒ λ is a no-op until baked', () => {
  const bank = defaultPantheonBank();
  assert.equal(bank.get('DEF').god, 'Thoth');
  assert.equal(bank.get('DEF').bias.size, 0);
  assert.equal(mountPersonality({ cell: { act: 'DEF' }, weights: { act: 1 }, bank }).bias.size, 0);
});
