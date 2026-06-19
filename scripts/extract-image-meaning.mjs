// Extract meaning from something besides text.
//
// The spine is modality-universal: `parse` is the text adapter, `ingestImage`
// is the image one. Both emit the same nine operators onto the same append-only
// log, so the graph, the three reading levels and the consciousness fold all
// run unchanged. Here we hand the engine a vision model's detections of a
// street scene — no characters, no sentences — and read meaning back out.

import { ingestImage } from '../src/ingest/image.js';
import { consciousness, existenceSurface, structureSurface } from '../src/read/index.js';
import { readingAt } from '../src/read/index.js';

// A vision model's detections of a street scene: regions (objects) + relations
// (spatial / semantic links). This is the only "input" — there is no text.
const scene = {
  name: 'crosswalk.jpg', width: 1024, height: 768,
  regions: [
    { label: 'Traffic light', bbox: [80, 40, 60, 160], attr: 'red' },
    { label: 'Pedestrian',    bbox: [120, 300, 90, 260] },
    { label: 'Crosswalk',     bbox: [60, 520, 700, 120] },
    { label: 'Car',           bbox: [520, 280, 360, 200], attr: 'stopped' },
    { label: 'Dog',           bbox: [250, 460, 80, 90] },
    { label: 'Driver',        bbox: [640, 300, 70, 90] },
  ],
  // `from`/`to` index into the regions array above (0=light, 1=pedestrian,
  // 2=crosswalk, 3=car, 4=dog, 5=driver).
  relations: [
    { from: 1, to: 2, kind: 'con', via: 'crossing' },    // pedestrian — crossing   — crosswalk
    { from: 4, to: 1, kind: 'sig', via: 'watching' },    // dog        — watching   — pedestrian
    { from: 1, to: 4, kind: 'sig', via: 'leashed-to' },  // pedestrian — leashed-to — dog
    { from: 3, to: 1, kind: 'con', via: 'waiting-for' }, // car        — waiting-for— pedestrian
    { from: 0, to: 3, kind: 'sig', via: 'stopping' },    // light(red) — stopping   — car
  ],
};

const doc = ingestImage(scene);

console.log('=== INPUT: a vision model\'s detections (not text) ===');
console.log(`image: ${doc.docId}  (${doc.width}×${doc.height})  modality: ${doc.modality}`);
console.log(`${doc.regions.length} regions in reading order (top→bottom, left→right):`);
doc.regions.forEach(r => console.log(`  region ${r.unitIdx}: ${r.label}${r.attr ? ` [${r.attr}]` : ''}`));

// The full reading set = every region index (read the whole image).
const spans = doc.regions.map(r => ({ idx: r.unitIdx, text: r.label }));

console.log('\n=== LEVEL 1 · EXISTENCE (counting measure) ===');
console.log('what is present, in reading order:');
existenceSurface(doc, spans).forEach(s => console.log(`  [${s.idx}] ${s.text}`));

console.log('\n=== LEVEL 2 · STRUCTURE (the object graph) ===');
const struct = structureSurface(doc, spans.map(s => s.idx));
console.log('figures (objects, by mass):');
struct.figures.forEach(f => console.log(`  ${f.label}  (×${f.count})`));
console.log('relations (the arrows the layout admitted):');
struct.relations.forEach(r => console.log(`  ${r.src.label} --${r.via}--> ${r.tgt.label}  [${r.op}]`));
if (struct.defs.length) {
  console.log('properties:');
  struct.defs.forEach(d => console.log(`  ${d.label}: ${d.value}`));
}

console.log('\n=== LEVEL 3 · SIGNIFICANCE (predict the next object, be surprised) ===');
console.log('stepping the reading cursor down the image:');
for (let c = 0; c < doc.regions.length; c++) {
  const r = readingAt(doc, c);
  console.log(`  cursor ${c} → ${doc.regions[c].label.padEnd(14)} surprise ${r.surprise.toFixed(3)}` +
    (r.summary ? `  — ${r.summary}` : ''));
}

console.log('\n=== THE CONSCIOUSNESS FOLD (the meaning, in arrows) ===');
const peak = doc.regions
  .map(r => ({ c: r.unitIdx, s: readingAt(doc, r.unitIdx).surprise }))
  .sort((a, b) => b.s - a.s)[0];
const c = consciousness(doc, spans, peak.c);
console.log(`(significance read at the surprise peak, cursor ${peak.c})\n`);
console.log(c.text || '(no arrows)');

console.log('\n=== THE GRAPH (a fold of the log, rebuilt by replay) ===');
const g = doc.projectGraph();
console.log(`${g.entities.size} entities, ${g.edges.length} edges over ${doc.log.snapshot().length} log events.`);
console.log('every event the meaning was read from is in the append-only log; the graph is just its fold.');
