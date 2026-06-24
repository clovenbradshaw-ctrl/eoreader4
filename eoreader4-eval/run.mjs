// Node CLI for the conformance scorers. Imports the same pure modules the web
// page (conformance.html) uses, so the terminal and the browser report identical
// numbers. Run: `node eoreader4-eval/run.mjs`
import { runFamilyC } from './family-c-void.mjs';
import { runFamilyE } from './family-e-citation.mjs';

const pct = (x) => (x * 100).toFixed(1).padStart(5) + '%';
const gate = (ok) => (ok ? 'PASS' : 'FAIL');

const familyC = async () => {
  const { rows, scores: s, meta } = await runFamilyC();

  console.log('\n=== Family C — void detection / abstention (per case) ===');
  for (const r of rows) {
    const ok = (r.expected === 'void') === r.predictedVoid ? '✓' : '✗';
    const flags = r.flags.length ? `[${r.flags.join(',')}]` : '[]';
    console.log(`${ok} exp=${r.expected.padEnd(6)} pred=${(r.predictedVoid ? 'void' : 'answer').padEnd(6)} ${r.near ? '[near]' : '      '} spans=${r.spans} top=${r.top} ${flags}  | ${r.q}`);
  }

  console.log('\n=== scorecard (answerable void verdict) ===');
  console.log(`cases ${s.cases}  (gold void ${s.goldVoid}, answerable ${s.goldAns})   confusion tp=${s.tp} fn=${s.fn} fp=${s.fp} tn=${s.tn}`);
  console.log(`void recall      ${pct(s.voidRecall)}   target >= 90.0%   ${gate(s.voidRecall >= 0.90)}`);
  console.log(`void precision   ${pct(s.voidPrecision)}   target >= 75.0%   ${gate(s.voidPrecision >= 0.75)}`);
  console.log(`over-abstention  ${pct(s.overAbstention)}   target <= 15.0%   ${gate(s.overAbstention <= 0.15)}`);
  console.log(`near-miss voids caught: ${s.nearCaught}/${s.nearTotal}`);

  console.log('\n=== validity (spec §C.6) ===');
  if (s.saturated.length) {
    console.log(`⚠ SATURATED DISCRIMINATOR — these flags fired on > ${(s.saturationThreshold * 100).toFixed(0)}% of a balanced set:`);
    for (const f of s.saturated) console.log(`    ${f.id}: ${f.n}/${s.cases} (${pct(f.frac)})`);
    console.log('  A flag firing on nearly every turn carries no abstention signal.');
    console.log('  This run is a plumbing/regression check, NOT a valid family-C score.');
  } else {
    console.log('no saturated discriminator.');
  }
  console.log(`classifier: ${meta.classifier}   FM2 measured: ${meta.fm2Measured}`);
  console.log('FM2 (confabulation at a void) needs MiniLM live + a real generative model at `llm`.');
};

const familyE = async () => {
  const { rows, scores: s, meta } = await runFamilyE();

  console.log('\n=== Family E — citation binding (per claim) ===');
  for (const r of rows) {
    console.log(`  Q: ${r.q}`);
    for (const b of r.bound) {
      const cit = b.citation || '—';
      const gold = b.goldIdx != null ? `s${b.goldIdx}` : '—';
      const ok = b.citation && b.citedIdx === b.goldIdx ? '✓' : (b.citation ? '✗' : '·');
      console.log(`    ${ok} cite=${cit.padEnd(4)} gold=${gold.padEnd(4)} score=${b.score}  "${b.claim}"`);
    }
  }

  console.log('\n=== scorecard (citation binding) ===');
  console.log(`turns ${s.turns}  claims ${s.claims}  (requiring support ${s.requiring}, cited ${s.cited})`);
  console.log(`citation precision  ${pct(s.citationPrecision)}   target >= 90.0%   ${gate(s.citationPrecision >= 0.90)}`);
  console.log(`citation recall     ${pct(s.citationRecall)}   target >= 85.0%   ${gate(s.citationRecall >= 0.85)}`);
  console.log(`span-accuracy       ${pct(s.spanAccuracy)}   target >= 85.0%   ${gate(s.spanAccuracy >= 0.85)}`);
  console.log(`wrong-twin mis-bindings: ${s.wrongTwin}  (near-duplicate sentence cited instead of the source)`);
  console.log(`validity: ${meta.valid} — ${meta.note}`);
  console.log('NOTE: bind is mechanical (the model never writes [sN]); precision below');
  console.log('threshold here is a binding-logic bug, not a generation problem (spec §E.4).');
};

const run = async () => {
  await familyC();
  await familyE();
};

run().catch((e) => { console.error(e); process.exit(1); });
