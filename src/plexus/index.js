// plexus — the parameter patchbay between organs (docs/parameter-mapping.md).
//
// A nerve plexus is where the fibres of separate organs interweave. This one wires the
// PERSISTENT HOLONS of one organ — the recurring figures a modality input throws up, read
// off the core's structure surface and presented as PARAMETERS — into another organ, the way
// touchdesigner references one operator's parameter into another's. The wire carries no
// modality: it carries EOT (docs/eot-surface-syntax.md), the one surface every organ speaks,
// so a holon heard by the audio organ crosses to any other organ as EOT triples and lowers,
// losslessly, into that organ's own append-only log.
//
//   parametersOf(reading)          the persistent holons of a reading, as parameters
//   parameterOf(reading, ref)      one parameter by label / key
//   snapshotEOT(param, reading)    a holon's current state as EOT lines (the wire's payload)
//   mapParameter(source, target)   draw a wire (a binding, as data) from a parameter to an organ
//   route(binding, reading)        the EOT the wire carries over a live reading
//   connect(binding, reading, in)  lower that EOT into the target via an injected ingester (eotDoc)
//   patch(source, target, reading) draw + route in one step (the common case)

export { parametersOf, parameterOf, snapshotEOT } from './parameters.js';
export { mapParameter, route, connect, patch }     from './wire.js';
