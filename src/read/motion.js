// Reading a moving shape — the three levels, over a video's tracks.
//
//   L1 existence    which track is a real moving SHAPE. Persistence (γ-mass) is
//                   the first cut — but TV snow fakes it: with enough grains a few
//                   line up frame-to-frame into a high-mass track that is no shape
//                   at all. So persistence alone is fooled (the README's warning —
//                   snow is maximally improbable yet inert). Coherence breaks the
//                   tie: a shape has EXTENT. Ranked by total lit area, the circle
//                   (a ~29-px disk every frame) dwarfs any snow chain (~2 px), with
//                   no threshold — just rank.
//   L2 structure    the coherent track's trajectory — where it travelled.
//   L3 significance  predict the next position by constant velocity (the simplest
//                   fold of the path) and be surprised when it deviates — the frame
//                   the shape DID something (turned, stopped). The circle's path is
//                   smooth (low surprise); a snow chain's would jitter (high).
//
// Pure on the doc; no model.

const trackStats = (doc) => doc.tracks.map(tr => ({
  id: tr.id,
  mass: tr.points.length,                                   // frames survived = the γ-mass fold
  area: tr.points.reduce((s, p) => s + p.size, 0),          // total lit pixels — the extent
  meanSize: round(tr.points.reduce((s, p) => s + p.size, 0) / tr.points.length),
}));

// L1, first cut: ranked by persistence (the engine's projection mass — sightings).
export const persistentFigures = (doc) => {
  const sightings = new Map([...doc.projectGraph().entities.values()].map(e => [e.id, e.sightings]));
  return trackStats(doc).map(t => ({ ...t, mass: sightings.get(t.id) ?? t.mass }))
    .sort((a, b) => b.mass - a.mass);
};

// L1, resolved: ranked by extent. A shape is contiguous AND substantial; this is
// what separates the circle from a snow chain that only faked persistence.
export const coherentFigures = (doc) =>
  trackStats(doc).sort((a, b) => b.area - a.area);

export const motionReading = (doc) => {
  const figs = coherentFigures(doc);
  const top = figs[0];
  const tr = doc.tracks.find(t => t.id === top.id) || { points: [] };
  const pts = tr.points;

  const steps = [];
  for (let i = 1; i < pts.length; i++) {
    const pred = i < 2
      ? { x: pts[i - 1].x, y: pts[i - 1].y }                                  // no velocity yet
      : { x: 2 * pts[i - 1].x - pts[i - 2].x, y: 2 * pts[i - 1].y - pts[i - 2].y }; // constant velocity
    steps.push({
      frame: pts[i].fi,
      x: round(pts[i].x), y: round(pts[i].y),
      surprise: round(Math.hypot(pts[i].x - pred.x, pts[i].y - pred.y)),
    });
  }
  const scored = steps.slice(1);
  const peak = scored.length ? scored.reduce((m, s) => (s.surprise > m.surprise ? s : m)) : null;

  return { trackId: top.id, mass: top.mass, area: top.area, figures: figs, points: pts, steps, peak };
};

const round = (x) => Math.round(x * 100) / 100;
