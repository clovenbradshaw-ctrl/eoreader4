// Frontier — the cases physics alone cannot reach.
//
// The deterministic core (admission gravity, union-find identity, the symbolic
// conflict oracle, the DEF·EVA·REC ledger) runs with NO model, NO embedder, NO
// network — and that is its ceiling. This module runs the adversarial battery's
// HARD cases (Winograd, casing-invariance, ontology-from-verb, weight-keyed
// corroboration, author-name disambiguation) through the REAL pipeline and measures
// where the physics abstains or misses. Each "✗ reached" is not a bug — it is the
// frontier the model channel is for: a witness that deposits defeasible weight into
// the field, never a decider. Pass these and you have needed an LLM.
//
// Pure, browser-safe: imports only the same `src/` ES modules the app loads. No
// console, no process. The Node CLI and conformance.html both import `runFrontier`.

import { parseText }    from '../src/perceiver/parse/pipeline.js';
import { projectGraph } from '../src/core/project.js';

const labelsOf = (doc) => [...doc.admission.admitted.keys()].sort();
const idsOf    = (doc) => new Set([...doc.admission.admitted.values()]);
const eqSet    = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const entityCount = (doc, re) => {
  const g = projectGraph(doc.log);
  return new Set([...g.entities.keys()].filter((k) => re.test(k)).map((k) => g.representative(k))).size;
};

// Each case runs the real engine and returns a row:
//   { id, kind, family, title, input, measured, reached, needs }
// `reached` = did the deterministic engine meet the bar with no model? (almost never —
// that is the point). `needs` names the model capability a pass would require.
const CASES = [

  // ── A4 · INV · casing invariance (the metamorphic relation for the audio path) ──
  () => {
    const text  = 'Mara Singh requested the retention policy. She received no reply.';
    const lower = text.toLowerCase();
    const orig  = labelsOf(parseText(text,  { docId: 'a4-cased' }));
    const low   = labelsOf(parseText(lower, { docId: 'a4-lower' }));
    return {
      id: 'A4', kind: 'INV', family: 'detection',
      title: 'Casing invariance — lowercasing must not change who exists',
      input: `“${text}”  vs  its lowercased copy`,
      measured: `cased ⇒ {${orig.join(', ') || '∅'}} · lowercased ⇒ {${low.join(', ') || '∅'}}`,
      reached: eqSet(orig, low),
      needs: 'source-adaptive detection / truecasing — caps is the candidate gate (ED-6/7). The S1–S4 generator, gated by source class.',
    };
  },

  // ── A3 · DIR · same token, two ontologies (type from verb-selection) ──
  () => {
    const a = parseText('Apple acquired the startup and reported record earnings.', { docId: 'a3-org' });
    const b = parseText('She ate an apple.', { docId: 'a3-fruit' });
    const appleAdmitted = a.admission.isAdmitted('Apple');
    // The engine has no entity-TYPE channel — it admits the capitalised token but cannot
    // say organisation-vs-fruit, and the lowercased fruit is not admitted as a figure.
    const fruitAdmitted = b.admission.isAdmitted('apple');
    return {
      id: 'A3', kind: 'DIR', family: 'detection',
      title: 'Same token, two ontologies — Apple (org) vs apple (fruit)',
      input: '“Apple acquired the startup…”  vs  “She ate an apple.”',
      measured: `(org) “Apple” admitted: ${appleAdmitted ? 'yes' : 'no'}, type: none · (fruit) “apple” admitted: ${fruitAdmitted ? 'yes' : 'no'}`,
      reached: false,   // detection fires on caps, but there is no org/fruit TYPE to move with the predicate
      needs: 'an entity-type channel from verb-selection (S4) — “acquired / reported earnings” ⇒ organisation, independent of case.',
    };
  },

  // ── B8 · DIR · the Winograd trigger flip (world-knowledge pronoun resolution) ──
  () => {
    const sig = (doc) => doc.log.events
      .filter((e) => e.op === 'INS' || e.op === 'CON' || e.op === 'SIG' || e.op === 'SYN')
      .map((e) => `${e.op}:${e.src ?? e.id ?? ''}→${e.tgt ?? ''}`).join('|');
    const a = parseText('The Senate rejected the Bill. It was too radical.', { docId: 'b8-a' });
    const b = parseText('The Senate rejected the Bill. It was too cautious.', { docId: 'b8-b' });
    // The trigger adjective ("radical" vs "cautious") is the only token that changes; in a
    // world-knowledge reader it would flip what "It" resolves to. Here the structural
    // event stream is byte-identical across the flip — the trigger word is inert.
    const identical = sig(a) === sig(b);
    return {
      id: 'B8', kind: 'DIR', family: 'coreference',
      title: 'Winograd trigger flip — “…because it was too radical / cautious”',
      input: '“The Senate rejected the Bill. It was too radical / cautious.”',
      measured: identical
        ? 'the structural event stream is IDENTICAL across the trigger flip — resolution cannot differ'
        : 'resolution differed (unexpected for the deterministic reader)',
      reached: !identical,   // a real flip would make the streams differ
      needs: 'world-knowledge pronoun resolution (the Winograd Schema). The trigger word carries meaning the physics cannot weigh.',
    };
  },

  // ── B6.5 · MFT · weight-keyed corroboration, not string-identity ──
  () => {
    const doc = parseText(
      'Tom Turner, the NDP CEO, was born in 1961. Mr. Turner was born in 1979.',
      { docId: 'b65' });
    const g = projectGraph(doc.log);
    const turners = entityCount(doc, /turner/);
    const contested = doc.log.events.some((e) => e.op === 'EVA' && e.reason === 'functional-key-contested');
    // "Tom Turner" and "Mr. Turner" are two multi-word forms — the tail-alias only fires
    // single↔multi-word, so they never unify; the shared role (NDP CEO) + surname is
    // never weighed, so the conflicting birth year is neither vetoed nor contested.
    return {
      id: 'B6.5', kind: 'MFT', family: 'identity',
      title: 'Weight-keyed corroboration — “Tom Turner, NDP CEO” … “Mr. Turner”',
      input: '“Tom Turner, the NDP CEO, was born in 1961. Mr. Turner was born in 1979.”',
      measured: `“Turner” → ${turners} entit${turners === 1 ? 'y' : 'ies'}; bornOn contested: ${contested ? 'yes' : 'no'} (corroboration on role+org+surname not weighed)`,
      reached: false,   // B6 fires only on string-identical names; this corroboration is missed
      needs: 'agreement-WEIGHT (Fellegi-Sunter), not string-identity — role+org+surname accumulate into the indeterminate zone (B6.5).',
    };
  },

  // ── B3 · MFT · two people, one full name (author-name disambiguation) ──
  () => {
    const doc = parseText(
      'John Smith chaired the senate hearing. John Smith fixed the leaking pipe.',
      { docId: 'b3' });
    const johns = entityCount(doc, /john/);
    return {
      id: 'B3', kind: 'MFT', family: 'identity',
      title: 'Same full name, two people — the author-name disambiguation hard case',
      input: '“John Smith chaired the senate hearing. John Smith fixed the leaking pipe.”',
      measured: `two distinct “John Smith” → ${johns} node${johns === 1 ? '' : 's'} (string-identity collapses them)`,
      reached: johns === 2,   // a senator and a plumber are two people
      needs: 'context / world-knowledge to SPLIT a shared name on incompatible roles — the AND problem; needs per-mention typing.',
    };
  },
];

export const runFrontier = async ({ onCase } = {}) => {
  const rows = [];
  for (let i = 0; i < CASES.length; i++) {
    const row = CASES[i]();
    rows.push(row);
    if (onCase) onCase(row, i, CASES.length);
  }
  const reached = rows.filter((r) => r.reached).length;
  const families = [...new Set(rows.map((r) => r.family))];
  return {
    rows,
    summary: { total: rows.length, reached, frontier: rows.length - reached, families },
    meta: {
      engine: 'parseText + projectGraph (the real deterministic core)',
      model: 'none', embedder: 'none', network: 'none',
      note: 'Every row ran through the same src/ modules the app loads, with no weights. A ✗ marks the model frontier, not a defect.',
    },
  };
};
