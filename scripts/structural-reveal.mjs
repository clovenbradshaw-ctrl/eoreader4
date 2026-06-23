#!/usr/bin/env node
// structural-reveal — a read-only measurement of the connectivity channel.
//
// READ-ONLY. Touches no production state, changes no rules. For every line of every
// document/condition in data/structural-reveal-stimulus.json it emits, over PRIOR
// CONTEXT ONLY (causally), the two significance channels the engine computes at that
// cursor, to data/structural-reveal-out.jsonl. It selects nothing, scores nothing,
// flags no "reveal". There is no answer key in the input and this script does not read
// one. The selection happens in scripts/structural-reveal-score.mjs, against a held key
// this script never sees.
//
// THE PRESSURE. A random orthogonal collision of two Wikipedia draws (a 1934
// commemorative coin × an early-1900s cartoonist) introduces two casts in SEPARATE
// regions of the entity graph, then a single line bonds an entity from one to an entity
// from the other — a structural reveal. The cheap surface signal (a relational sentence
// between two proper names) is loud on the reveal AND on the controls; only connectivity
// tells them apart.
//
// THE CHANNELS, both off the live engine, both embedder-independent (no model, no
// network — deterministic):
//
//   bayesSurprise   readingAt().bayesBits — D_KL(posterior || prior) over the γ-decayed
//                   proposition/figure field (src/core/surprise.js). Moves on MASS. The
//                   channel under test for the GAP: a bond between two standing entities
//                   is a tiny mass deposit, so a reveal barely moves it.
//
//   bridgeSurprise  readingAt(..,{bridge:true}).bridge — connectivity collapse over the
//                   CON/SIG bond graph, endpoints resolved through the causal SYN-merge
//                   identity quotient (src/core/bridge.js). Moves on STRUCTURE. 1 when a
//                   line's bond joins two previously-separate components, 0 on a re-bond
//                   among adjacent entities or a fresh-entity line. bridgeAxis names the
//                   bridging pair.
//
// CAUSALITY. Line k is read by re-parsing the cumulative prefix lines[0..k] (so no
// future line shapes the parse) and reading at its last unit; bridgeSurprise's own G is
// built from bonds with sentIdx < k and the coref quotient from merges with sentIdx <= k.
//
// THE INSTRUMENT IS VERIFIED before the numbers are trusted: the parse must emit bonds
// (the organ is live), the bridge channel must compute (not all-zeros), and one positive
// and one negative line are traced at the event level.
//
//   Usage:  node scripts/structural-reveal.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseText } from '../src/perceiver/parse/index.js';
import { readingAt } from '../src/perceiver/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN   = join(ROOT, 'data', 'structural-reveal-stimulus.json');
const OUT  = join(ROOT, 'data', 'structural-reveal-out.jsonl');

const round3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);

// One causal read of line k: re-parse the prefix, read both channels at the last unit,
// and report the bonds the parse emitted at k (the instrument trace).
const readLine = (docId, lines, k) => {
  const doc = parseText(lines.slice(0, k + 1).join('\n'), { docId });
  const at  = doc.units.length - 1;
  const r   = readingAt(doc, at, { bridge: true });
  const ev  = doc.log.snapshot();
  const label = new Map();
  for (const e of ev) if (e.op === 'INS' && !label.has(e.id)) label.set(e.id, e.label);
  const nm = (id) => label.get(id) || id;
  const bonds = ev
    .filter((e) => (e.op === 'CON' || e.op === 'SIG') && e.sentIdx === at)
    .map((e) => `${nm(e.src)} --${e.via}--> ${nm(e.tgt)}`);
  return {
    bayesSurprise: round3(r.bayesBits),
    bridgeSurprise: round3(r.bridge),
    bridgeAxis: r.bridgeAxis,
    bondsAtLine: bonds,
  };
};

const stim = JSON.parse(readFileSync(IN, 'utf8'));
console.log('# structural-reveal — read-only connectivity sweep');
console.log('# bayesSurprise:  readingAt().bayesBits        (mass KL, always on, embedder-independent)');
console.log('# bridgeSurprise: readingAt({bridge:true}).bridge (connectivity collapse, src/core/bridge.js)');

const records = [];
let totalBonds = 0, totalBridgeFires = 0, totalLines = 0;
for (const [docId, conds] of Object.entries(stim.documents)) {
  for (const [condition, lines] of Object.entries(conds)) {
    if (!Array.isArray(lines)) continue;
    for (let k = 0; k < lines.length; k++) {
      const m = readLine(docId, lines, k);
      totalLines++;
      totalBonds += m.bondsAtLine.length;
      if (m.bridgeSurprise > 0) totalBridgeFires++;
      records.push({ docId, condition, lineIdx: k, text: lines[k], ...m });
    }
    const bridgeVals = records.filter((r) => r.docId === docId && r.condition === condition).map((r) => r.bridgeSurprise);
    console.log(`  ${docId}/${condition}: ${lines.length} lines · bridgeFires=${bridgeVals.filter((v) => v > 0).length}/${lines.length}`);
  }
}

// ── VERIFY THE INSTRUMENT before the score is read anywhere. ───────────────────────
console.log('\n# instrument check:');
const ok = [];
const fail = [];
(totalBonds > 0 ? ok : fail).push(`organ live — parse emitted ${totalBonds} bond(s) across ${totalLines} lines`);
(totalBridgeFires > 0 ? ok : fail).push(`bridge channel computed — fired on ${totalBridgeFires} line(s) (not all-zeros / dormant)`);
// trace one positive and one negative at the event level
const pos = records.filter((r) => r.bridgeSurprise > 0)[0];
const neg = records.filter((r) => r.bridgeSurprise === 0 && r.bondsAtLine.length > 0)[0];
if (pos) ok.push(`positive traced — ${pos.docId}/${pos.condition} line ${pos.lineIdx}: bridge=${pos.bridgeSurprise} axis=${JSON.stringify(pos.bridgeAxis)} bonds=${JSON.stringify(pos.bondsAtLine)}`);
else fail.push('no positive line to trace');
if (neg) ok.push(`negative traced — ${neg.docId}/${neg.condition} line ${neg.lineIdx}: bridge=${neg.bridgeSurprise} (a bond that did not bridge) bonds=${JSON.stringify(neg.bondsAtLine)}`);
else fail.push('no bonded-but-non-bridging line to trace');
for (const m of ok) console.log(`  ok   · ${m}`);
for (const m of fail) console.log(`  FAIL · ${m}`);

writeFileSync(OUT, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`\n# wrote ${records.length} line records -> ${OUT.replace(ROOT + '/', '')}`);
if (fail.length) { console.log('# INSTRUMENT VOID — the score is meaningless until this is fixed.'); process.exit(2); }
