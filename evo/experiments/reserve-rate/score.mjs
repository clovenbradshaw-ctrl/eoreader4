#!/usr/bin/env node
// reserve-rate — BLIND SCORER. Reads the measurement (out.jsonl) and the held key
// (key.json) AFTER the fact. Reads the control FIRST (did the trivial explanation get
// caught), then the per-item split, then stability across the control. Every test is a
// sign / equality / ordering — no constant is tuned to make an item score a certain way.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const rows = readFileSync(join(HERE, 'out.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const key = JSON.parse(readFileSync(join(HERE, 'key.json'), 'utf8'));
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

const checks = [];
const note = (ok, label) => { checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`); return ok; };

// 5. VERIFY THE INSTRUMENT before reading the score.
console.log('# instrument');
note(rows.every((r) => r.organLive), 'every organ live (parser segmented / frequency organ emitted bins)');
note(rows.every((r) => r.constBayes != null && r.signalBayes != null && r.reserveAmp != null), 'every reserve channel computed (no nulls)');
note(rows.filter((r) => r.sense === 'text').every((r) => r.crosscheck === true), 'text Born reconstruction matches readingAt (const + signal)');
for (const p of key.pairs.newcomer) {
  const t = byId[p.turnover], s = byId[p.stable];
  note(t.reserveAmp > s.reserveAmp, `${p.sense}: reserveAmp high after turnover (${t.reserveAmp}) > low after stability (${s.reserveAmp})`);
  note(t.sumPrior === s.sumPrior && t.newBins === s.newBins, `${p.sense}: confound matched across the pair (sumPrior ${t.sumPrior}=${s.sumPrior}, newBins ${t.newBins}=${s.newBins})`);
}

// 6a. CONTROL FIRST — did the trivial explanation get caught.
console.log('# control (the constant reserve must be BLIND; surface must be blind)');
for (const p of key.pairs.newcomer) {
  const t = byId[p.turnover], s = byId[p.stable];
  note(t.constBayes === s.constBayes, `${p.sense}: constant reserve blind to turnover/stability (const ${t.constBayes} == ${s.constBayes})`);
  if (p.sense === 'text') note(t.surprisal === s.surprisal, `text: surface surprisal blind (${t.surprisal} == ${s.surprisal})`);
}

// 6b. MECHANISM — the per-item split, in both senses.
console.log('# mechanism (the signal reserve separates, turnover < stable)');
const mechBySense = {};
for (const p of key.pairs.newcomer) {
  const t = byId[p.turnover], s = byId[p.stable];
  const ok = t.signalBayes < s.signalBayes;
  mechBySense[p.sense] = ok;
  note(ok, `${p.sense}: signal(turnover)=${t.signalBayes} < signal(stable)=${s.signalBayes}`);
}

// 6c. NULL — on a confirmation probe the reserve must not separate.
console.log('# null (a confirmation probe: reserve does not separate)');
for (const cp of key.pairs.confirm) {
  const np = key.pairs.newcomer.find((x) => x.sense === cp.sense);
  const cΔ = Math.abs(byId[cp.turnover].signalBayes - byId[cp.stable].signalBayes);
  const nΔ = Math.abs(byId[np.turnover].signalBayes - byId[np.stable].signalBayes);
  note(cΔ < nΔ, `${cp.sense}: confirm separation ${cΔ.toFixed(2)} < newcomer separation ${nΔ.toFixed(2)}`);
}

// 7. OMNIMODAL — the interior gate.
console.log('# omnimodal (the interior gate: the change must help ≥ 2 senses)');
note(mechBySense.text && mechBySense.frequency, 'mechanism fires in BOTH text and frequency → interior, not a modality fact');

const passed = checks.every(Boolean);
console.log(`\n# VERDICT: ${passed ? 'CONFIRMED' : 'NOT CONFIRMED'} — ${checks.filter(Boolean).length}/${checks.length} checks`);
console.log(`# mechanism: ${key.mechanism}`);
process.exit(passed ? 0 : 1);
