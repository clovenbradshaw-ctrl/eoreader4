// See a circle travel through static — the engine pulls it out of TV snow.
//
// Every frame is a field of random lit pixels (snow) with a lit disk (the
// circle) drawn moving through it. The snow and the circle are the SAME lit
// pixels; nothing tells them apart by value. The engine recovers the circle by
// two generic facts only: the circle is contiguous (one blob), and it persists
// across frames (one track, sighted every frame). Its γ-mass towers over the
// snow, every grain of which lives one frame. "The reading does not chase the
// snow; it rides what persists" — here, literally.

import { ingestFrames } from '../src/ingest/video.js';
import { motionReading, persistentFigures, coherentFigures } from '../src/read/index.js';

// --- synthesise the clip (the only input): static + a moving circle. ---------
const W = 34, H = 20, R = 3, FRAMES = 10, SNOW = 0.05;
const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const rand = rng(7);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const path = [];
let cx = 5, cy = 10, vx = 3, vy = 0;
for (let t = 0; t < FRAMES; t++) {
  path.push([cx, cy]);
  if (t === 4) { vx = 0; vy = 2; }                 // the circle turns downward here
  cx = clamp(cx + vx, R, W - 1 - R);
  cy = clamp(cy + vy, R, H - 1 - R);
}
const frames = path.map(([ox, oy]) => {
  const f = Array.from({ length: H }, () => new Array(W).fill(0));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rand() < SNOW) f[y][x] = 1; // snow
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)                                  // circle
    if ((x - ox) ** 2 + (y - oy) ** 2 <= R * R) f[y][x] = 1;
  return f;
});

const render = (grid, mark) => grid.map((row, y) =>
  '  ' + row.map((v, x) => (mark && mark(x, y)) || (v ? '#' : '·')).join('')).join('\n');

console.log('=== INPUT: one frame of the clip (snow everywhere, a circle somewhere) ===');
console.log(render(frames[0]));
console.log(`\n${FRAMES} frames, ${W}×${H}, ${Math.round(SNOW * 100)}% snow per frame. No labels, no model.`);

// --- what the engine extracts -----------------------------------------------
const doc = ingestFrames({ name: 'snow+circle', frames });

console.log('\n=== L1 · EXISTENCE — finding the moving shape in the snow ===');
console.log(`the engine found ${doc.tracks.length} tracks across the clip.`);

const byMass = persistentFigures(doc);
const topMass = byMass.filter(f => f.mass === byMass[0].mass);
console.log(`\n  first cut — PERSISTENCE (frames survived). top mass = ${byMass[0].mass}, reached by ${topMass.length} tracks:`);
console.log(`    ${topMass.map(f => f.id).join(', ')}`);
console.log('  persistence alone is FOOLED: with 5% snow, a few grains line up frame-to-frame');
console.log('  into a high-mass chain that is no shape at all (snow is improbable but inert).');

const byArea = coherentFigures(doc);
console.log(`\n  resolved — COHERENCE (total lit area; a shape has extent). by area:`);
byArea.slice(0, 4).forEach((f, i) => console.log(`    ${i === 0 ? '→' : ' '} ${f.id}: area ${f.area}  (mass ${f.mass}, ~${f.meanSize}px/frame)`));
console.log(`  the circle (${byArea[0].id}, ~${byArea[0].meanSize}px each frame) dwarfs every snow chain (~1–2px). no`);
console.log('  threshold — just rank. one coherent thing travelled through time; the rest is dust.');

const m = motionReading(doc);
console.log('\n=== L2 · STRUCTURE — the path it travelled ===');
const onPath = (x, y) => {
  const hit = m.points.find(p => Math.round(p.x) === x && Math.round(p.y) === y);
  return hit ? String(hit.fi % 10) : null;     // mark each frame's centre with its frame index
};
console.log(render(frames[0].map(r => r.map(() => 0)), onPath));
console.log('  (each digit is the circle\'s centre at that frame — the trajectory the engine traced.)');

console.log('\n=== L3 · SIGNIFICANCE — predict the next position, be surprised ===');
for (const s of m.steps) {
  const bar = '█'.repeat(Math.round(s.surprise * 4));
  console.log(`    frame ${s.frame}  at (${s.x},${s.y})  surprise ${s.surprise.toFixed(2)} ${bar}`);
}
console.log(`  → sharpest deviation at frame ${m.peak.frame}: the circle TURNED there — the one`);
console.log('    moment its motion broke the straight line the reading had been predicting.');

console.log('\n=== WHAT THIS SHOWS ===');
console.log('Input: raw lit pixels, snow and circle indistinguishable per pixel. The engine');
console.log('saw the circle travelling through time from three generic facts, no model, no');
console.log('labels, no threshold: it is CONTIGUOUS (one blob), it is COHERENT (a blob with');
console.log('real extent, not a grain — which is what broke snow\'s fake-persistence tie), and');
console.log('it PERSISTS and moves predictably (low surprise until it turned at frame 5). The');
console.log('moving shape is the thing that coheres and persists; the snow, however improbable,');
console.log('never does — so the reading rode the circle and not the snow.');
