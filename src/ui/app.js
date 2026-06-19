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

import { ingestText }       from '../ingest/index.js';
import { runTurn }          from '../turn/index.js';
import { createAuditLog }   from '../audit/index.js';
import { createModel, createHashEmbedder, createMiniLMEmbedder } from '../model/index.js';
import { bootGeometricReader } from '../boot/index.js';
import { markSites }        from '../read/index.js';
import { renderUserMessage, createThinkingMessage,
         updateThinking, finalizeThinking } from './chat.js';
import { renderDoc, highlightSources, markSiteSentences } from './doc-view.js';
import { renderGraph } from './graph-view.js';
import { renderLog } from './log-view.js';
import { mountFeed } from './feed-view.js';
import { mountPredict } from './predict-view.js';
import { renderAuditTurn, renderEmptyAudit, exportAudit } from './audit-view.js';

const STATE = {
  doc:       null,
  audit:     createAuditLog(),
  embedder:  createHashEmbedder(),
  backendName: 'echo',
  model:     null,
  loadingBackend: null,  // promise of the in-flight model load, if any
  graph:     null,       // graph-view controller for the current doc
  activeTab: 'text',
  history:   [],         // the running transcript, fed back each turn (the session fold)
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

const ingest = async (file) => {
  setStatus('parsing…');
  const t0 = performance.now();
  const doc = await ingestText(file);
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
  const t1 = performance.now();
  const g = doc.projectGraph();
  setStatus(`parsed: ${doc.sentences.length} sentences, ${doc.log.length} events, ` +
    `${g.entities.size} figures, ${g.edges.length} links, ${Math.round(t1 - t0)}ms`);

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
      if (sites.length) {
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

const send = async () => {
  const question = els.input.value.trim();
  if (!question) return;

  els.input.value = '';
  els.send.disabled = true;
  renderUserMessage(els.messages, question);

  // Live "thinking" bubble — updates as each pipeline stage finishes.
  const thinking = createThinkingMessage(els.messages,
    STATE.doc ? 'thinking…' : 'thinking (no doc — chat mode)…');

  try {
    await ensureModel();
  } catch (err) {
    finalizeThinking(thinking, `Model failed to load: ${err?.message || err}`, [], {
      route: 'error', flags: [],
    });
    els.send.disabled = false;
    return;
  }

  const t0 = performance.now();
  const result = await runTurn({
    question,
    doc:      STATE.doc,        // may be null — chat-only path
    model:    STATE.model,
    embedder: STATE.embedder,
    // The geometric organ for the edge-grounding fact-check (the talker's assertions
    // contrasted against the graph). Holds at no-commit until MiniLM + centroids come
    // online, so its geometric verdicts degrade to indeterminate until then; the
    // embedder-free symbolic algebra (disjoint-kinship axioms) fires regardless.
    classifier: STATE.geometric?.installer?.getState?.().classifier || null,
    auditLog: STATE.audit,
    history:  STATE.history,    // the prior transcript — the session fold reads it
    onStep:   (name, ctx, data) => updateThinking(thinking, name, data, ctx),
  });
  const ms = Math.round(performance.now() - t0);

  finalizeThinking(thinking, result.answer, result.sources, {
    route: result.turn.route, ms, flags: result.flags,
  });
  if (result.sources?.length) highlightSources(els.docView, result.sources);

  // Append the completed exchange so the next turn's session fold can read it back.
  STATE.history.push({ role: 'user', content: question });
  STATE.history.push({ role: 'assistant', content: result.answer || '' });

  els.send.disabled = false;
};

// File input + drag-drop
els.fileInput.addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (f) ingest(f);
});
els.dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  els.dropzone.style.borderColor = '#60a5fa';
});
els.dropzone.addEventListener('dragleave', () => {
  els.dropzone.style.borderColor = '';
});
els.dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  els.dropzone.style.borderColor = '';
  const f = e.dataTransfer?.files?.[0];
  if (f) ingest(f);
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
