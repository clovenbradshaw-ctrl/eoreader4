// The ground holon: cite-or-veto. The integrity guarantee.

export { bindCitations, renderBound } from './bind.js';
export { runVetoes, VETOES, isUnbound, isAbstention } from './veto.js';
// Per-proposition grounding provenance — veto on propositional MEANING, not raw spans. Each
// proposition of a response is verbatim (lifted), grounded (its figures stand in the same
// relation a read span asserts), or fabricated (witnessed by nothing). A response can be a
// mix; the fabricated propositions are the ones a veto suppresses or flags.
export { classifyProvenance } from './provenance.js';
