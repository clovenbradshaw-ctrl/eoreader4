// SCORE (blind) — reads the per-item channels + the held key, control FIRST, then the
// per-item dissociation, per sense. Channel-agnostic: it scores whatever two channels the
// key names (here bayes_fixed = the live default, bayes_signal = RULES_REV). The measure
// produced the channels without ever seeing the key.
//
//   node scripts/novelty-reserve-score.mjs

import { readFileSync } from 'node:fs';

const out = readFileSync(new URL('../data/novelty-reserve-out.jsonl', import.meta.url), 'utf8')
  .trim().split('\n').map(JSON.parse);
const key = JSON.parse(readFileSync(new URL('../data/novelty-reserve-key.json', import.meta.url)));
const byId = Object.fromEntries(out.map(o => [o.id, o]));
const [CH_FIX, CH_SIG] = key.channels;          // ['bayes_fixed','bayes_signal']

const NEWCOMER_MARGIN = 0.3;    // signal: settled must beat churning by at least this (bits)
const FIXED_FLAT      = 0.05;   // fixed: |settled − churning| must stay under this (blind)
const CONTROL_FLAT    = 0.2;    // repeat control: |settled − churning| stays small under signal

const find = (sense, regime, final, role) => out.find(o => {
  const k = key.items[o.id];
  return o.sense === sense && k.regime === regime && k.final === final && (!role || k.role === role);
});
const ch = (o, c) => (o ? o[c] : null);
const pass = [], fail = [];
const check = (cond, msg) => (cond ? pass : fail).push(msg);

console.log(`CAPABILITY: ${key.capability}\n`);

for (const sense of ['text', 'tone']) {
  console.log(`── sense: ${sense} ${'─'.repeat(40)}`);

  // 1) CONTROL FIRST — repeat-final: the signal reserve must NOT open a wide gap.
  const sRep = find(sense, 'settled',  'repeat', 'control');
  const cRep = find(sense, 'churning', 'repeat', 'control');
  const repGapSig = Math.abs(ch(sRep, CH_SIG) - ch(cRep, CH_SIG));
  console.log(`  control (repeat-final): |Δ signal| = ${repGapSig.toFixed(3)}  ` +
              `(settled ${ch(sRep, CH_SIG)} vs churning ${ch(cRep, CH_SIG)})`);
  check(repGapSig < CONTROL_FLAT,
    `[${sense}] control stays flat under the signal reserve (|Δ|=${repGapSig.toFixed(3)} < ${CONTROL_FLAT})`);

  // 2) DISSOCIATION — newcomer-final, both lengths.
  for (const role of ['probe', 'probe-long']) {
    const s = find(sense, 'settled',  'newcomer', role);
    const c = find(sense, 'churning', 'newcomer', role);
    const sigGap = ch(s, CH_SIG) - ch(c, CH_SIG);
    const fixGap = Math.abs(ch(s, CH_FIX) - ch(c, CH_FIX));
    // instrument sanity: both finals are genuine newcomers (loud-surface matched)
    check(s.final_is_newcomer && c.final_is_newcomer,
      `[${sense}/${role}] both finals are genuine newcomers (surface-matched)`);
    console.log(`  ${role.padEnd(10)} signal: settled ${ch(s, CH_SIG)} − churning ${ch(c, CH_SIG)} = ${sigGap.toFixed(3)}` +
                `   |  fixed Δ = ${fixGap.toFixed(3)}`);
    check(sigGap > NEWCOMER_MARGIN,
      `[${sense}/${role}] signal reserve SEPARATES (settled − churning = ${sigGap.toFixed(3)} > ${NEWCOMER_MARGIN})`);
    check(fixGap < FIXED_FLAT,
      `[${sense}/${role}] fixed reserve is BLIND (|Δ| = ${fixGap.toFixed(3)} < ${FIXED_FLAT}) — the loud-surface control`);
  }

  // 3) MONOTONE in confirmation length — more confirmation, deeper settled surprise.
  const sShort = find(sense, 'settled', 'newcomer', 'probe');
  const sLong  = find(sense, 'settled', 'newcomer', 'probe-long');
  check(ch(sLong, CH_SIG) >= ch(sShort, CH_SIG),
    `[${sense}] longer confirmation deepens the effect (${ch(sLong, CH_SIG)} ≥ ${ch(sShort, CH_SIG)})`);
}

// 4) OMNIMODAL — text and tone agree (the mechanism reads only the membrane).
console.log(`── omnimodal ${'─'.repeat(43)}`);
let omni = true;
for (const id of ['i01','i02','i03','i04','i05','i06']) {
  const toneId = 'i' + String(Number(id.slice(1)) + 6).padStart(2, '0');
  const a = byId[id], b = byId[toneId];
  const same = a[CH_SIG] === b[CH_SIG] && a[CH_FIX] === b[CH_FIX];
  if (!same) omni = false;
  console.log(`  ${id}(text) ≟ ${toneId}(tone): signal ${a[CH_SIG]}/${b[CH_SIG]}  fixed ${a[CH_FIX]}/${b[CH_FIX]}  ${same ? 'OK' : 'DIFF'}`);
}
check(omni, `the dissociation is identical across two senses (text organ ≡ tone operator-log)`);

console.log(`\n${'='.repeat(60)}`);
for (const m of pass) console.log(`  PASS  ${m}`);
for (const m of fail) console.log(`  FAIL  ${m}`);
const verdict = fail.length === 0 ? 'CONFIRMED' : 'FAILED';
console.log(`\nVERDICT: ${verdict}  (${pass.length} pass, ${fail.length} fail)`);
process.exit(fail.length === 0 ? 0 : 1);
