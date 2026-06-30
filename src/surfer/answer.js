// surfToAnswer — assemble the surf's reading of a question into a structured, saveable result.
//
// The honest contract (the firewall, evaluation.js): the surf is the modeler + the surfer,
// the σ-side. It REACHES the material a question lives in (the regions, the cast, the cited
// bonds, the argument structure) and ATTRIBUTES the narrator's evaluative operation over it —
// it does NOT render the verdict. The verdict is the read-time evaluator's (the veto guard's
// sibling on the rhetoric axis), kept out of this object. So the result is evidence + attributed
// stance, every span cited to a sentence index, for a reader (or a downstream talker) to judge.
//
// Pure over a prebuilt context { doc, encoding, evaluation } so a harness builds the encoding
// and the evaluation once and answers many questions against them. JSON-serializable, so a
// battery can save the results and score region-reaching, citation quality, and the modeler's
// owner-attributed loci against a hand key.

import { coarseSurf } from './levels.js';

const clip = (t, n = 140) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);

export const surfToAnswer = (question, { doc, encoding, evaluation, top = 3 } = {}) => {
  const S = doc?.sentences || doc?.units || [];
  const segByLo = new Map((encoding?.segments || []).map((s) => [s.lo, s]));
  const evByIdx = new Map((evaluation?.segments || []).map((s) => [s.idx, s]));
  const links = (doc?.log?.filter ? doc.log.filter((e) => e.linkKind === 'inter-proposition') : []);

  const r = coarseSurf(encoding, question, { top, evaluation });

  const regions = r.regions.map((reg, i) => {
    const seg = segByLo.get(reg.lo);
    const ev = seg ? evByIdx.get(seg.idx) : null;
    // bonds, citing the sentence each was read from; the verbatim quote rides along so the
    // result is self-checking (a reader can confirm the bond against the text).
    const bonds = (reg.bonds || []).slice(0, 3).map((b) => ({
      src: b.srcLabel, via: b.via, tgt: b.tgtLabel,
      confidence: b.confidence, sentIdx: b.idx, quote: clip(S[b.idx], 110),
    }));
    // the argument structure in the region — the inter-proposition links by type.
    const argTypes = {};
    for (const l of links) if (l.sentIdx >= reg.lo && l.sentIdx < reg.hi) argTypes[l.via] = (argTypes[l.via] || 0) + 1;
    return {
      rank: i + 1, title: reg.title, lo: reg.lo, hi: reg.hi, sentences: reg.hi - reg.lo,
      cast: (reg.figures || []).slice(0, 6).map((f) => f.label),
      meaningDensity: reg.meaningDensity,
      evaluation: ev && ev.score > 0 ? { score: ev.score, carrier: ev.carrier, owner: ev.owner } : null,
      bonds, argumentLinks: argTypes,
    };
  });

  // The narrator's sharpest attributed judgment near the surfaced material — the modeler's
  // top-ranked evaluative locus that sits within reach of a surfaced region. Owner-marked
  // (narrator, or ambiguous under free-indirect discourse); never the machine's own stance.
  const near = (lo) => regions.some((reg) => Math.abs(reg.lo - lo) < 400);
  const locus = (evaluation?.ranked || []).find((s) => near(s.lo));
  const narratorJudgment = locus ? {
    carrier: locus.carrier, owner: locus.owner, sentIdx: locus.lo, score: locus.score,
    quote: clip(S[locus.lo + 1] || S[locus.lo], 110),
  } : null;

  // The epistemic gate, made STRUCTURAL (not a convention). Two channels that never blend:
  //   source         — σ. The document: cited evidence and the narrator's ATTRIBUTED evaluative
  //                     operation (owner-marked, never endorsed). Everything here traces to a
  //                     sentence index; a reader can audit every span against the text.
  //   interpretation — ρ. The reader's / a talker's OWN verdict. The surf does NOT produce it
  //                     (null here). If a talker renders it, the discipline is that it comes
  //                     from a SEPARATE model call and is rendered as a visibly distinct channel
  //                     (a different colour, a labelled block) — so source and opinion can be
  //                     told apart at a glance and the opinion can be contested, never mistaken
  //                     for what the text says. This is the firewall the modeler/evaluator split
  //                     enforces, carried to the output boundary.
  return {
    question, domain: r.domain, keys: r.keys,
    source: {
      basis: 'σ — cited document material and the narrator\'s attributed evaluative operation',
      regions,
      narratorStance: narratorJudgment,   // owner-marked (narrator | ambiguous under FID); attributed, not endorsed
    },
    interpretation: {
      basis: 'ρ — the reader\'s/talker\'s own verdict',
      stance: null,                        // the surf withholds the verdict
      generated: false,
      discipline: 'render in a SEPARATE model call and a visibly distinct channel; never blended with source',
    },
  };
};
