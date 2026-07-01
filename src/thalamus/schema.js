// thalamus/schema — the two type systems and the compiled claim, as frozen records.
//
// THALAMUS compiles an assignment from a dataset's VARIABLES (typed by their data shape)
// to perception's CHANNELS (typed by their perceptual character). The compiled result
// is a MapSpec — a modality-INDEPENDENT claim: "amount → size (√), date → position_x…".
// Like LIMNER's ViewSpec it is inspectable, content-addressable, and emitted as data,
// so the mapping is itself a claim a reader can read and contest (docs/parameter-mapping.md,
// docs/thalamus.md). This module owns the shapes, their constructors, validation, and the hash.
//
// Nothing here decides an assignment (that is compile.js) or judges one (critique.js). It
// only fixes the vocabulary the two type systems and the claim are written in.

// ── The data side (a Variable's type) ────────────────────────────────────────
export const ROLES         = Object.freeze(['domain', 'measure']);
export const MEASUREMENTS   = Object.freeze(['nominal', 'ordinal', 'interval', 'ratio', 'cyclic']);
export const TEMPORALS      = Object.freeze(['state', 'event', 'rate', 'static']);
export const DISTRIBUTIONS  = Object.freeze(['linear', 'log', 'skewed', 'bimodal', 'uniform']);

// ── The perception side (a Channel's type) ───────────────────────────────────
// `haptic` is RESERVED (§8 Q4): the type system already admits a third modality; no
// backend drives it yet, so it appears in the enum and nowhere else.
export const MODALITIES      = Object.freeze(['visual', 'auditory', 'haptic']);
export const ORDERS          = Object.freeze(['ordered', 'categorical', 'cyclic']);
export const TIME_CHARACTERS = Object.freeze(['sustained', 'transient']);
export const TRANSFERS       = Object.freeze(['linear', 'log', 'sqrt', 'mel', 'sone', 'cieL']);
export const ATTENTIONALS    = Object.freeze(['foreground', 'background']);

const oneOf = (set, v, fallback) => (set.includes(v) ? v : fallback);
const num = (x, d = 0) => (Number.isFinite(x) ? x : d);

// makeVariable — a profiled data variable (the output of profile(), the SIG stage).
export const makeVariable = ({
  id, role = 'measure', measurement = 'nominal', temporal = 'static',
  cardinality = 'continuous', range = null, categories = null,
  distribution_hint = 'linear', importance = 0.5,
} = {}) => Object.freeze({
  id: String(id),
  role:              oneOf(ROLES, role, 'measure'),
  measurement:       oneOf(MEASUREMENTS, measurement, 'nominal'),
  temporal:          oneOf(TEMPORALS, temporal, 'static'),
  cardinality:       cardinality === 'continuous' ? 'continuous' : Math.max(0, Math.round(num(cardinality))),
  range:             range ? Object.freeze([num(range[0]), num(range[1])]) : null,
  categories:        categories ? Object.freeze(categories.map(String)) : null,
  distribution_hint: oneOf(DISTRIBUTIONS, distribution_hint, 'linear'),
  importance:        Math.min(1, Math.max(0, num(importance, 0.5))),
});

// makeChannel — a perceptual channel a render backend advertises it can drive.
export const makeChannel = ({
  id, modality = 'visual', order = 'ordered', time_character = 'sustained',
  capacity = 5, transfer = 'linear', polarity = null, valence = 0,
  integral_with = [], attentional = 'foreground', effectiveness = 0.5,
} = {}) => Object.freeze({
  id: String(id),
  modality:       oneOf(MODALITIES, modality, 'visual'),
  order:          oneOf(ORDERS, order, 'ordered'),
  time_character: oneOf(TIME_CHARACTERS, time_character, 'sustained'),
  capacity:       Math.max(1, Math.round(num(capacity, 5))),
  transfer:       oneOf(TRANSFERS, transfer, 'linear'),
  polarity:       polarity == null ? null : String(polarity),
  valence:        Math.min(1, Math.max(0, num(valence))),
  integral_with:  Object.freeze(integral_with.map(String)),
  attentional:    oneOf(ATTENTIONALS, attentional, 'foreground'),
  effectiveness:  Math.min(1, Math.max(0, num(effectiveness, 0.5))),
});

// makeBinding — one variable→channel edge of a MapSpec, with its L3 transfer and ranges.
export const makeBinding = ({
  variable, channel, transfer = 'linear', normalize = 'linear', domain = null, range = null,
  polarity = null, reason = null,
} = {}) => Object.freeze({
  variable: String(variable),
  channel:  String(channel),
  transfer: oneOf(TRANSFERS, transfer, 'linear'),   // the CHANNEL's perceptual correction (L3, renderer-owned)
  normalize: normalize === 'log' ? 'log' : 'linear', // the DATA-distribution inversion (L3, tool-owned)
  domain:   domain ? Object.freeze(domain.map((x) => (typeof x === 'number' ? x : String(x)))) : null,
  range:    range ? Object.freeze(range.map(Number)) : null,
  polarity: polarity == null ? null : String(polarity),
  reason:   reason == null ? null : String(reason),
});

// makeMapSpec — the compiled claim. `provenance` (incl. mapspec_hash) is filled by the host,
// like LIMNER's view_id/source, so it is excluded from the content hash (mapSpecHash).
export const makeMapSpec = ({
  bindings = [], unmapped = [], modality = 'visual',
  valence_declarations = [], provenance = null,
} = {}) => Object.freeze({
  bindings:  Object.freeze(bindings.map(makeBinding)),
  unmapped:  Object.freeze(unmapped.map(String)),
  modality:  ['visual', 'auditory', 'cross'].includes(modality) ? modality : 'visual',
  valence_declarations: Object.freeze(valence_declarations.map((d) => Object.freeze({
    channel: String(d.channel), variable: String(d.variable), justification: String(d.justification ?? ''),
  }))),
  provenance: provenance == null ? null : Object.freeze({ ...provenance }),
});

// validateMapSpec — structural check: every binding names a variable + a channel, no channel
// is driven twice, unmapped ids are disjoint from bound ids. Returns human-readable problems.
export const validateMapSpec = (spec) => {
  const problems = [];
  if (!spec || typeof spec !== 'object') return ['mapspec is not an object'];
  const chans = new Set();
  const bound = new Set();
  for (const b of spec.bindings || []) {
    if (!b.variable) problems.push('binding with no variable');
    if (!b.channel)  problems.push(`binding ${b.variable} has no channel`);
    if (chans.has(b.channel)) problems.push(`channel driven twice: ${b.channel}`);
    chans.add(b.channel);
    bound.add(b.variable);
  }
  for (const u of spec.unmapped || []) if (bound.has(u)) problems.push(`variable both bound and unmapped: ${u}`);
  return problems;
};

// ── Content hash ─────────────────────────────────────────────────────────────
// The same FNV-1a-over-canonical-serialization idiom LIMNER's spec.js uses, kept local so
// the organ has no cross-faculty dependency. STABLE on the bytes: same MapSpec → same hash,
// which is what lets a compiled claim be a content address (docs/thalamus.md). Provenance is
// excluded — the claim is identical whichever run minted it.
const fnvHash = (text) => {
  let h1 = 0x811c9dc5, h2 = 0x811c9dc5;
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ((c + i) & 0xff), 0x01000193) >>> 0;
  }
  return 'fnv:' + (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
};
const canonical = (v) => {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
};
export const mapSpecHash = (spec) => {
  const { provenance, ...content } = spec || {};
  return fnvHash(canonical(content));
};
