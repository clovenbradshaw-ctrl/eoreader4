// Chat view: append user/assistant messages, linkify [sN] citations
// so clicking one scrolls and highlights the source in the doc pane.

export const renderUserMessage = (root, text) => {
  const el = document.createElement('div');
  el.className = 'msg user';
  el.textContent = text;
  root.appendChild(el);
  root.scrollTop = root.scrollHeight;
};

export const renderAssistantMessage = (root, text, sources, opts = {}) => {
  const el = document.createElement('div');
  el.className = 'msg assistant';
  el.innerHTML = linkifyCitations(text);
  if (sources && sources.length) {
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `sources: ${sources.map(s => `s${s}`).join(', ')}` +
      (opts.route ? `  ·  route: ${opts.route}` : '') +
      (opts.ms != null ? `  ·  ${opts.ms}ms` : '');
    el.appendChild(meta);
  } else if (opts.route) {
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `route: ${opts.route}` + (opts.ms != null ? `  ·  ${opts.ms}ms` : '');
    el.appendChild(meta);
  }
  root.appendChild(el);
  root.scrollTop = root.scrollHeight;
};

const linkifyCitations = (text) => {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\[s(\d+)\]/g,
    (_, n) => `<span class="cite" data-idx="${n}">[s${n}]</span>`);
};
