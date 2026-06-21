// probe/detectors.js — the inelegance signatures (Koestlerian probe §2).
//
// Each detector is a PURE read over the module/holon graph (graph.js). It returns
// raw findings — { signature, locus, strain, evidence, criterion } — and does no
// ranking or gating; the strain map (index.js) derives the null and decides what
// beats it. A detector never edits and never decides; it measures one holon-health
// violation and cites the Koestler criterion it violates (criterion-bound, §4).
//
// This file holds the two gravest GRAPH-based signatures. The stream-based ones
// (cross-level fire, unaddressed emit) and the calibration one (absolute-on-
// relative-scale) read the sealed event stream / runtime signals and land next.

import { nearestHolon, isFace, holonsContaining } from './graph.js';

// ── 1. MEMBRANE BREACH (the gravest) ─────────────────────────────────────────
// A module imports another holon's INTERNALS instead of its published face. The
// detector: an import edge that crosses into a different holon and lands on a
// non-face file. Per-module strain is the count of such reaches; the locus is the
// reaching module, the evidence the specific internal targets. Returns the
// findings AND the full strain distribution (every module, clean ones at 0) so the
// null reflects the code's own typical strain, not only the flagged tail.
export const membraneBreaches = (graph) => {
  const findings = [];
  const background = [];
  for (const f of graph.files.values()) {
    const hF = nearestHolon(graph, f.rel);
    const breaches = [];
    for (const t of f.imports) {
      const hT = nearestHolon(graph, t);
      if (!hT || hT === hF) continue;          // same holon (or target in no holon) — no membrane crossed
      if (isFace(graph, t)) continue;          // entered through a published face — clean
      breaches.push(t);
    }
    background.push(breaches.length);
    if (breaches.length) findings.push(Object.freeze({
      signature: 'membrane-breach',
      locus: f.rel,
      strain: breaches.length,
      evidence: Object.freeze(breaches.slice(0, 6)),
      criterion: 'clean membrane (Koestler): a holon hides its internals; only its currency crosses, through its face',
    }));
  }
  return { signature: 'membrane-breach', findings, background };
};

// ── 3. FUSED HOLON ───────────────────────────────────────────────────────────
// Two holons mutually coupled with no membrane between them (the read/ =
// reader+surfer fusion). The detector: a pair of DISJOINT holons (neither contains
// the other) that import each other's files in BOTH directions. Strain is the total
// coupling across the pair; the locus names both. Ancestor/descendant pairs are
// excluded — a part using its whole is nesting, not fusion. The background is every
// disjoint pair with any cross-coupling, so a mutually-fused pair is gated against
// how coupled the code's pairs typically are.
export const fusedHolons = (graph) => {
  const contains = (a, b) => b === a || b.startsWith(`${a}/`);
  const pair = new Map();   // "A⇄B" (sorted) → { a, b, ab, ba }
  for (const f of graph.files.values()) {
    const hF = nearestHolon(graph, f.rel);
    if (!hF) continue;
    for (const t of f.imports) {
      const hT = nearestHolon(graph, t);
      if (!hT || hT === hF) continue;
      if (contains(hF, hT) || contains(hT, hF)) continue;   // nesting, not fusion
      const [a, b] = [hF, hT].sort();
      const key = `${a}⇄${b}`;
      const rec = pair.get(key) || { a, b, ab: 0, ba: 0 };
      if (hF === a) rec.ab++; else rec.ba++;
      pair.set(key, rec);
    }
  }
  const findings = [];
  const background = [];
  for (const { a, b, ab, ba } of pair.values()) {
    background.push(ab + ba);
    if (ab > 0 && ba > 0) findings.push(Object.freeze({
      signature: 'fused-holon',
      locus: `${a} ⇄ ${b}`,
      strain: ab + ba,
      evidence: Object.freeze([`${a}→${b}: ${ab}`, `${b}→${a}: ${ba}`]),
      criterion: 'stable sub-whole (Koestler): two faculties must face each other through a membrane, not couple mutually with none',
    }));
  }
  return { signature: 'fused-holon', findings, background };
};

// The detectors active so far, each returning { signature, findings, background }.
// A signature it cannot assess on the available field contributes no findings (it
// abstains — NUL — rather than manufacture one). The stream-based signatures
// (cross-level fire, unaddressed emit) and the calibration one land next.
export const DETECTORS = Object.freeze([membraneBreaches, fusedHolons]);

