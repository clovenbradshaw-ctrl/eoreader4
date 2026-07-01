// cantor — the ear. KOINÉ's auditory render backend: a MapSpec lowers to a ScoreSpec (pure,
// deterministic, owns the mel/sone physics), which the Web Audio scheduler sounds. The mirror
// of LIMNER: the hard part (turning a modality-independent claim into physical events) is code,
// deterministic and content-addressable; the renderer is a thin, injected shim. Placeholder
// name (a cantor sings a score); rename with KOINÉ.
//
//   toScoreSpec(mapSpec, data, opts)  MapSpec → ScoreSpec (physical events, each with a data ref)
//   playScore(score, ctx, opts)       schedule a ScoreSpec on an injected AudioContext
//   freqOf / gainOf                   the L3 physics inverses (mel⁻¹, sone/phon), exposed + testable

export { toScoreSpec, makeScoreSpec, freqOf, gainOf } from './score.js';
export { playScore }                                   from './play.js';
