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
import { runTurn }          from '../turn/index.js';
import { createAuditLog }   from '../audit/index.js';
import { createModel, createHashEmbedder, createMiniLMEmbedder } from '../model/index.js';
import { bootGeometricReader } from '../boot/index.js';
import { markSites }        from '../perceiver/index.js';
import { renderUserMessage, createThinkingMessage,
         updateThinking, finalizeThinking } from './chat.js';
import { renderDoc, highlightSources, markSiteSentences } from './doc-view.js';
import { renderGraph } from './graph-view.js';
import { renderLog } from './log-view.js';
import { mountFeed } from './feed-view.js';
import { mountPredict } from './predict-view.js';
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
  grounding: 'auto',     // how answers use the document: 'auto' | 'grounded' | 'free' (the chip)
};

// The grounding register the chip cycles through. One value (STATE.grounding) that the
// turn pipeline fans out to the route, the retrieval fallback, and the system prompt.
const GROUNDING_MODES  = ['auto', 'grounded', 'free'];
const GROUNDING_LABEL  = { auto: 'Auto', grounded: 'Chat with document', free: 'Free form' };
const GROUNDING_TITLE  = {
  auto:     'Auto — use the document when it covers the question, otherwise answer from general knowledge.',
  grounded: 'Chat with document — answer from the loaded document and tag it as a source; if it doesn’t cover the question, say so.',
  free:     'Free form — answer from general knowledge, ignoring the document.',
};

const els = {
  status:    document.getElementById('status'),
  dropzone:  document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  docView:   document.getElementById('doc-view'),
  graphView: document.getElementById('graph-view'),
  logView:   document.getElementById('log-view'),
  feedView:  document.getElementById('feed-view'),
  predictView: document.getElementById('predict-view'),
  docTabs:   document.getElementById('doc-tabs'),
  messages:  document.getElementById('messages'),
  composer:  document.getElementById('composer'),
  input:     document.getElementById('input'),
  send:      document.getElementById('send'),
  auditView: document.getElementById('audit-view'),
  exportBtn: document.getElementById('export-audit'),
  backend:   document.getElementById('backend'),
  groundingChip: document.getElementById('grounding-chip'),
  docChips:  document.getElementById('doc-chips'),
};

const setStatus = (s) => { els.status.textContent = s; };

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

// The persistent document chips: every loaded document is a chip; tagged (selected)
// ones are grounded against, and stay selected until deselected. Clicking a chip
// toggles its selection and views it; the × removes it.
const renderDocChips = () => {
  const root = els.docChips;
  root.innerHTML = '';
  if (STATE.docs.size === 0) { root.hidden = true; return; }
  root.hidden = false;
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
  setStatus('parsing…');
  const t0 = performance.now();
  const doc = await ingestText(file);
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
  setStatus(`parsed: ${doc.sentences.length} sentences, ${doc.log.length} events, ` +
    `${g.entities.size} figures, ${g.edges.length} links, ${Math.round(t1 - t0)}ms · ` +
    `${STATE.docs.size} doc${STATE.docs.size > 1 ? 's' : ''} loaded`);

  // Semantic site-role pass — chrome by role, not a list. Marks off-distribution
  // figure-less units as sites (DEF role=site) so retrieval skips furniture.
  // It reads a unit's role with the embedder, so it needs real semantics: the
  // hash embedder is too weak (it would mismark rare-vocabulary narrative), so
  // the pass only runs with a capable embedder. The mechanism is the point;
  // a stronger embedder sharpens the judgement.
  const capable = STATE.embedder?.id && STATE.embedder.id !== 'hash-embed';
  if (capable && doc.sentences.length > 20) {
    try {
      const sites = await markSites(doc, STATE.embedder);
      if (sites.length && STATE.doc?.docId === id) {
        markSiteSentences(els.docView, sites);
        renderLog(doc, els.logView, { onSelectSentence: selectSentence });
      }
    } catch { /* role pass is best-effort */ }
  }
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
  els.dropzone.style.display = name === 'text' ? '' : 'none';
  if (name === 'graph') STATE.graph?.reheat?.();
  // The move-log is rebuilt only when the document changed (refresh is a no-op
  // otherwise), so opening the tab is cheap after the first build.
  if (name === 'predict') STATE.predict?.refresh();
};

// Run one query through the pipeline and render it. Factored out of the composer so
// an errored turn can offer a one-click retry (re-runs the very same question).
const runQuery = async (question) => {
  if (!question) return;
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

  const t0 = performance.now();
  const result = await runTurn({
    question,
    docs:     selectedDocs,     // the selected set — folded into one composite to ground against
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
    grounding: STATE.grounding, // the Auto / Chat with document / Free form register (the chip)
    onStep:   (name, ctx, data) => updateThinking(thinking, name, data, ctx),
  });
  const ms = Math.round(performance.now() - t0);
  const route = result.route || result.turn.route;

  // Tag the documents the answer actually drew on as sources (each cited document).
  const docNames = route === 'grounded'
    ? (result.sourceDocs?.length ? result.sourceDocs : selectedDocs.map(d => d.docId))
    : [];

  finalizeThinking(thinking, result.answer, result.sources, {
    route, ms, flags: result.flags,
    mode: STATE.grounding,
    docNames,
    onDocSource: (name) => { if (name && STATE.docs.has(name)) viewDoc(name); setTab('text'); },
    onRetry: () => runQuery(question),
  });
  // Highlight only when grounding a single document — composite indices don't map onto
  // one doc pane (clicking a source chip switches to that document instead).
  if (result.sources?.length && selectedDocs.length <= 1) highlightSources(els.docView, result.sources);

  // Append the completed exchange so the next turn's session fold can read it back —
  // but never feed an error turn back into the conversation (it would poison the fold).
  if (route !== 'error') {
    STATE.history.push({ role: 'user', content: question });
    STATE.history.push({ role: 'assistant', content: result.answer || '' });
  }

  els.send.disabled = false;
};

// The composer's submit path: read the box, clear it, run.
const send = () => {
  const question = els.input.value.trim();
  if (!question) return;
  els.input.value = '';
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

// Backend switch — auto-load the new model immediately.
els.backend.addEventListener('change', () => {
  STATE.backendName = els.backend.value;
  STATE.model = null;
  setStatus(`${STATE.backendName}: starting…`);
  ensureModel().catch(() => { /* status already reflects failure */ });
});

// Grounding chip — one click cycles Auto → Grounded → Free form → Auto. The choice
// is persisted so it survives a reload, and reflected on the chip's label + colour.
const applyGrounding = () => {
  const m = STATE.grounding;
  els.groundingChip.textContent  = GROUNDING_LABEL[m] || 'Auto';
  els.groundingChip.title        = GROUNDING_TITLE[m] || '';
  els.groundingChip.dataset.mode = m;
};
try {
  const saved = localStorage.getItem('eoreader.grounding');
  if (saved && GROUNDING_MODES.includes(saved)) STATE.grounding = saved;
} catch { /* localStorage may be unavailable (private mode) — default stands */ }
applyGrounding();
els.groundingChip.addEventListener('click', () => {
  const i = GROUNDING_MODES.indexOf(STATE.grounding);
  STATE.grounding = GROUNDING_MODES[(i + 1) % GROUNDING_MODES.length];
  try { localStorage.setItem('eoreader.grounding', STATE.grounding); } catch { /* ignore */ }
  applyGrounding();
});

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
