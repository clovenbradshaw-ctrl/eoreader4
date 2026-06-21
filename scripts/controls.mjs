// The control battery — the falsifications that prove the structure is real.
//
// A demo that lights up proves nothing on its own; the question is whether it
// would go DARK when the structure it claims to read is removed. Each control
// below specifies what must break, and by how much:
//
//   FREQUENCIES · inharmonic control — replace the harmonic overtones with random
//     non-integer partials. Octave equivalence and consonance must VANISH (the
//     overlap was reading the harmonics, not spelling).
//   MUSIC · shuffle control (double dissociation) — shuffle the note order. The
//     mass-tonic is order-blind and must SURVIVE; the n-gram predictor reads order
//     and must FALL to chance. One control, two opposite predictions.
//   VIDEO · frame-shuffle + static baselines — shuffle the frame order: per-frame
//     coherence (a blob exists) must SURVIVE, temporal persistence (one track
//     through time) and the turn-event must DIE. A static circle must persist yet
//     show no event. Noise sweep: find where snow finally drowns the shape.

import { ingestFrequencies } from '../src/organs/in/frequency.js';
import { ingestMusic } from '../src/organs/in/music.js';
import { ingestFrames } from '../src/organs/in/video.js';
import { retrieveLexical } from '../src/retrieve/index.js';
import { discoverEquivalences } from '../src/reader/index.js';
import { predictiveSequenceReading } from '../src/reader/index.js';
import { motionReading, coherentFigures, persistentFigures } from '../src/reader/index.js';

const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const shuffle = (arr, seed) => { const r = rng(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
const PASS = (b) => (b ? '✅ PASS' : '❌ FAIL');
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

let allPass = true;
const check = (label, cond, detail) => { allPass = allPass && cond; console.log(`  ${PASS(cond)}  ${label}${detail ? `  — ${detail}` : ''}`); };

// ============================================================================
console.log('=== CONTROL 1 · FREQUENCIES — inharmonic partials kill the structure ===');
// Overlap of a root with its octave and fifth, under harmonic vs inharmonic partials.
const octaveFifth = (multipliers) => {
  const doc = ingestFrequencies({
    name: 'c', notes: [{ hz: 220 }, { hz: 330 }, { hz: 440 }],   // root, fifth, octave
    ...(multipliers ? { partialMultipliers: multipliers } : {}),
  });
  const o = new Map(retrieveLexical(doc, doc.spectrumQuery(0), 9).map(r => [r.idx, r.score]));
  return { fifth: o.get(1) || 0, octave: o.get(2) || 0 };
};
const harmonic = octaveFifth(null);
const inharm = octaveFifth(shuffle(Array.from({ length: 16 }, (_, k) => 1 + k * 0.97 + 0.31), 5).map(m => m * 1.013)); // random-ish non-integer

console.log(`  harmonic:   octave overlap ${harmonic.octave.toFixed(3)}, fifth ${harmonic.fifth.toFixed(3)}`);
console.log(`  inharmonic: octave overlap ${inharm.octave.toFixed(3)}, fifth ${inharm.fifth.toFixed(3)}`);
check('harmonic partials give octave equivalence', harmonic.octave > 0.3, `octave ${harmonic.octave.toFixed(3)} > 0.3`);
check('inharmonic partials destroy it', inharm.octave < 0.05, `octave ${inharm.octave.toFixed(3)} < 0.05`);
check('the structure was in the harmonics, not the reader', harmonic.octave > 6 * (inharm.octave + 1e-6));

// ============================================================================
console.log('\n=== CONTROL 2 · MUSIC — shuffle: mass survives, prediction dies ===');
const FRERE = ['C4','D4','E4','C4','C4','D4','E4','C4','E4','F4','G4','E4','F4','G4',
  'G4','A4','G4','F4','E4','C4','G4','A4','G4','F4','E4','C4','C4','G3','C4','C4','G3','C4'];
const topTwoMass = (notes) => [...ingestMusic({ name: 'm', notes }).projectGraph().entities.values()]
  .sort((a, b) => b.sightings - a.sightings).slice(0, 2).map(e => e.label).sort();
const predHits = (notes) => { const s = predictiveSequenceReading(ingestMusic({ name: 'm', notes }), { order: 2 }); return s.filter(x => x.hit).length; };

const realMass = topTwoMass(FRERE);
const shufMass = topTwoMass(shuffle(FRERE, 7));
const realHits = predHits(FRERE);
const shufHits = mean(Array.from({ length: 30 }, (_, i) => predHits(shuffle(FRERE, 100 + i))));

console.log(`  top-2 by mass — real: [${realMass}]  shuffled: [${shufMass}]`);
console.log(`  order-2 prediction hits — real: ${realHits}/${FRERE.length - 1}   shuffled mean: ${shufHits.toFixed(1)}`);
check('mass-tonic is order-invariant (survives shuffle)', JSON.stringify(realMass) === JSON.stringify(shufMass));
check('the n-gram predictor reads order (collapses on shuffle)', realHits > shufHits + 1.5, `${realHits} vs ${shufHits.toFixed(1)}`);

// ============================================================================
console.log('\n=== CONTROL 3 · VIDEO — frame-shuffle + static baselines ===');
const W = 34, H = 20, R = 3, FRAMES = 10, SNOW = 0.05;
const clip = ({ move = true, snow = SNOW, seed = 7 }) => {
  const rand = rng(seed), clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const path = []; let cx = 5, cy = 10, vx = move ? 3 : 0, vy = 0;
  for (let t = 0; t < FRAMES; t++) { path.push([cx, cy]); if (move && t === 4) { vx = 0; vy = 2; } cx = clamp(cx + vx, R, W - 1 - R); cy = clamp(cy + vy, R, H - 1 - R); }
  return path.map(([ox, oy]) => { const f = Array.from({ length: H }, () => new Array(W).fill(0));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rand() < snow) f[y][x] = 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - ox) ** 2 + (y - oy) ** 2 <= R * R) f[y][x] = 1;
    return f; });
};
const topMass = (doc) => persistentFigures(doc)[0].mass;
const topMean = (doc) => coherentFigures(doc)[0].meanSize;

const moving = ingestFrames({ name: 'mv', frames: clip({ move: true }) });
const shuffled = ingestFrames({ name: 'sh', frames: shuffle(clip({ move: true }), 3) });
const static_ = ingestFrames({ name: 'st', frames: clip({ move: false }) });

// Mean step-to-step surprise of the coherent track = how SMOOTH its motion is.
// (Skip step 1, which has no velocity yet to predict from.)
const motionJitter = (doc) => { const s = motionReading(doc).steps.slice(1); return s.length ? mean(s.map(x => x.surprise)) : 0; };
const movePeak = motionReading(moving).peak.surprise;
const staticPeak = motionReading(static_).peak?.surprise ?? 0;
const moveJit = motionJitter(moving), shufJit = motionJitter(shuffled);

console.log(`  persistence (top track mass)   — moving: ${topMass(moving)}   shuffled: ${topMass(shuffled)}   (note: a slow object overlaps itself, so raw presence survives shuffle — that is honest)`);
console.log(`  coherence  (top blob px/frame)  — moving: ${topMean(moving)}   shuffled: ${topMean(shuffled)}`);
console.log(`  motion smoothness (mean jitter) — moving: ${moveJit.toFixed(2)}   shuffled: ${shufJit.toFixed(2)}`);
console.log(`  event (turn surprise peak)      — moving: ${movePeak.toFixed(2)}   static: ${staticPeak.toFixed(2)}`);
check('per-frame coherence survives shuffle (a blob is still there)', topMean(shuffled) > 15);
check('shuffling frames destroys SMOOTH MOTION (the trajectory)', shufJit > 2 * moveJit && shufJit > 2.5, `jitter ${moveJit.toFixed(2)} → ${shufJit.toFixed(2)}`);
check('the turn-event needs real motion (static shows none)', movePeak > 2 && staticPeak < 0.6, `moving ${movePeak.toFixed(2)} vs static ${staticPeak.toFixed(2)}`);
check('a static shape still persists (present, just no event)', topMass(static_) === FRAMES);

console.log('\n  noise sweep — does the shape outrank the snow as snow rises?');
for (const snow of [0.02, 0.05, 0.10, 0.20, 0.35]) {
  const f = coherentFigures(ingestFrames({ name: 'n', frames: clip({ move: true, snow }) }));
  const shape = f[0], bestSnow = f.find(t => t.meanSize < 5) || { area: 0 };
  const ratio = shape.area / Math.max(1, bestSnow.area);
  console.log(`    snow ${String(Math.round(snow * 100)).padStart(2)}%:  shape area ${String(shape.area).padStart(3)}  vs best snow ${String(bestSnow.area).padStart(2)}  → ${ratio.toFixed(1)}× ${ratio > 3 ? '(shape wins)' : '(DROWNED)'}`);
}

console.log(`\n=== ${allPass ? '✅ ALL CONTROLS PASS' : '❌ SOME CONTROL FAILED'} ===`);
console.log('Each result above is a falsification: the structure goes dark exactly when the');
console.log('thing it claims to read is removed (harmonics, order, motion) and survives exactly');
console.log('when an order-blind property (mass, per-frame coherence) should be untouched.');
process.exit(allPass ? 0 : 1);
