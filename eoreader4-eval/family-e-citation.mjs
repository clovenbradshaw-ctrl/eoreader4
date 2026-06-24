// Family E — citation binding — against the real pipeline.
//
// Pure, environment-agnostic module (same contract as family-c-void.mjs): imports
// only browser-safe `src/` ES modules and exports the corpus, runner, and scorer.
//
// Unlike family C, family E IS fully measurable in the deterministic config. `bind`
// is mechanical — the model never writes [sN], the binder re-attaches citations by
// an idf-weighted lexical posterior (src/ground/bind.js). The echo model emits the
// top retrieved spans verbatim, so each claim equals exactly one document sentence:
// that sentence's index is an INDEPENDENT gold citation (string match, not the
// binder's own logic). The corpus seeds near-duplicate sentences (north/south,
// Monday/Tuesday) so span-accuracy is a real test, not a gimme — a binder that
// routes a claim to the wrong twin is caught. Spec §5.
import { parseText } from '../src/perceiver/parse/pipeline.js';
import { runTurn } from '../src/turn/pipeline.js';
import { createAuditLog } from '../src/audit/index.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';
import '../src/model/echo.js';
import { createModel } from '../src/model/interface.js';

const setup = (text, docId) => {
  const doc = parseText(text, { docId });
  let p = null;
  doc.sentenceEmbeddings = async (e) => {
    if (p) return p;
    p = Promise.all(doc.sentences.map(s => e.embed(s)));
    return p;
  };
  return doc;
};

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim();

// Docs with deliberate near-duplicate sentences — the citation binder must route
// each claim to its OWN twin, not the lexically-adjacent one.
export const DOCS = {
  reactors: `The north reactor was shut down on Monday for a scheduled inspection.
The south reactor was shut down on Tuesday for a scheduled inspection.
Inspectors found a cracked coolant valve on the north reactor.
Inspectors found a corroded pump seal on the south reactor.
Both reactors are expected to return to service next week.`,
  budget: `The city allocated four million dollars to the transit expansion in March.
The city allocated two million dollars to the bike-lane network in March.
The transit expansion will add eleven new bus routes across the east end.
The bike-lane network will add thirty kilometres of protected lanes downtown.
Council approved both allocations in a single unanimous vote.`,
};

// Each case is a question that retrieves several near-duplicate spans, so the
// echoed answer carries multiple claims that must each bind to the right sentence.
export const CASES = [
  { doc: 'reactors', q: 'When were the reactors shut down for inspection?' },
  { doc: 'reactors', q: 'What did inspectors find on the reactors?' },
  { doc: 'reactors', q: 'What was found on the north reactor?' },
  { doc: 'budget', q: 'How much was allocated to transit and bike lanes?' },
  { doc: 'budget', q: 'What will the transit expansion and bike-lane network add?' },
  { doc: 'budget', q: 'What did council do with the allocations?' },
];

// For each bound claim, the gold supporting sentence is the doc sentence whose text
// the claim equals (echo copies spans verbatim). Independent of the binder's logic.
const goldIdxFor = (claim, sentences) => {
  const c = norm(claim);
  if (!c) return null;
  for (let i = 0; i < sentences.length; i++) if (norm(sentences[i]) === c) return i;
  // Not a verbatim copy (e.g. a joined fragment) — fall back to containment.
  for (let i = 0; i < sentences.length; i++) {
    const s = norm(sentences[i]);
    if (s.includes(c) || c.includes(s)) return i;
  }
  return null;
};

export const scoreRows = (rows) => {
  // A "binding" is one bound claim. Aggregate across all turns.
  let claims = 0, requiring = 0, cited = 0, preciseHits = 0, spanHits = 0, wrongTwin = 0;
  for (const r of rows) {
    for (const b of r.bound) {
      claims++;
      const requires = b.goldIdx != null;            // maps to a real doc sentence → needs support
      if (requires) requiring++;
      if (b.citation != null) {
        cited++;
        if (b.supports) preciseHits++;               // cited sentence actually supports the claim
        if (b.goldIdx != null && b.citedIdx === b.goldIdx) spanHits++;  // exact source
        else if (b.goldIdx != null && b.citedIdx !== b.goldIdx) wrongTwin++;
      }
    }
  }
  const citedRequiring = rows.reduce((n, r) =>
    n + r.bound.filter(b => b.goldIdx != null && b.citation != null).length, 0);
  return {
    turns: rows.length,
    claims, requiring, cited,
    citationPrecision: cited ? preciseHits / cited : 1,
    citationRecall:    requiring ? citedRequiring / requiring : 1,
    spanAccuracy:      cited ? spanHits / cited : 1,
    wrongTwin,
  };
};

export const runFamilyE = async ({ onCase } = {}) => {
  const model = createModel('echo');
  await model.load();
  const embedder = createHashEmbedder();
  const docs = Object.fromEntries(Object.entries(DOCS).map(([k, t]) => [k, setup(t, k)]));

  const rows = [];
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const audit = createAuditLog();
    const result = await runTurn({ question: c.q, doc: docs[c.doc], model, embedder, auditLog: audit });
    const sentences = docs[c.doc].sentences;
    const bound = (result.turn.bound || []).map((b) => {
      const citedIdx = b.citation != null ? parseInt(b.citation.slice(1), 10) : null;
      const goldIdx = goldIdxFor(b.claim, sentences);
      // "supports" = the cited sentence is the one the claim is about. For verbatim
      // claims that is the gold sentence; we read it off the cited text directly so
      // precision is independent of the gold index.
      const citedText = citedIdx != null ? sentences[citedIdx] : null;
      const cc = norm(b.claim), cs = norm(citedText);
      const supports = citedText != null && cc !== '' && (cs === cc || cs.includes(cc) || cc.includes(cs));
      return { claim: b.claim, citation: b.citation, citedIdx, goldIdx, supports, score: +(b.score || 0).toFixed(2) };
    });
    const row = { doc: c.doc, q: c.q, bound };
    rows.push(row);
    onCase?.(row, i, CASES.length);
  }

  return {
    rows,
    scores: scoreRows(rows),
    meta: {
      model: 'echo', embedder: 'hash', classifier: 'none (hash organ)',
      // Family E is VALID deterministically: bind is mechanical and the echo claims
      // are verbatim, so the gold citation is an independent string match. The one
      // gap vs a live model: echo never PARAPHRASES, so this measures binding on
      // verbatim claims — paraphrase-robustness needs a generative model. Spec §5/§E.4.
      valid: true,
      note: 'verbatim claims only; paraphrase-robustness needs a live model',
    },
  };
};
