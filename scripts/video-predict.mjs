// video-predict.mjs — signal from noise, then self-generate the next frames.
//
// "Video" here is a sequence of lit-or-not pixel grids — a retina's spike map, no model.
// A disk drifts at constant velocity through TV snow. Three generic mechanisms, all the
// engine's own, recover it and predict it:
//
//   • deriveNull (the Born rule) separates the disk's blob from the snow blobs in a
//     single frame — the disk's size beats the void boundary the snow throws up.
//   • persistence (organs/in/video.js) binds the disk frame-to-frame into ONE track that
//     survives the whole clip, while every snow grain is a one-frame flicker.
//   • the helix-aware predictor (surfer/helix-predict.js) reads the recovered trajectory:
//     a moving object IS a constant MOVE against a shifting frame, so the Structure rung
//     (velocity) predicts confidently where the Existence rung (absolute position) only
//     ever sees novelty — and it extrapolates the next frames.
//
//   node scripts/video-predict.mjs

import { ingestFrames } from '../src/organs/in/video.js';
import { helixPredict, helixGenerate } from '../src/surfer/index.js';
import { deriveNull } from '../src/core/index.js';

const W = 30, H = 13, T = 16, R = 2, DENS = 0.06;
const x0 = 4, y0 = 6, vx = 1, vy = 0;
let s = 20260626;
const rnd = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const blank = () => Array.from({ length: H }, () => Array.from({ length: W }, () => 0));
const drawDisk = (f, cx, cy) => { for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { if (dx * dx + dy * dy > R * R) continue; const x = Math.round(cx) + dx, y = Math.round(cy) + dy; if (x >= 0 && x < W && y >= 0 && y < H) f[y][x] = 1; } };
const render = (f) => f.map(r => r.map(v => v ? '█' : '·').join('')).join('\n');

const frames = [];
for (let t = 0; t < T; t++) {
  const f = blank();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rnd() < DENS) f[y][x] = 1;
  drawDisk(f, x0 + vx * t, y0 + vy * t);
  frames.push(f);
}
console.log('one noisy frame (disk + 6% snow):');
console.log(render(frames[6]));

const doc = ingestFrames({ name: 'clip', frames });
const sizes = doc.blobsByFrame[6].map(b => b.size).sort((a, b) => b - a);
const nul = deriveNull(sizes.slice(1), { scale: 'log', alpha: 0.05, grain: 1 });
console.log(`\nframe-6 blob sizes: ${sizes.join(' ')}`);
console.log(`void boundary (deriveNull, log): ${Number.isFinite(nul) ? nul.toFixed(2) : 'abstain'} — biggest blob (${sizes[0]}) ${sizes[0] > nul ? 'BEATS the snow null → SIGNAL' : 'is snow'}`);

const len = (t) => t.points.length;
const longest = [...doc.tracks].sort((a, b) => len(b) - len(a))[0];
const lens = doc.tracks.map(len).sort((a, b) => b - a);
console.log(`\n${doc.tracks.length} tracks; lengths (top) ${lens.slice(0, 5).join(' ')} … median ${lens[lens.length >> 1]}`);
console.log(`SIGNAL = the one track persisting ${len(longest)}/${T} frames; snow flickers for ~${lens[lens.length >> 1]}.`);

const traj = longest.points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
const xs = traj.map(p => p.x), ys = traj.map(p => p.y);
console.log(`\nrecovered x: ${xs.join(' ')}\nrecovered y: ${ys.join(' ')}`);
const rx = helixPredict(xs, { order: 2 });
console.log(`helix on x — existence ${rx.summary.meanExistenceBits} bits vs move ${rx.summary.meanMoveBits} bits → ` +
  `${rx.summary.meanMoveBits < rx.summary.meanExistenceBits ? 'the MOVE rung carries (constant velocity)' : 'flat'}`);

const N = 3;
const gx = helixGenerate(xs, { order: 2, n: N, rung: 'structure' }).slice(1);
const gy = helixGenerate(ys, { order: 2, n: N, rung: 'structure' }).slice(1);
console.log(`\nlast seen (${xs.at(-1)},${ys.at(-1)}); SELF-PREDICTED next: ${gx.map((x, i) => `(${x},${gy[i]})`).join(' ')}`);
for (let i = 0; i < N; i++) { const f = blank(); drawDisk(f, gx[i], gy[i]); console.log(`\nSELF-GENERATED frame ${T + i} (disk at ${gx[i]},${gy[i]}):`); console.log(render(f)); }
