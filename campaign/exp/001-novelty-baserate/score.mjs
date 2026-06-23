// BLIND scorer for exp/001-novelty-baserate. Reads the measure's per-item channels and the
// held key. Reads the CONTROL first (did the cheap surface explanation get caught), then the
// per-item split, then stability across modalities. Exit 0 = capability confirmed, 1 = not.
//
// The core measure is Δ = live_bayesBits − signal_bayesBits: the surprise the DERIVED reserve
// absorbed at the newcomer. Δ is read WITHIN an item, so priorProp, the deposit, the bonds and
// γ are all identical between the two readings — only the reserve amplitude differs. Δ therefore
// isolates the reserve cleanly, free of the modality's structural confounds (in music the cursor
// deposit carries a CON bond whose shape differs across melodies; an absolute live-vs-live
// comparison would conflate that with the reserve, Δ does not).
//
// Thresholds are the experiment's DECISION rule (not the engine's predictive path).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runMeasure } from './measure.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(here, 'key.json'), 'utf8'));

const MIN_GAP = 0.10;   // a real dissociation in Δ clears this
const NEAR    = 0.06;   // "≈" tolerance (ctrl ~ low)
const FLAT    = 0.03;   // structurally-matched live blindness (text)

const rows = runMeasure();
const by = {};   // modality → condition → row (+ Δ)
for (const r of rows) {
  const k = key.items[r.item];
  r.delta = Math.round((r.live_bayesBits - r.signal_bayesBits) * 1000) / 1000;   // reserve effect
  r.liveSpread = r.live_bayesBits;
  (by[k.modality] ||= {})[k.condition] = r;
}

let ok = true;
const line = (pass, msg) => { console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${msg}`); if (!pass) ok = false; };
const senses = Object.keys(by);

console.log('exp 001-novelty-baserate — does the reserve track the recent novelty rate?');
console.log('Δ = live − signal = surprise the derived reserve absorbed at the newcomer (within-item, confound-free).\n');

// 1) CONTROL FIRST. A large cast / wide pitch-set is the loud surface signal, with total mass
//    matched. If the reserve effect Δ tracked that surface signal, Δ(ctrl) would sit near
//    Δ(high). It must instead sit near Δ(low): the reserve tracks the RECENT rate, not cast/mass.
console.log('control (read first) — cheap surface signal (cast size / mass) must be caught:');
for (const mod of senses) {
  const { high, low, ctrl } = by[mod];
  line(Math.abs(ctrl.delta - low.delta) <= NEAR && (high.delta - ctrl.delta) >= MIN_GAP,
    `${mod}: Δ(ctrl)≈Δ(low) and Δ(ctrl)≪Δ(high)  (Δ high=${high.delta} low=${low.delta} ctrl=${ctrl.delta}) — large cast does not move the reserve`);
  if (mod === 'text')
    line(Math.abs(high.massAtCursor - low.massAtCursor) < 1e-9 && Math.abs(ctrl.massAtCursor - low.massAtCursor) < 1e-9,
      `${mod}: total mass identical across conditions (${high.massAtCursor}) — mass cannot explain Δ`);
}

// 2) THE GAP — the constant reserve is (near-)blind to the recent novelty rate. The
//    novelty-rate sensitivity high−low is far smaller under the live reader than the signal
//    reader; in the structurally-matched text sense the live reader is exactly flat.
console.log('\ngap (the constant reserve) — blind to the recent novelty rate:');
for (const mod of senses) {
  const { high, low } = by[mod];
  const liveSens = Math.abs(high.live_bayesBits - low.live_bayesBits);
  const sigSens  = Math.abs(high.signal_bayesBits - low.signal_bayesBits);
  line(liveSens + 1e-9 < sigSens && (mod !== 'text' || liveSens <= FLAT),
    `${mod}: novelty-rate sensitivity is ${liveSens.toFixed(2)} live vs ${sigSens.toFixed(2)} signal — the constant reserve barely moves`);
}

// 3) THE FIX — the per-item split. The derived reserve absorbs MORE surprise exactly where
//    newcomers have been frequent: Δ(high) ≫ Δ(low). The instrument confirms the stimulus.
console.log('\nfix (the derived reserve) — the per-item split:');
for (const mod of senses) {
  const { high, low } = by[mod];
  line((high.delta - low.delta) >= MIN_GAP,
    `${mod}: Δ(high) ≫ Δ(low)  (${high.delta} vs ${low.delta}) — same newcomer, more reserve after a burst`);
  line(high.noveltyAmp > low.noveltyAmp,
    `${mod}: instrument — noveltyAmp(high) > noveltyAmp(low)  (${high.noveltyAmp} > ${low.noveltyAmp})`);
}

// 4) OMNIMODAL — the same interior change helping two different organs.
console.log('\nomnimodal — the interior change helps a second sense:');
line(senses.length >= 2 && senses.includes('text') && senses.includes('music'),
  `two organs exercised: ${senses.join(', ')}`);

console.log(`\n${ok ? 'CONFIRMED' : 'NOT CONFIRMED'} — the reserve tracks the recent novelty rate, controlled for mass and cast size, in ${senses.length} senses.`);
process.exit(ok ? 0 : 1);
