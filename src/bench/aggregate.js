// The angle aggregation — the point of the whole design (docs/surfing-success.md §5).
//
// Per target there are many probes, one per angle. Two numbers come out, and the
// second is the one the wide-variety-of-angles ask actually wants:
//
//   mean         how good the note is on average for this target.
//   consistency  how STABLE the note is across phrasings. A target that returns the
//                gold note for every angle scores high; one that nails the
//                text-overlapping phrasing and misses the zero-overlap paraphrase
//                scores low even when the mean looks acceptable. Low consistency is
//                the signature of a fold that pivots on surface words, not meaning —
//                exactly the failure the multi-angle battery exists to expose.
//
//   target score = mean × consistency       (mean, discounted by angle variance)
//   battery score = Σ target scores          (gated by the hard gates holding everywhere)
//
// consistency = max(0, 1 − 2·σ): the standard deviation of the angle scores, which
// for scores in [0,1] tops out at 0.5, mapped to a full [1,0] discount. A target
// split half-perfect / half-zero (σ = 0.5) collapses to consistency 0 — keyword
// matching with extra steps earns nothing here, however high its mean.

export const aggregateTarget = (probes) => {
  const scores = probes.map(p => p.score);
  const n = scores.length || 1;
  const mean = scores.reduce((s, x) => s + x, 0) / n;
  const variance = scores.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const consistency = Math.max(0, 1 - 2 * std);
  const targetScore = mean * consistency;
  const gated = probes.some(p => p.gated);
  return {
    mean: round(mean), std: round(std), consistency: round(consistency),
    targetScore: round(targetScore), gated, n: scores.length,
    angles: probes,
  };
};

// Roll the per-target aggregates into a battery score. `anyGate` is the report's
// admissibility check (§7): the best force setting is the highest
// consistency-discounted battery score that trips NO hard gate on any probe.
export const aggregateBattery = (perTarget) => {
  const targetScores = Object.values(perTarget).map(t => t.targetScore);
  const batteryScore = targetScores.reduce((s, x) => s + x, 0);
  const meanTarget = targetScores.length ? batteryScore / targetScores.length : 0;
  const anyGate = Object.values(perTarget).some(t => t.gated);
  return {
    batteryScore: round(batteryScore),
    meanTarget: round(meanTarget),
    nTargets: targetScores.length,
    anyGate,
    perTarget,
  };
};

const round = (x) => Math.round(x * 1000) / 1000;
