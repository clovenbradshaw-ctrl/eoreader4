// cycle-0001 — SCORE (blind). Reads the held key and the read-only measurement, and scores
// in the methodology's order: the CONTROL first (did the trivial explanation get caught),
// then the per-item split (the result is a split, not an aggregate), then stability.
//
// The scorer is channel-agnostic: it reads the per-item channels the measure emitted and the
// control, and compares them to the key's predictions. It never recomputes surprise itself.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { measure } from './measure.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(here, 'key.json'), 'utf8'));
const out = measure();
const byId = (rows, id) => rows.find(r => r.item === id);

const pass = (b) => (b ? 'PASS' : 'FAIL');
let ok = true;
const check = (label, cond) => { ok = ok && cond; console.log(`  [${pass(cond)}] ${label}`); };

console.log(`cycle ${key.cycle}\nclaim: ${key.claim}\n`);

// 1) CONTROL FIRST — did the loud surface win? It must not.
console.log('CONTROL (read first) — the loud surface must not win:');
const Bon = byId(out.on, 'B'), Con = byId(out.on, 'C');
check('the quiet newcomer (B) dominates the loud confirmation (C)',
  Bon.text.surprisalBits > Con.text.surprisalBits + 3);
check('the loud confirmation (C) is itself low — surface presence is not significance',
  Con.text.surprisalBits < 1);

// 2) THE GAP — flag off, the constant reserve is blind (the per-item identity).
console.log('\nGAP (flag off) — the constant reserve cannot tell the contexts apart:');
const Aoff = byId(out.off, 'A'), Boff = byId(out.off, 'B');
check('A.surprisal == B.surprisal (matched mass → identical; the blindness)',
  Aoff.text.surprisalBits === Boff.text.surprisalBits);

// 3) THE DISSOCIATION — flag on, the per-item split (not the aggregate).
console.log('\nDISSOCIATION (flag on) — the per-item split:');
const Aon = byId(out.on, 'A');
check('B > A by a clear margin (newcomer shocks the settled reader, not the churning one)',
  Bon.text.surprisalBits > Aon.text.surprisalBits + 2);

// 4) OMNIMODAL — the second sense, same recipe, the two-way move.
console.log('\nOMNIMODAL (flag on vs off) — the n-gram learner moves the same way:');
const AonS = byId(out.on, 'A').seq.pNovel, AoffS = byId(out.off, 'A').seq.pNovel;
const BonS = byId(out.on, 'B').seq.pNovel, BoffS = byId(out.off, 'B').seq.pNovel;
check(`churn reserve rises (${AonS} > ${AoffS}) — stays open to newcomers`, AonS > AoffS);
check(`settled reserve falls (${BonS} < ${BoffS}) — settles`, BonS < BoffS);

console.log(`\nVERDICT: ${ok ? 'CONFIRMED — capability holds with mechanism + control + second sense' : 'NOT CONFIRMED'}`);
console.log(`key's recorded verdict: ${key.verdict}`);
process.exit(ok ? 0 : 1);
