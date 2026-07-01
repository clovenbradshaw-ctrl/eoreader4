// koine — the parameter-mapping compiler (docs/koine.md). Placeholder name, from koinē
// aísthēsis (the common sense that unifies the special senses); rename freely.
//
// Domains are infinite; data SHAPES and perceptual CHANNELS are small finite sets. So KOINÉ
// designs no per-domain view — it compiles over two type systems. Given a dataset and a
// finding, it profiles each variable's type (SIG), then solves a deterministic constraint
// problem (L1–L8) assigning variables to perceptual channels, and emits a MapSpec: a
// modality-INDEPENDENT, inspectable, content-addressed claim about how the data should be seen
// or heard. The mapping is itself a claim — high-valence channels are quarantined the way the
// rest of eoreader4 quarantines rhetoric, and what the budget could not show is a first-class
// `unmapped` field (the absence discipline).
//
// This slice is the MODALITY-INDEPENDENT core: profile → compile → critique, plus the channel
// catalogs (visual + a declared auditory set). It is render-backend-agnostic — MapSpec names
// channels, not marks — so `toViewSpec` (to a visual backend) and `toScoreSpec` (to an auditory
// one) are the declared seam, deferred, exactly as LIMNER shipped its model path as a seam.
//
//   profile(dataset, hints)          SIG — infer each variable's type from its values
//   channelsFor(modality)            the channel catalog a target draws from (visual|auditory|cross)
//   compile(vars, channels, budget)  the deterministic CSP over L1–L8 → a MapSpec
//   critique(mapSpec, catalog)       the linter — L1–L8 violations (error|warn|info)
//   mapSpecHash(mapSpec)             the content address of a compiled claim

export {
  ROLES, MEASUREMENTS, TEMPORALS, DISTRIBUTIONS,
  MODALITIES, ORDERS, TIME_CHARACTERS, TRANSFERS, ATTENTIONALS,
  makeVariable, makeChannel, makeBinding, makeMapSpec, validateMapSpec, mapSpecHash,
} from './schema.js';
export { profile, profileColumn }                       from './profile.js';
export { VISUAL_CHANNELS, AUDITORY_CHANNELS, channelsFor, VALENCE_QUARANTINE } from './channels.js';
export { normalizer, applyTransfer, describeTransfer }  from './transfer.js';
export { compile, KOINE_VERSION }                       from './compile.js';
export { critique, critiqueBySeverity }                 from './critique.js';
// CANTOR — the auditory render backend (the ear). MapSpec → ScoreSpec → Web Audio.
export { toScoreSpec, makeScoreSpec, playScore, freqOf, gainOf } from './cantor/index.js';
export * as cantor                                      from './cantor/index.js';
