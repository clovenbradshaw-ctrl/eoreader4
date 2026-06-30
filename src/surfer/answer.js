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

  // The cited sentences accumulate into the VERBATIM channel; STRUCTURE points at them by
  // index, so a relation is never confused with the words it was read from.
  const quoteIdx = new Set();
  const cite = (i) => { if (Number.isInteger(i) && S[i] != null) quoteIdx.add(i); return i; };

  const regions = r.regions.map((reg, i) => {
    const seg = segByLo.get(reg.lo);
    const ev = seg ? evByIdx.get(seg.idx) : null;
    // bonds as RELATIONS (structure) — citing the sentence each was read from by index; the
    // verbatim words live in the verbatim channel, looked up by that index. A relation is a
    // reading of the source, not the source.
    const bonds = (reg.bonds || []).slice(0, 3).map((b) => ({
      src: b.srcLabel, via: b.via, tgt: b.tgtLabel, confidence: b.confidence, sentIdx: cite(b.idx),
    }));
    const argTypes = {};
    for (const l of links) if (l.sentIdx >= reg.lo && l.sentIdx < reg.hi) argTypes[l.via] = (argTypes[l.via] || 0) + 1;
    return {
      rank: i + 1, title: reg.title, lo: reg.lo, hi: reg.hi, sentences: reg.hi - reg.lo,
      cast: (reg.figures || []).slice(0, 6).map((f) => f.label),
      meaningDensity: reg.meaningDensity,
      // the narrator's attributed evaluative operation — STRUCTURE (objective about the text's
      // operation, owner-marked), never the machine's verdict.
      narratorOperation: ev && ev.score > 0 ? { carrier: ev.carrier, score: ev.score, owner: ev.owner } : null,
      bonds, argumentLinks: argTypes,
    };
  });

  // The narrator's sharpest attributed judgment near the surfaced material (structure-level).
  const near = (lo) => regions.some((reg) => Math.abs(reg.lo - lo) < 400);
  const locus = (evaluation?.ranked || []).find((s) => near(s.lo));
  const narratorStance = locus
    ? { carrier: locus.carrier, owner: locus.owner, sentIdx: cite(locus.lo + 1 <= S.length - 1 ? locus.lo + 1 : locus.lo), score: locus.score }
    : null;

  // The verbatim channel — the source, word for word, for every index structure cited.
  const quotes = [...quoteIdx].sort((a, b) => a - b).map((i) => ({ sentIdx: i, text: clip(S[i], 220) }));

  // THREE LEVELS, gated so they never blend (the cube's Site face carried to the output):
  //   verbatim       — Existence. The source, word for word. Checkable character for character.
  //   structure      — Structure. Objective ABOUT the source but not IN it verbatim: the
  //                    relations, the cast, the argument links, and the narrator's ATTRIBUTED
  //                    evaluative operation. A reading, re-derivable and auditable, not a quote.
  //   interpretation — Interpretation. The reader's / a talker's OWN verdict (ρ). The surf
  //                    withholds it; if a talker renders it, that is a SEPARATE model call and a
  //                    visibly distinct channel — so opinion is never mistaken for the source or
  //                    for an objective reading of it.
  return {
    question, domain: r.domain, keys: r.keys,
    verbatim: { level: 'existence', basis: 'the source, word for word', quotes },
    structure: {
      level: 'structure', basis: 'objective about the source (re-derivable), not verbatim — relations, cast, and the narrator\'s attributed evaluative operation',
      // The GRAIN is the GROUND — the background condition for anything to stand out. The
      // span-cut is objective GIVEN a grain (closure/the Born spectrum determines it,
      // re-derivably), but the CHOICE of grain is prior to the figure/ground distinction itself:
      // it sets what CAN become a figure or a surprise. Interpretation's surprise (the me-ness)
      // stands out only against this Ground; change the grain and a different reading stands out.
      // There are MULTIPLE grains (the holarchy — detectHolons/holarchy): a stack of Grounds, each
      // making different figures salient. This result stands on one of them.
      grain: encoding?.mode || 'unknown',
      grainNote: 'the grain is the Ground (background condition); objective given the grain, but choosing the grain is the transcendental act, and the holarchy holds the other grains',
      regions, narratorStance,
    },
    interpretation: {
      level: 'interpretation',
      // The subjective register — the ME-NESS. Its native quantity is SURPRISE measured against
      // the READER's accumulated ρ (not the document's σ): what departed from MY priors, what I
      // found salient. That is why it is not re-derivable across readers (structure is) — a thing
      // is surprising only relative to a self, and the prior IS the self. Document-intrinsic
      // surprise (cast turnover, holon boundaries) is the OTHER surprise and lives in structure.
      basis: 'the reader\'s subjective response (ρ) — surprise against MY accumulated state, the me-ness; not re-derivable across readers',
      surprise: null,                      // reader-relative surprise — filled only by a self with an accumulated ρ
      stance: null, generated: false,
      discipline: 'render in a SEPARATE model call and a visibly distinct channel; never blended with verbatim or structure',
    },
  };
};
