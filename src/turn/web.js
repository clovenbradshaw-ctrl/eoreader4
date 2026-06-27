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

// runWebFollowup(args, first, opts) → the post-approval half: fetch+admit the proposal's query
// and either VERIFY the first answer against it or RE-RUN the turn with the web sources in scope.
// Split out of runTurnWithWeb so a UI can render the first answer immediately, surface the
// proposal as its own confirmation step, and run THIS only on a go-ahead — instead of blocking
// the whole turn behind a popup. `query` overrides the proposal's query (the confirmation card
// lets the user sharpen it before searching); absent, the proposal's own query stands.
// Formulate a real SEARCH QUERY from the conversation — the fix for "web search is useless".
// The proposer hands over the raw chat question ("no there's a newer one", "who is making the
// new series as of 2026?"), which a search engine matches to nonsense (songs containing "no
// there's"; random 2026 TV series) because the SUBJECT lives earlier in the thread, never in
// the question. This asks the talker to rewrite the latest turn into a standalone query with
// references resolved (the thread's "new series" → "X-Files (2025 revival)"). Model-assisted
// and fully guarded: no model, a thin/odd rewrite, or any throw → the original query stands,
// so behaviour only ever improves, never regresses. Returns a plain string.
export const formulateSearchQuery = async ({ model, question, history = [], fallback = '' } = {}) => {
  const base = String(question || fallback || '').trim();
  if (!model?.phrase || !base) return base;
  // The recent thread, compacted — enough to resolve "it / the new one / that show".
  const thread = (history || [])
    .slice(-6)
    .map(m => `${m.role === 'assistant' ? 'A' : 'U'}: ${String(m.content || '').replace(/\s+/g, ' ').slice(0, 240)}`)
    .join('\n');
  const messages = [
    { role: 'system', content:
      'You turn a chat turn into ONE web search query. Resolve every pronoun and back-reference ' +
      'from the conversation so the query stands alone (name the actual subject). Keep it short — ' +
      'the keywords a search engine needs, no filler, no question words, no quotes. Output ONLY the query.' },
    { role: 'user', content: `${thread ? `Conversation so far:\n${thread}\n\n` : ''}Latest turn: ${base}\n\nSearch query:` },
  ];
  try {
    const out = await model.phrase(messages, { maxTokens: 32, temperature: 0 });
    const q = String(out || '')
      .split('\n').map(s => s.trim()).find(Boolean) || '';     // first non-empty line
    const cleaned = q.replace(/^(search query|query)\s*:\s*/i, '').replace(/^["'`]+|["'`]+$/g, '').trim();
    // Guard: a usable rewrite is short and not the model refusing/echoing. Else keep the original.
    if (cleaned && cleaned.length <= 120 && !/^i (cannot|can't|am unable)/i.test(cleaned)) return cleaned;
  } catch { /* fall through to the original */ }
  return base;
};

export const runWebFollowup = async (args, first, {
  webSearch,
  k = 4,
  runTurnImpl = runTurn,
  query,
  formulate = formulateSearchQuery,
} = {}) => {
  const proposal = first?.webProposal;
  if (!proposal || !webSearch) return first;
  // A user-sharpened query (the confirmation card) wins outright. Otherwise reformulate the
  // proposal's raw query against the conversation so the engine gets keywords, not chat filler.
  const q = (query != null && String(query).trim())
    ? String(query).trim()
    : await formulate({ model: args?.model, question: proposal.query, history: args?.history || [], fallback: proposal.query });

  // Pick the source per trigger: verify/witness want FACTS (Wikipedia); a gap wants to FIND the
  // answer in the wild, so auto-route and pull the actual result pages (random websites).
  const opts = (proposal.trigger === 'verify' || proposal.trigger === 'witness')
    ? { k, kind: 'wikipedia' }
    : { k, kind: 'auto', fetchPages: true };
  let admitted = [];
  try { admitted = await webSearch(q, opts); } catch { admitted = []; }
  const webDocs = (admitted || []).map(a => a?.doc).filter(Boolean);
  if (!webDocs.length) return { ...first, webFetched: { query: q, trigger: proposal.trigger, results: 0 } };

  // VERIFY — keep the model's answer (general knowledge is fine), check it against the web, and
  // attach a flag. The answer is NOT replaced: the engine's job here is to flag what's wrong or
  // unconfirmed, not to restrict the answer.
  //
  // Check each source INDEPENDENTLY, not against one merged corpus, and tag each with its own
  // verdict (the partitioned-retrieval discipline — collapsing sources into one field hides
  // whether the support is one page or many, and lets a single SEO-captured dump read as
  // consensus). Each source carries `supported` / `overlap` / `missing`; the answer stands
  // on whichever sources back it, and the UI tags each source distinctly.
  if (proposal.trigger === 'verify') {
    const perSource = webDocs.map(d => {
      const v = verifyAgainstWeb(first.answer, String(d.text || ''), { question: q });
      return {
        docId: d.docId, title: d.web?.title || d.title || '', url: d.web?.url || d.web?.final_url || '',
        supported: v.supported, overlap: v.overlap, missing: (v.missing || []).slice(0, 5),
      };
    });
    const backing = perSource.filter(s => s.supported);
    const supported = backing.length > 0;            // independent corroboration: any source backs it
    const overlap = perSource.reduce((m, s) => Math.max(m, s.overlap), 0);   // the best single source
    const flag = supported
      ? { id: 'web-supported', refuses: false,
          message: `${backing.length} of ${perSource.length} web source${perSource.length > 1 ? 's' : ''} back this up.` }
      : { id: 'web-unconfirmed', refuses: false,
          message: `Couldn't confirm this against the web (${perSource.length} source${perSource.length > 1 ? 's' : ''} checked, none corroborated).` };
    return { ...first, flags: [...(first.flags || []), flag],
      webProposal: proposal,
      webFetched: { query: q, trigger: 'verify', results: webDocs.length,
                    supported, supportingCount: backing.length, overlap, sources: perSource } };
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
    webFetched: { query: q, trigger: proposal.trigger, results: webDocs.length,
                  sources: webDocs.map(d => ({ docId: d.docId, title: d.web?.title || d.title || '', url: d.web?.url || d.web?.final_url || '' })) },
  };
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

  return runWebFollowup(args, first, { webSearch, k, runTurnImpl });
};
