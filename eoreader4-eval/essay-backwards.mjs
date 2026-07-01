// essay-backwards — the backwards analysis, made executable.
//
// docs/essay-backwards.md decomposed a compelling essay into the loop's operator
// alphabet and found that ~75% of an essay's atoms consume no fresh external span —
// they operate on prior atoms. The claim: the loop we had can only SPEND ground, so it
// stops with `ground-exhausted` ~3 atoms into essay-shaped work; the SELF register (the
// edge ops resolving against the accepted units) is what lets it keep developing.
//
// This harness proves the STRUCTURAL claim end to end. It runs the loop over the
// essay's own concept graph twice — register OFF (the failure it reproduces) and
// register ON (the fix) — with the echo model, and reports the realized move-trace,
// the stop reason, and the atom count for each. The prose is echo (spans read back
// verbatim); what is under test is the SHAPE of the walk, not the phrasing.
//
//   run:  node eoreader4-eval/essay-backwards.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { runContinuation } from '../src/longgen/index.js';
import { createModel } from '../src/model/interface.js';
import '../src/model/echo.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const trace = JSON.parse(readFileSync(join(HERE, 'essay-backwards.trace.json'), 'utf8'));

// The external ground: the NODE material the essay introduces — the concepts a node op
// (DEF/INS/CON/SIG) spends. Drawn from the trace's fresh-external atoms, ranked so the
// walk has a stable order to open on. This is the whole external pool; everything past
// it the essay must develop, not introduce.
const CONCEPT_GROUND = trace.atoms
  .filter(a => a.freshSpan === true)
  .map((a, i) => ({ idx: i, score: 1 - i * 0.12, text: a.gist }));

const EDGE = new Set(trace.summary.nodeMovesVsEdgeMoves.edge);

const movesOf = (res) => res.units.map(u => u.move);
const edgeCount = (moves) => moves.filter(m => EDGE.has(m)).length;

const report = (label, res) => {
  const moves = movesOf(res);
  console.log(`\n── ${label} ──`);
  console.log(`  atoms      : ${res.units.length}`);
  console.log(`  stop       : ${res.stop}`);
  console.log(`  move-trace : ${moves.join(' · ') || '(none)'}`);
  console.log(`  edge moves : ${edgeCount(moves)} / ${moves.length}  (self-operations, the essay's substance)`);
  return { atoms: res.units.length, stop: res.stop, edge: edgeCount(moves), total: moves.length };
};

const main = async () => {
  const model = createModel('echo');
  await model.load();

  console.log('essay-backwards — generate-then-read parity, structural harness');
  console.log(`concept ground: ${CONCEPT_GROUND.length} external nodes (the pool a node op spends)`);

  const target = trace.atoms.map(a => a.move);
  console.log(`\ntarget essay   : ${target.length} atoms, ${edgeCount(target)} edge moves ` +
    `(${Math.round(100 * edgeCount(target) / target.length)}% self-operation)`);
  console.log(`target trace   : ${target.join(' · ')}`);

  // Temperature reaches up the posterior so the walk draws the varied moves an essay
  // needs rather than argmax-repeating one op; the arc biases open→DEF, land→SYN.
  const common = { ground: CONCEPT_GROUND, model, arc: true, temperature: 1 };

  const off = await runContinuation({ ...common });                       // the failure
  const on = await runContinuation({ ...common, selfRegister: true });    // develops + lands
  // + the self-fold: strain now comes from the argument moving off its frame, not only
  // the floor's grounding verdict — so a REC (the turn) can fire on clean-binding prose.
  const onFold = await runContinuation({ ...common, selfRegister: true, semanticStrain: true });

  const rOff = report('register OFF  (spend-only — reproduces the early stop)', off);
  const rOn = report('register ON   (self register — develops and lands)', on);
  report('register ON + self-fold (semantic strain — the turn licensed, not yet timed)', onFold);
  const recFired = movesOf(onFold).includes('REC');
  console.log(`  REC (the turn) : ${recFired ? 'YES — a turn fired live' : 'not live yet — see below'}`);
  console.log(`    the self-fold that licenses REC on CLEAN-binding prose is unit-verified`);
  console.log(`    (tests/essay-backwards.test.js); it does not fire in THIS walk because the`);
  console.log(`    node ops front-load all ${CONCEPT_GROUND.length} concepts before the body develops, so nothing`);
  console.log(`    novel is left to strain the frame. Firing it live needs the interleave rhythm`);
  console.log(`    (introduce → develop → turn → introduce) — the fine-grain seam.`);

  // The macro-arc: a run of node moves (open), then self-op develops (the body), then
  // a SYN close (land). The essay's shape, read off the realized trace.
  const onMoves = movesOf(on);
  const lands = on.stop === 'arc-closed' && onMoves[onMoves.length - 1] === 'SYN';
  const develops = rOn.edge > rOff.edge;
  const opens = onMoves.slice(0, 1).every(m => !EDGE.has(m));
  const arc = opens && develops && lands;

  console.log('\n── verdict ──');
  const decoupled = rOn.atoms > rOff.atoms && !['ground-exhausted', 'saturated'].includes(on.stop);
  console.log(`  length decoupled from span exhaustion : ${decoupled ? 'YES' : 'no'} ` +
    `(off stopped '${off.stop}' at ${rOff.atoms}; on '${on.stop}' at ${rOn.atoms})`);
  console.log(`  edge moves realized (self-operation)  : ${develops ? 'YES' : 'no'} ` +
    `(off ${rOff.edge}, on ${rOn.edge})`);
  console.log(`  walks the macro-arc open→develop→land  : ${arc ? 'YES' : 'no'} ` +
    `(open on a node move; body self-ops; lands '${on.stop}')`);
  console.log(`\n  reading: the OFF run walks the NODES and quits when they run out — a summary.`);
  console.log(`  the ON run spends the pool to open, then operates on what it said, then closes.`);

  console.log('\n── seams still open (honest gaps, not hacks) ──');
  console.log(`  • the OPEN is node-led but CON-led, not DEF-led: the recurrence seed and the`);
  console.log(`    short self-log let CON out-draw the DEF the arc's open phase biases toward.`);
  console.log(`  • no REC in the body: the echo model binds every atom clean, so there is no`);
  console.log(`    strain for a restructure to turn on. REC appears with a model that drifts.`);
  console.log(`  • the FINE rhythm (which develop, when to turn) is the "read self back through`);
  console.log(`    the perceiver" seam (spec-generation.md) — this harness lands the MACRO arc.`);

  // A non-zero exit if the fix did not change the shape, so this can gate CI later.
  if (!(decoupled && develops)) {
    console.log('\n  NOTE: the self register did not change the walk shape here — investigate.');
    process.exitCode = 1;
  }
};

main().catch(err => { console.error(err); process.exitCode = 1; });
