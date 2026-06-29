// Chat view: append user/assistant messages, render a live "thinking"
// bubble that updates per stage, and surface veto flags as pills.
// Citations [sN] are linkified — clicking one scrolls and highlights
// the source in the doc pane.
//
// CHATBOT SURFACE. The chat is deliberately spare — a user bubble, a
// thinking indicator, the streamed answer (with its citations still
// clickable), a retry on error, and the per-claim SOURCE view. Most of the
// machinery the engine produces per turn — the per-stage trace, the verbatim
// prompt and raw model output, the retrieved spans, the coverage verdict, the
// veto flags, the route/timing meta, the recalled-memory and web-source blocks
// — is NOT shown here. It lives, in full and verbatim, in the Audit pane
// (renderAuditTurn, fed independently off STATE.audit) and the Log tab. "Hide
// it in the chat, keep it in the log." The one deliberate exception is the
// transparency panel (renderTransparency): every proposition the answer makes,
// reviewed against the document graph and traced to its source — that IS the
// point of the surface, so it ships by default, governed by the user's
// collapse/expand toggle. Each other renderer accepts `opts.verbose` as an
// escape hatch to bring its block back inline for debugging.

// ── Per-message actions: copy · reply/quote · fork ─────────────────────────
//
// Every rendered message (user or finalized assistant) carries a small action
// bar: COPY the message text, REPLY to it (quote it into the composer so the
// next turn responds to that exact message — from the model or from you), and
// FORK the chat from that point (open a new, independent chat seeded with the
// transcript up to and including that message, leaving this one untouched).
//
// The fork/reply behaviours live in app.js (they touch session state and the
// composer); chat.js only needs the handlers, registered once at startup. Copy
// is self-contained here. Each message stashes its plain text on `el._msgText`
// and its role on `el.dataset.role` so app.js can rebuild the transcript prefix
// from the DOM when forking.
let actionHandlers = { onQuote: null, onFork: null };
export const setMessageActionHandlers = (h) => { actionHandlers = { ...actionHandlers, ...(h || {}) }; };

const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through to the legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
};

const actionBtn = (label, title, onClick) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'msg-action';
  b.textContent = label;
  b.title = title;
  b.setAttribute('aria-label', title);
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(b); });
  return b;
};

// Attach (or refresh) the action bar on a message element. `opts.quote` /
// `opts.fork` gate the affordances that don't make sense on a given turn (an
// errored assistant turn gets copy only — there is nothing to reply to or fork).
export const attachMessageActions = (el, role, text, opts = {}) => {
  if (!el) return;
  el.dataset.role = role;
  el._msgText = text ?? '';
  el.querySelector(':scope > .msg-actions')?.remove();   // idempotent — refresh on re-finalize

  const bar = document.createElement('div');
  bar.className = 'msg-actions';

  bar.appendChild(actionBtn('⧉ Copy', 'Copy this message', async (b) => {
    const ok = await copyToClipboard(el._msgText ?? text ?? '');
    if (ok) {
      const prev = b.textContent;
      b.textContent = '✓ Copied';
      b.classList.add('done');
      setTimeout(() => { b.textContent = prev; b.classList.remove('done'); }, 1200);
    }
  }));

  if (opts.quote !== false && actionHandlers.onQuote) {
    const isModel = role === 'assistant';
    bar.appendChild(actionBtn(
      isModel ? '↩ Reply' : '↩ Quote',
      isModel ? 'Quote the model’s message into the composer to respond to it'
              : 'Quote this message into the composer',
      () => actionHandlers.onQuote(el._msgText ?? text ?? '', role)));
  }

  if (opts.fork !== false && actionHandlers.onFork) {
    bar.appendChild(actionBtn('⑂ Fork', 'Fork the chat from here into a new tab', () => actionHandlers.onFork(el)));
  }

  el.appendChild(bar);
};

export const renderUserMessage = (root, text) => {
  const el = document.createElement('div');
  el.className = 'msg user';
  el.textContent = text;
  root.appendChild(el);
  attachMessageActions(el, 'user', text);
  root.scrollTop = root.scrollHeight;
  return el;
};

// A "thinking" bubble is the assistant slot reserved early in the turn.
// It updates as each stage fires and then finalizes with the real answer.
// The user sees the pipeline progressing rather than a silent wait.
export const createThinkingMessage = (root, initial = 'thinking…') => {
  const el = document.createElement('div');
  el.className = 'msg assistant thinking';
  el.innerHTML = `
    <div class="body"><span class="dots"></span><span class="label">${escapeHtml(initial)}</span><span class="elapsed"></span></div>
    <div class="trail"></div>
  `;
  root.appendChild(el);
  root.scrollTop = root.scrollHeight;

  // Latency cue: answers on the local 3B WebGPU model take ~20–40s, so tick an
  // elapsed-seconds counter while the turn is in flight to set expectations. The
  // timer is cleared in finalizeThinking.
  const start = nowMs();
  const elapsedEl = el.querySelector('.elapsed');
  const tick = () => {
    const s = Math.floor((nowMs() - start) / 1000);
    if (elapsedEl) elapsedEl.textContent = s >= 1 ? ` ${s}s` : '';
  };
  el._elapsedTimer = setInterval(tick, 1000);
  return el;
};

const nowMs = () =>
  (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

// Stream a token into the thinking bubble (docs/streaming-answer.md). On the first
// piece the bubble drops its "thinking" dots and becomes a live answer that the
// tokens append to; the elapsed counter keeps ticking. finalizeThinking later
// overwrites this raw stream with the bound, cited answer — so the streamed text is
// the live surface, the finalized text is the grounded record. Plain text only
// (no citation linkify mid-stream — the [sN] tags are added at bind).
export const streamThinking = (el, piece) => {
  if (!el || !piece) return;
  const body = el.querySelector('.body');
  if (!body) return;
  let stream = body.querySelector('.answer-stream');
  if (!stream) {
    clearImpression(el);                 // the talker speaks — replace the preview gloss
    el.classList.remove('thinking');
    el.classList.add('streaming');
    const dots  = body.querySelector('.dots');  if (dots)  dots.remove();
    const label = body.querySelector('.label'); if (label) label.remove();
    stream = document.createElement('span');
    stream.className = 'answer-stream';
    body.insertBefore(stream, body.querySelector('.elapsed'));
  }
  stream.textContent += piece;
  const root = el.parentElement;
  if (root) root.scrollTop = root.scrollHeight;
};

// Stream the FOLD'S IMPRESSION while the talker warms (docs/streaming-answer.md).
// The local model is slow to its first token; the substrate has already read the
// passage, so during the wait we type out its impressionistic gloss — the figures
// it settled on, the edges it drew, the turn it found — model-free. It is a PREVIEW,
// muted and italic, never the answer: when the real answer's first token arrives
// (streamThinking) or the turn finalizes, it is cleared and replaced. The dots keep
// pulsing beside it so it reads as "still working", not "done".
export const streamImpression = (el, phrases) => {
  if (!el || !phrases || !phrases.length) return null;
  const body = el.querySelector('.body');
  if (!body) return null;
  const label = body.querySelector('.label'); if (label) label.remove();  // the impression takes the line
  let prev = body.querySelector('.impression');
  if (!prev) {
    prev = document.createElement('span');
    prev.className = 'impression';
    body.insertBefore(prev, body.querySelector('.elapsed'));
  }
  el.classList.add('impressing');
  // Reveal word by word for the streaming feel, over the seconds the talker spends
  // warming. Types once and rests; if the talker is still going, the gloss simply sits.
  const tokens = phrases.join('  ').match(/\s+|\S+/g) || [];
  let i = 0;
  const timer = setInterval(() => {
    if (i >= tokens.length) { clearInterval(timer); return; }
    prev.textContent += tokens[i++];
    const root = el.parentElement; if (root) root.scrollTop = root.scrollHeight;
  }, 50);
  const handle = { stop() { clearInterval(timer); } };
  el._impression = handle;
  return handle;
};

// Stop and remove the impression preview — when the real answer starts, or at finalize.
const clearImpression = (el) => {
  if (el && el._impression) { el._impression.stop(); el._impression = null; }
  const prev = el && el.querySelector && el.querySelector('.impression');
  if (prev) prev.remove();
  if (el && el.classList) el.classList.remove('impressing');
};

export const updateThinking = (el, stageName, data, ctx, opts = {}) => {
  if (!el) return;
  // The one chatbot-visible signal of progress: a short, friendly status on
  // the thinking bubble ("Reading…", "Writing…"). The per-stage trace, the
  // verbatim prompt / raw output, and the retrieved spans are NOT built into
  // the bubble — they are recorded in the Audit pane instead. Pass
  // opts.verbose to restore the inline trail for debugging.
  const label = el.querySelector('.body .label');
  if (label) label.textContent = stageLabel(stageName, data);

  if (!opts.verbose) return;
  const trail = el.querySelector('.trail');
  if (!trail) return;

  const line = document.createElement('div');
  line.className = 'tline';
  line.innerHTML =
    `<span class="name">${escapeHtml(stageName)}</span>` +
    `<span class="ms">+${(data?.ms ?? 0)}ms</span>` +
    `<span class="data">${escapeHtml(compactData(stageName, data))}</span>`;
  trail.appendChild(line);

  // Surface the verbatim prompt (what the model actually receives) and the
  // verbatim raw output (what the model actually said, before bind). This is
  // the answer to "are we really chatting, or just grepping spans?".
  if (stageName === 'prompt' && ctx?.promptText) {
    trail.appendChild(rawBlock('prompt sent to model', ctx.promptText));
  }
  if (stageName === 'llm' && ctx?.rawOutput) {
    trail.appendChild(rawBlock('raw model output', ctx.rawOutput));
  }
  if (stageName === 'retrieve' && Array.isArray(ctx?.spans) && ctx.spans.length) {
    const text = ctx.spans
      .map(s => `[s${s.idx}] (score ${Number(s.score || 0).toFixed(3)}) ${s.text}`)
      .join('\n');
    trail.appendChild(rawBlock(`spans retrieved (${ctx.spans.length})`, text));
  }

  const root = el.parentElement;
  if (root) root.scrollTop = root.scrollHeight;
};

const rawBlock = (label, text) => {
  const wrap = document.createElement('div');
  wrap.className = 'tblock';
  wrap.innerHTML =
    `<div class="tlabel">${escapeHtml(label)}</div>` +
    `<pre class="traw">${escapeHtml(text)}</pre>`;
  return wrap;
};

export const finalizeThinking = (el, text, sources, opts = {}) => {
  if (!el) return;
  if (el._elapsedTimer) { clearInterval(el._elapsedTimer); el._elapsedTimer = null; }
  clearImpression(el);                  // stop any preview gloss still typing
  // Idempotent: a web follow-up re-renders this same bubble with the updated answer, so drop the
  // blocks a prior finalize appended (kept as siblings of .body) before re-appending them — else
  // coverage / flags / meta / trace stack up. The web proposal/result cards are preserved.
  el.querySelectorAll(':scope > .coverage, :scope > .docsources, :scope > .flags, :scope > .meta, :scope > .retry, :scope > .trail-toggle, :scope > .transparency-toggle, :scope > .transparency, :scope > .searchnote, :scope > .msg-actions')
    .forEach(n => n.remove());
  el.classList.remove('thinking');
  el.classList.remove('streaming');     // the live stream is replaced by the cited answer
  const body  = el.querySelector('.body');
  const trail = el.querySelector('.trail');
  if (body) {
    body.innerHTML = renderRich(text || '', opts.citationSources);
    // EXPLORE CHIPS: when the answer closes with a "want me to go deeper" list, make those
    // leads clickable — each re-asks as a fresh turn. Defensive: a no-op when the cue/list is
    // absent, so a plain answer is untouched. (The shape cue produces this list on broad turns.)
    if (typeof opts.onExplore === 'function') wireExploreChips(body, opts.onExplore);
  }

  // CHATBOT SURFACE (default): the answer is the whole message. The coverage
  // verdict, doc-source chips, veto pills, the route/timing meta line, and the
  // per-stage trace are all suppressed here — they live in the Audit pane and the
  // Log, where the full record is kept. The error-retry below stays (it's an
  // action, not info). Pass opts.verbose to bring every block back inline.
  if (opts.verbose) finalizeVerbose(el, text, sources, opts, body, trail);

  // The per-claim SOURCE view is the exception to "hide it in the chat": every
  // proposition the answer makes, reviewed against the document graph and traced to
  // the sentence that grounds (or the verdict that contradicts) it. It ships in the
  // default surface — collapsed or expanded per the persisted `opts.transparency`
  // toggle — because seeing the source of each assertion is the point, not debug noise.
  renderTransparency(el, opts);

  // Retry affordance — re-runs the same query. Shown on errored turns so a
  // transient backend fault isn't a dead end.
  if (typeof opts.onRetry === 'function' && opts.route === 'error') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'retry small';
    retry.textContent = '↻ Retry';
    retry.addEventListener('click', () => { retry.disabled = true; opts.onRetry(); });
    el.appendChild(retry);
  }

  // The action bar — copy/reply/fork. An errored turn gets copy only (there is
  // nothing to reply to or fork from a failed answer). The text stashed is the
  // bound answer (sans the verbose blocks), which is what copy/fork should carry.
  const isError = opts.route === 'error';
  attachMessageActions(el, 'assistant', text || '', { quote: !isError, fork: !isError });

  const root = el.parentElement;
  if (root) root.scrollTop = root.scrollHeight;
};

// The full, verbose render of a finished turn — every block the engine can
// surface inline. Kept intact behind finalizeThinking's `opts.verbose` gate so
// the machinery is one flag away for debugging, while the default chat stays a
// bare chatbot. (The same information is always available in the Audit pane.)
const finalizeVerbose = (el, text, sources, opts, body, trail) => {
  // The plain-language coverage verdict — the headline read of how grounded the
  // answer is, above the terse audit pills. (The pills stay for the trail.)
  const cov = coverageSummary(opts.route, opts.flags, sources, text);
  if (cov) {
    const c = document.createElement('div');
    c.className = `coverage ${cov.level}`;
    c.textContent = cov.text;
    el.appendChild(c);
  }

  // Tag the documents the answer drew on as sources, one chip per document. Each tag
  // shows the document's display name (its filename); the "source" label is styling,
  // not part of the name. (docName kept for single-document back-compat.)
  const docNames = opts.docNames || (opts.docName ? [opts.docName] : []);
  if (docNames.length) {
    const wrap = document.createElement('div');
    wrap.className = 'docsources';
    for (const name of docNames) {
      const src = document.createElement('span');
      src.className = 'docsource';
      src.textContent = name;
      src.title = 'Source — ' + name;
      if (typeof opts.onDocSource === 'function') {
        src.classList.add('clickable');
        src.addEventListener('click', () => opts.onDocSource(name));
      }
      wrap.appendChild(src);
    }
    el.appendChild(wrap);
  }

  // The transparency view (every proposition traced to its source) is rendered by
  // finalizeThinking itself now — it ships in the default surface, not only here.

  // Flags ride alongside the answer — never substitute it.
  if (opts.flags?.length) {
    const flagBox = document.createElement('div');
    flagBox.className = 'flags';
    for (const f of opts.flags) {
      const pill = document.createElement('span');
      pill.className = 'flag' + (f.refuses ? ' refuses' : '');
      pill.title = f.message || '';
      pill.textContent = f.id;
      flagBox.appendChild(pill);
    }
    el.appendChild(flagBox);
  }

  const parts = [];
  if (sources?.length) parts.push(`sources: ${sources.map(s => `s${s}`).join(', ')}`);
  if (opts.mode)       parts.push(`mode: ${MODE_LABEL[opts.mode] || opts.mode}`);
  if (opts.route)      parts.push(`route: ${opts.route}`);
  if (opts.ms != null) parts.push(`${opts.ms}ms`);
  if (parts.length) {
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = parts.join('  ·  ');
    el.appendChild(meta);
  }

  // The per-stage trail collapses to a toggle once we have an answer.
  if (trail && trail.children.length) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'trail-toggle';
    toggle.textContent = `▸ trace (${trail.children.length} steps)`;
    toggle.addEventListener('click', () => {
      const open = trail.classList.toggle('open');
      toggle.textContent = `${open ? '▾' : '▸'} trace (${trail.children.length} steps)`;
    });
    el.insertBefore(toggle, trail);
  }

  const root = el.parentElement;
  if (root) root.scrollTop = root.scrollHeight;
};

// The "from memory" block — eoreader's READ corpus (the mind), surfaced as a
// distinct, epistemically-separate panel beneath a document-grounded answer.
// Each line is a real sentence in a named book, linked to its source URI: the
// memory always points back at what it remembers, the accountability local
// inference buys. Rendered only when the mind is consulted (the pinned chip).
export const renderMindBlock = (el, spans, opts = {}) => {
  if (!el) return;
  // Drop a prior block if this turn re-renders (defensive — one block per msg).
  el.querySelector('.mindblock')?.remove();
  const box = document.createElement('div');
  box.className = 'mindblock';
  const head = document.createElement('div');
  head.className = 'mindblock-head';
  head.textContent = spans?.length
    ? `✦ from memory · ${spans.length} recalled`
    : '✦ from memory · nothing recalled for this';
  box.appendChild(head);

  for (const s of (spans || [])) {
    const item = document.createElement('div');
    item.className = 'mindsource';
    const quote = document.createElement('span');
    quote.className = 'mindsource-q';
    const line = String(s.text || '').replace(/\s+/g, ' ').trim();
    quote.textContent = `“${line.length > 200 ? line.slice(0, 200) + '…' : line}”`;
    const prov = document.createElement('a');
    prov.className = 'mindsource-prov';
    prov.href = s.book?.uri || '#';
    prov.target = '_blank';
    prov.rel = 'noopener';
    const author = s.book?.authors ? ` — ${String(s.book.authors).split(';')[0].trim()}` : '';
    prov.textContent = `${s.book?.title || 'unknown'}${author}`;
    prov.title = `Open the source — ${s.book?.uri || ''}`;
    item.appendChild(quote);
    item.appendChild(prov);
    box.appendChild(item);
  }
  el.appendChild(box);
  const root = el.parentElement;
  if (root) root.scrollTop = root.scrollHeight;
};

// The web-search CONFIRMATION — the in-app replacement for the native window.confirm popup
// (docs/web-search.md). It renders BENEATH a finalized answer, never over a thinking bubble:
// the answer is shown first, then this offers to reach past the document. The proposed query
// is EDITABLE — the proposer builds it from the question + the reading's figure, but a bare
// "what happens at the end?" needs the user's hand to become "Metamorphosis Kafka ending", so
// the box is theirs to sharpen before anything leaves the machine. `onSearch(query)` runs the
// fetch; `onDismiss()` drops the card. Proposer-only: nothing is sent until a button is pressed.
// The conversational "let me look that up" beat — said the MOMENT a search fires, before the
// (slow) fetch + re-answer, so the wait reads as purposeful activity rather than a blank pause
// (docs/web-search.md). First-person and explicit about the query, built from the proposer's own
// decision (turn/propose.js `searchAnnouncement`) — no extra model call. Replaces any prior note
// in this bubble; finalizeThinking clears it when the grounded answer comes back. Returns the line.
export const renderSearchNote = (el, text) => {
  if (!el || !text) return null;
  el.querySelector(':scope > .searchnote')?.remove();   // one in-flight note per message
  const note = document.createElement('div');
  note.className = 'searchnote';
  note.innerHTML = `<span class="dots"></span><span class="searchnote-text"></span>`;
  note.querySelector('.searchnote-text').textContent = text;
  el.appendChild(note);
  const root = el.parentElement;
  if (root) root.scrollTop = root.scrollHeight;
  return note;
};

export const renderWebProposal = (el, proposal, { onSearch, onDismiss } = {}) => {
  if (!el || !proposal) return;
  el.querySelector('.webproposal')?.remove();   // one card per message
  const card = document.createElement('div');
  card.className = 'webproposal';

  const head = document.createElement('div');
  head.className = 'wp-head';
  head.textContent = proposal.trigger === 'verify'
    ? 'Check this against the web?'
    : 'Search the web to answer this?';
  card.appendChild(head);

  if (proposal.rationale) {
    const why = document.createElement('div');
    why.className = 'wp-why';
    why.textContent = proposal.rationale;
    card.appendChild(why);
  }

  const field = document.createElement('input');
  field.type = 'text';
  field.className = 'wp-query';
  field.value = proposal.query || '';
  field.setAttribute('aria-label', 'Search query — edit before searching');
  field.title = 'Edit the search query before sending it';
  card.appendChild(field);

  const actions = document.createElement('div');
  actions.className = 'wp-actions';
  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'wp-go small';
  go.textContent = '🔍 Search the web';
  const no = document.createElement('button');
  no.type = 'button';
  no.className = 'wp-no small';
  no.textContent = 'Not now';
  actions.appendChild(go);
  actions.appendChild(no);
  card.appendChild(actions);

  if (proposal.cost) {
    const cost = document.createElement('div');
    cost.className = 'wp-cost';
    cost.textContent = proposal.cost;
    card.appendChild(cost);
  }

  const close = () => card.remove();
  go.addEventListener('click', () => {
    const q = field.value.trim();
    if (!q) { field.focus(); return; }
    card.classList.add('searching');
    go.disabled = true; no.disabled = true; field.disabled = true;
    go.textContent = 'Searching…';
    if (typeof onSearch === 'function') onSearch(q);
  });
  no.addEventListener('click', () => { close(); if (typeof onDismiss === 'function') onDismiss(); });
  field.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });

  el.appendChild(card);
  const root = el.parentElement;
  if (root) root.scrollTop = root.scrollHeight;
  field.focus();
  return card;
};

// The web-search OUTCOME — what the search actually brought back, made visible (docs/web-search.md).
// A verify search reports whether the web backed the answer; a gap/witness search lists the pages
// it pulled in. Either way the user sees that the search RAN and what it found, rather than a lone
// pill — the answer to "but it doesn't do the search". Sources link out to the fetched page.
// Set the in-flight status note in the thinking bubble (e.g. "🌐 searching the web…").
// Empty string restores the default "thinking…" label.
export const setThinkingNote = (el, msg) => {
  const label = el?.querySelector?.('.body > .label');
  if (label) label.textContent = msg || 'thinking…';
};

// host → just the domain, for a compact, honest source chip ("en.wikipedia.org").
const domainOf = (url) => { try { return new URL(url).host.replace(/^www\./, ''); } catch { return ''; } };

// A rich-media source card (video/image), the kind the screenshot shows above its text sources.
// SCAFFOLD — DARK by default: nothing in the current retrieval path emits `s.media`, so this never
// renders today. It lights up the moment a media-returning source attaches `media:{type,
// thumbnail, embedUrl}` to a source, with no further UI change. We link OUT to the page rather than
// embedding an iframe — the strict, safe choice (no third-party frame, no autoplay). Returns the
// card element, or null when the source carries no usable media.
const renderSourceMedia = (s) => {
  const m = s && s.media;
  if (!m || (!m.thumbnail && !m.embedUrl)) return null;
  const href = m.embedUrl || s.url;
  const card = document.createElement(href ? 'a' : 'div');
  card.className = 'wr-media';
  if (href) { card.href = href; card.target = '_blank'; card.rel = 'noopener'; card.title = href; }
  if (m.type) card.dataset.mediaType = m.type;
  if (m.thumbnail) {
    const thumb = document.createElement('span');
    thumb.className = 'wr-media-thumb';
    const img = document.createElement('img');
    img.src = m.thumbnail; img.alt = s.title || 'media'; img.loading = 'lazy';
    thumb.appendChild(img);
    if (m.type === 'video') {
      const play = document.createElement('span');
      play.className = 'wr-media-play';
      play.textContent = '▶';
      thumb.appendChild(play);
    }
    if (m.duration) {
      const dur = document.createElement('span');
      dur.className = 'wr-media-dur';
      dur.textContent = m.duration;
      thumb.appendChild(dur);
    }
    card.appendChild(thumb);
  }
  const cap = document.createElement('span');
  cap.className = 'wr-media-cap';
  cap.textContent = s.title || domainOf(href) || 'media';
  card.appendChild(cap);
  return card;
};
// ISO → a short local date/time, so each source carries WHEN it was fetched (provenance).
const whenOf = (iso) => { if (!iso) return ''; try { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(); } catch { return ''; } };

export const renderWebResult = (el, fetched) => {
  if (!el || !fetched) return;
  el.querySelector('.webresult')?.remove();
  const box = document.createElement('div');
  box.className = 'webresult';
  const n = fetched.results;
  const plural = n > 1 ? 's' : '';

  const head = document.createElement('div');
  head.className = 'wr-head';
  if (!n) {
    box.classList.add('empty');
    head.textContent = `No web results for “${fetched.query}”.`;
  } else if (fetched.grounded) {
    // INVERTED FLOW: the answer above was built FROM these sources (web + docs + memory),
    // surfed into one reading. The block is the provenance — every source, traceable.
    box.classList.add('ok');
    head.textContent = `🌐 Grounded in ${n} web source${plural} (searched “${fetched.query}”):`;
  } else if (fetched.trigger === 'verify' && fetched.augmented) {
    box.classList.add('ok');
    head.textContent = `🌐 From the web — answered from ${n} source${plural}:`;
  } else {
    box.classList.add('ok');
    head.textContent = `🔍 Searched the web (${n} source${plural}).`;
  }
  box.appendChild(head);

  // The provenance contract, borrowed from EO_Reader: name the sources as what they are —
  // pages read, each with a link and a fetch time — so nothing the answer used is opaque.
  if (n && (fetched.grounded || fetched.augmented)) {
    const intro = document.createElement('div');
    intro.className = 'wr-intro';
    intro.textContent = 'Each source below is a page I read — title, link, and when I fetched it. The answer is my fold of them.';
    box.appendChild(intro);
  }

  // A "From the web" answer (the verify/augment flavor only) — the inverted flow has no separate
  // answer here; the main bubble above IS the grounded answer.
  if (fetched.augmented?.answer) {
    const ans = document.createElement('div');
    ans.className = 'wr-answer';
    ans.textContent = String(fetched.augmented.answer).replace(/\s*\[s\d+\]/g, '').trim();
    box.appendChild(ans);
  }

  // The MEANING GRAPH the talker reasoned over — the typed relations the fold read off the
  // gathered content (not the raw text). Collapsed by default.
  const graph = fetched.graph || fetched.augmented?.graph;
  if (graph) {
    const det = document.createElement('details');
    det.className = 'wr-graph';
    const sum = document.createElement('summary');
    sum.textContent = 'meaning graph fed to the model';
    det.appendChild(sum);
    const pre = document.createElement('pre');
    pre.textContent = graph;
    det.appendChild(pre);
    box.appendChild(det);
  }

  // The RESEARCH PLAN — the facets (the multiple prompts) a DEEP research gather opened from, before
  // any hop (docs/deep-research.md). Makes "it researched from several angles" legible: each line is
  // a distinct query the engine generated from the one concise question. Present only for a deep gather.
  if (Array.isArray(fetched.facets) && fetched.facets.length > 1) {
    const det = document.createElement('details');
    det.className = 'wr-plan';
    det.open = true;   // the plan is the headline of a deep gather — show it expanded
    const sum = document.createElement('summary');
    sum.textContent = `research plan · ${fetched.facets.length} angles`;
    det.appendChild(sum);
    for (const f of fetched.facets) {
      const row = document.createElement('div');
      row.className = 'wr-facet';
      row.textContent = `• ${f}`;
      det.appendChild(row);
    }
    box.appendChild(det);
  }

  // The WALK trace — the hops the gather took, each with the surprise (in bits) that steered it and
  // the saliency that leashed it (docs/curiosity-research.md, docs/deep-research.md). Collapsed by
  // default; present for a multi-hop research gather. Makes "it followed its curiosity" legible:
  // which thread, at what depth, how surprising, kept or dropped as a dead seam. A DEEP gather's hops
  // carry a depth (indented) and a facet (the angle they belong to); a single walk's do not.
  if (Array.isArray(fetched.research) && fetched.research.length) {
    const det = document.createElement('details');
    det.className = 'wr-hops';
    const sum = document.createElement('summary');
    const kept = fetched.research.filter(h => h.kept).length;
    const deep = fetched.research.some(h => h.depth != null);
    sum.textContent = `${deep ? 'deep research walk' : 'curiosity walk'} · ${fetched.research.length} hop${fetched.research.length > 1 ? 's' : ''}, ${kept} kept`;
    det.appendChild(sum);
    for (let i = 0; i < fetched.research.length; i++) {
      const h = fetched.research[i];
      const row = document.createElement('div');
      row.className = 'wr-hop' + (h.kept ? '' : ' dead');
      // depth 0 is a facet (a planned angle); deeper hops are discovered leads, indented by depth.
      const indent = h.depth ? '  '.repeat(h.depth) + '↳ ' : '';
      const lead = h.term ? ` → ${h.term}` : (h.depth === 0 ? ' (angle)' : ' (seed)');
      // surprise steered it (curiosity, in bits) and saliency leashed it; a dropped hop says why
      // (strayed off the question, or an empty fetch).
      const metrics = `${h.curiosity} bits` + (h.salience != null ? ` · salience ${h.salience}` : '');
      const tail = h.kept ? ((h.exhausted ? ' · on topic, nothing new' : '') + (h.strayed ? ' · angle off topic, not deepened' : ''))
                          : (h.reason === 'strayed' ? ' · strayed off topic' : ' · no results');
      row.textContent = `${indent}${i + 1}.${lead} “${h.query}” · ${metrics}${tail}`;
      det.appendChild(row);
    }
    box.appendChild(det);
  }

  const sources = fetched.augmented?.sources || fetched.sources || [];
  for (const s of sources) {
    if (!s) continue;
    // A media source (video/image) renders as a card; everything else as a text source row.
    // Dark today — no retrieval path emits `s.media` yet (renderSourceMedia).
    const media = renderSourceMedia(s);
    if (media) { box.appendChild(media); continue; }
    const item = document.createElement(s.url ? 'a' : 'div');
    item.className = 'wr-source';
    if (s.url) { item.href = s.url; item.target = '_blank'; item.rel = 'noopener'; item.title = s.url; }
    const label = document.createElement('span');
    label.className = 'wr-source-label';
    label.textContent = s.title || domainOf(s.url) || s.url || s.docId || 'source';
    item.appendChild(label);
    // Provenance tail: domain · when. Makes the origin of each piece of content explicit.
    const meta = [domainOf(s.url), whenOf(s.fetched_at)].filter(Boolean).join(' · ');
    if (meta) {
      const m = document.createElement('span');
      m.className = 'wr-source-meta';
      m.textContent = meta;
      item.appendChild(m);
    }
    box.appendChild(item);
  }

  el.appendChild(box);
  const root = el.parentElement;
  if (root) root.scrollTop = root.scrollHeight;
  return box;
};

// Back-compat for any caller that still wants a one-shot assistant render.
export const renderAssistantMessage = (root, text, sources, opts = {}) => {
  const el = createThinkingMessage(root);
  finalizeThinking(el, text, sources, opts);
  return el;
};

// The grounding register, for the meta line.
const MODE_LABEL = { auto: 'Auto', grounded: 'Chat with document', free: 'Free form' };

// Plain-language coverage verdict — the one-line human read of how grounded the answer
// is. The terse pills (low-coverage, unbound-contact, …) stay for the audit trail; this
// translates them, and the route, into a sentence. Levels drive the colour.
const ABSTENTION_RE = /\b(does(?:n['’]?t| not)\s+(?:cover|mention|say|state|address|discuss|contain|specify)|not\s+(?:covered|mentioned|stated|specified)|isn['’]?t\s+(?:in|covered)|no\s+(?:information|mention|indication|details?))\b/i;

const coverageSummary = (route, flags, sources, text) => {
  if (route === 'error') return null;
  const ids = new Set((flags || []).map(f => f.id));
  if (route === 'chat')
    return { text: 'Answered from general knowledge — not grounded in the document.', level: 'free' };
  // Grounded routes:
  if (ids.has('abstained') || ABSTENTION_RE.test(String(text || '')))
    return { text: 'The document doesn’t cover this question.', level: 'partial' };
  if (ids.has('edge-contradicted'))
    return { text: 'A claim here conflicts with the document.', level: 'weak' };
  if (ids.has('unbound'))
    return { text: 'Couldn’t tie any of this to specific sentences — read with care.', level: 'weak' };
  if (ids.has('unbound-contact'))
    return { text: 'Loosely grounded — paraphrased from the text, not tied to a single sentence.', level: 'partial' };
  if (ids.has('low-coverage'))
    return { text: 'Partial coverage — some of this goes beyond the cited text.', level: 'partial' };
  if (sources && sources.length)
    return { text: 'Answered from the text, tied to the cited sentences.', level: 'good' };
  return { text: 'Answered from the document.', level: 'good' };
};

// The single line shown on the thinking bubble. Friendly, plain-language
// phases — not the engine's stage names or counts. The precise per-stage
// record (route, span counts, char lengths, veto flags) lives in the Audit
// pane; here the user just sees that something is happening.
const stageLabel = (name) => {
  switch (name) {
    case 'route':    return 'thinking…';
    case 'retrieve': return 'reading…';
    case 'fold':     return 'reading…';
    case 'prompt':   return 'thinking…';
    case 'llm':      return 'writing…';
    case 'bind':     return 'writing…';
    case 'veto':     return 'checking…';
    case 'settle':   return 'finishing…';
    default:         return 'thinking…';
  }
};

const compactData = (name, data) => {
  if (!data) return '';
  const skip = new Set(['ms']);
  const entries = Object.entries(data).filter(([k]) => !skip.has(k));
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${k}=${formatVal(v)}`).join(' ');
};

const formatVal = (v) => {
  if (Array.isArray(v)) return `[${v.join(',')}]`;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return String(v ?? '');
};

// ── Transparency: every proposition the answer makes, traced to its source (or marked unsupported)
//
// The user's ask — "see the source on everything it's saying; all output turned into propositions
// and grounded (or found inaccurate) based on the source." buildPropositions turns the pipeline's
// per-claim record into that list: each bound claim (an answer sentence) paired with the source it
// cited, then overlaid with the fact-check's verdicts so a claim the source DENIES is marked
// inaccurate. Pure and exported so the mapping is unit-testable without the DOM.

const STOPWORDS = new Set(('the a an of to in on for and or but is are was were be been with as at by from this that ' +
  'it its his her their he she they i you we not no do does did has have had will would can could s t'). split(/\s+/));
const contentWords = (s) => new Set((String(s || '').toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) || []).filter(w => !STOPWORDS.has(w)));
// The claim a verdict is about — highest content-word overlap with the verdict's relation text.
const bestMatch = (claims, text) => {
  const want = contentWords(text);
  if (!want.size) return null;
  let best = null, bestScore = 0;
  for (const c of claims) {
    const have = contentWords(c.text);
    let n = 0; for (const w of want) if (have.has(w)) n++;
    if (n > bestScore) { bestScore = n; best = c; }
  }
  return bestScore >= 1 ? best : null;
};

export const buildPropositions = (res = {}, citationSources = {}) => {
  const route = res.route || res.turn?.route || 'grounded';
  const idxOf = (citation) => {
    if (!citation) return null;
    const idx = parseInt(String(citation).slice(1), 10);
    return Number.isFinite(idx) ? idx : null;
  };
  const sourceFor = (citation) => {
    const idx = idxOf(citation);
    return idx == null ? null : (citationSources[idx] || citationSources[String(idx)] || null);
  };
  // One proposition per bound claim (an answer sentence). On a chat turn nothing is grounded —
  // the answer is the model's own knowledge, and the view says so plainly. Pair each claim with
  // its bound record up front so the verdict overlay can re-index safely (an empty claim dropped
  // here must not shift the others off their sources).
  const claims = (res.bound || [])
    .map((b) => ({ b, text: String(b.claim || '').trim() }))
    .filter(({ text }) => text)
    .map(({ b, text }) => ({
      text, citation: b.citation || null, source: sourceFor(b.citation),
      status: route === 'chat' ? 'general' : (b.citation ? 'grounded' : 'ungrounded'),
      reason: null,
      // `verdict` is the graph-comparison outcome (corroborated / contradicted / unsupported …)
      // once the fact-check overlay below finds the claim; null means the claim was not a
      // relational assertion the edge-grounding check could measure.
      verdict: null,
    }));
  // Overlay the fact-check verdicts — the comparison of each asserted proposition against the
  // document graph (factcheck/correspond.js). A contradicted / off-diagonal relation marks the
  // claim INACCURATE; a corroborated relation CONFIRMS it and lends the document edge's citation
  // (so a graph-witnessed claim the lexical binder missed still points back at its source); an
  // unsupported relation — endpoints resolve, relation types, but the reading does not witness it
  // — is flagged as having no witness, distinct from a claim simply never cited. Indeterminate is
  // held (the check could not run) and leaves the claim's binding status untouched.
  for (const v of (res.verdicts || [])) {
    const text = v.sentence || [v.src, v.tgt].filter(Boolean).join(' ');
    const claim = bestMatch(claims, text);
    if (!claim) continue;
    claim.verdict = v.verdict;
    if (v.verdict === 'contradicted' || v.verdict === 'off_diagonal') {
      claim.status = 'inaccurate';
      claim.reason = v.reason || 'the source does not support this';
    } else if (v.verdict === 'corroborated') {
      if (claim.status === 'ungrounded') claim.status = 'grounded';
      if (v.citation) {
        if (!claim.citation) claim.citation = v.citation;
        if (!claim.source) claim.source = sourceFor(v.citation);
      }
      claim.reason = 'confirmed against the document graph';
    } else if (v.verdict === 'unsupported' && claim.status === 'ungrounded') {
      claim.status = 'unsupported';
      claim.reason = v.reason || 'no witness for this relation in the document';
    }
  }
  return claims;
};

const PROP_STATUS = {
  grounded:    { glyph: '✓', label: 'grounded',     cls: 'good' },
  inaccurate:  { glyph: '✗', label: 'conflicts with source', cls: 'weak' },
  unsupported: { glyph: '?', label: 'no witness in source', cls: 'partial' },
  ungrounded:  { glyph: '·', label: 'not in sources', cls: 'partial' },
  general:     { glyph: '◇', label: 'general knowledge', cls: 'free' },
};

// The transparency panel — a toggleable list of every proposition and what backs it. Collapsed
// or expanded per `opts.transparency` (the persisted on/off); the toggle flips it and reports
// back through `opts.onTransparency` so the choice sticks across turns.
export const renderTransparency = (el, opts = {}) => {
  el.querySelector('.transparency')?.remove();
  el.querySelector('.transparency-toggle')?.remove();
  const props = opts.propositions || [];
  if (!props.length) return;

  const open = opts.transparency !== false;   // default ON — the user asked to see the sourcing
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'transparency-toggle';
  const setLabel = (o) => { toggle.textContent = `${o ? '▾' : '▸'} sources for every claim (${props.length})`; };
  setLabel(open);

  const panel = document.createElement('div');
  panel.className = 'transparency' + (open ? ' open' : '');
  for (const p of props) {
    const row = document.createElement('div');
    row.className = `prop ${p.status}`;
    const meta = PROP_STATUS[p.status] || PROP_STATUS.ungrounded;

    const pill = document.createElement('span');
    pill.className = `prop-status ${meta.cls}`;
    pill.textContent = `${meta.glyph} ${meta.label}`;
    if (p.reason) pill.title = p.reason;
    row.appendChild(pill);

    const claim = document.createElement('span');
    claim.className = 'prop-claim';
    claim.textContent = p.text;
    row.appendChild(claim);

    // The source of the assertion. A web-sourced claim links out to the page it cites; a
    // document-grounded claim renders its [sN] citation as a clickable chip that scrolls to —
    // and highlights — the source sentence in the doc pane (the delegated `.cite` handler in
    // app.js does the jump). So every grounded proposition points back at where it came from.
    const citeIdx = p.citation ? parseInt(String(p.citation).slice(1), 10) : NaN;
    if (p.source?.url) {
      const src = document.createElement('a');
      src.className = 'prop-source';
      src.href = p.source.url; src.target = '_blank'; src.rel = 'noopener';
      src.textContent = p.source.label || p.source.url;
      src.title = `Source — ${p.source.url}`;
      row.appendChild(src);
    } else if (Number.isFinite(citeIdx)) {
      const src = document.createElement('span');
      src.className = 'prop-source cite';
      src.dataset.idx = String(citeIdx);
      const label = p.source?.label && p.source.label !== `s${citeIdx}` ? ` · ${p.source.label}` : '';
      src.textContent = `[s${citeIdx}]${label}`;
      src.title = 'Jump to the source sentence in the document';
      row.appendChild(src);
    } else if (p.source?.label) {
      const src = document.createElement('span');
      src.className = 'prop-source';
      src.textContent = p.source.label;
      src.title = `Source — ${p.source.label}`;
      row.appendChild(src);
    }

    // The cited span itself — the verbatim sentence the claim was tied to, quoted beneath it, so
    // the user sees exactly where it came from, not only a pointer. Present only when the pipeline
    // resolved the text for this citation (a grounded, doc/web-backed claim).
    if (p.source?.text) {
      const span = document.createElement('div');
      span.className = 'prop-span';
      span.textContent = `“${p.source.text}”`;
      if (Number.isFinite(citeIdx)) {
        span.classList.add('cite');           // reuse the delegated [sN] jump-to-source handler
        span.dataset.idx = String(citeIdx);
        span.title = 'Jump to this sentence in the document';
      }
      row.appendChild(span);
    }
    panel.appendChild(row);
  }

  toggle.addEventListener('click', () => {
    const nowOpen = panel.classList.toggle('open');
    setLabel(nowOpen);
    if (typeof opts.onTransparency === 'function') opts.onTransparency(nowOpen);
  });

  el.appendChild(toggle);
  el.appendChild(panel);
};

// Per-claim attribution: each [sN] becomes a chip that names the source it cites. When a source
// map is supplied (idx → {label, url}), a web citation links to the page and shows its title on
// hover; a document citation still scrolls to the span. Falls back to the bare [sN] chip.
// Operates on ALREADY-ESCAPED text — the bracket form survives escaping, so callers escape once.
const linkifyEscaped = (escaped, citationSources = null) =>
  escaped.replace(/\[s(\d+)\]/g, (_, n) => {
    const src = citationSources && citationSources[n];
    if (src && src.url) {
      const title = escapeHtml(`${src.label} — ${src.url}`);
      return `<a class="cite cite-web" data-idx="${n}" href="${escapeHtml(src.url)}" target="_blank" rel="noopener" title="${title}">[s${n}]</a>`;
    }
    const title = src?.label ? ` title="${escapeHtml(src.label)}"` : '';
    return `<span class="cite" data-idx="${n}"${title}>[s${n}]</span>`;
  });

const linkifyCitations = (text, citationSources = null) =>
  linkifyEscaped(escapeHtml(text), citationSources);

// Inline span markup on a RAW segment: escape first (no markup injection), then **bold** and
// *italic* (bold before italic so `**x**` is not eaten by the single-star rule), then the
// citation chips. The marker characters (* # - [ ]) are not HTML-special, so they survive the
// escape and the regexes see them intact.
const formatInline = (raw, citationSources = null) => {
  let s = escapeHtml(raw);
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  return linkifyEscaped(s, citationSources);
};

// renderRich — the chat answer body as markdown-lite HTML. The answer used to render as a single
// escaped+linkified blob, so a multi-section answer's `## headings`, `**bold**`, and `- lists`
// showed as literal punctuation. This honours that light structure (the shape the arc and the
// research reports emit) while keeping the escape-first, no-raw-HTML guarantee: every text node
// is escaped before any tag is introduced. Blocks split on blank lines; within a block, a lone
// `#…` line is a heading, an all-`-`/`*` (or all-`1.`) block is a list, everything else is a
// paragraph with hard newlines kept as <br>.
const renderRich = (text, citationSources = null) => {
  const blocks = String(text || '').split(/\n{2,}/);
  const html = [];
  for (const block of blocks) {
    const b = block.replace(/\s+$/, '');
    if (!b.trim()) continue;
    const lines = b.split('\n');

    // Heading: a single line opening with 1–4 `#`. `#`/`##` → h3, deeper → h4 (the chat has no h1/h2).
    const h = lines.length === 1 && b.match(/^\s*(#{1,4})\s+(.+?)\s*$/);
    if (h) {
      const tag = h[1].length <= 2 ? 'h3' : 'h4';
      html.push(`<${tag}>${formatInline(h[2], citationSources)}</${tag}>`);
      continue;
    }

    // Unordered list: every line is a `- ` / `* ` item.
    if (lines.every(l => /^\s*[-*]\s+/.test(l))) {
      const items = lines.map(l => `<li>${formatInline(l.replace(/^\s*[-*]\s+/, ''), citationSources)}</li>`);
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list: every line is a `1.` / `2.` item.
    if (lines.every(l => /^\s*\d+\.\s+/.test(l))) {
      const items = lines.map(l => `<li>${formatInline(l.replace(/^\s*\d+\.\s+/, ''), citationSources)}</li>`);
      html.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Paragraph: hard line wraps within the block become <br>.
    html.push(`<p>${lines.map(l => formatInline(l, citationSources)).join('<br>')}</p>`);
  }
  return html.join('');
};

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Exported for the renderer's regression test (rich-render.test.js). Pure string → HTML string,
// no DOM — the chat body's markdown-lite render in one inspectable function.
export { renderRich, formatInline };

// The cue line a "go deeper" list sits under — the closing offer the shape cue asks the talker
// to write ("Want me to go deeper on:"). Matched loosely so the talker's own wording still trips it.
const EXPLORE_CUE = /\b(go deeper|dig deeper|dive deeper|explore|want to know more|learn more)\b/i;

// wireExploreChips — turn the trailing "want me to go deeper" list into clickable leads. The
// answer's LAST list is the candidate; it qualifies only if the element just before it reads as
// the go-deeper offer. Each item then re-asks as a fresh turn via onExplore. Purely additive: if
// there is no such list (a plain or pointed answer), nothing changes.
const wireExploreChips = (body, onExplore) => {
  const lists = body.querySelectorAll(':scope > ul, :scope > ol');
  const list = lists[lists.length - 1];
  if (!list) return;
  const cue = list.previousElementSibling;
  if (!cue || !EXPLORE_CUE.test(cue.textContent || '')) return;
  list.classList.add('explore-leads');
  for (const li of list.querySelectorAll(':scope > li')) {
    const q = (li.textContent || '').trim();
    if (!q) continue;
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.classList.add('explore-lead');
    const ask = () => onExplore(q);
    li.addEventListener('click', ask);
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ask(); } });
  }
};
