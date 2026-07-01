// plexus/parameters — a modality input's PERSISTENT HOLONS, exposed as parameters.
//
// When an organ ingests a modality, the core discovers structure above the unit stream:
// figures (referents that recur), the relations they wear, the standing properties they
// carry. A figure that RECURS — that survives across the stream instead of firing once —
// is a persistent holon (docs/holons.md): the stable intermediate form selection can act
// on. This module reads such holons off a reading and presents them as PARAMETERS — the
// wire endpoints a plexus binding routes (touchdesigner's parameters, applied here).
//
// A parameter is nothing the organ hands in: it is emergent, read off the core's own
// structure surface (perceiver/surfaces.js → { figures, relations, defs }). The persistence
// is the figure's recurrence (its merged sighting count) — the measure of how clearly the
// holon emerged. Its VALUE, when wired, is its state serialized as EOT (parameters carry no
// modality across the wire; only EOT does — docs/parameter-mapping.md).

import { holonId }      from '../core/index.js';
import { serializeEOT } from '../perceiver/index.js';

// The unique wire-endpoint id for a holon on a given organ: the SAME holon read off two
// different organs is two endpoints (a "Gregor" heard and a "Gregor" seen are not yet one),
// so the organ is part of the key. The holon's organ-independent identity rides separately.
const endpointId = (organ, label) => holonId(`${organ}.${label}`);

// parametersOf(reading, opts) → the persistent holons of a reading, as parameters.
//   reading         a structure surface: { figures:[{id,label,count}], relations, defs }
//   opts.organ      which organ exposed this reading (the source modality) — rides on each param
//   opts.minPersistence  the recurrence floor a holon must clear to count as persistent (default 1)
// Ranked most-persistent first: the holons that most clearly emerged lead.
export const parametersOf = (reading, { organ = 'organ', minPersistence = 1 } = {}) => {
  const params = [];
  for (const f of (reading?.figures || [])) {
    const persistence = f.count || 0;
    if (persistence < minPersistence) continue;
    params.push(Object.freeze({
      key:         endpointId(organ, f.label),   // wire endpoint id — unique per (organ, holon)
      holonId:     holonId(f.label),             // the holon's own identity — organ-independent
      label:       f.label,
      organ,
      kind:        'figure',
      persistence,                               // recurrence: how clearly the holon emerged
    }));
  }
  params.sort((a, b) => b.persistence - a.persistence);
  return Object.freeze(params);
};

// parameterOf(reading, ref, opts) → one parameter by label / key / param, or null.
export const parameterOf = (reading, ref, opts = {}) => {
  const params = parametersOf(reading, opts);
  const label = typeof ref === 'string' ? ref : ref?.label;
  const key   = typeof ref === 'string' ? ref : ref?.key;
  return params.find((p) => p.label === label || p.key === key) || null;
};

// The sub-reading CENTRED on one holon: the relations it participates in (as either end)
// plus its standing properties — optionally RELABELED to a destination name, so the same
// holon rides the wire under the target's own parameter name. Same shape serializeEOT eats,
// so the plexus and the notes surface are one renderer.
const focus = (reading, label, as) => {
  const relabel = (n) => (n.label === label ? { ...n, label: as } : n);
  const relations = (reading?.relations || [])
    .filter((r) => r.src.label === label || r.tgt.label === label)
    .map((r) => ({ ...r, src: relabel(r.src), tgt: relabel(r.tgt) }));
  const defs = (reading?.defs || [])
    .filter((d) => d.label === label)
    .map((d) => ({ ...d, label: as }));
  return { relations, defs };
};

// snapshotEOT(param, reading, opts) → the holon's current STATE as EOT lines (the value the
// wire carries). This is the translation layer: whatever modality the holon emerged from, its
// state crosses as EOT triples — a LINK per relation, an IS-A per standing property.
//   opts.as   the destination name to relabel the holon under (default: its own label)
//   opts.max  cap on lines (default 24)
export const snapshotEOT = (param, reading, { as, max = 24 } = {}) => {
  const label = param?.label ?? param;
  return serializeEOT(focus(reading, label, as ?? label), { max });
};
