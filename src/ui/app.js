// Wire the UI. No turn logic here — every interaction calls into the
// turn holon (`runTurn`) and renders the result. The UI sees the audit
// turn returned from the pipeline; it does not compute anything itself.

import { ingestText }       from '../ingest/index.js';
import { runTurn }          from '../turn/index.js';
import { createAuditLog }   from '../audit/index.js';
import { createModel, createHashEmbedder } from '../model/index.js';
import { renderUserMessage, renderAssistantMessage } from './chat.js';
import { renderDoc, highlightSources } from './doc-view.js';
import { renderAuditTurn, renderEmptyAudit, exportAudit } from './audit-view.js';

const STATE = {
  doc:       null,
  audit:     createAuditLog(),
  embedder:  createHashEmbedder(),
  backendName: 'echo',
  model:     null,
};

const els = {
  status:    document.getElementById('status'),
  dropzone:  document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  docView:   document.getElementById('doc-view'),
  messages:  document.getElementById('messages'),
  composer:  document.getElementById('composer'),
  input:     document.getElementById('input'),
  send:      document.getElementById('send'),
  auditView: document.getElementById('audit-view'),
  exportBtn: document.getElementById('export-audit'),
  backend:   document.getElementById('backend'),
};

const setStatus = (s) => { els.status.textContent = s; };

const ensureModel = async () => {
  if (STATE.model && STATE.model.id === STATE.backendName) return;
  STATE.model = createModel(STATE.backendName);
  await STATE.model.load((p) =>
    setStatus(`${STATE.backendName}: ${p.phase} · ${Math.round((p.pct || 0) * 100)}%`));
  setStatus(`${STATE.backendName}: ready`);
};

const ingest = async (file) => {
  setStatus('parsing…');
  const t0 = performance.now();
  const doc = await ingestText(file);
  STATE.doc = doc;
  renderDoc(doc, els.docView);
  const t1 = performance.now();
  setStatus(`parsed: ${doc.sentences.length} sentences, ${doc.log.length} events, ${Math.round(t1 - t0)}ms`);
};

const send = async () => {
  const question = els.input.value.trim();
  if (!question) return;
  if (!STATE.doc) { setStatus('Drop a document first.'); return; }
  await ensureModel();

  els.input.value = '';
  els.send.disabled = true;
  renderUserMessage(els.messages, question);

  const t0 = performance.now();
  const result = await runTurn({
    question,
    doc:      STATE.doc,
    model:    STATE.model,
    embedder: STATE.embedder,
    auditLog: STATE.audit,
  });
  const ms = Math.round(performance.now() - t0);

  renderAssistantMessage(els.messages, result.answer, result.sources, {
    route: result.turn.route, ms,
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

// Backend switch
els.backend.addEventListener('change', () => {
  STATE.backendName = els.backend.value;
  STATE.model = null;
  setStatus(`${STATE.backendName}: will load on next message`);
});

// Audit: live-render on every step / finish
STATE.audit.subscribe((turn) => renderAuditTurn(els.auditView, turn));
els.exportBtn.addEventListener('click', () => exportAudit(STATE.audit));
renderEmptyAudit(els.auditView);

// Citation clicks (delegated)
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t?.classList?.contains('cite')) {
    const idx = parseInt(t.dataset.idx, 10);
    if (!isNaN(idx)) highlightSources(els.docView, [idx]);
  }
});

// Boot: echo is ready immediately. The page is alive on open.
ensureModel().then(() => setStatus(`echo: ready · drop a document to begin`));

window.STATE = STATE; // for in-browser inspection
