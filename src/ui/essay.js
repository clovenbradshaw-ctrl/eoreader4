// The ESSAY ORGAN surface — a chat-shaped page whose ONLY output is an essay.
//
// It looks like the chat (a thread of messages, a composer) and shares its styling, but it
// answers nothing: every commission you send is treated as an essay to WRITE, and it walks the
// arc (organs/out/essay.composeEssay) — open, develop, turn, land — over as many talker passes
// as it takes to clear the ≥2500-word floor. No routing, no research, no short replies. The
// commission goes in; a whole essay comes back, streamed section by section with a live word
// count, then rendered as a titled, sectioned piece you can copy or download.
//
// The model layer is shared with the chat (src/model): the selected backend auto-loads, and the
// essay organ is handed a `talker` that is just streamPhrase over that model. This file owns no
// generation logic — the walk lives in the organ; here is only the surface and the wiring.

import { createModel, streamPhrase } from '../model/index.js';
import { composeEssay, ESSAY_MIN_WORDS } from '../organs/out/essay.js';

const els = {
  status:  document.getElementById('status'),
  backend: document.getElementById('backend'),
  messages: document.getElementById('messages'),
  composer: document.getElementById('composer'),
  input:   document.getElementById('input'),
  send:    document.getElementById('send'),
};

const STATE = {
  backendName: 'webllm',
  model: null,
  loadingBackend: null,   // { name, promise } of the in-flight load, if any
  inflight: null,         // the AbortController of the walk currently running, or null
};

const setStatus = (s) => { els.status.textContent = s; };
const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The Write button doubles as a Stop button while a walk is in flight — the user must always be
// able to halt a long generation.
const setBusy = (busy) => {
  els.send.textContent = busy ? 'Stop' : 'Write';
  els.send.classList.toggle('stop', busy);
  els.send.title = busy ? 'Stop writing' : '';
  els.send.disabled = false;
};

// Load the selected backend, idempotently. Auto-runs on boot and on backend change so the
// download starts before the first commission (a walk over Llama takes real time). Mirrors the
// chat's ensureModel.
const ensureModel = async () => {
  if (STATE.model && STATE.model.id === STATE.backendName) return STATE.model;
  if (STATE.loadingBackend?.name === STATE.backendName) return STATE.loadingBackend.promise;
  const name = STATE.backendName;
  const model = createModel(name);
  const promise = (async () => {
    try {
      await model.load((p) => setStatus(`${name}: ${p.phase} · ${Math.round((p.pct || 0) * 100)}%`));
      if (STATE.backendName === name) { STATE.model = model; setStatus(`${name}: ready`); }
      return model;
    } catch (err) {
      if (STATE.backendName === name) setStatus(`${name}: failed — ${err?.message || err}`);
      throw err;
    } finally {
      if (STATE.loadingBackend?.name === name) STATE.loadingBackend = null;
    }
  })();
  STATE.loadingBackend = { name, promise };
  return promise;
};

// ── Rendering ─────────────────────────────────────────────────────────────────

const renderUser = (text) => {
  const el = document.createElement('div');
  el.className = 'msg user';
  el.textContent = text;
  els.messages.appendChild(el);
  els.messages.scrollTop = els.messages.scrollHeight;
  return el;
};

// The live essay bubble: a status line the walk updates ("Outlining…", "Writing “X” · N words")
// and a body the sections stream into. Returns handles the walk's hooks drive.
const createEssayBubble = () => {
  const el = document.createElement('div');
  el.className = 'msg assistant essay';
  el.innerHTML = '<div class="essay-status"><span class="dots"></span><span class="lbl">Outlining the essay…</span></div><div class="essay-body"></div>';
  els.messages.appendChild(el);
  els.messages.scrollTop = els.messages.scrollHeight;
  const statusLbl = el.querySelector('.essay-status .lbl');
  const body = el.querySelector('.essay-body');
  let currentSec = null;
  let liveWords = 0;
  return {
    el,
    setStatus: (msg) => { statusLbl.textContent = msg; },
    startSection: (heading) => {
      const h = document.createElement('h2');
      h.textContent = heading;
      body.appendChild(h);
      currentSec = document.createElement('div');
      currentSec.className = 'sec';
      body.appendChild(currentSec);
      els.messages.scrollTop = els.messages.scrollHeight;
    },
    stream: (piece) => {
      if (!currentSec) return;
      currentSec.textContent += piece;
      liveWords += (String(piece).match(/\S+/g) || []).length;
      els.messages.scrollTop = els.messages.scrollHeight;
    },
    liveWords: () => liveWords,
  };
};

// A titled block of prose becomes h1/h2/paragraphs. Escape-first (no model string reaches
// innerHTML raw): every text node is escaped, then only OUR tags are introduced.
const renderEssay = (bodyEl, text) => {
  const blocks = String(text || '').split(/\n{2,}/);
  const html = [];
  for (const block of blocks) {
    const b = block.replace(/\s+$/, '');
    if (!b.trim()) continue;
    const h1 = b.match(/^#\s+(.+)$/);
    if (h1 && !b.includes('\n')) { html.push(`<h1>${escapeHtml(h1[1])}</h1>`); continue; }
    const h2 = b.match(/^##\s+(.+)$/);
    if (h2 && !b.includes('\n')) { html.push(`<h2>${escapeHtml(h2[1])}</h2>`); continue; }
    html.push(`<p>${b.split('\n').map(escapeHtml).join('<br>')}</p>`);
  }
  bodyEl.innerHTML = html.join('');
};

const actionButton = (label, title, onClick) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'msg-action';
  b.textContent = label;
  b.title = title;
  b.addEventListener('click', () => onClick(b));
  return b;
};

// Finalize: replace the streamed sections with the clean, titled render, and add the meta line
// (word count against the floor) with copy / download actions.
const finalizeEssay = (bubble, res) => {
  bubble.el.classList.add('done');
  const body = bubble.el.querySelector('.essay-body');
  renderEssay(body, res.text);
  bubble.setStatus(res.aborted
    ? `Stopped — ${res.words} words so far`
    : `Essay · ${res.words} words · ${res.sections.length} sections`);

  const meta = document.createElement('div');
  meta.className = 'essay-meta';
  const count = document.createElement('span');
  count.innerHTML = res.words >= ESSAY_MIN_WORDS
    ? `${res.words} words — clears the ${ESSAY_MIN_WORDS.toLocaleString()}-word floor`
    : `<span class="under">${res.words} words — under the ${ESSAY_MIN_WORDS.toLocaleString()}-word floor</span>`;
  meta.appendChild(count);

  const actions = document.createElement('span');
  actions.className = 'essay-actions';
  actions.appendChild(actionButton('⧉ Copy', 'Copy the essay', async (b) => {
    try { await navigator.clipboard.writeText(res.text); b.textContent = '✓ Copied'; setTimeout(() => { b.textContent = '⧉ Copy'; }, 1200); } catch { /* ignore */ }
  }));
  actions.appendChild(actionButton('⇩ .md', 'Download as Markdown', () => {
    const blob = new Blob([res.text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(res.title || 'essay').replace(/[^\w-]+/g, '-').toLowerCase().slice(0, 60)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }));
  meta.appendChild(actions);
  bubble.el.appendChild(meta);
  els.messages.scrollTop = els.messages.scrollHeight;
};

// ── The walk ────────────────────────────────────────────────────────────────

const write = async (commission) => {
  if (!commission) return;
  const ctl = new AbortController();
  STATE.inflight = ctl;
  setBusy(true);
  renderUser(commission);
  const bubble = createEssayBubble();

  try {
    await ensureModel();
  } catch (err) {
    bubble.setStatus(`Model failed to load: ${err?.message || err}`);
    STATE.inflight = null; setBusy(false);
    return;
  }
  if (ctl.signal.aborted) {
    bubble.setStatus('Stopped.');
    STATE.inflight = null; setBusy(false);
    return;
  }

  // The talker: streamPhrase over the loaded model, exactly the contract the organ wants.
  const talker = (messages, opts) => streamPhrase(STATE.model, messages, opts);

  try {
    const res = await composeEssay({
      topic: commission,
      talker,
      signal: ctl.signal,
      hooks: {
        onPhase: (name) => {
          if (name === 'planning') bubble.setStatus('Outlining the essay…');
          if (name === 'done') bubble.setStatus('Finishing…');
        },
        onSection: ({ heading, role }) => {
          bubble.startSection(heading);
          const verb = role === 'open' ? 'Opening' : role === 'land' ? 'Landing' : 'Writing';
          bubble.setStatus(`${verb} “${heading}” · ${bubble.liveWords()} words so far…`);
        },
        onToken: (piece) => bubble.stream(piece),
      },
    });
    finalizeEssay(bubble, res);
  } catch (err) {
    if (!ctl.signal.aborted) bubble.setStatus(`The arc could not complete: ${err?.message || err}`);
    else finalizeEssay(bubble, { text: bubble.el.querySelector('.essay-body').textContent, words: bubble.liveWords(), sections: [], aborted: true, title: commission });
  } finally {
    STATE.inflight = null;
    setBusy(false);
  }
};

// ── Wiring ────────────────────────────────────────────────────────────────────

const submit = () => {
  // A click while a walk is running is a Stop.
  if (STATE.inflight) { STATE.inflight.abort(); return; }
  const commission = els.input.value.trim();
  if (!commission) return;
  els.input.value = '';
  write(commission);
};

els.composer.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
});
els.backend.addEventListener('change', () => {
  STATE.backendName = els.backend.value;
  STATE.model = null;
  setStatus(`${STATE.backendName}: starting…`);
  ensureModel().catch(() => { /* status already reflects failure */ });
});

STATE.backendName = els.backend.value || 'webllm';
setStatus(`${STATE.backendName}: starting…`);
ensureModel().catch(() => { /* status already reflects failure */ });
