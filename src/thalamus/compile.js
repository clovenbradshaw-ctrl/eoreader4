// thalamus/compile — the assignment compiler. Variables + channels + a budget → a MapSpec.
//
// This is the intelligence, and it is DETERMINISTIC: same (variables, channels, budget) ⇒ same
// MapSpec, every time. No model. The model's only optional job upstream is the importance
// ranking (what the finding is) — selection, which small models do reliably; the hard part,
// the assignment, is a constraint solve in code (docs/thalamus.md). The solve is Mackinlay's
// expressiveness/effectiveness compiler generalized across modalities, plus L2 (time-character)
// and L8 (valence) which the visual lineage never needed.
//
// The algorithm:
//   pass 1 — DOMAINS define the frame. Independent axes (time, space, index) take the most
//            effective ordered channels first (a timeline's x is position, not size).
//   pass 2 — MEASURES by importance. The highest-importance measure takes the most effective
//            remaining channel it is TYPE-LEGAL on.
//   a channel is legal for a variable iff L1 (order), L2 (time), L5 (capacity), L6 (separable),
//   and L8 (valence not quarantined) all hold; among legal channels, L4 picks by effectiveness;
//   L3 stamps the perceptual transfer. A variable with no legal channel is honestly `unmapped`.

import { makeMapSpec, mapSpecHash } from './schema.js';
import { normalizer } from './transfer.js';
import { VALENCE_QUARANTINE } from './channels.js';

export const THALAMUS_VERSION = '0.1';

// L1 — expressiveness: the channel's ORDER must be able to carry the variable's measurement.
const ORDER_FOR = { nominal: 'categorical', ordinal: 'ordered', interval: 'ordered', ratio: 'ordered', cyclic: 'cyclic' };
const expressible = (v, c) => {
  const need = ORDER_FOR[v.measurement];
  if (need === c.order) return true;
  if (v.measurement === 'cyclic' && c.order === 'ordered') return true;   // a logged downgrade (loses wrap)
  return false;
};

// L2 — time-character: a MEASURE's temporal character must match the channel's. A DOMAIN is
// exempt: an axis lays time out as space/onset regardless (that is what a timeline is).
const timeMatches = (v, c) => {
  if (v.role === 'domain' || v.temporal === 'static' || v.temporal === 'rate') return true;
  if (v.temporal === 'state') return c.time_character === 'sustained';
  if (v.temporal === 'event') return c.time_character === 'transient';
  return true;
};

// L5 — capacity: a DISCRETE variable needs at most `capacity` distinguishable levels. Continuous
// variables are not hard-blocked (they bin); critique warns when the ceiling is low.
const capacityOk = (v, c) => (v.cardinality === 'continuous' ? true : v.cardinality <= c.capacity);

// L6 — separability: don't drive two independently-read variables onto an integral pair.
const separable = (c, used) => !c.integral_with.some((other) => used.has(other));

// L8 — valence quarantine: a high-valence channel may carry magnitude only if declared.
const valenceOk = (v, c, declared) => c.valence <= VALENCE_QUARANTINE || declared.has(`${c.id}|${v.id}`);

const legal = (v, c, used, declared) =>
  !used.has(c.id) && expressible(v, c) && timeMatches(v, c) && capacityOk(v, c) && separable(c, used) && valenceOk(v, c, declared);

export const compile = (variables, channels, budget = {}) => {
  const vars  = variables || [];
  const chans = channels || [];
  const maxChannels = budget.maxChannels ?? Infinity;
  const modality    = budget.modality ?? (chans.every((c) => c.modality === 'auditory') ? 'auditory' : chans.some((c) => c.modality === 'auditory') ? 'cross' : 'visual');
  const declarations = budget.valence_declarations || [];
  const declared = new Set(declarations.map((d) => `${d.channel}|${d.variable}`));

  const used = new Set();
  const bindings = [];
  const unmapped = [];

  const assign = (v) => {
    if (used.size >= maxChannels) { unmapped.push(v.id); return; }
    // L4 orders by effectiveness, but a temporal variable first PREFERS the channel whose
    // time-character matches its own (an event → the transient/time axis: onset in sound,
    // and — since no visual channel is transient — position in space). This is a soft tie-break
    // above effectiveness, so a time domain takes onset over the flashier pitch (L2 in spirit).
    const wantTransient = v.temporal === 'event';
    const wantSustained = v.temporal === 'state';
    const timePref = (c) => ((wantTransient && c.time_character === 'transient') || (wantSustained && c.time_character === 'sustained')) ? 1 : 0;
    const cands = chans
      .filter((c) => legal(v, c, used, declared))
      .sort((a, b) => (timePref(b) - timePref(a)) || (b.effectiveness - a.effectiveness));
    if (!cands.length) { unmapped.push(v.id); return; }
    const c = cands[0];
    used.add(c.id);
    const norm = normalizer(v);
    bindings.push({
      variable: v.id, channel: c.id,
      transfer: c.transfer, normalize: norm.pre, domain: norm.domain, range: [0, 1], polarity: c.polarity,
      reason: `${v.measurement}/${v.temporal} → ${c.id} (${c.order}/${c.time_character}, eff ${c.effectiveness}${norm.pre === 'log' ? ', log-compressed' : ''})`,
    });
  };

  const byImportance = (a, b) => b.importance - a.importance;
  vars.filter((v) => v.role === 'domain').sort(byImportance).forEach(assign);   // pass 1: the frame
  vars.filter((v) => v.role !== 'domain').sort(byImportance).forEach(assign);   // pass 2: the measures

  const spec = makeMapSpec({
    bindings, unmapped, modality, valence_declarations: declarations,
    provenance: { compiler_version: THALAMUS_VERSION, data_ref: budget.data_ref ?? null, profile_ref: budget.profile_ref ?? null, mapspec_hash: null },
  });
  // stamp the content hash into provenance (excluded from the hash itself).
  return makeMapSpec({
    ...spec,
    provenance: { ...spec.provenance, mapspec_hash: mapSpecHash(spec) },
  });
};
