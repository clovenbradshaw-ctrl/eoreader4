// Appearance time vs connection cursor — the measurement.
//
// The invariant (the two clocks):
//   APPEARANCE TIME (valid time)   — when the referent first appeared in the text.
//                                    The INS-by-appearance, dated to the EARLIEST
//                                    birth in the merge class.
//   CONNECTION CURSOR (txn time)   — when WE discovered the binding (a SYN merge).
//                                    Always ≥ appearance time, and it must NOT move
//                                    appearance: "not yet connected" ≠ "never INS'd".
//
// "Make sure this is actually embodied." This script measures, and is written to
// come back NEGATIVE where a read dates appearance to the id it happened to connect
// to instead of the earliest birth. The forced later-root case is the adversary:
// a merge whose union-find ROOT appears LATER than the earliest member — the case
// the surname alias never produces (it roots on the earlier id) but the naming
// scene ("his sister" → Grete) does.
//
// Run: node scripts/appearance-time.mjs   (exit 1 if the invariant leaks)

import { createLog } from '../src/core/log.js';
import { projectGraph } from '../src/core/project.js';
import { parseText } from '../src/perceiver/parse/pipeline.js';
import { localeOf, conversationCast } from '../src/converse/reference.js';
import { readingAt } from '../src/perceiver/reading.js';

let leaks = 0;
const verdict = (name, ok, detail) => {
  console.log(`  ${ok ? 'PASS' : 'LEAK'}  ${name}${detail ? '  —  ' + detail : ''}`);
  if (!ok) leaks++;
};

// A forced LATER-ROOT merge: the role referent ("his sister") appears EARLY (s0);
// the proper name (Grete) appears LATE (s10); the connection folds the role into
// the NAME, so the union-find root is the later-appearing id — exactly the naming
// scene's `SYN merge from: roleRef, to: m.name` (pipeline.js:397).
const laterRootLog = () => {
  const log = createLog({ docId: 'later-root' });
  log.append({ op: 'INS', id: 'sister', label: 'his sister', sentIdx: 0 });   // earliest birth
  log.append({ op: 'INS', id: 'grete',  label: 'Grete',      sentIdx: 10 });  // the late name
  log.append({ op: 'SYN', kind: 'merge', from: 'sister', to: 'grete' });      // root = grete (later)
  return log;
};

console.log('\n# Appearance time vs connection cursor\n');

// ── A · THE LAW — the projection back-dates appearance to the earliest birth ──
// firstSeen of the merged class must be the EARLIEST member's seq, regardless of
// which id the merge rooted on. This is where the invariant is meant to live.
console.log('A · the law (core/project.js): firstSeen = earliest birth, not the connected root');
{
  const g = projectGraph(laterRootLog());
  const root = g.representative('sister');
  const ent  = g.entities.get(root);
  verdict('root canonicalises both aliases', g.representative('grete') === root, `root=${root}`);
  verdict('firstSeen back-dates to the earliest INS (seq 0), though the root (grete) is later',
    ent?.firstSeen === 0, `firstSeen=${ent?.firstSeen}`);
}

// ── B · localeOf — the referent's locus dates to its earliest appearance ──────
// With no incident edge, localeOf falls back to "first line that instantiated the
// referent." Reading the connected id alone returns the LATE name line (10); the
// appearance-class returns the EARLIEST line (0).
console.log('\nB · localeOf (converse/reference.js): the locus is the earliest appearance line');
{
  const log = laterRootLog();
  const doc = { log, admission: { labelOf: (id) => ({ grete: 'Grete', sister: 'his sister' }[id] || id) } };
  const root = projectGraph(log).representative('sister');
  const loc  = localeOf(doc, root);
  verdict('localeOf returns the earliest appearance (0), not the connection line (10)',
    loc === 0, `localeOf=${loc}`);
}

// ── C · conversationCast — a renamed referent is ONE figure, not two ──────────
// Two surface forms of one person, both before the question cursor. Reading raw
// ids splits the warmth across two figures (and ranks the later mention hotter);
// pooling on the appearance-class warms the one referent.
console.log('\nC · conversationCast (converse/reference.js): a rename is one warm figure, not two');
{
  const cast = conversationCast(
    [{ role: 'user', content: 'Gregor Samsa woke. Samsa dressed slowly.' }],
    'Was he late?',
  );
  const labels = cast.map(c => c.label);
  verdict('the conversation cast holds ONE referent across the rename',
    cast.length === 1, `cast=${JSON.stringify(labels)}`);
}

// ── D · readingAt — the documented residue (forward reading, parity-gated) ─────
// The forward reader keys novelty on the raw id, so a referent re-entering under a
// new surface form reads as a FRESH INS even though the alias is already in the log.
// This is the deepest manifestation; it sits on the core surprise loop behind the
// byte-identical parity gate, so it is REPORTED here, not asserted.
console.log('\nD · readingAt (perceiver/reading.js): the parity-gated residue (reported, not gated)');
{
  const doc = parseText('Monk drifts through the room. The pianist plays alone. Thelonious Monk finally speaks.',
    { docId: 'rename' });
  const r = readingAt(doc, 2);
  const fresh = r.surprises.some(s => s.op === 'INS' && /Thelonious Monk enters/.test(s.text));
  const shift = r.surprises.some(s => s.op === 'SEG' && /focus shifts off/.test(s.text));
  console.log(`  NOTE  at the full-name line the reader fires fresh-INS=${fresh}, focus-shift=${shift}`);
  console.log(`        for a referent already born at s0 (root canonicalises to "monk").`);
  console.log(`        → the in-the-moment surprise is defensible, but the alias is already`);
  console.log(`          in the log at this cursor; pooling INS ids through the projection`);
  console.log(`          representative suppresses it. Parity-affecting → ships behind RULES_REV.`);
}

console.log(`\n${leaks === 0 ? 'EMBODIED' : 'LEAKS: ' + leaks} — appearance time vs connection cursor\n`);
process.exit(leaks === 0 ? 0 : 1);
