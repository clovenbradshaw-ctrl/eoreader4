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

// ── THE PANTHEON (spec-the-pantheon.md) ──────────────────────────────────────────────────
// The λ-term factored along the cube's Act axis: one cartridge per face-value, summed at the
// cell the turn lands on. The corpus proved the three axes independent (max pairwise ARI 0.096),
// which is the precise condition that licenses SUMMING the faces rather than enumerating 27 cells.
// Each god is a CONTRASTIVE vector — expert (toward) minus anti-expert (against) — so both poles
// are named here for the offline bake (scripts/distill-voice.mjs). The λ cap is asymmetric by
// RISK: tightest on Apollo (SIG), which claims the most and colors the least; loosest on Thoth
// (DEF), whose lean toward bareness reinforces the void rather than fighting it.
//
// Order is the real progression: ground (NUL SIG), structural middle (INS SEG CON SYN), landing
// act (DEF EVA REC).
export const PANTHEON = Object.freeze({
  NUL: { god: 'Chaos',     group: 'Existence',    cap: 0.8,
         toward: 'marks absence plainly — "the record does not say", "no span supports this", "this is unestablished"; states the edge of the known and stops.',
         against: 'confident completion — "presumably", "it stands to reason", "likely"; the reflex to fill silence with inference.' },
  SIG: { god: 'Apollo',    group: 'Existence',    cap: 0.4,
         toward: 'interpretive and illuminating — "this reads as", "the effect is", "the register here is"; names the frame the material is seen through.',
         against: 'flat literalism — bare paraphrase, "the text says X" with no reading, refusal to interpret.' },
  INS: { god: 'Janus',     group: 'Existence',    cap: 0.7,
         toward: 'introduces and orients — present-tense, low-jargon, definite; names a thing on first use and defines it before building on it.',
         against: 'mid-stream assumption — undefined jargon, "as established", "recall that"; treating the reader as already inside.' },
  SEG: { god: 'Terminus',  group: 'Structure',    cap: 0.7,
         toward: 'sharp and contrastive — "whereas", "unlike", "distinct from"; parallel structure setting two things against each other.',
         against: 'conflation — "roughly the same", "more or less", hedged equivalence smoothing two things into one.' },
  CON: { god: 'Harmonia',  group: 'Structure',    cap: 0.7,
         toward: 'connective and threaded — "because", "which leads to", "and so", "in turn"; follows one line of consequence; narrative over list.',
         against: 'disjointed enumeration — bare "also", "additionally", "separately"; facts stacked without relation.' },
  SYN: { god: 'Hermes',    group: 'Structure',    cap: 0.7,
         toward: 'paraphrastic and plain — "in other words", "that is", "put simply"; trades the technical word for the everyday one.',
         against: 'jargon retention — "more precisely" followed by more terminology; restating in harder words than the original.' },
  DEF: { god: 'Thoth',     group: 'Significance', cap: 1.0,
         toward: 'terse and factual — exact figures, dates, definite articles; one fact per clause; no adjectives, no hedging, no flourish.',
         against: 'ornate qualification — adjectival padding, "it could be argued that", "in some sense"; narrative around a fact that should stand bare.' },
  EVA: { god: 'Themis',    group: 'Significance', cap: 0.7,
         toward: 'evaluative and conditional — "the span supports X but not Y", "this holds only insofar as"; ties confidence to evidence; grades rather than asserts.',
         against: 'flat over-commitment — "clearly", "obviously", "without question"; stating a graded thing as binary.' },
  REC: { god: 'Mnemosyne', group: 'Significance', cap: 0.7,
         toward: 'revisionary — "on closer reading", "this supersedes the earlier", "revising that"; names the correction explicitly.',
         against: 'silent overwrite — pretending the first reading never happened, "as I said" when you did not, flat re-assertion with no acknowledgment of change.' },
});

// loadPantheon(json) → Map<op, { god, cap, bias:Map<tokenId,delta> }>. The data file ships the
// BAKED vectors per face-value (empty until distilled); the god identity + cap come from PANTHEON.
export const loadPantheon = (json) => {
  const bank = new Map();
  const gods = json?.gods && typeof json.gods === 'object' ? json.gods : {};
  for (const [op, meta] of Object.entries(PANTHEON)) {
    const bias = new Map();
    const tokens = gods[op]?.tokens;
    if (tokens && typeof tokens === 'object') {
      for (const [id, d] of Object.entries(tokens)) {
        const t = Number(id);
        if (Number.isInteger(t) && Number.isFinite(d) && d) bias.set(t, d);
      }
    }
    bank.set(op, { god: meta.god, cap: meta.cap, bias });
  }
  return bank;
};

// defaultPantheonBank() → the bank with EMPTY baked vectors: god identities + caps, no steering.
// Auto-mount still names which gods WOULD mount (the Given-Log) and the λ term is a no-op until a
// baked data/pantheon.json is loaded — production stays at "μ-only relevance + void gate, λ off"
// (the lens-port spec's smallest honest first test) until the bake lands.
export const defaultPantheonBank = () => loadPantheon({ gods: {} });

// capNorm(map, budget) → scale a token-bias map so its L2 norm ≤ budget. THE BUDGET (Track B): a
// Born-weighted sum of several cartridges can clear the degeneracy cliff even when each alone is
// safe, so the summed personality vector is capped before it enters the stack — the hard ceiling
// over Born-weighting, without which a triple-stacked turn collapses into the ModelOracle of tone.
export const capNorm = (map, budget) => {
  if (!(budget > 0)) return map;
  let n2 = 0;
  for (const d of map.values()) n2 += d * d;
  const n = Math.sqrt(n2);
  if (n <= budget) return map;
  const s = budget / n;
  for (const [t, d] of map) map.set(t, d * s);
  return map;
};

// mountPersonality({ cell, weights, bank, tilt, budget }) → { bias, mounted }. Read the cell
// address (act/grain/stance) and the Born weight of each coordinate, look up each coordinate's
// cartridge, and form the Born-weighted, cap-bounded, budget-capped sum, plus the standing
// ρ-departure tilt. Returns the λ contribution and the mounted-set for the Given-Log. (Stance and
// the thin Site grain-diction layer join the same sum once their banks exist — Tracks C/D.)
export const mountPersonality = ({ cell = {}, weights = {}, bank = null, tilt = null, budget = 6 } = {}) => {
  const acc = new Map();
  const mounted = [];
  const add = (bias, scale) => { for (const [t, d] of bias) acc.set(t, (acc.get(t) || 0) + d * scale); };

  if (bank && cell.act && bank.has(cell.act)) {
    const g = bank.get(cell.act);
    const w = (Number.isFinite(weights.act) ? weights.act : 1) * g.cap;   // Born weight × risk cap
    add(g.bias, w);
    mounted.push({ axis: 'act', op: cell.act, god: g.god, weight: round(w), locked: !!cell.locked });
  }
  if (tilt && tilt.size) { add(tilt, Number.isFinite(weights.tilt) ? weights.tilt : 1); mounted.push({ axis: 'tilt', weight: round(weights.tilt ?? 1) }); }

  capNorm(acc, budget);
  return { bias: acc, mounted };
};

// orthogonality(a, b) → cosine of two token-bias maps in logit space. The register-INDEPENDENCE
// gate (separate from the corpus's classification-independence): the obvious risk is REC vs the
// Stance-defeat cartridge encoding the same "walk it back" move twice. Bake both, measure this; if
// it is not near-zero, collapse the overlapping pair into one rather than double-count it.
export const orthogonality = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (const [t, d] of a) { na += d * d; const e = b.get(t); if (e) dot += d * e; }
  for (const d of b.values()) nb += d * d;
  if (na <= 0 || nb <= 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

const round = (x) => Math.round(x * 1e4) / 1e4;
