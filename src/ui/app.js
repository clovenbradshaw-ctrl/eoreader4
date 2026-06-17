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
import { markSites, carveBonds } from '../read/index.js';
import { renderUserMessage, createThinkingMessage,
         updateThinking, finalizeThinking } from './chat.js';
import { renderDoc, highlightSources, markSiteSentences } from './doc-view.js';
import { renderGraph } from './graph-view.js';
import { renderLog } from './log-view.js';
import { renderAuditTurn, renderEmptyAudit, exportAudit } from './audit-view.js';

const STATE = {
  doc:       null,
  audit:     createAuditLog(),
  embedder:  createHashEmbedder(),
  backendName: 'echo',
  model:     null,
  loadingBackend: null,  // promise of the in-flight model load, if any
  embedderName: 'hash',
  graph:     null,       // graph-view controller for the current doc
  activeTab: 'text',
};

const els = {
  status:    document.getElementById('status'),
  dropzone:  document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  docView:   document.getElementById('doc-view'),
  graphView: document.getElementById('graph-view'),
  logView:   document.getElementById('log-view'),
  docTabs:   document.getElementById('doc-tabs'),
  messages:  document.getElementById('messages'),
  composer:  document.getElementById('composer'),
  input:     document.getElementById('input'),
  send:      document.getElementById('send'),
  auditView: document.getElementById('audit-view'),
  exportBtn: document.getElementById('export-audit'),
  backend:   document.getElementById('backend'),
  embedder:  document.getElementById('embedder'),
  carve:     document.getElementById('carve'),
};

// The embedding organ — the √2/geometry cell. Hash is instant lexical; MiniLM
// downloads a transformer and gives real geometry (and lets the site-role and
// predictive-surprise passes run for real). Warming is lazy and idempotent.
const ensureEmbedder = async () => {
  const e = STATE.embedder;
  if (!e || typeof e.warm !== 'function' || e.isWarm?.()) return e;
  if (STATE.embedderName !== 'minilm') return e;
  try {
    setStatus('MiniLM: downloading…');
    await e.warm();
    setStatus('MiniLM: ready');
  } catch (err) {
    setStatus(`MiniLM: failed — ${err?.message || err}`);
  }
  return e;
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
  });
  renderLog(doc, els.logView, { onSelectSentence: selectSentence });
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
  els.dropzone.style.display = name === 'text' ? '' : 'none';
  if (name === 'graph') STATE.graph?.reheat?.();
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
    await ensureEmbedder();   // warm the geometry organ so retrieval is semantic
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
    auditLog: STATE.audit,
    onStep:   (name, ctx, data) => updateThinking(thinking, name, data, ctx),
  });
  const ms = Math.round(performance.now() - t0);

  finalizeThinking(thinking, result.answer, result.sources, {
    route: result.turn.route, ms, flags: result.flags,
  });
  if (result.sources?.length) highlightSources(els.docView, result.sources);
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

// Embedder switch — swap the geometry organ. On upgrade to a real embedder,
// warm it and re-run the semantic site-role pass over the open document.
els.embedder.addEventListener('change', async () => {
  STATE.embedderName = els.embedder.value;
  STATE.embedder = STATE.embedderName === 'minilm' ? createMiniLMEmbedder() : createHashEmbedder();
  await ensureEmbedder();
  if (STATE.doc && STATE.embedder.id !== 'hash-embed') {
    try {
      const sites = await markSites(STATE.doc, STATE.embedder);
      if (sites.length) {
        markSiteSentences(els.docView, sites);
        renderLog(STATE.doc, els.logView, { onSelectSentence: selectSentence });
      }
    } catch { /* role pass is best-effort */ }
  }
});

// Carve — ask the model to read each sentence and state its bonds, beyond the
// regex extractor. Re-renders the graph and log from the enriched log.
els.carve.addEventListener('click', async () => {
  if (!STATE.doc) { setStatus('load a document first'); return; }
  els.carve.disabled = true;
  try {
    await ensureModel();
    setStatus('carving bonds with the model…');
    const { carved, scanned } = await carveBonds(STATE.doc, STATE.model, {
      onProgress: ({ at, total, carved }) => setStatus(`carving… s${at}/${total} · ${carved} bonds`),
    });
    STATE.graph?.destroy?.();
    STATE.graph = renderGraph(STATE.doc, els.graphView, {
      onSelectSentence: selectSentence, getModel: () => STATE.model, embedder: STATE.embedder,
    });
    renderLog(STATE.doc, els.logView, { onSelectSentence: selectSentence });
    setStatus(`carved ${carved} bonds across ${scanned} sentences`);
  } catch (e) {
    setStatus(`carve failed — ${e?.message || e}`);
  } finally {
    els.carve.disabled = false;
  }
});

// Audit: live-render on every step / finish.
STATE.audit.subscribe((turn) => renderAuditTurn(els.auditView, turn));
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

// Boot: kick the selected model now so first message is instant.
ensureModel().catch(() => { /* status already reflects failure */ });

window.STATE = STATE; // for in-browser inspection
