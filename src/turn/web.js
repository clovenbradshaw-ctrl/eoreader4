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

  let admitted = [];
  try { admitted = await webSearch(proposal.query, { k }); } catch { admitted = []; }
  const webDocs = (admitted || []).map(a => a?.doc).filter(Boolean);
  if (!webDocs.length) return { ...first, webFetched: { query: proposal.query, results: 0 } };

  // Re-run with the web sources added to the answer scope — retrieval/bind/veto treat them like
  // any source, so the second answer can stand on (and cite) what the search brought back. On a
  // WITNESS trigger the same sources ALSO ride as `witnessSource`, so the veto's witness-seek
  // confirms the engine's reading against the world and the `interpretation` flag can clear.
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
