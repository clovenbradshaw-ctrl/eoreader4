// Wire the UI. No turn logic here — every interaction calls into the
// turn holon (`runTurn`) and renders the result. The UI sees the audit
// turn returned from the pipeline; it does not compute anything itself.
//
// Three small choices the user asked for live here:
//   1. The selected model auto-loads (on page open and on backend change),
//      not on first message.
//   2. Chat works without a document — the pipeline degrades to ungrounded
//      chat; mechanical math still short-circuits.
//   3. The assistant message renders live, updating per stage so the
//      thinking is visible while the turn is in flight.

import { ingestText }       from '../organs/in/index.js';
import { runTurn, runWebFollowup, formulateSearchQuery, searchAnnouncement, loadShapeLibrary,
         runCuriousResearch, researchAnnouncement,
         runDeepResearch, modelPlanner, deepResearchAnnouncement } from '../turn/index.js';
import { createWebClient, searchAndAdmit, createRawStore } from '../ingest/index.js';
import { artifactKindOf } from '../tasks/index.js';
import { createSpeculativeWeb } from './prefetch.js';
import { createAuditLog }   from '../audit/index.js';
import { createModel, createHashEmbedder, createMiniLMEmbedder, buildChatMessages, streamPhrase } from '../model/index.js';
import { bootGeometricReader } from '../boot/index.js';
import { markSites }        from '../perceiver/index.js';
import { createHorizon, structuralGround } from '../surfer/index.js';
import { createCast } from '../converse/index.js';
import { renderUserMessage, createThinkingMessage, renderAssistantMessage, setMessageActionHandlers,
         updateThinking, finalizeThinking, streamThinking, streamImpression, renderMindBlock,
         renderWebProposal, renderWebResult, renderSearchNote, setThinkingNote, buildPropositions, finalizeSvg } from './chat.js';
import { limn, VIEW_KINDS } from '../organs/out/limner/index.js';
import { createMind } from '../mind/index.js';
import { foldImpression } from '../write/index.js';
import { renderDoc, highlightSources, markSiteSentences } from './doc-view.js';
import { renderGraph } from './graph-view.js';
import { renderLog } from './log-view.js';
import { mountFeed } from './feed-view.js';
import { mountPredict } from './predict-view.js';
import { mountReplay } from './replay-view.js';
import { mountSurfer } from './surfer-view.js';
import { mountIdle } from './idle-view.js';
import { mountGates } from './gates-view.js';
import { renderAuditTurn, renderEmptyAudit, exportAudit } from './audit-view.js';
import { exportChat } from './chat-export.js';
import { exportActivity } from './activity-export.js';

// CHATBOT SURFACE. The chat pane is a bare chatbot — a thinking indicator and
// the answer, nothing else. The full per-turn record (the trace, the verbatim
// prompt/output, the spans, the coverage verdict, the per-claim transparency,
// the recalled-memory and web-source blocks) is NOT shown inline; it lives in
// the Audit pane (fed independently off STATE.audit) and the Log tab. Flip this
// to true to bring every block back inline for debugging.
const CHAT_VERBOSE = false;

const STATE = {
  doc:       null,       // the document currently shown in the doc pane
  docs:      new Map(),  // docId → parsed doc, every loaded document
  selected:  new Set(),  // docIds tagged for grounding (the persistent chips)
  audit:     createAuditLog(),
  embedder:  createHashEmbedder(),
  backendName: 'webllm',
  model:     null,
  loadingBackend: null,  // promise of the in-flight model load, if any
  inflight:  null,       // the AbortController of the turn currently running (the Stop button), or null
  graph:     null,       // graph-view controller for the current doc
  activeTab: 'text',
  history:   [],         // the running transcript, fed back each turn (the session fold)
  // The session's persistent Horizon (surfer/horizon.js, surfing-next.md §4e): the moved
  // density operator that accumulates the conversation's interpretive state across turns.
  // Owned here in session state and threaded into runTurn so the `settle` stage folds each
  // turn's reading in — OBSERVE-ONLY (no reading change, no answer change), audited in
  // settle.horizon. Cold-starts at the embedder-free structural ground σ (operator basis),
  // so it accumulates with no meaning model. Created lazily on the first turn below.
  horizon:   null,
  // The session Cast (converse/cast.js) — DEF→EVA→REC memory of the referents under discussion,
  // carried across turns. Created lazily on the first turn below.
  cast:      null,

  grounding: 'auto',     // FIXED — no register chip. 'auto' grounds on whatever was gathered (web + docs).
  inquire:   false,      // self-directed inquiry — off (experimental; no chip)
  lensPort:  false,      // THE LENS PORT (spec-the-lens-port.md): bias the WebLLM decoder's logits through
                         //   the lens during generation. OFF by default → golden phrase()+veto path is
                         //   byte-identical; a settings toggle persists the choice under eoreader.lensPort.
  voicePref: {},         // THE DIAL (spec-the-pantheon.md, Track E): a plain-language standing voice
                         //   preference (terse/cautious/concrete) layered over auto-mount. Persisted under
                         //   eoreader.voice; never overrides the NUL-on-VOID lock; god-names stay in the audit.
  webSearch: 'auto',     // FIXED to AUTO — the web is the tool's memory, so every turn searches up front and
                         //   answers grounded in what it gathered. Not a per-message option (no web chip).
  researchHops: 6,       // the curiosity walk's hop BACKSTOP (docs/curiosity-research.md): the max hops the
                         //   auto gather may take. The real governor is the saliency leash — the walk stops
                         //   when it strays too far from the question; this only caps a runaway.
  deepResearchHops: 14,  // DEEP RESEARCH (docs/deep-research.md, "/research <query>"): the hop backstop for
                         //   the deliberate, dig-hard mode — far larger than the auto walk, since depth is
                         //   the point. The saliency leash is still the real governor.
  researchFacets: 4,     // how many ANGLES deep research plans from the one concise query (multiple prompts).
  transparency: true,    // the per-claim source view: every proposition traced to its source (or marked
                         //   unsupported). Default ON; the toggle beneath each answer persists the choice.
  // The MIND — eoreader's read corpus, held as memory (src/mind). A pinned, opt-in
  // chip distinct from the document chips: when on, every turn consults the corpus and
  // surfaces its provenance-tagged spans beneath the answer. Lazily constructed; the
  // build is paid once and cached to OPFS. See docs/the-mind.md.
  mind:      null,       // the createMind() instance, once constructed
  mindReady: false,      // the OPFS index is built and queryable
  mindMode:  'off',      // 'off' | 'recall' (show beneath) | 'weave' (fold into prompt) — persisted
  mindBuilding: false,   // a build is in flight (chip shows progress)
};

// The corpus the mind reads — the ~3,400-book English Project Gutenberg parquet.
const CORPUS_URL = 'https://storage.googleapis.com/intelechia-content/eo-mind/gutenberg_en_3400.parquet';

// The grounding register is fixed to 'auto' — there is no user-facing register chip any
// more (internet-native: the web is always the ground, a loaded document joins it when
// present). 'auto' is exactly that behaviour: the turn grounds on whatever it gathered
// (web + any docs) and falls to general knowledge only when nothing covers the question.
const els = {
  status:    document.getElementById('status'),
  dropzone:  document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  docView:   document.getElementById('doc-view'),
  graphView: document.getElementById('graph-view'),
  logView:   document.getElementById('log-view'),
  feedView:  document.getElementById('feed-view'),
  replayView: document.getElementById('replay-view'),
  surferView: document.getElementById('surfer-view'),
  predictView: document.getElementById('predict-view'),
  gatesView: document.getElementById('gates-view'),
  idleView:  document.getElementById('idle-view'),
  docTabs:   document.getElementById('doc-tabs'),
  messages:  document.getElementById('messages'),
  composer:  document.getElementById('composer'),
  input:     document.getElementById('input'),
  send:      document.getElementById('send'),
  auditView: document.getElementById('audit-view'),
  exportBtn: document.getElementById('export-audit'),
  exportChatWrap: document.getElementById('chat-export'),
  exportChatBtn:  document.getElementById('export-chat'),
  exportChatMenu: document.getElementById('export-chat-menu'),
  backend:   document.getElementById('backend'),
  docChips:  document.getElementById('doc-chips'),
  lensPort:  document.getElementById('lens-port'),
  voiceTerse:    document.getElementById('voice-terse'),
  voiceCautious: document.getElementById('voice-cautious'),
  voiceConcrete: document.getElementById('voice-concrete'),
};

const setStatus = (s) => { els.status.textContent = s; };

// The Send button doubles as a Stop button while a turn is in flight: a click (or the
// composer submit) aborts the running turn instead of sending. The button is never
// disabled during a turn — the user must always be able to stop the LLM response.
const setComposerBusy = (busy) => {
  els.send.textContent = busy ? 'Stop' : 'Send';
  els.send.classList.toggle('stop', busy);
  els.send.title = busy ? 'Stop generating' : '';
  els.send.disabled = false;
};

// Ingestion feedback. A large document used to freeze the page silently behind a
// synchronous parse; now the parse yields and reports, and this paints a live bar in
// the dropzone (label + percentage) so the wait is legible. Built on demand, removed
// when the document lands — the dropzone returns to its plain prompt.
const setIngestProgress = (label, pct) => {
  let bar = els.dropzone.querySelector('.ingest-progress');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'ingest-progress';
    bar.innerHTML = '<div class="ingest-label"></div>' +
                    '<div class="ingest-track"><div class="ingest-fill"></div></div>';
    els.dropzone.appendChild(bar);
    els.dropzone.classList.add('ingesting');
  }
  bar.querySelector('.ingest-label').textContent = label;
  const fill = bar.querySelector('.ingest-fill');
  if (pct == null) {                       // indeterminate — phase running, no count yet
    fill.classList.add('indeterminate');
    fill.style.width = '100%';
  } else {
    fill.classList.remove('indeterminate');
    fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }
};
const endIngest = () => {
  els.dropzone.classList.remove('ingesting');
  els.dropzone.querySelector('.ingest-progress')?.remove();
};

// Load the currently selected backend, idempotently. Auto-runs on boot and
// whenever the backend select changes — the user never has to wait for the
// first message to start the download.
const ensureModel = async () => {
  if (STATE.model && STATE.model.id === STATE.backendName) return STATE.model;
  if (STATE.loadingBackend?.name === STATE.backendName) return STATE.loadingBackend.promise;

  const name = STATE.backendName;
  const model = createModel(name);
  const promise = (async () => {
    try {
      await model.load((p) =>
        setStatus(`${name}: ${p.phase} · ${Math.round((p.pct || 0) * 100)}%`));
      if (STATE.backendName === name) {
        STATE.model = model;
        setStatus(`${name}: ready`);
      }
      return model;
    } catch (err) {
      if (STATE.backendName === name) {
        setStatus(`${name}: failed — ${err?.message || err}`);
      }
      throw err;
    } finally {
      if (STATE.loadingBackend?.name === name) STATE.loadingBackend = null;
    }
  })();
  STATE.loadingBackend = { name, promise };
  return promise;
};

// The graph node → sentence jump: switch to text, highlight the line, and
// move the reading cursor there so the graph re-focuses around it.
const selectSentence = (idx) => {
  // On a phone the text lives behind the Document pane — surface it on a jump.
  if (STATE.setPane && window.matchMedia('(max-width: 820px)').matches) STATE.setPane('doc');
  setTab('text');
  highlightSources(els.docView, [idx]);
  STATE.graph?.setCursor(idx);
};

// Render a loaded document into the shared doc pane (text · graph · log). This is the
// "viewed" document; grounding is governed separately by the selection chips.
const renderViewedDoc = (doc) => {
  STATE.doc = doc;
  renderDoc(doc, els.docView);
  STATE.graph?.destroy?.();
  STATE.graph = renderGraph(doc, els.graphView, {
    onSelectSentence: selectSentence,
    getModel: () => STATE.model,
    embedder: STATE.embedder,
    // The MiniLM organ + a liveness probe: reading mode deepens the enacted loop
    // to meaning-distance surprise when the geometric reader is live (else holds
    // at the γ-mass skeleton). Separate from STATE.embedder (the hash organ).
    geometricEmbedder: STATE.geometricEmbedder,
    isGeometricLive: () => STATE.geometric?.installer?.getState?.().geometricReader === 'live',
  });
  renderLog(doc, els.logView, { onSelectSentence: selectSentence });
  if (STATE.activeTab === 'predict') STATE.predict?.refresh();
  if (STATE.activeTab === 'idle')    STATE.idle?.refresh();
  if (STATE.activeTab === 'replay')  STATE.replay?.refresh();
  if (STATE.activeTab === 'surfer')  STATE.surfer?.refresh();
};

// Show the empty placeholders (no document loaded).
const clearDocPane = () => {
  STATE.doc = null;
  els.docView.innerHTML = '';
  STATE.graph?.destroy?.();
  STATE.graph = renderGraph(null, els.graphView, { onSelectSentence: selectSentence });
  renderLog(null, els.logView, { onSelectSentence: selectSentence });
  STATE.replay?.refresh();   // back to the empty placeholder (clears any running timer)
  STATE.surfer?.refresh();   // the reading register returns to its "load a document" prompt
};

// View a loaded document by id (clicking its chip).
const viewDoc = (id) => {
  const doc = STATE.docs.get(id);
  if (doc) renderViewedDoc(doc);
};

// Remove a document entirely (the chip's ×). If it was the one on screen, fall back
// to another loaded document, or clear the pane.
const removeDoc = (id) => {
  STATE.docs.delete(id);
  STATE.selected.delete(id);
  if (STATE.doc?.docId === id) {
    const next = STATE.docs.keys().next().value;
    if (next) viewDoc(next); else clearDocPane();
  }
  renderDocChips();
};

// ── The mind: eoreader's read corpus, held as memory ───────────────────────
// Constructed lazily (the OPFS-backed index), built once with progress, then
// consulted as an opt-in source kept epistemically separate from the document.

// Construct the mind once; reading status() tells us whether the OPFS index is
// already built from a prior session (cached) so a returning user need not rebuild.
const getMind = async () => {
  if (!STATE.mind) STATE.mind = await createMind({ url: CORPUS_URL });
  return STATE.mind;
};

// After boot, quietly check whether memory is already on disk — so the pinned
// chip shows "ready" for a returning user without any action. Never blocks boot.
const probeMind = async () => {
  try {
    const mind = await getMind();
    const st = await mind.status();
    STATE.mindReady = !!st.built;
    renderDocChips();
  } catch { /* OPFS unavailable — the chip simply offers to build later */ }
};

// Read the corpus into memory (resumable; cached to OPFS). Progress lands in the
// status line so the cost is honest, never a spinner that hides it.
const buildMindNow = async () => {
  if (STATE.mindBuilding) return;
  STATE.mindBuilding = true;
  renderDocChips();
  setStatus('memory: starting…');
  try {
    const mind = await getMind();
    await mind.build(({ group, groups, books, sentences, phase }) => {
      if (phase === 'flush')
        setStatus(`memory: reading… group ${group}${groups ? `/${groups - 1}` : ''} · ` +
          `${books} books · ${sentences.toLocaleString()} sentences`);
    });
    STATE.mindReady = true;
    STATE.mindMode = 'recall';          // built → start by recalling beneath answers
    persistMind();
    const st = await mind.status();
    setStatus(`memory: ready · ${st.books.toLocaleString()} books · ${st.sentences.toLocaleString()} sentences`);
  } catch (err) {
    setStatus(`memory: build failed — ${err?.message || err}`);
  } finally {
    STATE.mindBuilding = false;
    renderDocChips();
  }
};

const persistMind = () => {
  try { localStorage.setItem('eoreader.mindMode', STATE.mindMode); } catch { /* ignore */ }
};

// The chip's click: not built → build it; built → cycle off → recall → weave → off.
//   recall = recalled lines shown beneath the answer (display-only)
//   weave  = those lines also woven into the model's prompt as background
const MIND_CYCLE = { off: 'recall', recall: 'weave', weave: 'off' };
const onMindChip = () => {
  if (STATE.mindBuilding) return;
  if (!STATE.mindReady) { buildMindNow(); return; }
  STATE.mindMode = MIND_CYCLE[STATE.mindMode] || 'off';
  persistMind();
  renderDocChips();
};

const MIND_CHIP = {
  off:    { label: '✦ Mind · off',    title: 'Memory is ready but not consulted. Click to recall beneath answers.' },
  recall: { label: '✦ Mind · recall', title: 'Recalling — memory’s lines appear beneath each answer (not in the answer). Click to weave them into the prompt.' },
  weave:  { label: '✦ Mind · weave',  title: 'Weaving — memory’s lines are offered to the model as background and shown beneath. Click to stop consulting.' },
};
const renderMindChip = (root) => {
  const mode = STATE.mindReady ? STATE.mindMode : 'off';
  const chip = document.createElement('span');
  chip.className = 'doc-chip mind' + (STATE.mindReady && mode !== 'off' ? ' on' : '') + (STATE.mindBuilding ? ' building' : '');
  const name = document.createElement('span');
  name.className = 'doc-chip-name';
  name.textContent = STATE.mindBuilding ? '✦ Mind · reading…'
    : !STATE.mindReady ? '✦ Mind · load memory'
    : MIND_CHIP[mode].label;
  chip.title = STATE.mindBuilding ? 'Reading the corpus into memory (once; cached to OPFS).'
    : !STATE.mindReady ? 'eoreader’s read corpus — its memory. Click to read it in (once, then cached).'
    : MIND_CHIP[mode].title;
  chip.addEventListener('click', onMindChip);
  chip.appendChild(name);
  root.appendChild(chip);
};

// The persistent document chips: every loaded document is a chip; tagged (selected)
// ones are grounded against, and stay selected until deselected. Clicking a chip
// toggles its selection and views it; the × removes it. The pinned Mind chip leads.
const renderDocChips = () => {
  const root = els.docChips;
  root.innerHTML = '';
  root.hidden = false;                  // the pinned Mind chip is always present
  renderMindChip(root);
  // A loaded document is exportable activity (its reading log), so keep the
  // Export menu's enabled state in step with the doc set.
  refreshExportChat();
  for (const [id] of STATE.docs) {
    const on = STATE.selected.has(id);
    const chip = document.createElement('span');
    chip.className = 'doc-chip' + (on ? ' selected' : '');
    chip.title = on
      ? 'Grounded in this document — click to deselect'
      : 'Click to ground answers in this document';

    const name = document.createElement('span');
    name.className = 'doc-chip-name';
    name.textContent = id;
    name.addEventListener('click', () => {
      if (STATE.selected.has(id)) STATE.selected.delete(id); else STATE.selected.add(id);
      viewDoc(id);
      renderDocChips();
    });

    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'doc-chip-x';
    x.textContent = '×';
    x.title = 'Remove this document';
    x.addEventListener('click', (e) => { e.stopPropagation(); removeDoc(id); });

    chip.appendChild(name);
    chip.appendChild(x);
    root.appendChild(chip);
  }
};

const ingest = async (file) => {
  const name = (typeof file === 'string' ? null : file?.name) || 'document';
  const sizeKB = (typeof file !== 'string' && file?.size) ? Math.round(file.size / 1024) : null;
  const sizeTag = sizeKB != null ? ` · ${sizeKB >= 1024 ? (sizeKB / 1024).toFixed(1) + ' MB' : sizeKB + ' KB'}` : '';
  setStatus(`reading ${name}${sizeTag}…`);
  setIngestProgress(`reading ${name}${sizeTag}…`, null);   // indeterminate until the parse reports
  const t0 = performance.now();

  let doc;
  try {
    // The parse now yields between chunks and reports as it goes (organs/in/text.js →
    // pipeline.js), so a large document streams a percentage in instead of freezing.
    doc = await ingestText(file, {
      onProgress: ({ phase, done, total }) => {
        if (phase !== 'parse') return;
        const pct = total ? Math.round((done / total) * 100) : 0;
        const msg = `parsing ${name} — ${pct}% (${done.toLocaleString()}/${total.toLocaleString()} sentences)`;
        setIngestProgress(msg, pct);
        setStatus(msg);
      },
    });
  } catch (err) {
    endIngest();
    setStatus(`ingest failed for ${name}: ${err?.message || err}`);
    return;
  }

  // Keep document ids unique so two files with the same name stay distinct (their
  // referents are namespaced by this id in the composite).
  let id = doc.docId, n = 2;
  while (STATE.docs.has(id)) id = `${doc.docId} (${n++})`;
  doc.docId = id;

  STATE.docs.set(id, doc);
  STATE.selected.add(id);          // a freshly loaded document is grounded by default
  renderViewedDoc(doc);
  renderDocChips();

  const t1 = performance.now();
  const g = doc.projectGraph();
  const summary = `parsed ${name}: ${doc.sentences.length.toLocaleString()} sentences, ${doc.log.length.toLocaleString()} events, ` +
    `${g.entities.size} figures, ${g.edges.length} links, ${Math.round(t1 - t0)}ms · ` +
    `${STATE.docs.size} doc${STATE.docs.size > 1 ? 's' : ''} loaded`;
  setStatus(summary);

  // Semantic site-role pass — chrome by role, not a list. Marks off-distribution
  // figure-less units as sites (DEF role=site) so retrieval skips furniture.
  // It reads a unit's role with the embedder, so it needs real semantics: the
  // hash embedder is too weak (it would mismark rare-vocabulary narrative), so
  // the pass only runs with a capable embedder. The mechanism is the point;
  // a stronger embedder sharpens the judgement.
  const capable = STATE.embedder?.id && STATE.embedder.id !== 'hash-embed';
  if (capable && doc.sentences.length > 20) {
    setIngestProgress(`reading roles in ${name}…`, null);
    try {
      // Embedding a large document is the other slow phase — report it the same way
      // (vectors land incrementally) so the wait stays legible past the parse.
      const sites = await markSites(doc, STATE.embedder, 0.16, ({ done, total }) => {
        const pct = total ? Math.round((done / total) * 100) : 0;
        const msg = `reading roles in ${name} — ${pct}% (${done.toLocaleString()}/${total.toLocaleString()})`;
        setIngestProgress(msg, pct);
        setStatus(msg);
      });
      if (sites.length && STATE.doc?.docId === id) {
        markSiteSentences(els.docView, sites);
        renderLog(doc, els.logView, { onSelectSentence: selectSentence });
      }
    } catch { /* role pass is best-effort */ }
    setStatus(summary);
  }
  endIngest();
};

// Tabs: Text · Graph · Log share the document pane. The reading cursor is
// shared — clicking a sentence in Text moves the cursor the Graph reads from.
const setTab = (name) => {
  STATE.activeTab = name;
  for (const b of els.docTabs.querySelectorAll('.tab')) {
    b.classList.toggle('active', b.dataset.tab === name);
  }
  els.docView.hidden   = name !== 'text';
  els.graphView.hidden = name !== 'graph';
  els.logView.hidden   = name !== 'log';
  els.replayView.hidden = name !== 'replay';
  els.surferView.hidden = name !== 'surfer';
  els.feedView.hidden  = name !== 'feed';
  els.predictView.hidden = name !== 'predict';
  els.gatesView.hidden = name !== 'gates';
  els.idleView.hidden  = name !== 'idle';
  els.dropzone.style.display = name === 'text' ? '' : 'none';
  if (name === 'graph') STATE.graph?.reheat?.();
  // The move-log / open-set / beat list are rebuilt only when the document changed
  // (refresh is a no-op otherwise), so opening the tab is cheap after the first build.
  if (name === 'predict') STATE.predict?.refresh();
  if (name === 'gates')   STATE.gates?.refresh();
  if (name === 'surfer')  STATE.surfer?.refresh();
  if (name === 'idle')    STATE.idle?.refresh();
  // The replay plays on a timer; refresh when shown, pause when hidden so it never
  // ticks against an unseen surface.
  if (name === 'replay') STATE.replay?.refresh();
  else STATE.replay?.pause?.();
};

// LIMNER (docs/limner.md): render the active document's EO state to deterministic
// SVG and drop it into the chat. The grounded document is the SELECTED set's
// first member (the same scope the turn grounds on), falling back to the open
// doc. `arg` is "[kind] [focus]" — an optional leading view kind, then free text
// naming a figure to centre on.
const runSvg = async (rawQuestion, arg) => {
  renderUserMessage(els.messages, rawQuestion);
  const doc = [...STATE.selected].map(id => STATE.docs.get(id)).filter(Boolean)[0] || STATE.doc;
  const think = createThinkingMessage(els.messages, 'drawing…');
  if (!doc || typeof doc.projectGraph !== 'function') {
    finalizeThinking(think, 'Load a document first — /svg renders the graph of what you have read.',
      [], { route: 'chat', mode: STATE.grounding });
    return;
  }
  // Split a leading view kind off the argument; the remainder centres the view.
  const tokens = arg ? arg.split(/\s+/) : [];
  let kind = 'graph';
  if (tokens.length && VIEW_KINDS.includes(tokens[0].toLowerCase())) kind = tokens.shift().toLowerCase();
  const focus = tokens.join(' ').trim();
  try {
    const { svg, spec, vetoed } = await limn({
      doc, kind, scope: focus ? { focus } : {}, site: { kind: 'session', docId: doc.docId },
    });
    if (!spec.nodes.length) {
      finalizeThinking(think, focus
        ? `Nothing to draw around “${focus}” yet — no matching figure in this document's graph.`
        : 'No figures admitted yet — the graph fills in as names recur. Read more, then try /svg again.',
        [], { route: 'chat', mode: STATE.grounding });
      return;
    }
    const caption = `${kind}${focus ? ` · ${focus}` : ''} — ${spec.nodes.length} node${spec.nodes.length > 1 ? 's' : ''}, ${spec.edges.length} edge${spec.edges.length === 1 ? '' : 's'}`
      + (vetoed ? ` · ${vetoed.fired.length} ungrounded ref${vetoed.fired.length === 1 ? '' : 's'} dropped` : '');
    // The render is its own record: limn() emitted an INS view event into the
    // doc's log (organs/out/limner/emit.js), content-addressed by render_hash.
    finalizeSvg(think, svg, { caption });
  } catch (err) {
    finalizeThinking(think, `Couldn't draw that: ${err?.message || err}`, [],
      { route: 'error', mode: STATE.grounding });
  }
};

// The compose verbs that open a GENERATIVE request — "write …", "compose …", "draft a …".
// The gate, paired with `artifactKindOf` naming a real kind, that distinguishes "write an
// emily dickinson poem" (a make-this) from "summarize this" or a bare question (a read-this).
// Deliberately a lead-anchored verb set: a question never opens with one, so the grounded
// answer path (runTurn) is untouched — only an explicit make-this crosses into the writer.
const COMPOSE_VERB = /^\s*(?:please\s+)?(?:can you\s+|could you\s+|i'?d like you to\s+|i want you to\s+)?(?:write|compose|draft|create|generate|produce|pen|author|make)\b/i;

// THE WRITER PATH. A generative request — "write an emily dickinson poem" — is not a question to
// answer but an artifact to MAKE. The reading pipeline (runTurn) researches the topic and answers
// ABOUT it; that is why it came back as a memory of Dickinson rather than a poem. The fix is not a
// new apparatus — the model writes the form perfectly well from its own training. The job is only
// to stop the reading posture from intercepting the request: hand it to the model in the plain
// writer frame and stream the piece back. No research, no example scaffolding, no grounding
// constraints — that prompting is exactly what flattens a poem into a write-up.
const runWrite = async (rawQuestion, kindHint = null) => {
  if (!rawQuestion) return;
  const ctl = new AbortController();
  STATE.inflight = ctl;
  setComposerBusy(true);
  renderUserMessage(els.messages, rawQuestion);
  if (STATE.setPane && window.matchMedia('(max-width: 820px)').matches) STATE.setPane('chat');

  const kind = kindHint || artifactKindOf(rawQuestion);
  const label = kind && kind !== 'answer' ? kind : 'piece';
  const thinking = createThinkingMessage(els.messages, `writing ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}…`);

  try {
    await ensureModel();
  } catch (err) {
    finalizeThinking(thinking, `Model failed to load: ${err?.message || err}`, [], {
      route: 'error', mode: STATE.grounding, onRetry: () => runWrite(rawQuestion, kindHint),
    });
    STATE.inflight = null;
    setComposerBusy(false);
    return;
  }
  if (ctl.signal.aborted) {
    finalizeThinking(thinking, '⏹ Stopped.', [], { route: 'chat', mode: STATE.grounding });
    STATE.inflight = null;
    setComposerBusy(false);
    return;
  }

  // The request itself is the prompt, in the plain assistant frame (no doc, no grounding) — the
  // same path that already writes a clean poem. Prior turns ride as history so a follow-up
  // ("make it shorter", "now one about the sea") continues the thread.
  const history = STATE.history.slice(-8).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
  const messages = buildChatMessages({ question: rawQuestion, history, now: new Date() });
  let acc = '';
  let raw = '';
  try {
    raw = await streamPhrase(STATE.model, messages, {
      maxTokens: 700, temperature: 0.85, signal: ctl.signal,
      onToken: (piece) => { acc += String(piece || ''); streamThinking(thinking, piece); },
    });
  } catch (err) {
    if (!(ctl.signal.aborted)) {
      finalizeThinking(thinking, acc.trim() || `Couldn't write that: ${err?.message || err}`, [], {
        route: acc.trim() ? 'chat' : 'error', mode: STATE.grounding, onRetry: () => runWrite(rawQuestion, kindHint),
      });
      STATE.inflight = null;
      setComposerBusy(false);
      return;
    }
    raw = acc;
  }

  // THE FIRST GO, THEN EVALUATE. "Let me take a first go, and then I'll update if I need to." The
  // draft above is the first go; the writer now reads it back against the request and only rewrites
  // if it falls short — the lag posture / self-fold weld, write→evaluate→(maybe)revise, not plan
  // it all up front. Any trouble, an empty verdict, or an OK keeps the first go untouched.
  let artifact = String(raw || acc || '').trim();
  if (artifact && !ctl.signal.aborted) {
    try {
      const review = [
        { role: 'system', content: 'You are the writer, reviewing your own draft. Read it against the request — the form it should take, the voice, and exactly what was asked. If the draft already meets the request well, reply with only the word OK. If it falls short, reply with an improved, complete version of the piece and nothing else — no commentary, no preamble.' },
        { role: 'user', content: `Request: ${rawQuestion}\n\nDraft:\n${artifact}` },
      ];
      setThinkingNote(thinking, '🔁 reading it back…');
      const verdict = String(await streamPhrase(STATE.model, review, { maxTokens: 700, temperature: 0.7, signal: ctl.signal }) || '').trim();
      if (verdict && !/^ok\b/i.test(verdict)) {
        const revised = verdict.replace(/^(?:sure[,!.]?\s+|certainly[,!.]?\s+|here(?:'s| is| you go|’s)\b[^\n:]*:?\s*)/i, '').trim();
        if (revised.replace(/[^a-z]/gi, '').length >= 20) artifact = revised;
      }
    } catch { /* keep the first go */ }
  }

  finalizeThinking(thinking, artifact || `I couldn't write that ${label}.`, [], {
    route: 'chat', mode: STATE.grounding,
    onRetry: () => runWrite(rawQuestion, kindHint),
  });
  if (ctl.signal.aborted) thinking.classList.add('stopped');

  // Commit the exchange so a follow-up reads it back — the same session fold the grounded turns feed.
  if (artifact) {
    STATE.history.push({ role: 'user', content: rawQuestion });
    STATE.history.push({ role: 'assistant', content: artifact });
  }

  STATE.inflight = null;
  setComposerBusy(false);
};

// Run one query through the pipeline and render it. Factored out of the composer so
// an errored turn can offer a one-click retry (re-runs the very same question).
const runQuery = async (rawQuestion) => {
  if (!rawQuestion) return;
  // THE WRITER PATH: a generative request is a make-this, not a question. "/write <request>" (or
  // /compose, /draft) forces it; otherwise a request that opens with a compose verb and names an
  // artifact kind is auto-detected. It hands the request to the model to WRITE (runWrite) instead
  // of researching the topic and answering about it (runTurn) — the gap that turned "write an emily
  // dickinson poem" into a memory of Dickinson instead of a poem.
  const writeCmd = /^\/(?:write|compose|draft|create)\b[\s:]*/i.exec(rawQuestion);
  if (writeCmd) { await runWrite(rawQuestion.slice(writeCmd[0].length).trim()); return; }
  if (COMPOSE_VERB.test(rawQuestion) && artifactKindOf(rawQuestion) !== 'answer') {
    await runWrite(rawQuestion);
    return;
  }
  // LIMNER SVG MODE (docs/limner.md): "/svg [kind] [focus]" renders the active
  // document's EO state as deterministic SVG — graph (default), timeline,
  // void_map, or path — optionally centred on a figure named by the focus text.
  // No model is in the loop: the organ projects the graph and the layout engine
  // computes geometry, so this short-circuits the whole turn pipeline.
  const svgCmd = /^\/svg\b[\s:]*/i.exec(rawQuestion);
  if (svgCmd) { await runSvg(rawQuestion, rawQuestion.slice(svgCmd[0].length).trim()); return; }
  // DEEP RESEARCH MODE (docs/deep-research.md): "/research <query>" (or "/deep <query>") asks the
  // engine to dig HARD — plan several angles on the concise query (multiple prompt generation), walk
  // each one deep following its curiosity, and write up everything it found with full provenance. A
  // bare "/research" with no query is a no-op prompt. The command prefix is stripped; the rest is the
  // concise query both rendered and researched.
  const deepCmd = /^\/(?:deep(?:-research)?|research)\b[\s:]*/i.exec(rawQuestion);
  const deepResearch = !!deepCmd;
  const question = (deepResearch ? rawQuestion.slice(deepCmd[0].length) : rawQuestion).trim();
  if (!question) {
    if (deepResearch) {
      renderUserMessage(els.messages, rawQuestion);
      finalizeThinking(createThinkingMessage(els.messages, ''),
        'Give me a concise question after /research — e.g. “/research how do mRNA vaccines work”.',
        [], { route: 'chat', mode: STATE.grounding });
    }
    return;
  }
  // On a phone the answer lands in the chat pane — make sure it's the one shown.
  if (STATE.setPane && window.matchMedia('(max-width: 820px)').matches) STATE.setPane('chat');
  // The Stop handle for this turn: an AbortController whose signal is threaded through the web
  // gather and the model decode. The Send button becomes Stop while it is in flight.
  const ctl = new AbortController();
  STATE.inflight = ctl;
  setComposerBusy(true);
  renderUserMessage(els.messages, question);

  // The grounding scope is the SELECTED set of documents (the tagged chips).
  const selectedDocs = [...STATE.selected].map(id => STATE.docs.get(id)).filter(Boolean);

  // Live "thinking" bubble — updates as each pipeline stage finishes, with an
  // elapsed-time cue (the local 3B model takes ~20–40s).
  const thinking = createThinkingMessage(els.messages,
    selectedDocs.length
      ? `thinking (${selectedDocs.length} doc${selectedDocs.length > 1 ? 's' : ''})…`
      : 'thinking (no doc — chat mode)…');

  try {
    await ensureModel();
  } catch (err) {
    finalizeThinking(thinking, `Model failed to load: ${err?.message || err}`, [], {
      route: 'error', flags: [], mode: STATE.grounding, onRetry: () => runQuery(rawQuestion),
    });
    STATE.inflight = null;
    setComposerBusy(false);
    return;
  }

  // The user stopped while the model was still loading — abandon the turn before any search
  // or decode, and leave a stopped marker rather than a half-rendered bubble.
  if (ctl.signal.aborted) {
    finalizeThinking(thinking, '⏹ Stopped.', [], { route: 'chat', mode: STATE.grounding });
    STATE.inflight = null;
    setComposerBusy(false);
    return;
  }

  // Consult MEMORY (the mind) before the turn, if on — one lexical reading over the
  // read corpus, reused for both the display block and (in weave mode) the prompt.
  let mindSpans = null;
  if (STATE.mindReady && STATE.mindMode !== 'off' && STATE.mind) {
    try { mindSpans = await STATE.mind.retrieve(question, 5); } catch { mindSpans = null; }
  }

  // Build the sample-answer library ONCE, when the meaning embedder is warm (it embeds 430
  // responses, so it is deferred and cached on STATE; the first turn after warm-up runs
  // without it, every turn after with it). Inert until MiniLM warms — the form predictor
  // (turn/shape.js) stays dark, exactly like the significance column, until then.
  if (!STATE.shapeLibrary && !STATE.shapeLibraryBuilding
      && STATE.geometricEmbedder?.measuresMeaning && STATE.geometricEmbedder.isWarm?.()) {
    STATE.shapeLibraryBuilding = loadShapeLibrary((t) => STATE.geometricEmbedder.embed(t))
      .then((lib) => { STATE.shapeLibrary = lib; return lib; })
      .catch(() => null);
  }

  // The session Horizon, created once and reused for the life of the conversation
  // (surfing-next.md §4e). The structural ground is doc-independent (the fixed operator
  // basis), so one Horizon spans the whole session and accumulates across documents.
  if (!STATE.horizon) {
    try { STATE.horizon = createHorizon({ ground: structuralGround() }); } catch { STATE.horizon = null; }
  }
  // The session Cast (cast.js) — the DEF→EVA→REC memory of the referents under discussion,
  // created once and carried across turns so a thin follow-up stays on the thing being
  // discussed. One cast spans the conversation, like the Horizon.
  if (!STATE.cast) {
    try { STATE.cast = createCast(); } catch { STATE.cast = null; }
  }

  const t0 = performance.now();
  const turnArgs = {
    question,
    // The persistent session Horizon — the `settle` stage folds this turn's reading into it
    // (observe-only; the answer is byte-identical). Null only if construction failed.
    horizon:  STATE.horizon,
    // The persistent session Cast — the fold's EVA/REC read off it (carry-forward on a null
    // live read; settle on a concentrated fold). Null only if construction failed.
    cast:     STATE.cast,
    shapeLibrary: STATE.shapeLibrary,   // the form predictor, once built (null until MiniLM warms)
    docs:     selectedDocs,     // the selected set — folded into one composite to ground against
    // In WEAVE mode the recalled lines are offered to the model as labelled background;
    // in recall mode they are display-only (not passed here). Epistemically separate either way.
    mindSpans: STATE.mindMode === 'weave' ? mindSpans : null,
    model:    STATE.model,
    embedder: STATE.embedder,
    // The MiniLM organ for retrieval's SEMANTIC channel: when it is live, retrieval
    // scores meaning instead of spelling, so a paraphrased question reaches the right
    // sentence. Falls back to the hash organ (STATE.embedder) until MiniLM warms, so
    // retrieval never blocks on the download — the same organ the geometric reader uses.
    geometricEmbedder: STATE.geometricEmbedder,
    // The geometric organ for the edge-grounding fact-check (the talker's assertions
    // contrasted against the graph). Holds at no-commit until MiniLM + centroids come
    // online, so its geometric verdicts degrade to indeterminate until then; the
    // embedder-free symbolic algebra (disjoint-kinship axioms) fires regardless.
    classifier: STATE.geometric?.installer?.getState?.().classifier || null,
    auditLog: STATE.audit,
    history:  STATE.history,    // the prior transcript — the session fold reads it
    now:      new Date(),       // the real clock — so a date/time question is answered directly, no web hop
    grounding: STATE.grounding, // the Auto / Chat with document / Free form register (the chip)
    inquire:  STATE.inquire,    // self-directed inquiry — read another pass on the open question (the chip)
    lensPort: STATE.lensPort,   // THE LENS PORT (spec-the-lens-port.md): steer the decoder's logits through
                                //   the lens — relevance + the void gate during generation (the toggle below)
    voicePref: STATE.voicePref, // THE DIAL (spec-the-pantheon.md): the plain-language voice preference
    signal:   ctl.signal,       // the Stop button: halts the model decode and short-circuits the rest of the turn

    onStep:   (name, ctx, data) => {
      // When this turn synthesizes over a web gather, tell the thinking bubble how many
      // sources it is reading/writing from — so the (slow) synthesis pass after the per-hop
      // research feedback reads as purposeful work over the pages, not a silent "thinking…".
      updateThinking(thinking, name, data, ctx, { verbose: CHAT_VERBOSE, sources: webGather?.docs?.length || 0 });
      // As soon as the fold has read the passage, type its IMPRESSION into the bubble
      // while the talker warms — model-free streaming during the long time-to-first-
      // token (docs/streaming-answer.md). Cleared when the real answer begins. This
      // exposes the engine's internal reading (the figures it settled on, the edges it
      // drew, what it holds open), so the silent "…" wait reads as the substrate
      // thinking out loud rather than a dead spinner. It ships in the DEFAULT surface —
      // decoupled from the verbose audit gate (which only governs the heavy blocks:
      // raw prompt, retrieved spans, the per-stage trace). The preview is muted/italic
      // and always replaced by the real answer, so it never reads as the answer itself.
      if (name === 'fold' && ctx?.surf && !thinking._impression) {
        try { streamImpression(thinking, foldImpression(ctx).phrases); } catch { /* preview only */ }
      }
    },
    // PLAIN token streaming (docs/streaming-answer.md): the answer fills the bubble
    // token by token as the model decodes, where the backend exposes a decode
    // callback (webllm, onnx-chat, wllama). The first real token clears the impression
    // preview; finalizeThinking then replaces the raw stream with the bound, cited
    // answer. No `stream:true` — that arms the grounded beat-loop, not the default.
    onToken:  (piece) => streamThinking(thinking, piece),
  };
  // Run the turn. Web search (docs/web-search.md) is PROPOSER-ONLY: the pipeline measures the
  // gap and proposes a query, but never fetches. The answer is rendered FIRST, then — if web
  // search is enabled and a query was proposed — the search is OFFERED beneath it (confirm) or
  // run for the user (auto). This replaces the old native window.confirm popup that fired
  // mid-turn, before the answer was even shown.
  const webMode = STATE.webSearch || 'off';
  const RESEARCH_HOPS = STATE.researchHops || 4;

  // INVERTED FLOW (auto): search the web FIRST, fold the results into the turn's scope, and let
  // the model answer from the surfer's reading of [web + documents + memory] in ONE grounded
  // pass — instead of answering from parametric knowledge and augmenting after (the old
  // double-LLM path). The meaning graph of the fetched content is fed to the talker; every
  // source is recorded for the transparency block. Confirm/off keep the proposer-only path.
  let webGather = null;
  if (deepResearch) {
    // DEEP RESEARCH (docs/deep-research.md): plan several angles on the concise query, then walk each
    // deep following the engine's surprise — one shared prior, one leash to the original question, a
    // far larger hop budget than the single auto walk. Every kept page folds into the scope; the turn
    // below synthesizes ONE grounded pass over them, and the full provenance (facets + sources + hop
    // tree) rides back to the deep-research block.
    setThinkingNote(thinking, "🔬 I'm going to research this — working out what to search for…");
    try {
      const search = (query, opts) => searchAndAdmit(query, { client: webClientOf(), rawStore: rawStoreOf(), ...opts });
      // Same LLM step as the auto walk: rewrite the chat turn into a standalone search query (refs
      // resolved, filler dropped) before it becomes the anchor and facet 0. Guarded — a bad rewrite or
      // no model falls back to the raw question, so the anchor is never worse than the user's words.
      const q = await formulateSearchQuery({ model: STATE.model, question, history: STATE.history }) || question;
      setThinkingNote(thinking, '🔬 planning the research…');
      const walk = await runDeepResearch(q, {
        search,
        // Discourse-aware fan-out: the planner writes each research angle against the conversation
        // (the subject in focus + what it left open), not the seed string alone. The raw `question`
        // is threaded so discourseFrame reads the true turn's operator/referent off the dialogue —
        // so the angles resolve back-references and keep the conversation's subject.
        plan: modelPlanner(STATE.model, { history: STATE.history, question }),
        anchor: q,
        maxFacets: STATE.researchFacets || 4,
        maxHops: STATE.deepResearchHops || 14,
        searchOpts: { kind: 'auto', fetchPages: true },
        signal: ctl.signal,    // the Stop button — end the walk between hops

        onPlan: (facets) => setThinkingNote(thinking, `🔬 ${deepResearchAnnouncement(q, facets, { maxHops: STATE.deepResearchHops || 14 })}`),
        onHop: (h) => setThinkingNote(thinking, `🔎 ${h.depth === 0 ? `angle: “${h.query}”` : `${'↳'.repeat(h.depth)} hop ${h.index}: “${h.query}”`}…`),
      });
      if (walk.docs.length) {
        turnArgs.docs = [...selectedDocs, ...walk.docs];
        turnArgs.groundGraph = true;
        // The synthesized answer (the turn below) is the report body; the facets + hop trace + sources
        // here are its provenance, surfaced by renderWebResult (the research plan + deep-research walk).
        webGather = { query: q, docs: walk.docs, research: walk.hops, facets: walk.facets, deep: true };
      }
    } catch { /* network/search/plan failed — fall through to the ungrounded turn */ }
    // Hand off from the per-hop research feedback to the synthesis pass with a note that
    // names what was read, so the transition isn't a blank "thinking…" (the per-stage labels
    // below then keep saying "reading/writing from N sources…"). No gather → plain bubble.
    setThinkingNote(thinking, webGather?.docs?.length
      ? `✍️ Read ${webGather.docs.length} source${webGather.docs.length === 1 ? '' : 's'} — composing the answer…` : '');
  } else if (webMode === 'auto') {
    // Two feedback beats, in the order the work happens: FIRST the LLM formulates the standalone
    // search query from the chat turn (formulateSearchQuery — a real model call that can take a
    // beat), so name that step rather than jumping to "searching…"; THEN, once we know the query,
    // announce the research and what it's actually searching for (researchAnnouncement, below).
    setThinkingNote(thinking, "🔎 I'm going to research this — working out what to search for…");
    try {
      const q = await formulateSearchQuery({ model: STATE.model, question, history: STATE.history });
      // CURIOSITY-GUIDED gather (docs/curiosity-research.md): instead of one query and four results,
      // run a multi-hop WALK that follows the engine's own surprise — each hop expands the single most
      // SURPRISING thread the last pages opened (a new figure, a new place), up to a max number of
      // hops, and STOPS when surprise dries up. It is the active-inference loop, not a shotgun fan-out.
      if (q) setThinkingNote(thinking, `🔎 ${researchAnnouncement(q, { maxHops: RESEARCH_HOPS }) || `Looking this up: “${q}”…`}`);
      const walk = await runCuriousResearch(q, {
        search: (query, opts) => searchAndAdmit(query, { client: webClientOf(), rawStore: rawStoreOf(), ...opts }),
        anchor: q, maxHops: RESEARCH_HOPS, k: 3,
        searchOpts: { kind: 'auto', fetchPages: true },
        signal: ctl.signal,    // the Stop button — end the walk between hops
        onHop: (h) => setThinkingNote(thinking, `🔎 hop ${h.index}/${RESEARCH_HOPS}: “${h.query}”${h.curiosity != null ? ` · curiosity ${h.curiosity} bits` : ''}…`),
      });
      const webDocs = walk.docs;
      if (webDocs.length) {
        turnArgs.docs = [...selectedDocs, ...webDocs];   // web joins the grounding scope, beside any loaded docs
        turnArgs.groundGraph = true;                     // feed the talker the MEANING GRAPH of what was gathered
        webGather = { query: q, docs: webDocs, research: walk.hops };
      }
    } catch { /* network/search failed — fall through to the ungrounded turn */ }
    // Same hand-off as the deep path: name the pages gathered as the synthesis starts, rather
    // than blanking back to a bare "thinking…" for the slow read-and-write over them.
    setThinkingNote(thinking, webGather?.docs?.length
      ? `✍️ Read ${webGather.docs.length} source${webGather.docs.length === 1 ? '' : 's'} — composing the answer…` : '');
  }

  let result = await runTurn(turnArgs);

  // Render (or re-render) the answer bubble. Idempotent — the web follow-up calls it again with
  // the updated answer. Returns nothing; it paints `thinking` and the doc-pane highlights.
  // Web docs cite back with an opaque "web-<hash>" docId; show the page's title/domain instead,
  // so the answer's source chips are transparent (not raw ids). Built from this turn's gather.
  const webLabel = new Map();   // web docId → display label
  const webUrl   = new Map();   // web docId → url
  for (const d of (webGather?.docs || [])) {
    webLabel.set(d.docId, d.web?.title || (() => { try { return new URL(d.web?.url || '').host.replace(/^www\./, ''); } catch { return d.docId; } })());
    if (d.web?.url || d.web?.final_url) webUrl.set(d.docId, d.web.url || d.web.final_url);
  }
  const render = (res, ms) => {
    const route = res.route || res.turn?.route;
    const docNames = route === 'grounded'
      ? (res.sourceDocs?.length ? res.sourceDocs : selectedDocs.map(d => d.docId)).map(n => webLabel.get(n) || n)
      : [];
    // Per-claim attribution: map each cited [sN] to its source (label + web url), so a citation
    // names the page it came from. Built from the pipeline's index→docId map (res.citeOrigins).
    const citationSources = {};
    for (const [idx, docId] of Object.entries(res.citeOrigins || {})) {
      citationSources[idx] = { label: webLabel.get(docId) || docId, url: webUrl.get(docId) || '' };
    }
    // The transparency record: every proposition the answer makes, paired with the source it is
    // grounded in (or the verdict that it is unsupported / contradicted). This turns "the answer"
    // into a list of claims each traceable to a page — what the transparency toggle reveals.
    const propositions = buildPropositions(res, citationSources);
    finalizeThinking(thinking, res.answer, res.sources, {
      route, ms, flags: res.flags,
      mode: STATE.grounding,
      docNames,
      citationSources,
      propositions,
      verbose: CHAT_VERBOSE,               // bare chatbot by default — blocks suppressed, kept in the Audit pane
      transparency: STATE.transparency,   // the persisted on/off for the per-claim source view
      onTransparency: (open) => {         // remember the choice so it sticks across turns
        STATE.transparency = open;
        try { localStorage.setItem('eoreader.transparency', open ? '1' : '0'); } catch { /* ignore */ }
      },
      onDocSource: (name) => {
        if (STATE.setPane && window.matchMedia('(max-width: 820px)').matches) STATE.setPane('doc');
        if (name && STATE.docs.has(name)) viewDoc(name);
        setTab('text');
      },
      onRetry: () => runQuery(rawQuestion),
      // Clicking a "want me to go deeper" lead asks it as a fresh turn (renders the lead as the
      // new user message and runs it). Only the trailing go-deeper list is made clickable.
      onExplore: (q) => runQuery(q),
    });
    // Highlight only when grounding a single document — composite indices don't map onto
    // one doc pane (clicking a source chip switches to that document instead).
    if (res.sources?.length && selectedDocs.length <= 1) highlightSources(els.docView, res.sources);
  };

  // Append the completed exchange so the next turn's session fold can read it back — but never
  // feed an error turn back into the conversation (it would poison the fold). An UNBOUND answer
  // (claims, but none tied to a source) is tagged so the fold keeps it out of the next turn's
  // ground (§7). Re-committable: a web follow-up that changes the answer UPDATES this turn's
  // assistant entry IN PLACE — so even if the user sent another message while the search card
  // sat open, the right pair is rewritten and the newer turn is untouched.
  let asstEntry = null;
  const commitHistory = (res) => {
    const route = res.route || res.turn?.route;
    // A stopped turn (the Stop button) is not fed back into the session fold — a partial,
    // unverified answer should not become the premise of the next turn (same reason as an error).
    if (route === 'error' || res.stopped) return;
    if (!asstEntry) {
      STATE.history.push({ role: 'user', content: question });
      asstEntry = { role: 'assistant', content: res.answer || '' };
      STATE.history.push(asstEntry);
    } else {
      asstEntry.content = res.answer || '';
    }
    if (res.unbound) asstEntry.unbound = true; else delete asstEntry.unbound;
  };

  // The user pressed Stop: the turn carries whatever decoded before the halt. Mark it stopped,
  // give an empty draft a plain "Stopped." so the bubble is never blank, and tag the element so
  // the CSS shows a small "stopped" badge. commitHistory then keeps it out of the session fold.
  const stopped = !!result.stopped || ctl.signal.aborted;
  if (stopped) {
    result.stopped = true;
    if (!String(result.answer || '').trim()) result.answer = 'Stopped.';
  }

  render(result, Math.round(performance.now() - t0));
  if (stopped) thinking.classList.add('stopped');
  // The recalled-memory and web-source blocks are part of the verbose surface — the
  // sources stay reachable through the answer's inline [sN] citation links and the
  // Audit pane. The bare chatbot shows neither inline.
  if (CHAT_VERBOSE && mindSpans && (result.route || result.turn?.route) !== 'error') renderMindBlock(thinking, mindSpans);
  // Source transparency: when the web was gathered up front, show every page it grounded on
  // (title · link · fetched-at) and the meaning graph the talker reasoned over.
  if (CHAT_VERBOSE && webGather && (result.route || result.turn?.route) !== 'error') {
    renderWebResult(thinking, {
      query: webGather.query, results: webGather.docs.length, grounded: true,
      research: webGather.research || null,   // the curiosity-walk hop trace, surfaced collapsed
      facets: webGather.facets || null,       // the deep-research plan (the angles it opened from)
      deep: webGather.deep || false,
      sources: webGather.docs.map(d => ({
        docId: d.docId, title: d.web?.title || '', url: d.web?.url || d.web?.final_url || '',
        fetched_at: d.web?.fetched_at || null,
      })),
      graph: result.fedGraph || '',
    });
  }
  commitHistory(result);

  // The search itself — fetch+admit the proposed query and verify/re-run, then re-render the
  // answer and show what the search found. Driven by the in-app confirmation card (or auto).
  const runFollowup = async (query) => {
    // The conversational "let me look that up" beat — said the moment the search fires, before the
    // (slow) fetch + re-answer, in the proposer's own first-person voice. The user-edited query (the
    // confirmation card's field) is what we announce, falling back to the proposal's own query.
    const announce = searchAnnouncement({ ...(result.webProposal || {}), query: query || result.webProposal?.query });
    if (announce) renderSearchNote(thinking, announce);
    let updated;
    try {
      updated = await runWebFollowup(turnArgs, result, {
        // Consult the speculative quarantine first: if the user's typing already warmed this
        // exact query, take() returns it instantly and marks it PRESERVED (it proved useful).
        // A miss falls through to a live fetch — the normal proposer-only path.
        webSearch: async (q, opts) => (await prefetcherOf().take(q)) ||
          searchAndAdmit(q, { client: webClientOf(), rawStore: rawStoreOf(), ...opts }),
        query,
      });
    } catch { updated = result; }
    result = updated;
    render(result, Math.round(performance.now() - t0));
    if (CHAT_VERBOSE && mindSpans && (result.route || result.turn?.route) !== 'error') renderMindBlock(thinking, mindSpans);
    if (CHAT_VERBOSE && result.webFetched) renderWebResult(thinking, result.webFetched);
    commitHistory(result);
  };

  // CONFIRM mode keeps the proposer-only path: answer first, then offer the search beneath it.
  // AUTO already gathered up front (above), so it does not run a follow-up here.
  if (webMode === 'confirm' && result.webProposal) {
    renderWebProposal(thinking, result.webProposal, { onSearch: (q) => runFollowup(q) });
  }

  STATE.inflight = null;
  setComposerBusy(false);
};

// The session web instrument and its speculative quarantine, both lazily built on first
// use and shared across turns. The prefetcher fetches+admits exactly as a real turn would
// (kind:'auto', fetchPages) so a taken entry is byte-identical to one fetched live.
const webClientOf = () => (STATE.webClient ||= createWebClient());
// The session's OPFS raw store — every fetched page kept in full, as binary, re-readable without a
// refetch. Built once, shared across every search/admit so the content accumulates (the user's
// "save it all into opfs"). Degrades to in-memory where OPFS is unavailable.
const rawStoreOf  = () => (STATE.rawStore ||= createRawStore());
const prefetcherOf = () => (STATE.prefetcher ||= createSpeculativeWeb({
  search: (q, opts) => searchAndAdmit(q, { client: webClientOf(), rawStore: rawStoreOf(), kind: 'auto', fetchPages: true, ...opts }),
}));

// Speculative prefetch — DISABLED on the typing path. It fetched + parsed full web pages on
// every typing pause (auto mode); parseText is synchronous main-thread work, so it FROZE the
// tab while the user typed. The send-time fetch (capped in websource.js) covers the real need.
// Re-enable only behind off-main-thread parsing (a worker) or snippet-only warming.
let prefetchTimer = null;
const maybePrefetch = () => { /* disabled: see note above — was freezing the tab on type */ };

// The composer's submit path. While a turn is in flight the Send button is a Stop button:
// a submit aborts the running turn instead of starting a new one. Otherwise: read the box,
// clear it, run.
const send = () => {
  if (STATE.inflight) { STATE.inflight.abort(); return; }
  const question = els.input.value.trim();
  if (!question) return;
  els.input.value = '';
  clearTimeout(prefetchTimer);
  runQuery(question);
};

// File input + drag-drop — several files may be added; each becomes a selectable chip.
// Ingest sequentially so the per-document renders don't race.
els.fileInput.addEventListener('change', async (e) => {
  const files = [...(e.target.files || [])];
  els.fileInput.value = '';   // allow re-selecting the same file later
  for (const f of files) await ingest(f);
});
els.dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  els.dropzone.style.borderColor = '#60a5fa';
});
els.dropzone.addEventListener('dragleave', () => {
  els.dropzone.style.borderColor = '';
});
els.dropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  els.dropzone.style.borderColor = '';
  const files = [...(e.dataTransfer?.files || [])];
  for (const f of files) await ingest(f);
});

// Compose
els.composer.addEventListener('submit', (e) => {
  e.preventDefault();
  send();
});
els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (STATE.inflight) return;   // a turn is running — Enter is inert; Stop is the explicit button
    send();
  }
});
// Proactive search as you type — speculatively warm the web for the in-progress query
// (auto mode only). The result is quarantined and preserved only if the turn consumes it.
els.input.addEventListener('input', maybePrefetch);

// ── Message actions: copy · reply/quote · fork ─────────────────────────────
//
// Each rendered message carries a copy/reply/fork bar (wired in chat.js). Copy
// is self-contained there; the reply and fork behaviours touch session state
// and the composer, so they live here and are registered once.

// REPLY / QUOTE: drop the message — from the model or from you — into the
// composer as a Markdown blockquote, so the next turn responds to that exact
// message. The cursor lands after the quote, ready to type the response.
const quoteIntoComposer = (text) => {
  const quoted = String(text || '').trim().split('\n').map(l => '> ' + l).join('\n');
  const existing = els.input.value;
  els.input.value = (existing ? existing.replace(/\s+$/, '') + '\n\n' : '') + quoted + '\n\n';
  if (STATE.setPane && window.matchMedia('(max-width: 820px)').matches) STATE.setPane('chat');
  els.input.focus();
  els.input.selectionStart = els.input.selectionEnd = els.input.value.length;
  els.input.scrollTop = els.input.scrollHeight;
};

// FORK: rebuild the transcript up to and including the chosen message straight
// from the DOM (each message stashes its role + plain text), seed it into
// localStorage under a one-shot key, and open a fresh chat tab pointed at it
// via the URL hash. This chat is left exactly as it was — the fork is a true
// branch, an independent conversation that starts from that point.
const collectTranscriptUpTo = (targetEl) => {
  const out = [];
  for (const el of els.messages.children) {
    if (el.dataset?.role) out.push({ role: el.dataset.role, content: el._msgText ?? '' });
    if (el === targetEl) break;
  }
  return out;
};
const forkFrom = (targetEl) => {
  const transcript = collectTranscriptUpTo(targetEl);
  if (!transcript.length) return;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const key = `eoreader.fork.${id}`;
  try {
    localStorage.setItem(key, JSON.stringify({ v: 1, createdAt: new Date().toISOString(), transcript }));
  } catch {
    setStatus('fork failed — could not stage the transcript (storage full?)');
    return;
  }
  const url = new URL('chat.html', location.href);
  url.hash = `fork=${id}`;
  const win = window.open(url.href, '_blank');
  if (!win) setStatus('fork staged — allow pop-ups, or open chat.html#fork=' + id);
};

setMessageActionHandlers({ onQuote: quoteIntoComposer, onFork: forkFrom });

// On boot, if this tab was opened as a fork, replay the seeded transcript into
// the chat pane and the session fold, then consume the seed so a reload starts
// clean. The continuation picks up exactly where the parent chat branched.
const hydrateFork = () => {
  const m = /(?:^|[#&])fork=([\w-]+)/.exec(location.hash || '');
  if (!m) return;
  const key = `eoreader.fork.${m[1]}`;
  let seed = null;
  try { seed = JSON.parse(localStorage.getItem(key) || 'null'); } catch { seed = null; }
  try { localStorage.removeItem(key); } catch { /* ignore */ }
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
  if (!seed || !Array.isArray(seed.transcript) || !seed.transcript.length) return;
  for (const msg of seed.transcript) {
    if (msg.role === 'user') {
      renderUserMessage(els.messages, msg.content);
      STATE.history.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      renderAssistantMessage(els.messages, msg.content, [], { route: 'chat', mode: STATE.grounding });
      STATE.history.push({ role: 'assistant', content: msg.content });
    }
  }
  setStatus(`forked chat — ${STATE.history.length} message${STATE.history.length > 1 ? 's' : ''} carried over · continue below`);
};
hydrateFork();

// Backend switch — auto-load the new model immediately.
els.backend.addEventListener('change', () => {
  STATE.backendName = els.backend.value;
  STATE.model = null;
  setStatus(`${STATE.backendName}: starting…`);
  ensureModel().catch(() => { /* status already reflects failure */ });
});

// THE LENS PORT toggle (spec-the-lens-port.md). A persisted on/off setting: when on, the turn
// builds the concept→token bridge and hands the steering config to the backend, which biases the
// decoder's logits through the lens. Off (the default) leaves the golden phrase()+veto path
// byte-identical. Restore the saved choice, reflect it on the checkbox, persist on change.
try {
  const l = localStorage.getItem('eoreader.lensPort');
  if (l === '0' || l === '1') STATE.lensPort = l === '1';
} catch { /* default off stands */ }
if (els.lensPort) {
  els.lensPort.checked = STATE.lensPort;
  els.lensPort.addEventListener('change', () => {
    STATE.lensPort = els.lensPort.checked;
    try { localStorage.setItem('eoreader.lensPort', STATE.lensPort ? '1' : '0'); } catch { /* ignore */ }
  });
}

// THE DIAL (spec-the-pantheon.md, Track E): the plain-language voice preference, layered over
// auto-mount. Three plain toggles — never god-names. Restore the saved choice, reflect it, persist
// on change. Effect is only audible once the cartridges are baked; the preference is held regardless.
try {
  const raw = localStorage.getItem('eoreader.voice');
  if (raw) STATE.voicePref = { ...STATE.voicePref, ...JSON.parse(raw) };
} catch { /* default (none) stands */ }
const voiceEls = { terse: els.voiceTerse, cautious: els.voiceCautious, concrete: els.voiceConcrete };
for (const [key, el] of Object.entries(voiceEls)) {
  if (!el) continue;
  el.checked = !!STATE.voicePref[key];
  el.addEventListener('change', () => {
    STATE.voicePref = { ...STATE.voicePref, [key]: el.checked };
    try { localStorage.setItem('eoreader.voice', JSON.stringify(STATE.voicePref)); } catch { /* ignore */ }
  });
}

// No grounding chip and no web chip any more (internet-native, minimal settings). The
// grounding register is fixed to 'auto' and web search is fixed to 'auto': the web is the
// tool's memory, so it is ALWAYS the ground — never a per-message option the user manages.
// Both were previously persisted and cycled; now they are constants, set once at STATE init.
STATE.grounding = 'auto';
STATE.webSearch = 'auto';

// Self-directed inquiry (the inquire stage, turn/stages.js) stays OFF — an experimental
// power-user toggle; STATE.inquire defaults false and the pipeline behaves exactly as "off".

// The per-claim source view (transparency) is a per-ANSWER view preference, not a send-time
// option — it stays, persisted, toggled beneath each answer. The only thing the user modifies.
try {
  const t = localStorage.getItem('eoreader.transparency');
  if (t === '0' || t === '1') STATE.transparency = t === '1';
} catch { /* default on stands */ }

// The Mind chip — pinned and always present. Restore the consult preference, show
// the chip immediately, then probe OPFS after boot so a returning user whose memory
// is already on disk sees "ready" without rebuilding. The probe never blocks boot.
try {
  const m = localStorage.getItem('eoreader.mindMode');
  if (m === 'recall' || m === 'weave' || m === 'off') STATE.mindMode = m;
} catch { /* default off */ }
renderDocChips();
(window.requestIdleCallback || ((f) => setTimeout(f, 200)))(probeMind);

// Audit: live-render on every step / finish. Export stays disabled until there
// is at least one turn, so the button never hands back an empty file.
els.exportBtn.disabled = true;
STATE.audit.subscribe((turn) => {
  renderAuditTurn(els.auditView, turn);
  els.exportBtn.disabled = false;
});
els.exportBtn.addEventListener('click', () => exportAudit(STATE.audit));
renderEmptyAudit(els.auditView);

// Export the chat window — a small two-item menu in the Chat pane header. "Text
// only" hands back the clean transcript; "Full audit" hands back every answer
// with its prompting and surfing. Both download a Markdown file. The button
// enables once there is something to export (a turn, or a forked-in transcript).
if (els.exportChatBtn && els.exportChatMenu) {
  const closeMenu = () => {
    els.exportChatMenu.hidden = true;
    els.exportChatBtn.setAttribute('aria-expanded', 'false');
  };
  els.exportChatBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = els.exportChatMenu.hidden;
    els.exportChatMenu.hidden = !open;
    els.exportChatBtn.setAttribute('aria-expanded', String(open));
  });
  els.exportChatMenu.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-mode]');
    if (!b) return;
    // "activity" is the single-file, all-the-activity export: the transcript, the
    // full audit, every loaded document's reading log, AND pointers to the web
    // pages imported (their bytes stay in OPFS; the export references them). The
    // other two modes export just the chat window (Markdown).
    const ok = b.dataset.mode === 'activity'
      ? await exportActivity({ history: STATE.history, audit: STATE.audit, docs: STATE.docs, rawStore: rawStoreOf() })
      : exportChat(b.dataset.mode, { history: STATE.history, turns: STATE.audit.turns });
    setStatus(ok
      ? (b.dataset.mode === 'activity' ? 'exported all activity (.json)'
        : b.dataset.mode === 'full' ? 'exported chat — full audit (.md)'
        : 'exported chat — transcript (.md)')
      : 'nothing to export yet');
    closeMenu();
  });
  // Click-away and Escape dismiss the menu.
  document.addEventListener('click', (e) => { if (!els.exportChatWrap?.contains?.(e.target)) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
}
// Enable the Export menu once there is anything to hand back — a recorded turn,
// a transcript a fork seeded in, or a loaded document (whose reading log the
// "Everything" export carries even before the first chat turn). A hoisted
// declaration so renderDocChips (which runs at init, before this point) can call
// it without tripping the temporal dead zone.
function refreshExportChat() {
  if (els.exportChatBtn) {
    els.exportChatBtn.disabled =
      !(STATE.history.length || STATE.audit.turns.length || STATE.docs.size);
  }
}
STATE.audit.subscribe(refreshExportChat);
refreshExportChat();

// Document tabs.
els.docTabs.addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (b) setTab(b.dataset.tab);
});

// Mobile pane switcher — the three panes can't share a phone screen, so a bottom
// bar shows one at a time. Desktop ignores this (the bar is hidden in CSS, and
// the panes lay out as a grid). The choice is held on <body data-pane> which the
// CSS reads to reveal the active pane.
const mobileNav = document.getElementById('mobile-nav');
const setPane = (name) => {
  document.body.dataset.pane = name;
  for (const b of mobileNav.querySelectorAll('.mnav-btn')) {
    b.classList.toggle('active', b.dataset.pane === name);
  }
  // The graph/canvas views measure their container; reveal then re-fit so they
  // don't render at zero width while hidden.
  if (name === 'doc') {
    if (STATE.activeTab === 'graph') STATE.graph?.reheat?.();
    if (STATE.activeTab === 'idle')  STATE.idle?.refresh?.();
  }
};
mobileNav.addEventListener('click', (e) => {
  const b = e.target.closest('.mnav-btn');
  if (b) setPane(b.dataset.pane);
});
// Default to Chat — the primary interaction. (CSS only consults data-pane on
// narrow screens, so this is inert on desktop.)
setPane('chat');
// Expose so the turn path can pull the user back to chat when a query starts.
STATE.setPane = setPane;

// Clicking a sentence moves the reading cursor (and highlights it). The
// graph re-projects around that position with γ-decay.
els.docView.addEventListener('click', (e) => {
  const s = e.target.closest('.sentence');
  if (!s) return;
  const idx = parseInt(s.dataset.idx, 10);
  if (isNaN(idx)) return;
  highlightSources(els.docView, [idx]);
  STATE.graph?.setCursor(idx);
});

// Citation clicks (delegated)
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t?.classList?.contains('cite')) {
    const idx = parseInt(t.dataset.idx, 10);
    if (!isNaN(idx)) highlightSources(els.docView, [idx]);
  }
});

// Empty placeholders until a document is loaded.
STATE.graph = renderGraph(null, els.graphView, { onSelectSentence: selectSentence });
renderLog(null, els.logView, { onSelectSentence: selectSentence });

// The feed view: write a message, see the graph around its terms (nested holons,
// unclipped) and the exact prompt the model would be fed. Mounted once; it reads
// the live document and embedder through getters and never calls the model.
mountFeed(els.feedView, {
  getDoc:      () => STATE.doc,
  getEmbedder: () => STATE.embedder,
  onSelectSentence: selectSentence,
});

// The predict view: scrub the cursor, watch the reader predict its next MOVE (the
// operator, not the word) from the move-log — no model called. Reads the live
// document through the getter; rebuilds the move-log only when the doc changes.
STATE.predict = mountPredict(els.predictView, {
  getDoc: () => STATE.doc,
  onSelectSentence: selectSentence,
});

// The replay view: press play and watch the reading happen, slowly, one proposition
// at a time — each line arriving under the expectation it carried in, its propositions
// revealing one by one, the reading lingering where belief moves. No model called; the
// beats are read off readingAt(doc, cursor), rebuilt only when the doc changes.
STATE.replay = mountReplay(els.replayView, {
  getDoc: () => STATE.doc,
  onSelectSentence: selectSentence,
});

// The Surfer view: a glass box on the surfer's navigation. In READING mode, drop the
// anchor anywhere in the loaded document and watch surfFold run live (pure, no model) —
// the reach it measured, the surprises it arrested on, the frame-breaks, the peak. In
// CHAT mode, replay exactly what the surfer did on each prompted turn, read off the
// recorded audit (reading.surf + the fold step's Significance column). No model called.
STATE.surfer = mountSurfer(els.surferView, {
  getDoc: () => STATE.doc,
  getAudit: () => STATE.audit,
  onSelectSentence: selectSentence,
});

// The Gates view: the limits on the logits, watched live. The lens port (src/write/lens-port.js)
// is a LogitProcessor — it reshapes the model's next-token distribution during decode. This
// surface reads the model's live per-token intervention feed (the void gate clamping an
// ungrounded number, an invented name hitting the entity trie) and, off the audit, how hard
// the logits were held on each prompted turn. Unconstrained when the Lens port is off (golden path).
STATE.gates = mountGates(els.gatesView, {
  getAudit: () => STATE.audit,
  getModel: () => STATE.model,
  onSelectSentence: selectSentence,
});

// The Rest view: after the first read, the instrument keeps working the open set
// that ingress left — re-reading on its own and surfacing, from later in the same
// document, what it could not learn at first sight. Reafferent, firewalled, yours
// to confirm (the §15 idle loop over the real projected graph).
STATE.idle = mountIdle(els.idleView, {
  getDoc: () => STATE.doc,
  onSelectSentence: selectSentence,
});

// Boot: kick the selected model now so first message is instant.
ensureModel().catch(() => { /* status already reflects failure */ });

// Boot the geometric reader: a separate MiniLM organ + the phasepost classifier,
// assembled behind the initialization animation. Non-blocking — the chat above
// is usable throughout, and the classifier holds at no-commit until (and unless)
// MiniLM and verified centroids both come online. Kept apart from STATE.embedder
// (the hash organ the retrieval path uses) so this changes nothing below it.
const geometricEmbedder = createMiniLMEmbedder();
STATE.geometricEmbedder = geometricEmbedder;   // reused by reading mode's meaning fold
STATE.geometric = bootGeometricReader(document.body, { embedder: geometricEmbedder });

window.STATE = STATE; // for in-browser inspection
