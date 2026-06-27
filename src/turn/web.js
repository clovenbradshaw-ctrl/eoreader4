// runTurnWithWeb — the orchestration that lets "search the internet to respond" actually fire.
// (docs/web-search.md)
//
// Run the turn. If it PROPOSES a web search (a measured gap the document can't close), get a
// go-ahead — automatically in `auto` mode, or via a `confirm(proposal)` callback in `confirm`
// mode — then fetch+admit the results (the caller's `webSearch`) and RE-RUN the turn with those
// sources added to the scope. Proposer-only is preserved: nothing is fetched without approval,
// and the engine itself never touches the network — `webSearch` does, outside the pipeline.
//
// `runTurnImpl` is injected (defaults to the real runTurn) so the orchestration is testable
// without a model or the network.

import { runTurn } from './pipeline.js';
import { createCompositeDoc } from '../organs/in/index.js';

// verifyAgainstWeb(answer, corpus) → does the web corpus SUPPORT the answer? An embedder-free
// lexical check: how many of the answer's salient (content) terms appear in the fetched text.
// `supported` when enough do; `missing` names the ones it couldn't find — the honest "couldn't
// confirm this" signal (true contradiction needs the meaning classifier; this flags absence).
const STOP = new Set(('the a an of to in on for and or but is are was were be been being with as at by from this that ' +
  'these those it its his her their your our my we you they he she them then than so not no yes do does did has have ' +
  'had will would can could should about into over under more most some any all what who whom whose when where why ' +
  'which how there here just only also very much many out up off down').split(/\s+/));
const terms = (s) => [...new Set((String(s || '').toLowerCase().match(/[a-z][a-z0-9'’-]{2,}/g) || []))].filter(t => !STOP.has(t));

export const verifyAgainstWeb = (answer, corpus, { question = '', floor = 0.5 } = {}) => {
  // Check the answer's DISTINCTIVE terms — the ones it adds beyond the question. "Lyon" in "the
  // capital of France is Lyon" is the claim; "capital"/"France" are just the question echoed, and
  // a wrong answer shares those too. So the discriminating signal is the novel term's presence.
  const q = new Set(terms(question));
  const novel = terms(answer).filter(t => !q.has(t));
  const check = novel.length ? novel : terms(answer);
  if (!check.length) return { supported: true, overlap: 1, missing: [] };
  const c = new Set(terms(corpus));
  const hit = check.filter(t => c.has(t));
  const overlap = Math.round((hit.length / check.length) * 100) / 100;
  return { supported: overlap >= floor, overlap, missing: check.filter(t => !c.has(t)) };
};

export const runTurnWithWeb = async (args, {
  webSearch,                 // (query, { k }) → [{ doc, … }] admitted web sources
  mode = 'confirm',          // 'confirm' | 'auto' | 'off'
  confirm = null,            // (proposal) → boolean | Promise<boolean>, for confirm mode
  k = 4,
  runTurnImpl = runTurn,
} = {}) => {
  const first = await runTurnImpl(args);
  const proposal = first.webProposal;
  if (mode === 'off' || !proposal || !webSearch) return first;

  const approved = mode === 'auto' ? true : (confirm ? await confirm(proposal) : false);
  if (!approved) return first;     // proposer-only: no go-ahead, nothing fetched

  // Pick the source per trigger: verify/witness want FACTS (Wikipedia); a gap wants to FIND the
  // answer in the wild, so auto-route and pull the actual result pages (random websites).
  const opts = (proposal.trigger === 'verify' || proposal.trigger === 'witness')
    ? { k, kind: 'wikipedia' }
    : { k, kind: 'auto', fetchPages: true };
  let admitted = [];
  try { admitted = await webSearch(proposal.query, opts); } catch { admitted = []; }
  const webDocs = (admitted || []).map(a => a?.doc).filter(Boolean);
  if (!webDocs.length) return { ...first, webFetched: { query: proposal.query, trigger: proposal.trigger, results: 0 } };

  // VERIFY — keep the model's answer (general knowledge is fine), check it against the web, and
  // attach a flag. The answer is NOT replaced: the engine's job here is to flag what's wrong or
  // unconfirmed, not to restrict the answer.
  if (proposal.trigger === 'verify') {
    const corpus = webDocs.map(d => String(d.text || '')).join('\n');
    const v = verifyAgainstWeb(first.answer, corpus, { question: proposal.query });
    const flag = v.supported
      ? { id: 'web-supported', refuses: false, message: `The web results back this up (${Math.round(v.overlap * 100)}% of the answer's terms appear).` }
      : { id: 'web-unconfirmed', refuses: false, message: `Couldn't confirm this against the web${v.missing?.length ? ` — not found: ${v.missing.slice(0, 5).join(', ')}` : ''}.` };
    return { ...first, flags: [...(first.flags || []), flag],
      webProposal: proposal,
      webFetched: { query: proposal.query, trigger: 'verify', results: webDocs.length, supported: v.supported, overlap: v.overlap } };
  }

  // GAP / WITNESS — re-run with the web sources added to the answer scope, so the second answer
  // can stand on (and cite) what the search brought back. On a WITNESS trigger the same sources
  // ALSO ride as `witnessSource`, so the veto's witness-seek confirms the reading against the
  // world and the `interpretation` flag can clear.
  const baseDocs = args.docs || (args.doc ? [args.doc] : []);
  const extra = proposal.trigger === 'witness'
    ? { witnessSource: webDocs.length === 1 ? webDocs[0] : createCompositeDoc(webDocs) }
    : {};
  const second = await runTurnImpl({ ...args, doc: undefined, docs: [...baseDocs, ...webDocs], ...extra });
  return {
    ...second,
    webProposal: proposal,
    webFetched: { query: proposal.query, trigger: proposal.trigger, results: webDocs.length, sources: webDocs.map(d => d.docId) },
  };
};
