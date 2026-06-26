// horizon-demo.mjs — a Horizon accumulating a self across turns, then re-grounding.
//
// Memory that IS the moved density operator. The Horizon cold-starts at σ (the corpus
// ground), folds each turn's reading in with recency decay, and DEPARTS σ as it
// commits to a frame — entropy falls, the novelty reserve falls, a self accumulates.
// Then the "conversation" changes frame; the cross-turn surprise beats the deriveNull
// the Horizon's own history throws up, and it RE-GROUNDS — drops back toward the bare
// ground and rebuilds in the new frame (the helix turning).
//
//   node scripts/horizon-demo.mjs

import { createHorizon, centroidBasis } from '../src/surfer/index.js';

const E = (i, d = 6) => { const v = new Array(d).fill(0); v[i] = 1; return v; };
const PRIOR = { vectors: {
  DEF_Clearing_Atmosphere: E(0), EVA_Tending_Atmosphere: E(1), REC_Cultivating_Atmosphere: E(2),
  EVA_Binding_Lens: E(3), DEF_Dissecting_Lens: E(4), REC_Making_Lens: E(5),
} };
const basis = centroidBasis(PRIOR);
const ix = (k) => basis.keys.indexOf(k);
const turnIn = (a, b, m = 5) => Array.from({ length: m }, (_, i) => { const v = new Array(basis.keys.length).fill(0.05); v[i % 2 === 0 ? a : b] = 1; return v; });

const h = createHorizon({ prior: PRIOR, gamma: 0.7, alpha: 0.05 });
const A = [ix('EVA_Tending_Atmosphere'), ix('DEF_Clearing_Atmosphere')];   // frame A: a tone/atmosphere reading
const B = [ix('EVA_Binding_Lens'), ix('REC_Making_Lens')];                 // frame B: a different reading

console.log('a 10-turn "conversation"; turns 0–5 read through frame A, then it shifts to frame B.\n');
console.log('turn  frame  turnSurprise  departure  entropy  reserve  event');
const frames = [...Array(6).fill(A), ...Array(4).fill(B)];
frames.forEach((f, t) => {
  const r = h.observe(turnIn(f[0], f[1]), { autoReground: true });
  const ev = r.regrounded ? 'RE-GROUND (helix turns)' : '';
  console.log(
    `${String(t).padStart(3)}    ${f === A ? 'A' : 'B'}    ` +
    `${String(r.turnSurprise).padStart(10)}  ${String(r.departure).padStart(8)}  ` +
    `${String(r.entropy).padStart(6)}  ${String(r.reserve).padStart(6)}  ${ev}`
  );
});

const r = h.reading();
console.log(`\nafter 10 turns: ${r.units} units folded, ${r.regroundings} re-ground(s).`);
console.log(`cumulative surprise (∫ per-turn) ${r.cumulativeSurprise} ≈ the atmosphere departure the Horizon carries.`);
console.log('append-only Horizon log (moves + re-grounds):');
for (const e of h.log) console.log('  ', JSON.stringify(e));
console.log('\nThe Horizon is not a replay of the turns — it is the single ρ they folded into,');
console.log('departed from σ where it committed and dropped back to σ where the frame broke.');
