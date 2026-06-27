// Chat view: append user/assistant messages, render a live "thinking"
// bubble that updates per stage, and surface veto flags as pills.
// Citations [sN] are linkified — clicking one scrolls and highlights
// the source in the doc pane.

export const renderUserMessage = (root, text) => {
  const el = document.createElement('div');
  el.className = 'msg user';
  el.textContent = text;
  root.appendChild(el);
  root.scrollTop = root.scrollHeight;
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

export const updateThinking = (el, stageName, data, ctx) => {
  if (!el) return;
  const label = el.querySelector('.body .label');
  if (label) label.textContent = stageLabel(stageName, data);
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
  el.querySelectorAll(':scope > .coverage, :scope > .docsources, :scope > .flags, :scope > .meta, :scope > .retry, :scope > .trail-toggle')
    .forEach(n => n.remove());
  el.classList.remove('thinking');
  el.classList.remove('streaming');     // the live stream is replaced by the cited answer
  const body  = el.querySelector('.body');
  const trail = el.querySelector('.trail');
  if (body) body.innerHTML = linkifyCitations(text || '');

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
export const renderWebResult = (el, fetched) => {
  if (!el || !fetched) return;
  el.querySelector('.webresult')?.remove();
  const box = document.createElement('div');
  box.className = 'webresult';

  const head = document.createElement('div');
  head.className = 'wr-head';
  if (!fetched.results) {
    box.classList.add('empty');
    head.textContent = `No web results for “${fetched.query}”.`;
  } else if (fetched.trigger === 'verify') {
    // AUGMENT: a "From the web" answer built from the real pages, shown beside the model's own.
    box.classList.add('ok');
    head.textContent = fetched.augmented
      ? `🌐 From the web — answered from ${fetched.results} source${fetched.results > 1 ? 's' : ''}:`
      : `🔍 Searched the web (${fetched.results} source${fetched.results > 1 ? 's' : ''}).`;
  } else {
    box.classList.add('ok');
    head.textContent = `🔍 Searched the web — pulled ${fetched.results} source${fetched.results > 1 ? 's' : ''} into this answer.`;
  }
  box.appendChild(head);

  // The web-grounded answer itself (verify/augment) — the good answer, kept separate from the
  // model's own above it. Plain text; the sources it drew on follow as chips.
  if (fetched.augmented?.answer) {
    const ans = document.createElement('div');
    ans.className = 'wr-answer';
    // Strip the bound [sN] markers: they index the web re-run's own scope, not this turn's
    // sources, so linkifying would mis-reference. The sources ride as chips just below.
    ans.textContent = String(fetched.augmented.answer).replace(/\s*\[s\d+\]/g, '').trim();
    box.appendChild(ans);
  }

  const sources = fetched.augmented?.sources || fetched.sources || [];
  for (const s of sources) {
    if (!s) continue;
    const item = document.createElement(s.url ? 'a' : 'div');
    item.className = 'wr-source';
    if (s.url) { item.href = s.url; item.target = '_blank'; item.rel = 'noopener'; item.title = s.url; }
    const label = document.createElement('span');
    label.className = 'wr-source-label';
    label.textContent = s.title || s.url || s.docId || 'source';
    item.appendChild(label);
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

const stageLabel = (name, data) => {
  switch (name) {
    case 'route':    return `route → ${data?.route || '?'}`;
    case 'retrieve': return `retrieve · ${data?.n || 0} spans`;
    case 'fold':     return `fold · ${data?.noteLen || 0} chars`;
    case 'prompt':   return `prompt · ${data?.promptLen || 0} chars`;
    case 'llm':      return `model · generating…`;
    case 'bind':     return `bind · ${data?.cited || 0}/${data?.claims || 0} cited`;
    case 'veto':     return data?.fired?.length
                       ? `veto · flags: ${data.fired.join(', ')}`
                       : `veto · clean`;
    case 'settle':   return 'settle';
    default:         return name;
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

const linkifyCitations = (text) => {
  const escaped = escapeHtml(text);
  return escaped.replace(/\[s(\d+)\]/g,
    (_, n) => `<span class="cite" data-idx="${n}">[s${n}]</span>`);
};

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
