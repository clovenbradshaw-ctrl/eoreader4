// scripts/belief-demo.mjs — the nested holder root, walked end to end. (SPEC §20)
//
// The belief.mjs kernel generalized into the repo's interfaces (src/write/folds.js,
// src/core/holder.js), run as one trace. Plain node, no deps:
//   node scripts/belief-demo.mjs   (or  npm run belief)
//
// It proves Update 4's one line: the system never holds another's belief — it holds
// its belief ABOUT another's, and the outer "instrument · models( … )" is the
// provenance that keeps the inference from becoming a fact (§20g). In order:
//   1. first-order false belief   — a holder's stale fold after a change it missed (§3)
//   2. the nested instrument root — every other-holder belief is reafferent, cannot
//      anchor; the §9 honesty rule DERIVED, not asserted (§20a/§20f)
//   3. the self-fold exception    — the instrument's own fold, one root, may anchor (§20c)
//   4. second-order false belief  — instrument · models( A · models( B · … ) ) (§20b)
//   5. dramatic irony / suspense  — belief divergence across folds (§9)

import { createFolds } from '../src/write/folds.js';
import { INSTRUMENT, READER, STATUS, beliefNotation, isModeled, canAnchor, beliefValue } from '../src/core/index.js';

const bar = (t) => console.log('\n' + '─'.repeat(76) + '\n' + t + '\n' + '─'.repeat(76));
const show = (label, b) =>
  console.log(`  ${label.padEnd(22)} ${beliefNotation(b)}` +
    `   [${isModeled(b) ? 'modeled' : 'self'} · ${b.status} · ${canAnchor(b) ? 'CAN anchor' : 'cannot witness'}]`);

// The Metamorphosis scene, hand-labelled with its witnessing routing (§9, §17.6):
//   t1  Gregor is in the room — Grete and the mother both present.
//   t2  Gregor moves to the hall — the mother present, GRETE absent (she has left).
const F = createFolds();
F.record({ key: 'gregor.loc', value: 'room', t: 1, witnesses: ['grete', 'mother'] });
F.record({ key: 'gregor.loc', value: 'hall', t: 2, witnesses: ['mother'], absent: ['grete'] });

bar('1 · FIRST-ORDER FALSE BELIEF  (§3)');
console.log('  Grete left before the move; the mother stayed. The instrument read it all.');
show('beliefOf(grete)', F.beliefOf('grete', 'gregor.loc'));
show('beliefOf(mother)', F.beliefOf('mother', 'gregor.loc'));
show('truth (instrument)', F.truth('gregor.loc'));

bar('2 · THE NESTED INSTRUMENT ROOT  (§20a, §20f)');
console.log('  Every belief ABOUT another holder is the instrument\'s MODEL of it:');
console.log('  authored by the instrument ⇒ reafferent ⇒ it cannot witness the mind.');
show('beliefOf(grete)', F.beliefOf('grete', 'gregor.loc'));
show('beliefOf(mother)', F.beliefOf('mother', 'gregor.loc'));

bar('3 · THE SELF-FOLD EXCEPTION  (§20c)');
console.log('  The one fold held first-class — one root, no outer model. It read the');
console.log('  doc (exafferent), so it — and only it — may anchor.');
show('truth (instrument)', F.truth('gregor.loc'));

bar('4 · SECOND-ORDER FALSE BELIEF  (§3, §20b)');
console.log('  The mother saw Grete leave, so she knows Grete still thinks "room".');
console.log('  Three roots, the outer one always the instrument:');
show("mother·models(grete)", F.modelOf('mother', 'grete', 'gregor.loc'));

bar('5 · DRAMATIC IRONY / SUSPENSE  (§9)');
F.record({ key: 'gregor.isInsect', value: true, t: 0, witnesses: [READER] });          // reader told, Grete not
F.record({ key: 'grete.plan', value: 'abandon-him', t: 3, witnesses: ['grete'], absent: [READER] }); // Grete forms it, reader not shown
const irony = F.divergence('gregor.isInsect', { reader: READER, character: 'grete' });
const suspense = F.divergence('grete.plan', { reader: READER, character: 'grete' });
console.log(`  gregor.isInsect → reader=${irony.reader}  grete=${irony.character}   ⇒  ${irony.kind.toUpperCase()}`);
console.log(`  grete.plan      → reader=${suspense.reader}  grete=${suspense.character}   ⇒  ${suspense.kind.toUpperCase()}`);

bar('the one line (§20g)');
console.log('  The system never holds another\'s belief. It holds its belief about');
console.log('  another\'s belief, and the outer "its belief about" is the provenance');
console.log('  that keeps the inference from becoming a fact — for Grete as for an');
console.log('  election, a market, or a quantum observer (§20d).\n');
