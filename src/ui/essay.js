// The ESSAY ORGAN surface — a chat-shaped page whose ONLY output is an essay.
//
// It looks like the chat (a thread of messages, a composer) and shares its styling, but it
// answers nothing: every commission you send is treated as an essay to WRITE, and it walks the
// arc (organs/out/essay.composeEssay) — open, develop, turn, land — over as many talker passes
// as it takes to clear the ≥2500-word floor. No routing, no research, no short replies.
//
// THE ESSAY GENERATES ACROSS MANY MESSAGES. The piece is not one blob: a title card lands first,
// then EACH SECTION arrives as its own assistant message, streamed live, the way a long reply
// comes in pieces in a real chat. Continuity across those message boundaries is the hard part,
// and it is held in the organ — the tail of the running draft is fed into every section prompt —
// not here. A closing card sums the whole piece (word count vs the floor) with copy/download of
// the assembled essay.
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

const scrollDown = () => { els.messages.scrollTop = els.messages.scrollHeight; };

// A plain assistant status message — the "Outlining the essay…" beat while the planner runs.
const statusMessage = (text) => {
  const el = document.createElement('div');
  el.className = 'msg assistant essay thinking';
  el.innerHTML = `<div class="essay-status"><span class="dots"></span><span class="lbl">${escapeHtml(text)}</span></div>`;
  els.messages.appendChild(el);
  scrollDown();
  return {
    el,
    set: (msg) => { const l = el.querySelector('.lbl'); if (l) l.textContent = msg; },
    remove: () => el.remove(),
  };
};

// The TITLE card — the first message of the essay, once the arc is planned.
const titleMessage = (title) => {
  const el = document.createElement('div');
  el.className = 'msg assistant essay done';
  el.innerHTML = `<div class="essay-body"><h1>${escapeHtml(title)}</h1></div>`;
  els.messages.appendChild(el);
  scrollDown();
};

// One SECTION message — a fresh assistant bubble the section streams into, then reflows to
// a heading + paragraphs on close. Each is its own message in the thread.
const sectionMessage = (heading) => {
  const el = document.createElement('div');
  el.className = 'msg assistant essay streaming';
  el.innerHTML = `<div class="essay-status"><span class="dots"></span><span class="lbl">Writing “${escapeHtml(heading)}”…</span></div>` +
                 `<div class="essay-body"><h2>${escapeHtml(heading)}</h2><div class="sec"></div></div>`;
  els.messages.appendChild(el);
  scrollDown();
  const sec = el.querySelector('.sec');
  const lbl = el.querySelector('.lbl');
  return {
    stream: (piece) => { sec.textContent += piece; scrollDown(); },
    // Close: drop the status, reflow the streamed text into paragraphs (blank-line split).
    finalize: ({ text, words }) => {
      el.classList.remove('streaming');
      el.classList.add('done');
      el.querySelector('.essay-status')?.remove();
      const body = el.querySelector('.essay-body');
      const paras = String(text || sec.textContent || '')
        .split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      const html = [`<h2>${escapeHtml(heading)}</h2>`];
      for (const p of paras) html.push(`<p>${p.split('\n').map(escapeHtml).join('<br>')}</p>`);
      if (paras.length === 0 && sec.textContent.trim()) html.push(`<p>${escapeHtml(sec.textContent.trim())}</p>`);
      body.innerHTML = html.join('');
      void lbl; void words;
      scrollDown();
    },
  };
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

// The CLOSING card — its own message, once every section has landed: the total word count
// against the floor, with copy / download of the WHOLE assembled essay.
const closingMessage = (res) => {
  const el = document.createElement('div');
  el.className = 'msg assistant essay done';
  const meta = document.createElement('div');
  meta.className = 'essay-meta';
  const count = document.createElement('span');
  count.innerHTML = res.aborted
    ? `<span class="under">Stopped — ${res.words} words</span>`
    : (res.words >= ESSAY_MIN_WORDS
        ? `Essay complete · ${res.words} words across ${res.sections.length} sections — clears the ${ESSAY_MIN_WORDS.toLocaleString()}-word floor`
        : `<span class="under">${res.words} words across ${res.sections.length} sections — under the ${ESSAY_MIN_WORDS.toLocaleString()}-word floor</span>`);
  meta.appendChild(count);

  const actions = document.createElement('span');
  actions.className = 'essay-actions';
  actions.appendChild(actionButton('⧉ Copy', 'Copy the whole essay', async (b) => {
    try { await navigator.clipboard.writeText(res.text); b.textContent = '✓ Copied'; setTimeout(() => { b.textContent = '⧉ Copy'; }, 1200); } catch { /* ignore */ }
  }));
  actions.appendChild(actionButton('⇩ .md', 'Download the whole essay as Markdown', () => {
    const blob = new Blob([res.text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(res.title || 'essay').replace(/[^\w-]+/g, '-').toLowerCase().slice(0, 60)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }));
  meta.appendChild(actions);
  el.appendChild(meta);
  els.messages.appendChild(el);
  scrollDown();
};

// ── The walk ────────────────────────────────────────────────────────────────

const write = async (commission) => {
  if (!commission) return;
  const ctl = new AbortController();
  STATE.inflight = ctl;
  setBusy(true);
  renderUser(commission);
  const status = statusMessage('Loading the model…');

  try {
    await ensureModel();
  } catch (err) {
    status.set(`Model failed to load: ${err?.message || err}`);
    status.el.classList.remove('thinking');
    STATE.inflight = null; setBusy(false);
    return;
  }
  if (ctl.signal.aborted) {
    status.set('Stopped.'); status.el.classList.remove('thinking');
    STATE.inflight = null; setBusy(false);
    return;
  }

  // The talker: streamPhrase over the loaded model, exactly the contract the organ wants. When a
  // lens config is present (the phasepost steer), it rides in opts and the backend's LogitProcessor
  // pushes the decode — the model never sees it. None today on this standalone surface; the seam is
  // ready (composeEssay's `lens`).
  const talker = (messages, opts) => streamPhrase(STATE.model, messages, opts);

  let current = null;   // the section message currently streaming
  try {
    const res = await composeEssay({
      topic: commission,
      talker,
      signal: ctl.signal,
      hooks: {
        // The plan is known — drop the "outlining" status and lay down the title card.
        onPlan: ({ title }) => { status.remove(); titleMessage(title); },
        // Each section opens a NEW message in the thread (generation across many messages).
        onSection: ({ heading }) => { current = sectionMessage(heading); },
        onToken: (piece) => { current?.stream(piece); },
        onSectionEnd: ({ text, words }) => { current?.finalize({ text, words }); current = null; },
      },
    });
    // If planning produced no plan hook path (defensive), make sure the status is gone.
    status.remove();
    closingMessage(res);
  } catch (err) {
    if (!ctl.signal.aborted) { status.set(`The arc could not complete: ${err?.message || err}`); status.el.classList.remove('thinking'); }
    else { current?.finalize({ text: '' }); status.remove(); closingMessage({ text: '', words: 0, sections: [], aborted: true, title: commission }); }
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
