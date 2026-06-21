// The refusal, in the operator vocabulary — NUL and VOID, at last.
//
// Abstention was real but SILENT: when the engine found nothing it simply did
// not emit a merge. That is invisible to the audit — and an auditable trace is
// the property we keep claiming. The nine operators already have the two we need:
//
//   NUL  — non-transformation. The field PROPOSED a structure (a merge, a shape),
//          but it did not clear the noise null, so the thing is HELD as-is: read,
//          recorded, not turned into structure.
//   VOID — a DEF to VOID, an ASSERTION of absence: "there is no equivalence /
//          no shape here." Content, not silence; the projection exposes it on
//          `voids`, where the edge-grounding veto can read it.
//
// So the refusal now leaves a trace. Below: the operator counts in the log on a
// real signal vs on pure noise, for audio and for video.

import { ingestFrequencies } from '../src/organs/in/frequency.js';
import { ingestFrames } from '../src/organs/in/video.js';
import { discoverEquivalences, detectMotion, coherentFigures } from '../src/read/index.js';
import { retrieveLexical } from '../src/retrieve/index.js';

const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const max = (xs) => xs.reduce((a, b) => Math.max(a, b), -Infinity);
const tally = (doc) => {
  const c = { SYN: 0, NUL: 0, VOID: 0 };
  for (const e of doc.log.snapshot()) { if (e.kind === 'void') c.VOID++; else if (e.op === 'SYN') c.SYN++; else if (e.op === 'NUL') c.NUL++; }
  return c;
};
const show = (label, doc) => {
  const t = tally(doc), v = doc.projectGraph().voids;
  console.log(`  ${label.padEnd(26)} SYN ${t.SYN}  NUL ${t.NUL}  VOID ${t.VOID}` + (v.length ? `   → voids: [${v.map(x => `${x.node}/${x.rel}`).join(', ')}]` : ''));
};

// ============================================================================
console.log('=== AUDIO — equivalence: SYN when real, NUL/VOID when noise ===');
const realA = ingestFrequencies({ name: 'real', notes: [{ hz: 220 }, { hz: 330 }, { hz: 440 }, { hz: 660 }] });
const inharm = (seed) => { const r = rng(seed); return Array.from({ length: 16 }, () => 1 + r() * 16); };
const noiseA = ingestFrequencies({ name: 'noise', notes: [{ hz: 220 }, { hz: 287 }, { hz: 413 }, { hz: 631 }], partialMultipliers: inharm(11) });
const maxOverlap = (doc) => max(doc.noteHz.map((_, i) => max(retrieveLexical(doc, doc.spectrumQuery(i), 9).filter(r => r.idx !== i).map(r => r.score).concat(0))));
const gate = max([12, 13, 14, 15, 16, 17].map(s => maxOverlap(ingestFrequencies({ name: 'n', notes: [{ hz: 220 }, { hz: 287 }, { hz: 413 }, { hz: 631 }], partialMultipliers: inharm(s) }))));

discoverEquivalences(realA, { minOverlap: gate });
discoverEquivalences(noiseA, { minOverlap: gate });
show('real (harmonic + octave)', realA);
show('noise (inharmonic)', noiseA);
console.log('  → real harmonics SYN-merge the octave; noise gets NUL (held pairs) and a VOID (no equivalence).');

// ============================================================================
console.log('\n=== VIDEO — shape: a reading when real, NUL/VOID when noise ===');
const W = 34, H = 20, R = 3, FRAMES = 10;
const frame = (rand, snow, center) => { const f = Array.from({ length: H }, () => new Array(W).fill(0));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rand() < snow) f[y][x] = 1;
  if (center) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - center[0]) ** 2 + (y - center[1]) ** 2 <= R * R) f[y][x] = 1;
  return f; };
const noiseClip = (snow, seed) => { const rand = rng(seed); return Array.from({ length: FRAMES }, () => frame(rand, snow, null)); };
const circleClip = (snow, seed) => { const rand = rng(seed), clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const out = []; let cx = 5, cy = 10, vx = 3, vy = 0;
  for (let t = 0; t < FRAMES; t++) { out.push(frame(rand, snow, [cx, cy])); if (t === 4) { vx = 0; vy = 2; } cx = clamp(cx + vx, R, W - 1 - R); cy = clamp(cy + vy, R, H - 1 - R); } return out; };

const nullExtent = max(Array.from({ length: 20 }, (_, i) => coherentFigures(ingestFrames({ name: 'n', frames: noiseClip(0.05, 1000 + i) }))[0].meanSize));
const realV = ingestFrames({ name: 'circle', frames: circleClip(0.05, 7) });
const noiseV = ingestFrames({ name: 'static', frames: noiseClip(0.05, 1005) });
const rv = detectMotion(realV, { nullExtent });
const nv = detectMotion(noiseV, { nullExtent });

console.log(`  noise null on per-frame extent: ${nullExtent.toFixed(1)}px`);
console.log(`  real:  shape ${rv.voided ? 'VOID' : 'DETECTED'} (top ${rv.top.meanSize.toFixed(1)}px, turn at frame ${rv.shape?.peak.frame})`);
console.log(`  noise: shape ${nv.voided ? 'VOID' : 'DETECTED'} (top ${nv.top.meanSize.toFixed(1)}px)`);
show('real (circle)', realV);
show('noise (static)', noiseV);
console.log('  → the circle is read as a shape; the static is NUL-held and VOID-asserted empty.');

console.log('\n=== WHAT THIS SHOWS ===');
console.log('The abstention is no longer a silent non-output. A refused structure is a NUL —');
console.log('the field proposed it, the null held it — and an empty reading is a VOID, an');
console.log('assertion the audit and the projection can read back. The two operators the');
console.log('cross-modal work never used turn out to be exactly the vocabulary of saying no.');
