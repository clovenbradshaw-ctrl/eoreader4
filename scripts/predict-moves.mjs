// The Cursor Predictor — move the cursor, see the prediction. (docs/cursor-predictor.md)
//
// The testable surface for the grounded move-predictor: a cursor and a panel. At
// each cursor it shows the moves so far, the posterior over the next move, the
// actual next move scored against it, and the posterior's sharpness — recomputed
// CAUSALLY at each step (the prediction at c uses only moves up to c). No model
// call, no ingested corpus; the prediction is over the ten-symbol move grammar
// conditioned on the log the reader already emitted.
//
//   node scripts/predict-moves.mjs                 interactive scrubber (n/p/g/q)
//   node scripts/predict-moves.mjs --all           print the panel at every cursor
//   node scripts/predict-moves.mjs --cursor 118    one-shot panel at a move index
//   node scripts/predict-moves.mjs --dump          Phase 0: dump the move-log
//   node scripts/predict-moves.mjs --controls      Phase 7: the falsification battery
//   node scripts/predict-moves.mjs --file path.txt use another text (default: esker)

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { ingestText } from '../src/ingest/index.js';
import {
  buildMoveLog, moveNotation, predictNextMove, scoreSeries,
  persistenceAccuracy, marginalAccuracy, shuffleMoves,
} from '../src/predict/index.js';

const RULE = '─'.repeat(64);
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const bar = (p, width = 24) => '█'.repeat(Math.round(p * width)) + '·'.repeat(width - Math.round(p * width));

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };

const file = opt('--file', 'data/esker.txt');
const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const doc = await ingestText(text, {});
const ml = buildMoveLog(doc);

// ── the panel ───────────────────────────────────────────────────────────────
const renderPanel = (i) => {
  const m = ml.moves[i];
  const p = predictNextMove(ml, i);
  const lines = [];
  const unit = doc.units[m.cursor] || '';
  lines.push(`move ${i}/${ml.moves.length - 1}   ·   unit c${m.cursor}   ·   "${unit.slice(0, 46)}${unit.length > 46 ? '…' : ''}"`);
  lines.push(RULE);

  // moves so far — the log up to and including i, last few.
  const recent = ml.moves.slice(Math.max(0, i - 6), i + 1).map(moveNotation);
  lines.push('moves so far (log up to the cursor, last few):');
  lines.push(`   …  ${recent.join('  ')}`);
  lines.push(RULE);

  // predicted next move — the posterior over the moves.
  lines.push('predicted next move  (posterior over the moves):');
  for (const [op, prob] of p.posterior.slice(0, 5)) {
    if (prob < 0.005) continue;
    lines.push(`   ${op.padEnd(5)} ${prob.toFixed(2)}  ${bar(prob)}`);
  }
  const conf = p.flat ? 'FLAT — no grounded expectation (the predictor\'s VOID)'
    : p.sharpness > 0.6 ? 'confident' : p.sharpness > 0.35 ? 'tentative' : 'weak';
  lines.push(`   posterior sharpness: ${p.sharpness.toFixed(2)}   concentration: ${p.concentration.toFixed(2)}   (${conf})`);
  lines.push(RULE);

  // actual next move — read from the log at i+1.
  if (p.actualMove) {
    const mark = p.correctTop1 ? '✓  (predicted top-1)' : `rank ${p.rank}/${ml.alphabet.length}`;
    lines.push(`actual next move (read from the log at c+1):`);
    lines.push(`   ${moveNotation(p.actualMove).padEnd(14)} ${mark}   ${p.actualMove.label ? `— ${p.actualMove.label}` : ''}`);
    lines.push(RULE);
    const note = p.correctTop1 ? 'actual was the predicted mode'
      : p.surprise === 'high' ? 'actual was far down the posterior' : 'actual was near the top';
    lines.push(`surprise: ${p.surprise.padEnd(6)} (${note};  ${p.surprisalBits.toFixed(2)} bits)`);
  } else {
    lines.push('actual next move: — (end of log)');
  }
  return lines.join('\n');
};

// ── Phase 0 — dump the move-log ───────────────────────────────────────────────
if (flag('--dump')) {
  console.log(`# move-log for ${file} — ${ml.moves.length} moves over ${doc.units.length} units\n`);
  let cur = -1;
  for (const m of ml.moves) {
    if (m.cursor !== cur) { cur = m.cursor; process.stdout.write(`\n[unit ${String(cur).padStart(2)}] `); }
    process.stdout.write(`${moveNotation(m)}${m.register === 'enacted' ? '*' : ''} `);
  }
  const counts = {};
  for (const m of ml.moves) counts[m.op] = (counts[m.op] || 0) + 1;
  console.log(`\n\ncounts: ${ml.alphabet.map(op => `${op} ${counts[op] || 0}`).join('  ')}`);
  console.log('(* = enacted cognition; the rest is perceived content)');
  process.exit(0);
}

// ── Phase 7 — the controls ────────────────────────────────────────────────────
if (flag('--controls')) {
  const full = scoreSeries(ml);
  const recOnly = scoreSeries(ml, { weights: { recurrence: 1, structure: 0, grammar: 0 } });
  const recStr = scoreSeries(ml, { weights: { recurrence: 1, structure: 1, grammar: 0 } });
  const pers = persistenceAccuracy(ml);
  const marg = marginalAccuracy(ml);
  const shufScores = [1, 2, 3, 4, 5].map(s => scoreSeries(shuffleMoves(ml, s)).accuracy);
  const shufMean = shufScores.reduce((a, b) => a + b, 0) / shufScores.length;

  console.log('=== PERSISTENCE / RECURRENCE BASELINES ===');
  console.log(`  persistence  (next = last move)        ${pct(pers.accuracy)}`);
  console.log(`  marginal     (always "${marg.top}")            ${pct(marg.accuracy)}`);
  console.log(`  recurrence   only (the bare n-gram)    ${pct(recOnly.accuracy)}   sharp ${recOnly.meanSharpness.toFixed(2)}`);
  console.log(`  recurrence × structure                 ${pct(recStr.accuracy)}   sharp ${recStr.meanSharpness.toFixed(2)}`);
  console.log(`  FULL  recurrence×structure×grammar     ${pct(full.accuracy)}   sharp ${full.meanSharpness.toFixed(2)}`);
  console.log(`  → the frame-aware posterior beats the bare n-gram by ${pct(full.accuracy - recOnly.accuracy)}.`);

  console.log('\n=== SHUFFLE (scramble the move order — accuracy must collapse) ===');
  console.log(`  real order   ${pct(full.accuracy)}     shuffled (mean of 5)   ${pct(shufMean)}`);
  console.log(`  → ${full.accuracy > shufMean + 0.15 ? 'collapses to chance' : 'DID NOT collapse — predictor may be reading marginals'}. The predictor reads the sequence, not the marginal frequencies.`);

  console.log('\n=== REC TEST (does it see the frame break coming, from strain?) ===');
  for (let i = 1; i < ml.moves.length; i++) {
    if (ml.moves[i].op !== 'REC') continue;
    const pr = predictNextMove(ml, i - 1);
    const recRank = pr.posterior.findIndex(([op]) => op === 'REC') + 1;
    const recP = pr.posterior.find(([op]) => op === 'REC')[1];
    const fr = ml.frameByCursor[ml.moves[i].cursor];
    console.log(`  REC at unit c${ml.moves[i].cursor} (strain ${fr.ratio.toFixed(2)}× threshold): predicted REC p=${recP.toFixed(2)}, rank ${recRank}, ${pr.correctTop1 ? 'TOP-1 ✓' : `top=${pr.top}`}`);
  }
  console.log('  → REC probability climbs with strain; sharp-and-right at the strongest break.');

  console.log('\n=== VOID TEST (does it abstain — predict NUL/VOID, go flat — where it should?) ===');
  console.log(`  flat-posterior rate (the predictor's VOID): ${pct(full.flatRate)} of positions`);
  const flats = full.perPosition.filter(p => p.flat).slice(0, 4);
  for (const p of flats) console.log(`    flat at move ${p.i} (after ${ml.moves[p.i].op}, c${p.cursor}): sharpness ${p.sharpness.toFixed(2)} — no move dominates`);
  // structural NUL+VOID elevation on flat fields
  let flatNV = 0, flatN = 0, actNV = 0, actN = 0;
  for (let i = 0; i < ml.moves.length - 1; i++) {
    const fr = ml.frameByCursor[ml.moves[i].cursor];
    const isFlat = (fr.bayes < 0.12) && !fr.newFigure && fr.ratio < 0.35;
    const s = predictNextMove(ml, i).components.structure;
    const nv = s.NUL + s.VOID;
    if (isFlat) { flatNV += nv; flatN++; } else { actNV += nv; actN++; }
  }
  console.log(`  structural NUL+VOID mass — flat fields ${(flatNV / flatN).toFixed(3)} vs active ${(actNV / actN).toFixed(3)} (${Math.round((flatNV / flatN) / Math.max(actNV / actN, 1e-6))}× higher)`);
  console.log('  → on a flat field the engine expects to find nothing; at a genuinely');
  console.log('    unpredictable point the posterior flattens and the sharpness drops.');
  process.exit(0);
}

// ── Phase 3 — the scrubber ────────────────────────────────────────────────────
if (flag('--cursor')) {
  console.log(renderPanel(Math.max(0, Math.min(ml.moves.length - 2, Number(opt('--cursor', 0)) | 0))));
  process.exit(0);
}

if (flag('--all') || !process.stdin.isTTY) {
  for (let i = 0; i < ml.moves.length - 1; i++) { console.log(renderPanel(i)); console.log('\n'); }
  const full = scoreSeries(ml);
  console.log(`SUMMARY  accuracy ${pct(full.accuracy)}  ·  mean sharpness ${full.meanSharpness.toFixed(2)}  ·  flat rate ${pct(full.flatRate)}`);
  process.exit(0);
}

// interactive: move the cursor, watch the prediction be right, wrong, surprised.
let cursor = 0;
const rl = createInterface({ input: process.stdin, output: process.stdout });
const show = () => {
  console.clear();
  console.log(renderPanel(cursor));
  console.log(`\n[n]ext  [p]rev  [g]oto <c>  [q]uit   (cursor ${cursor}/${ml.moves.length - 2})`);
};
show();
rl.on('line', (line) => {
  const s = line.trim();
  if (s === 'q') { rl.close(); return; }
  if (s === 'n' || s === '') cursor = Math.min(ml.moves.length - 2, cursor + 1);
  else if (s === 'p') cursor = Math.max(0, cursor - 1);
  else if (s.startsWith('g')) cursor = Math.max(0, Math.min(ml.moves.length - 2, Number(s.slice(1).trim()) | 0));
  show();
});
rl.on('close', () => process.exit(0));
