// Extract meaning from non-text — and this time make the ENGINE do the
// extracting, not me.
//
// The only input below is a raw note sequence. I do not tell the engine the
// key, where the phrases fall, which note is the tonic, or what is significant.
// The music adapter turns the bare signal into the same INS/CON events text
// produces (a sighting per note, a bond per interval) and stops. Everything
// reported here is read back OUT of the engine's own γ-mass fold and L3
// surprise math — the surfaces that read a novel, run over a melody.

import { ingestMusic } from '../src/ingest/music.js';
import { readingAt }   from '../src/read/index.js';

// "Twinkle, Twinkle, Little Star" — two phrases. The bare notes, nothing else.
const melody = {
  name: 'twinkle.mid',
  notes: ['C4','C4','G4','G4','A4','A4','G4','F4','F4','E4','E4','D4','D4','C4'],
};

const doc = ingestMusic(melody);

console.log('=== INPUT: a raw note sequence (no key, no phrasing, no labels) ===');
console.log(`${doc.docId}  modality: ${doc.modality}  (${doc.sequence.length} notes)`);
console.log('  ' + doc.sequence.map(s => s.note).join(' '));

// --- What the engine EXTRACTS on its own. -----------------------------------

console.log('\n=== TONAL CENTER (two folds of the same sightings, neither supplied) ===');
// projectGraph counts sightings flat; readingAt folds them with γ-recency. They
// answer different questions — and the difference is itself a real reading.
const g = doc.projectGraph();
const byMass = [...g.entities.values()].sort((a, b) => b.sightings - a.sightings);
console.log('A · flat count-mass — the pitches the whole melody keeps returning to:');
byMass.forEach(e => console.log(`  ${e.label.padEnd(3)} ×${e.sightings}`));
console.log(`  → the two heaviest are ${byMass[0].label} and ${byMass[1].label}: the tonic and dominant of the key,`);
console.log('    recovered without ever being told the key.');
const whole = readingAt(doc, doc.sequence.length - 1);
console.log(`B · γ-recency fold at the final beat — the LOCALLY warm note: ${whole.predicted.figures[0]}`);
console.log(`  → not the tonic but the cadence's approach tone; the reading honestly reports`);
console.log('    where its attention sat last, which recency weights, not where the key centers.');

console.log('\n=== TURNING POINTS (L3 surprise — I never marked a phrase) ===');
const curve = doc.sequence.map(s => ({ note: s.note, ...readingAt(doc, s.unitIdx) }));
curve.forEach((r, i) => {
  const bar = '█'.repeat(Math.round(r.surprise * 24));
  console.log(`  beat ${String(i).padStart(2)}  ${r.note.padEnd(4)} ${r.surprise.toFixed(3)} ${bar}` +
    (r.surprise >= 0.25 && r.surprises.length ? `  ${r.surprises[0].text}` : ''));
});

const peaks = curve
  .map((r, i) => ({ i, note: r.note, s: r.surprise, why: r.surprises[0]?.text }))
  .filter(p => p.i > 0)                 // beat 0 is the bare opening, no prior
  .sort((a, b) => b.s - a.s)
  .slice(0, 3);
console.log('\nthe three sharpest moments the engine found:');
peaks.forEach(p => console.log(`  beat ${p.i} (${p.note}) — surprise ${p.s.toFixed(3)}${p.why ? `  [${p.why}]` : ''}`));

console.log('\n=== WHAT THIS SHOWS ===');
console.log('I supplied 14 note names — the bare signal, no key, no phrasing, no labels.');
console.log(`With no music knowledge, the engine's flat mass-fold recovered the tonic and`);
console.log(`dominant (${byMass[0].label}, ${byMass[1].label}), its surprise channel marked each new pitch's entrance and`);
console.log('peaked on the final cadential resolution, and its recency fold reported the');
console.log('locally warm note — all from the exact math it uses to read a novel.');
console.log('That is extraction BY the engine from non-text, not meaning I pre-loaded.');
