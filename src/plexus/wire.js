// plexus/wire — the parameter patchbay. Wire a persistent holon (a parameter, one organ's
// emergent output) into another organ, with EOT as the translation layer between them.
//
// The analogy is touchdesigner: an operator's parameter is referenced into another operator's
// parameter, and the wire carries the value. Here the operators are ORGANS (organs/in, organs/out),
// a parameter is a persistent holon (plexus/parameters.js), and the wire carries EOT — because
// EOT is the one surface every organ already speaks (docs/eot-surface-syntax.md). A holon read
// off the audio organ crosses to any other organ as EOT triples and lowers, losslessly, into that
// organ's own append-only log. Modality lives at the edges; the wire is modality-blind.
//
// A binding is DATA (pure, serializable, deterministic id) — the patch itself, drawn once. Routing
// a binding over a live reading produces the EOT the wire carries; connecting it lowers that EOT
// into the target through an INJECTED ingester (eotDoc), so this membrane imports no ingester and
// no model — the same discipline organs/out keeps.

import { holonId }     from '../core/index.js';
import { snapshotEOT } from './parameters.js';

// mapParameter(source, target, opts) → a Binding (the wire, as data).
//   source        a Parameter (plexus/parameters.js) or { organ, label }
//   target        { organ, as? } — the destination organ, and the name to expose the holon
//                 under there (touchdesigner: wiring into a specific destination parameter)
//   opts.rename   force/suppress relabeling; defaults to true iff target.as differs from the label
export const mapParameter = (source, target, { rename } = {}) => {
  const label = source.label;
  const from  = { organ: source.organ, label, key: source.key ?? holonId(`${source.organ}.${label}`) };
  const as    = target.as ?? label;
  const to    = { organ: target.organ, as };
  const doRename = rename ?? (as !== label);
  return Object.freeze({
    id: holonId(`${from.key}->${to.organ}.${as}`),   // deterministic — the patch's identity of record
    from, to, via: 'eot', rename: doRename,
  });
};

// route(binding, sourceReading, opts) → { eot, lines } — the EOT the wire carries.
//   The source holon's state, relabeled to the destination name when the binding renames.
//   opts.recBridge  also prepend a `!rec` line documenting the vocabulary bridge between the two
//                   organs (EOT's native remap operator) — off by default; the rename already
//                   carries the data, the !rec is documentary.
export const route = (binding, sourceReading, { max = 24, recBridge = false } = {}) => {
  const as    = binding.rename ? binding.to.as : binding.from.label;
  const lines = snapshotEOT({ label: binding.from.label }, sourceReading, { as, max });
  const head  = (recBridge && binding.rename)
    ? [`!rec vocabulary:${binding.from.organ} {${binding.from.label}} => {${as}}`]
    : [];
  const all = [...head, ...lines];
  return Object.freeze({ eot: all.join('\n'), lines: Object.freeze(all) });
};

// connect(binding, sourceReading, ingest, opts) → the target-side doc.
//   Lowers the wire's EOT into the target organ through an injected EOT ingester (eotDoc), so the
//   holon becomes a first-class document the whole graph stack reads natively. The ingester is
//   injected — this module never imports one — keeping the plexus model-free and ingester-free.
export const connect = (binding, sourceReading, ingest, opts = {}) => {
  if (typeof ingest !== 'function') throw new TypeError('connect needs an EOT ingester (e.g. eotDoc)');
  const { eot } = route(binding, sourceReading, opts);
  return ingest(eot, {
    docId: `plexus:${binding.to.organ}`,
    frame: `plexus:${binding.from.organ}->${binding.to.organ}`,
    ...(opts.context || {}),
  });
};

// patch(source, target, sourceReading, opts) → { binding, eot, lines } — draw the wire and route
// it in one step, the common case: "map THIS parameter into THAT organ, and give me the EOT."
export const patch = (source, target, sourceReading, opts = {}) => {
  const binding = mapParameter(source, target, opts);
  return { binding, ...route(binding, sourceReading, opts) };
};
