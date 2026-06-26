// helix-predict.mjs — the helix-aware predictor on a modulating melody.
//
// Predict the move against the frame, and let a stale basis be a REC, not endless
// surprise. A motif is stated four times rooted on C, then four times transposed to G.
// The Existence rung (absolute pitch) reads the modulation as novelty forever; the
// Structure rung (the interval — the move) sails through it; the difference diagnoses a
// reframe, fires REC(Paradigm,…), and re-grounds. Then generation rides the move rung
// into a key the training never saw.
//
//   node scripts/helix-predict.mjs

import { helixPredict, helixGenerate } from '../src/surfer/index.js';

const SEMI = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const midi = (n) => { const m = /^([A-G]#?)(\d)$/.exec(n); return SEMI[m[1]] + 12 * (+m[2] + 1); };
const name = (m) => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][((m % 12) + 12) % 12];

const motifC = ['C4', 'E4', 'G4', 'E4'], motifG = ['G4', 'B4', 'D5', 'B4'];
const notes = [...motifC, ...motifC, ...motifC, ...motifC, ...motifG, ...motifG, ...motifG, ...motifG];
const seq = notes.map(midi);
const seam = motifC.length * 4;

console.log('melody:', notes.map(n => n.replace(/\d/, '')).join(' '));
console.log('key change at index', seam, '(C-root → G-root)\n');

const r = helixPredict(seq, { order: 2, window: 3, alpha: 0.05 });
console.log('rungs:', r.rungs.join(', '));
console.log('diagnosis:', r.summary.diagnosis);
console.log('RECs (auto-detected, off measured nulls):',
  r.recs.map(x => `@${x.at} Δ${x.surpriseDelta} ${x.cell}`).join('  ') || 'none');

const sect = (pred) => {
  const ss = r.steps.filter(pred);
  const m = (k) => { const v = ss.map(s => s[k]).filter(x => x != null); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : '—'; };
  return `existence ${m('existenceBits')}   move ${m('moveBits')}`;
};
console.log('\nmean surprise (bits):');
console.log('  C-section:', sect(s => s.at < seam));
console.log('  G-section:', sect(s => s.at >= seam), '  ← absolute worse, move BETTER: the mis-framed signature');

console.log('\naround the seam:');
console.log('  idx  existence  move   carrying');
for (const s of r.steps.filter(s => s.at >= seam - 2 && s.at <= seam + 4))
  console.log(`  ${String(s.at).padStart(3)}  ${String(s.existenceBits).padStart(8)}  ${String(s.moveBits).padStart(5)}  ${s.carrying}${s.regrounded ? '   <-- RE-GROUND' : ''}`);

console.log('\ngeneration (draw the move against the frame):');
console.log('  continuation:', helixGenerate(seq, { order: 2, n: 12, seed: 7 }).map(name).join(' '));
console.log('  same shape re-grounded onto D (untrained key):',
  helixGenerate(seq, { order: 2, n: 12, seed: 7, start: midi('D5') }).map(name).join(' '));
