// voice.js — PERSONALITY and the trained register (spec-the-lens-port.md, Track E).
//
// Personality is the λ-term of the steering equation, and it is literally the Horizon's
// DEPARTURE from σ. ρ cold-starts at σ (the corpus prior) and departs as the conversation
// accumulates a self; project that departure to tokens through the eigen-lenses:
//
//   personality(token) = Σ_i (λ_i − 1/d) · ⟨lens_i | token⟩
//
// λ_i are ρ's Born weights (its eigenvalues), 1/d the maximally-mixed baseline in d
// dimensions, and ⟨lens_i | token⟩ the lens realised in token space through the bridge. The
// claim made mechanical: when ρ = σ every λ_i = 1/d, every coefficient (λ_i − 1/d) = 0, the
// bias is identically zero, and the voice is characterless by construction. A Horizon that
// has read and committed carries a standing tilt; resetState / a re-ground returns ρ → σ and
// the voice forgets who it was. This reuses the very ρ and eigen-lenses the Significance
// column builds (core/spectral.js) — the column reads the spectrum, the port writes from it.

import { eigenLenses } from '../core/index.js';

// personalityDirection(rho) → the departure-weighted eigen-lens sum, a single direction in
// the significance basis: Σ_i (λ_i − 1/d) · lens_i. Zero vector when ρ is maximally mixed
// (ρ = σ at cold start), non-zero exactly to the degree ρ has left the ground.
export const personalityDirection = (rho) => {
  if (!Array.isArray(rho) || !rho.length) return [];
  const d = rho.length;
  const dir = new Array(d).fill(0);
  for (const { weight, lens } of eigenLenses(rho)) {
    const c = weight - 1 / d;
    if (Math.abs(c) < 1e-12 || !Array.isArray(lens)) continue;
    for (let k = 0; k < d && k < lens.length; k++) dir[k] += c * lens[k];
  }
  return dir;
};

const dot = (a, b) => {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
};

// projectPersonality({ rho, figureActivations, conceptMap, scale }) → Map<tokenId, delta>.
// Each figure carries an activation in the significance basis (its significance vector); its
// personality bias is that activation's alignment with the departure direction, landed on the
// figure's word-initial token through the bridge. The lossy figure→token projection is the
// known hard part (spec "The bridge"); first-token biasing is the standard trick and the trie
// the fallback for multi-token names. Empty when ρ = σ (direction is the zero vector).
export const projectPersonality = ({ rho, figureActivations, conceptMap, scale = 1 } = {}) => {
  const map = new Map();
  if (!conceptMap || !figureActivations) return map;
  const dir = personalityDirection(rho);
  if (!dir.length || dir.every(x => x === 0)) return map;   // characterless by construction
  const entries = figureActivations instanceof Map ? figureActivations.entries() : Object.entries(figureActivations);
  for (const [label, act] of entries) {
    if (!Array.isArray(act)) continue;
    const token = conceptMap.firstTokenOf(label);
    if (token == null) continue;
    const delta = dot(dir, act) * scale;
    if (delta) map.set(token, (map.get(token) || 0) + delta);
  }
  return map;
};

// ── the contrastive register cartridge (the trained term) ────────────────────────────────
// If the register should be LEARNED rather than hand-listed, it is contrastive: the per-token
// logit difference between an expert and an anti-expert (or a plain prompt against an ornate
// one) IS the steering vector — proxy-tuning at the logit level, no weight touched. Live dual-
// decode is two forward passes per step (too expensive on the CPU target), so the difference
// is frozen offline (scripts/distill-voice.mjs) into one small swappable auditable vector.
//
//   cartridge = { meta: {...}, tokens: { "<id>": delta, ... } }
export const loadVoiceCartridge = (json) => {
  const tokens = json?.tokens && typeof json.tokens === 'object' ? json.tokens : {};
  const map = new Map();
  for (const [id, delta] of Object.entries(tokens)) {
    const t = Number(id);
    if (Number.isInteger(t) && Number.isFinite(delta) && delta) map.set(t, delta);
  }
  return Object.freeze({ meta: json?.meta || null, bias: map, size: map.size });
};

// cartridgeBias(cartridge, scale) → Map<tokenId, delta> ready to stack as a finite contributor.
export const cartridgeBias = (cartridge, scale = 1) => {
  const map = new Map();
  if (!cartridge?.bias) return map;
  for (const [t, d] of cartridge.bias) map.set(t, d * scale);
  return map;
};
