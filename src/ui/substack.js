// Export the chat transcript as a file that pastes cleanly into Substack.
//
// Substack's editor accepts pasted *rich HTML* — headings, bold/italic, links,
// blockquotes, lists and dividers all map onto its own formatting — but it does
// NOT parse pasted Markdown (you get a literal ## and **). So the reliable path
// to "it just pastes" is to hand the user a small HTML page and let them copy its
// rendered article: the file carries a one-click "Copy for Substack" button, and
// a manual select-all of the article works too.
//
// Two pure builders (DOM-free, unit-tested) and one DOM download wrapper, mirroring
// exportLog / exportAudit:
//   mdToHtml(text)              – the lightweight Markdown→HTML the answers may carry
//   buildSubstackPost(msgs)     – the article body: questions as headings, answers as prose
//   buildSubstackHtml(msgs)     – the whole standalone page, with the copy button + script
//   exportSubstack(msgs)        – wrap it in a Blob and download it

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Inline Markdown on already-escaped text. Code spans are split out first (split on
// a capturing group keeps them at the odd indices) so their contents are never
// re-parsed for emphasis/links; only the text between them is transformed, then the
// <code> spans are welded back in. Order within a segment: links, strong before em
// (so ** isn't eaten as two *), then the app's [sN] citation tokens. Underscore
// emphasis is bounded by non-word edges so snake_case names aren't italicised.
const inlineMd = (escaped) => {
  const parts = String(escaped ?? '').split(/(`[^`]+`)/);
  return parts.map((part, i) => {
    if (i % 2 === 1) return `<code>${part.slice(1, -1)}</code>`;   // a captured `…` span
    let s = part;
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
    s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])__([^_\n]+?)__(?=$|[\s).,!?;:])/g, '$1<strong>$2</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[\s(])_([^_\n]+?)_(?=$|[\s).,!?;:])/g, '$1<em>$2</em>');
    // [sN] citation tokens → a muted superscript marker; if Substack drops the <sup>
    // on paste, the [N] text survives, so the grounding is never silently lost.
    s = s.replace(/\[s(\d+)\]/g, '<sup class="cite">[$1]</sup>');
    return s;
  }).join('');
};

// Block-level Markdown → HTML. A small, contained subset — the constructs a chat
// answer realistically carries: headings, blockquotes, ordered/unordered lists,
// fenced code, horizontal rules, and blank-line-separated paragraphs. Everything is
// HTML-escaped before any tag is emitted, so model output can never inject markup.
export const mdToHtml = (text) => {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  const flush = () => {
    if (para.length) { out.push(`<p>${inlineMd(escapeHtml(para.join(' ')))}</p>`); para = []; }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code block — verbatim, never re-parsed for inline markup.
    if (/^```/.test(line)) {
      flush();
      const body = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { body.push(lines[i]); i++; }
      out.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    if (/^\s*$/.test(line)) { flush(); continue; }

    // Horizontal rule (--- *** ___).
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push('<hr>'); continue; }

    // ATX heading.
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flush(); const n = h[1].length; out.push(`<h${n}>${inlineMd(escapeHtml(h[2].trim()))}</h${n}>`); continue; }

    // Blockquote run — consecutive > lines fold into one <blockquote>.
    if (/^\s*>\s?/.test(line)) {
      flush();
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      i--;
      out.push(`<blockquote>${inlineMd(escapeHtml(buf.join(' ')))}</blockquote>`);
      continue;
    }

    // Unordered list run.
    if (/^\s*[-*+]\s+/.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++; }
      i--;
      out.push(`<ul>${items.map((it) => `<li>${inlineMd(escapeHtml(it))}</li>`).join('')}</ul>`);
      continue;
    }

    // Ordered list run (1. or 1) ).
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
      i--;
      out.push(`<ol>${items.map((it) => `<li>${inlineMd(escapeHtml(it))}</li>`).join('')}</ol>`);
      continue;
    }

    // Plain paragraph line — accumulate until a blank line or a block flushes it.
    para.push(line.trim());
  }
  flush();
  return out.join('\n');
};

// The article body: each user turn becomes an <h2> (the question heading), each
// assistant turn the Markdown-rendered answer. Empty turns are skipped. Pure.
export const buildSubstackPost = (messages, opts = {}) => {
  const msgs = Array.isArray(messages) ? messages : [];
  const parts = [];
  for (const m of msgs) {
    const content = String(m?.content ?? '').trim();
    if (!content) continue;
    if (m.role === 'user') parts.push(`<h2>${inlineMd(escapeHtml(content))}</h2>`);
    else parts.push(mdToHtml(content));
  }
  return parts.join('\n');
};

const defaultTitle = (opts) => {
  if (opts.title && String(opts.title).trim()) return String(opts.title).trim();
  const docs = Array.isArray(opts.docNames) ? opts.docNames.filter(Boolean) : [];
  return docs.length ? `In conversation with ${docs.join(', ')}` : 'A conversation';
};

// The whole standalone page. The <article id="post"> is what gets copied; the
// toolbar and script are marked .no-copy and excluded from the copy range, so a
// click on the button — or a manual select-all of the article — yields just the
// post. The page is viewable on its own (readable typography, light/dark), but the
// formatting that survives the paste rides on the semantic tags, never the CSS.
export const buildSubstackHtml = (messages, opts = {}) => {
  const title = defaultTitle(opts);
  const docs = Array.isArray(opts.docNames) ? opts.docNames.filter(Boolean) : [];
  const body = buildSubstackPost(messages, opts);
  const provenance = docs.length
    ? `<p class="provenance"><em>Grounded in ${docs.map(escapeHtml).join(', ')} — answers were cited and auditable.</em></p>\n`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { max-width: 720px; margin: 0 auto; padding: 1.25rem 1.25rem 4rem;
         font: 18px/1.65 Georgia, "Iowan Old Style", "Times New Roman", serif; color: #1a1a1a; background: #fff; }
  .toolbar { position: sticky; top: 0; z-index: 1; display: flex; gap: .75rem; align-items: center;
             flex-wrap: wrap; padding: .75rem 0; margin-bottom: 1.25rem;
             border-bottom: 1px solid #e7e7e7; background: #fff;
             font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .toolbar button { font: 600 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    cursor: pointer; padding: .6rem 1rem; border: 0; border-radius: 8px; background: #ff6719; color: #fff; }
  .toolbar button:active { transform: translateY(1px); }
  .toolbar .hint { font-size: 13px; color: #666; }
  .toolbar .copied { font-size: 13px; color: #157a3f; font-weight: 600; }
  article h1 { font-size: 1.9rem; line-height: 1.2; margin: .25rem 0 1.25rem; }
  article h2 { font-size: 1.35rem; line-height: 1.3; margin: 2.25rem 0 .6rem; }
  article h3 { font-size: 1.1rem; margin: 1.75rem 0 .5rem; }
  article p { margin: 0 0 1.1rem; }
  article blockquote { margin: 0 0 1.1rem; padding: .2rem 0 .2rem 1rem; border-left: 3px solid #ddd; color: #444; }
  article ul, article ol { margin: 0 0 1.1rem 1.4rem; padding: 0; }
  article li { margin: .25rem 0; }
  article a { color: #1d4ed8; }
  article code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em;
                 background: #f3f3f3; padding: .1em .3em; border-radius: 4px; }
  article pre { background: #f6f8fa; padding: .8rem 1rem; border-radius: 8px; overflow: auto; }
  article pre code { background: none; padding: 0; }
  sup.cite { color: #ff6719; font-weight: 600; font-size: .7em; }
  .provenance { color: #666; font-size: .9rem; }
  @media (prefers-color-scheme: dark) {
    body { color: #e6e6e6; background: #121212; }
    .toolbar { background: #121212; border-color: #2a2a2a; } .toolbar .hint { color: #9a9a9a; }
    article blockquote { border-color: #333; color: #bbb; } article code { background: #222; }
    article pre { background: #1b1b1b; } article a { color: #7aa2ff; } .provenance { color: #9a9a9a; }
  }
</style>
</head>
<body>
<div class="toolbar no-copy">
  <button id="copy" type="button">Copy for Substack</button>
  <span class="hint">Click, then paste (Ctrl/Cmd-V) into the Substack editor. Or select the article and copy.</span>
  <span class="copied" id="copied" hidden>Copied &#10003;</span>
</div>
<article id="post">
<h1>${escapeHtml(title)}</h1>
${provenance}${body}
</article>
<script>
(function () {
  var btn = document.getElementById('copy');
  var ok = document.getElementById('copied');
  var post = document.getElementById('post');
  function flash() { if (ok) { ok.hidden = false; setTimeout(function () { ok.hidden = true; }, 2500); } }
  function selectArticle() {
    var sel = window.getSelection(); sel.removeAllRanges();
    var r = document.createRange(); r.selectNodeContents(post); sel.addRange(r); return sel;
  }
  if (!btn) return;
  btn.addEventListener('click', function () {
    var html = post.innerHTML, text = post.innerText;
    // Primary: write rich + plain together, so Substack takes the HTML and plain
    // editors take the text. Async clipboard may be blocked on file:// — fall through.
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })]).then(flash, fallback);
        return;
      } catch (e) { /* fall through */ }
    }
    fallback();
    function fallback() {
      // The file:// path: copy the live selection — exactly a manual select-all +
      // copy, which carries the rich formatting Substack accepts.
      try { selectArticle(); if (document.execCommand('copy')) { flash(); return; } } catch (e) {}
      // Last resort: leave the article selected so the user can press Ctrl/Cmd-C.
      selectArticle();
      btn.textContent = 'Press Ctrl/Cmd-C to copy';
    }
  });
})();
</script>
</body>
</html>`;
};

// Hand the page back as a downloadable .html file. Mirrors exportLog/exportAudit:
// the anchor must be IN the document for Firefox/Safari to start the download.
export const exportSubstack = (messages, opts = {}) => {
  const hasBody = Array.isArray(messages) && messages.some((m) => String(m?.content ?? '').trim());
  if (!hasBody) return;            // nothing said yet — don't hand back an empty post
  const html = buildSubstackHtml(messages, opts);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eoreader4-substack-${slug(opts.title || (opts.docNames && opts.docNames[0]))}-${Date.now()}.html`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const slug = (s) =>
  String(s || 'post').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'post';
