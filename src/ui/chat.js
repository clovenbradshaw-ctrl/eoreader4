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
    <div class="body"><span class="dots"></span><span class="label">${escapeHtml(initial)}</span></div>
    <div class="trail"></div>
  `;
  root.appendChild(el);
  root.scrollTop = root.scrollHeight;
  return el;
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
  el.classList.remove('thinking');
  const body  = el.querySelector('.body');
  const trail = el.querySelector('.trail');
  if (body) body.innerHTML = linkifyCitations(text || '');

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

// Back-compat for any caller that still wants a one-shot assistant render.
export const renderAssistantMessage = (root, text, sources, opts = {}) => {
  const el = createThinkingMessage(root);
  finalizeThinking(el, text, sources, opts);
  return el;
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
