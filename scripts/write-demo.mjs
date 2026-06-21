// scripts/write-demo.mjs — the Enacted Writer spine, walked end to end.
//
// This is the three proven kernels (sanity.mjs, contract.mjs, cursor.mjs)
// generalized into the repo's real interfaces (src/write/, src/core/), run as one
// trace. Plain node, no deps:  node scripts/write-demo.mjs   (or  npm run write)
//
// It proves, in order:
//   1. the scheduler + the two gates (sanity)   — baseline violations → substrate 0,
//      two postures, the void `meaning` propagated up into a hedged thesis.
//   2. the integral at the cursor (cursor)      — γ-decayed, firm-only, open held out.
//   3. the membrane (contract)                  — a cell → surface prompt with NO hashId,
//      then the witness rebinds the surface back to the Sites.
//   4. the write loop                            — schedule → cursor → spurt → witness → fold.
//   5. the governed idle loop (§15)              — wake on arrival, surface a reafferent
//      candidate, quiesce; the candidate cannot witness (the §8 firewall).

import {
  createFold, schedule, judge, propagateResolution, overclaims,
  buildCursor, serialize, witness, writeLoop, stubModel,
  createIdleLoop, seededRng, openLedger,
} from '../src/write/index.js';
import { HASHID_RE, isVoid } from '../src/core/index.js';

const bar = (t) => console.log('\n' + '─'.repeat(76) + '\n' + t + '\n' + '─'.repeat(76));

// ── the Metamorphosis content graph (the running test doc) ───────────────────
// `meaning` is VOID on purpose: Kafka never fixes what the change MEANS.
const figures = [
  ['gregor', []], ['grete', ['ins_gregor']], ['father', []], ['family', []],
  ['transformation', ['ins_gregor']], ['job', ['ins_gregor']], ['apple', ['ins_father']],
];
const cells = [
  ...figures.map(([id, deps]) => ({ id: `ins_${id}`, op: 'INS', site: id, deps })),
  { id: 'ins_meaning', op: 'INS', site: 'meaning', res: 'void', deps: ['ins_transformation'] },
  { id: 'c_supports',  op: 'CON', args: ['gregor', 'family'],         edge: 'supports',  deps: ['ins_gregor', 'ins_family', 'ins_job'], appears: ['job'] },
  { id: 'c_transforms',op: 'CON', args: ['gregor', 'transformation'], edge: 'undergoes', deps: ['ins_gregor', 'ins_transformation'] },
  { id: 'c_tends',     op: 'CON', args: ['grete', 'gregor'],          edge: 'tends',     deps: ['ins_grete', 'ins_gregor'] },
  { id: 'c_apple',     op: 'CON', args: ['father', 'gregor'],         edge: 'wounds',    deps: ['ins_father', 'ins_gregor', 'ins_apple'], appears: ['apple'] },
  { id: 'c_invert',    op: 'CON', args: ['family', 'gregor'],         edge: 'inverts',   deps: ['ins_family', 'ins_gregor'] },
  { id: 's_inversion', op: 'SYN', deps: ['c_supports', 'c_transforms', 'c_invert'], promotes: 'inversion' },
  { id: 's_meaning',   op: 'SYN', deps: ['c_transforms', 'ins_meaning'],            promotes: 'metaphysical' },
  { id: 'top',         op: 'SYN', deps: ['s_inversion', 's_meaning'],               promotes: 'thesis' },
];

// 1. THE SCHEDULER + THE TWO GATES ───────────────────────────────────────────
bar('1 · THE SCHEDULER + THE TWO GATES  (sanity, generalized)');
const baseline = schedule(cells, { posture: 'narrative' }).slice().reverse();   // an unscaffolded order
const res = propagateResolution(cells);
for (const posture of ['narrative', 'thesis-first']) {
  const order = schedule(cells, { posture });
  const v = judge(order);
  console.log(`  substrate [${posture.padEnd(12)}]  violations: ${v.total}   order: ${order.map(c => c.id).join(' ')}`);
}
const bv = judge(baseline);
console.log(`  baseline  [shuffled    ]  violations: ${bv.total}   (arity ${bv.arity} + unsupported ${bv.unsupported}) + overclaim ${overclaims(baseline, res, { handedResolution: false })}`);
console.log(`\n  resolution propagation (void dominates):`);
for (const id of ['c_transforms', 's_inversion', 's_meaning', 'top'])
  console.log(`    ${id.padEnd(13)} → ${res.get(id).band}${isVoid(res.get(id)) ? '   ← must hedge' : ''}`);
console.log(`\n  The thesis hedges the metaphysical claim automatically — the void on \`meaning\` reached the top.`);

// 2. THE INTEGRAL AT THE CURSOR ──────────────────────────────────────────────
bar('2 · THE INTEGRAL AT THE CURSOR  (cursor — γ-decayed, firm-only)');
const ifold = createFold();
ifold.register('r#001', { head: 'Gregor Samsa', pron: { subj: 'he', obj: 'him' } });
ifold.appear('r#001');
[[3, "the household's sole provider", 'firm'], [5, 'transformed overnight into an insect', 'firm'],
 [8, 'now confined to the back room', 'firm'], [9, 'the embodiment of modern alienation', 'void']]
  .forEach(([t, attr, r]) => ifold.record('r#001', { t, op: 'DEF', attr, res: r }));
const integral = ifold.integralName('r#001', 11);
console.log(`  name : ${integral.name}`);
console.log(`  open : ${integral.open.join('; ')}   ← void; held out of the name, not asserted`);

// 3. THE MEMBRANE ────────────────────────────────────────────────────────────
bar('3 · THE MEMBRANE  (contract — surface only; no hashId leaks)');
const mfold = createFold();
mfold.register('r#001', { head: 'Gregor Samsa', pron: { subj: 'he', obj: 'him' } });
mfold.register('r#002', { head: "Gregor's sister Grete", pron: { subj: 'she', obj: 'her' } });
mfold.appear('r#001'); mfold.appear('r#002');
mfold.record('r#001', { t: 8, op: 'DEF', attr: 'now confined to the back room', res: 'firm' });
const cell = { id: 'c_tends', op: 'CON', args: ['r#002', 'r#001'], edge: 'tends', target: 'one plain past-tense sentence' };
const cursor = buildCursor(cell, mfold, [{ idx: 312, text: 'It was Grete who set down the bowl of milk and withdrew.' }], { resolution: 'firm' });
console.log(`  AUDIT : ${cursor.audit.line}`);
console.log(`  PROMPT (user): ${cursor.input.find(m => m.role === 'user').content.split('\n').join('  ⏎  ')}`);
console.log(`  membrane check — hashId in prompt? ${HASHID_RE.test(serialize(cursor.input)) ? 'LEAK ✗' : 'none ✓'}`);
const out = 'Grete carried food to him, a tenderness she would not sustain.';
const w = witness(out, cursor.expect, [{ idx: 312, text: 'It was Grete who set down the bowl of milk and withdrew.' }], mfold);
console.log(`  RENDER: ${out}`);
console.log(`  witness rebind → ${w.bound.join(', ')}   (cursor expected ${[...cursor.expect].join(', ')})   flagged: ${w.flagged.length ? w.flagged.join(',') : 'none ✓'}`);

// 4. THE WRITE LOOP ───────────────────────────────────────────────────────────
bar('4 · THE WRITE LOOP  (schedule → cursor → spurt → witness → fold)');
const wfold = createFold();
wfold.register('r#001', { head: 'Gregor Samsa', pron: { subj: 'he', obj: 'him' } });
wfold.register('r#002', { head: 'Grete', pron: { subj: 'she', obj: 'her' } });
const loopCells = [
  { id: 'r#001', op: 'INS', site: 'r#001' },
  { id: 'r#002', op: 'INS', site: 'r#002' },
  { id: 'c_tends', op: 'CON', args: ['r#002', 'r#001'], edge: 'tends', deps: ['r#001', 'r#002'],
    spans: [{ idx: 312, text: 'It was Grete who set down the bowl of milk and withdrew to the door.' }], target: 'one sentence' },
];
const result = await writeLoop(loopCells, { fold: wfold, model: stubModel(), posture: 'narrative' });
console.log(`  order : ${result.order.join(' → ')}`);
console.log(`  draft : ${result.draft}`);
console.log(`  frontier after: ${wfold.appeared().join(', ')}   retractions: ${result.retractions.length}`);
console.log(`  (the witness is live: the stub's generic framing prose isn't carried by the lone span,`);
console.log(`   so it is honestly vetoed — pay-the-retraction, §7d. A grounded render survives.)`);

// 5. THE GOVERNED IDLE LOOP ────────────────────────────────────────────────────
bar('5 · THE GOVERNED IDLE LOOP  (§15 — reafferent, firewalled, self-terminating)');
const dfold = createFold();
dfold.appear('r#7f3', { head: 'the LLC behind the surveillance MOU' });   // INS without DEF → an open void
console.log(`  Open: ${openLedger(dfold).map(e => `${e.rid} «${e.head}» [${e.band}]`).join('; ')}`);
let emitted = false;
const surf = ({ void: v, docs }) => {
  const bears = docs.some(d => d.bearsOn === v.rid);
  if (bears && !emitted) { emitted = true; return { rec: 0.9, bearsOn: 'A filing lists Bradshaw Holdings LLC at the MOU address.' }; }
  return { rec: 0.1 };
};
const idle = createIdleLoop({ fold: dfold, surf, medianBand: 0.5, rng: seededRng(1) });
console.log(`  state: ${idle.state}  ← a gate held shut is the suppression to justify`);
const arrival = idle.arrive({ bearsOn: 'r#7f3' });   // the world wakes it
const cand = arrival.candidates[0];
console.log(`  ↑ document arrives → surfing → ${arrival.passes} passes → ${idle.state} (quiesced on the median band)`);
console.log(`  candidate: «${cand.body}»`);
console.log(`  provenance: door=${cand.prov.door} (reafferent) · canGround=${idle.canGround(cand)}  ← the §8 firewall; only a human confirm grounds it`);

bar('DONE');
console.log('  The substrate reasoned; the stub only rendered. Swap stubModel() for');
console.log('  createModel("wllama") and nothing above the membrane changes (§5).');
