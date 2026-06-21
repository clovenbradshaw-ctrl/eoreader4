// Metamorphosis Battery — Test 7 (the decisive controls), measurement-first.
// "When the structure is destroyed, the engine's quantities must collapse, or they were
// never reading structure." (docs/metamorphosis-battery.md §7). No gold marks needed:
// SHUFFLE compares ordered vs scrambled sentence order; LULL feeds flat text. The engine
// must read ORDER, not which sentences are present. Run: node scripts/battery-controls.mjs
import { readFileSync } from 'node:fs';
import { parseText } from '../src/reader/parse/index.js';
import { readingAt } from '../src/reader/index.js';
import { enactedReadingTo } from '../src/enact/index.js';

// seeded PRNG so a future test is deterministic (not flaky)
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (arr, rnd) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const metrics = (doc) => {
  const units = doc.units || doc.sentences || [];
  const S = units.length;
  const sur = [];
  for (let c = 0; c < S; c++) sur.push(readingAt(doc, c).bayes);
  const mean = sur.reduce((s, v) => s + v, 0) / S;
  const variance = sur.reduce((s, v) => s + (v - mean) ** 2, 0) / S;
  let num = 0, den = 0;
  for (let i = 0; i < S; i++) { den += (sur[i] - mean) ** 2; if (i > 0) num += (sur[i] - mean) * (sur[i - 1] - mean); }
  const autocorr = den > 0 ? num / den : 0;

  const r = enactedReadingTo(doc, S - 1);
  const strains = (r.recs || []).map(x => x.strainSum || 0);
  let impulse = 0, accum = 0;
  for (const e of r.events) if (e.op === 'REC') { if (e.trigger === 'impulse') impulse++; else if (e.trigger === 'accumulation') accum++; }
  return {
    S,
    recsProp: r.stats.proposition?.recs || 0,
    recsDoc:  r.stats.document?.recs || 0,
    peakStrain: strains.length ? Math.max(...strains) : 0,
    totalStrain: strains.reduce((s, v) => s + v, 0),
    surVar: variance, autocorr, impulse, accum,
  };
};

const fmt = (m) => `recs(prop/doc)=${(+m.recsProp).toFixed(1)}/${(+m.recsDoc).toFixed(1)}  peakStrain=${(+m.peakStrain).toFixed(2)}  totalStrain=${(+m.totalStrain).toFixed(2)}  surVar=${(+m.surVar).toFixed(4)}  autocorr=${(+m.autocorr).toFixed(3)}  impulse/accum=${(+m.impulse).toFixed(1)}/${(+m.accum).toFixed(1)}`;

const analyze = (path) => {
  const docO = parseText(readFileSync(path, 'utf8'), { docId: 'o' });
  const sents = docO.sentences || docO.units;
  const o = metrics(docO);
  console.log(`\n=== ${path} (${o.S} sentences) ===`);
  console.log('ORDERED      ', fmt(o));

  const K = 30, acc = {}, exceed = {};
  for (let k = 0; k < K; k++) {
    const m = metrics(parseText(shuffle(sents, mulberry32(1000 + k)).join(' '), { docId: 's' + k }));
    for (const key of Object.keys(m)) {
      acc[key] = (acc[key] || 0) + m[key];
      if (o[key] > m[key]) exceed[key] = (exceed[key] || 0) + 1;
    }
  }
  const sh = {}; for (const key of Object.keys(acc)) sh[key] = acc[key] / K;
  console.log(`SHUFFLED(${K})`, fmt(sh));
  console.log(`  ordered exceeds shuffled in: peakStrain ${exceed.peakStrain || 0}/${K}, totalStrain ${exceed.totalStrain || 0}/${K}, surVar ${exceed.surVar || 0}/${K}, recsProp ${exceed.recsProp || 0}/${K}`);
};

analyze('data/metamorphosis.txt');
analyze('data/esker.txt');

// LULL: a single figure, no development — the engine must find little where there is little.
const lull = parseText(Array.from({ length: 24 }, () => 'Gregor lay still in the dim quiet room.').join(' '), { docId: 'lull' });
console.log('\n=== LULL (one figure, repeated, no development) ===');
console.log('LULL         ', fmt(metrics(lull)));
