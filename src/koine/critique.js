// koine/critique — the linter. It enforces L1–L8 over a MapSpec and returns the violations,
// the parameter-mapping analog of LIMNER's grounding veto. It runs inside compile()'s guarantee
// (a compiled spec is clean by construction) AND over a HAND-EDITED spec — a reader re-patches a
// binding (an EVA on the log), and critique catches an edit that broke a law. So it takes the
// spec plus the catalog it was compiled against (the variables + channels), because the laws are
// about types, and a bare MapSpec carries ids, not types.
//
// Severities: `error` = the mapping asserts something the data doesn't hold (a lie of the
// truncated-axis kind); `warn` = legible-but-degraded; `info` = a suboptimal-but-honest choice.

import { VALENCE_QUARANTINE } from './channels.js';
import { describeTransfer } from './transfer.js';

const ORDER_FOR = { nominal: 'categorical', ordinal: 'ordered', interval: 'ordered', ratio: 'ordered', cyclic: 'cyclic' };
const VALENCE_SOFT = 0.35;

export const critique = (mapSpec, { channels = [], variables = [] } = {}) => {
  const V = new Map(variables.map((v) => [v.id, v]));
  const C = new Map(channels.map((c) => [c.id, c]));
  const declared = new Set((mapSpec.valence_declarations || []).map((d) => `${d.channel}|${d.variable}`));
  const out = [];
  const add = (rule, severity, binding, message) => out.push({ rule, severity, variable: binding.variable, channel: binding.channel, message });

  const usedChannels = [];
  for (const b of mapSpec.bindings || []) {
    const v = V.get(b.variable);
    const c = C.get(b.channel);
    if (!v || !c) { out.push({ rule: 'L0', severity: 'error', variable: b.variable, channel: b.channel, message: 'binding references an unknown variable or channel' }); continue; }

    // L1 — expressiveness (order preservation)
    const need = ORDER_FOR[v.measurement];
    const l1ok = need === c.order || (v.measurement === 'cyclic' && c.order === 'ordered');
    if (!l1ok) add('L1', 'error', b, `${v.measurement} on a ${c.order} channel — ${need === 'categorical' ? 'fabricates a magnitude the data lacks' : 'hides the order the data has'}`);

    // L2 — time-character match (measures only; a domain lays out as an axis)
    if (v.role !== 'domain' && v.temporal === 'state' && c.time_character !== 'sustained') add('L2', 'error', b, 'a state (value-at-every-instant) on a transient channel — it will flicker, not hold');
    if (v.role !== 'domain' && v.temporal === 'event' && c.time_character !== 'transient') add('L2', 'warn', b, 'an event on a sustained channel — the instant it marks is smeared');

    // L3 — perceptual linearization present and appropriate
    if (b.transfer !== c.transfer) add('L3', 'warn', b, `transfer is "${b.transfer}" but the channel's correction is "${c.transfer}" (${describeTransfer(c.transfer)})`);
    if ((v.distribution_hint === 'skewed' || v.distribution_hint === 'log') && b.transfer === 'linear') add('L3', 'warn', b, 'a heavy-tailed variable on a linear transfer — most of its mass hides at the low end');

    // L5 — capacity
    if (v.cardinality !== 'continuous' && v.cardinality > c.capacity) add('L5', 'error', b, `${v.cardinality} levels on a channel that resolves ~${c.capacity} — ${v.cardinality - c.capacity} will be indistinguishable`);
    else if (v.cardinality === 'continuous' && c.capacity <= 6) add('L5', 'warn', b, `a continuous variable on a ~${c.capacity}-level channel — fine steps will not read`);

    // L6 — separability
    for (const u of usedChannels) if (c.integral_with.includes(u)) add('L6', 'error', b, `integral with "${u}", already in use — the two variables cannot be read independently`);
    usedChannels.push(c.id);

    // L7 — polarity present on ordered mappings
    if (c.order === 'ordered' && !b.polarity) add('L7', 'info', b, 'ordered mapping with no declared polarity — pick a convention (more→up/bright/high/loud)');

    // L8 — valence discipline
    const key = `${c.id}|${v.id}`;
    if (c.valence > VALENCE_QUARANTINE && !declared.has(key)) add('L8', 'error', b, `channel carries heavy rhetorical valence (${c.valence}) and is undeclared — using it for magnitude smuggles in an argument`);
    else if (c.valence >= VALENCE_SOFT && !declared.has(key)) add('L8', 'warn', b, `channel carries rhetorical connotation (valence ${c.valence}) — declare the intent or prefer a neutral channel`);
  }
  return out;
};

// A convenience partition for the critique gutter (docs/koine.md §6.3).
export const critiqueBySeverity = (violations) => ({
  errors: violations.filter((v) => v.severity === 'error'),
  warns:  violations.filter((v) => v.severity === 'warn'),
  infos:  violations.filter((v) => v.severity === 'info'),
});
