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
import { runTurn, runWebFollowup, formulateSearchQuery, loadShapeLibrary } from '../turn/index.js';
import { createWebClient, searchAndAdmit, createRawStore } from '../ingest/index.js';
import { createSpeculativeWeb } from './prefetch.js';
import { createAuditLog }   from '../audit/index.js';
import { createModel, createHashEmbedder, createMiniLMEmbedder } from '../model/index.js';
import { bootGeometricReader } from '../boot/index.js';
import { markSites }        from '../perceiver/index.js';
import { createHorizon, structuralGround } from '../surfer/index.js';
import { createCast } from '../converse/index.js';
import { renderUserMessage, createThinkingMessage,
         updateThinking, finalizeThinking, streamThinking, streamImpression, renderMindBlock,
         renderWebProposal, renderWebResult, setThinkingNote, buildPropositions } from './chat.js';
import { createMind } from '../mind/index.js';
import { foldImpression } from '../write/index.js';
import { renderDoc, highlightSources, markSiteSentences } from './doc-view.js';
import { renderGraph } from './graph-view.js';
import { renderLog } from './log-view.js';
import { mountFeed } from './feed-view.js';
import { mountPredict } from './predict-view.js';
import { mountIdle } from './idle-view.js';
import { renderAuditTurn, renderEmptyAudit, exportAudit } from './audit-view.js';

const STATE = {
  doc:       null,       // the document currently shown in the doc pane
  docs:      new Map(),  // docId → parsed doc, every loaded document
  selected:  new Set(),  // docIds tagged for grounding (the persistent chips)
  audit:     createAuditLog(),
  embedder:  createHashEmbedder(),
  backendName: 'webllm',
  model:     null,
  loadingBackend: null,  // promise of the in-flight model load, if any
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
  webSearch: 'auto',     // FIXED to AUTO — the web is the tool's memory, so every turn searches up front and
                         //   answers grounded in what it gathered. Not a per-message option (no web chip).
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
  predictView: document.getElementById('predict-view'),
  idleView:  document.getElementById('idle-view'),
  docTabs:   document.getElementById('doc-tabs'),
  messages:  document.getElementById('messages'),
  composer:  document.getElementById('composer'),
  input:     document.getElementById('input'),
  send:      document.getElementById('send'),
  auditView: document.getElementById('audit-view'),
  exportBtn: document.getElementById('export-audit'),
  backend:   document.getElementById('backend'),
  docChips:  document.getElementById('doc-chips'),
};

const setStatus = (s) => { els.status.textContent = s; };

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
};

// Show the empty placeholders (no document loaded).
const clearDocPane = () => {
  STATE.doc = null;
  els.docView.innerHTML = '';
  STATE.graph?.destroy?.();
  STATE.graph = renderGraph(null, els.graphView, { onSelectSentence: selectSentence });
  renderLog(null, els.logView, { onSelectSentence: selectSentence });
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
  els.feedView.hidden  = name !== 'feed';
  els.predictView.hidden = name !== 'predict';
  els.idleView.hidden  = name !== 'idle';
  els.dropzone.style.display = name === 'text' ? '' : 'none';
  if (name === 'graph') STATE.graph?.reheat?.();
  // The move-log / open-set are rebuilt only when the document changed (refresh is
  // a no-op otherwise), so opening the tab is cheap after the first build.
  if (name === 'predict') STATE.predict?.refresh();
  if (name === 'idle')    STATE.idle?.refresh();
};

// Run one query through the pipeline and render it. Factored out of the composer so
// an errored turn can offer a one-click retry (re-runs the very same question).
const runQuery = async (question) => {
  if (!question) return;
  // On a phone the answer lands in the chat pane — make sure it's the one shown.
  if (STATE.setPane && window.matchMedia('(max-width: 820px)').matches) STATE.setPane('chat');
  els.send.disabled = true;
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
      route: 'error', flags: [], mode: STATE.grounding, onRetry: () => runQuery(question),
    });
    els.send.disabled = false;
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
    onStep:   (name, ctx, data) => {
      updateThinking(thinking, name, data, ctx);
      // As soon as the fold has read the passage, type its IMPRESSION into the bubble
      // while the talker warms — model-free streaming during the long time-to-first-
      // token (docs/streaming-answer.md). Cleared when the real answer begins.
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

  // INVERTED FLOW (auto): search the web FIRST, fold the results into the turn's scope, and let
  // the model answer from the surfer's reading of [web + documents + memory] in ONE grounded
  // pass — instead of answering from parametric knowledge and augmenting after (the old
  // double-LLM path). The meaning graph of the fetched content is fed to the talker; every
  // source is recorded for the transparency block. Confirm/off keep the proposer-only path.
  let webGather = null;
  if (webMode === 'auto') {
    setThinkingNote(thinking, '🌐 searching the web…');
    try {
      const q = await formulateSearchQuery({ model: STATE.model, question, history: STATE.history });
      const admitted = await searchAndAdmit(q, { client: webClientOf(), rawStore: rawStoreOf(), kind: 'auto', fetchPages: true, k: 4 });
      const webDocs = (admitted || []).map(a => a?.doc).filter(Boolean);
      if (webDocs.length) {
        turnArgs.docs = [...selectedDocs, ...webDocs];   // web joins the grounding scope, beside any loaded docs
        turnArgs.groundGraph = true;                     // feed the talker the MEANING GRAPH of what was gathered
        webGather = { query: q, docs: webDocs };
      }
    } catch { /* network/search failed — fall through to the ungrounded turn */ }
    setThinkingNote(thinking, '');
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
      onRetry: () => runQuery(question),
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
    if (route === 'error') return;
    if (!asstEntry) {
      STATE.history.push({ role: 'user', content: question });
      asstEntry = { role: 'assistant', content: res.answer || '' };
      STATE.history.push(asstEntry);
    } else {
      asstEntry.content = res.answer || '';
    }
    if (res.unbound) asstEntry.unbound = true; else delete asstEntry.unbound;
  };

  render(result, Math.round(performance.now() - t0));
  if (mindSpans && (result.route || result.turn?.route) !== 'error') renderMindBlock(thinking, mindSpans);
  // Source transparency: when the web was gathered up front, show every page it grounded on
  // (title · link · fetched-at) and the meaning graph the talker reasoned over.
  if (webGather && (result.route || result.turn?.route) !== 'error') {
    renderWebResult(thinking, {
      query: webGather.query, results: webGather.docs.length, grounded: true,
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
    if (mindSpans && (result.route || result.turn?.route) !== 'error') renderMindBlock(thinking, mindSpans);
    if (result.webFetched) renderWebResult(thinking, result.webFetched);
    commitHistory(result);
  };

  // CONFIRM mode keeps the proposer-only path: answer first, then offer the search beneath it.
  // AUTO already gathered up front (above), so it does not run a follow-up here.
  if (webMode === 'confirm' && result.webProposal) {
    renderWebProposal(thinking, result.webProposal, { onSearch: (q) => runFollowup(q) });
  }

  els.send.disabled = false;
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

// The composer's submit path: read the box, clear it, run.
const send = () => {
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
    send();
  }
});
// Proactive search as you type — speculatively warm the web for the in-progress query
// (auto mode only). The result is quarantined and preserved only if the turn consumes it.
els.input.addEventListener('input', maybePrefetch);

// Backend switch — auto-load the new model immediately.
els.backend.addEventListener('change', () => {
  STATE.backendName = els.backend.value;
  STATE.model = null;
  setStatus(`${STATE.backendName}: starting…`);
  ensureModel().catch(() => { /* status already reflects failure */ });
});

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
