// Render a PLAIN-TEXT body (.txt, Project Gutenberg, pasted prose) as a readable HTML
// document for the reader's center/embed iframe.
//
// THE BUG THIS FIXES: a .txt has no markup — its paragraph and line structure lives
// entirely in newline characters. The reader's loaders (loadCenter / loadEmbed) used to
// drop the fetched body straight into an iframe as an HTML document. A browser parsing
// text as HTML applies the default `white-space: normal`, which collapses every newline
// and run of spaces into a single space — so the whole document reflowed into one
// run-on, justified blob. We rebuild the structure instead: blank-line-separated
// paragraphs become <p>; a body with no blank lines is shown verbatim in a pre-wrap
// block so its line breaks survive and nothing is lost.

// looksPlainText(ctype, body) — is the fetched body plain text rather than HTML? Trusts
// an explicit content-type, otherwise sniffs the head for any block-level HTML tag (the
// same heuristic extract() uses on the memory side).
export const looksPlainText = (ctype, body) => {
  const ct = String(ctype || '');
  if (/text\/plain/i.test(ct)) return true;
  if (/text\/html|application\/xhtml|application\/xml|\+xml/i.test(ct)) return false;
  const head = String(body || '').slice(0, 3000);
  return !/<\s*(!doctype|html|body|article|main|div|p|h[1-6]|table|section|span)\b/i.test(head);
};

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// plainTextParagraphs(raw) → [paragraphHtml]. Blank lines delimit paragraphs; hard line
// wraps inside a paragraph collapse to spaces. A body with no blank lines is kept
// verbatim in a single pre-wrap block (so a hard-wrapped or single-block file is shown
// exactly as written rather than guessed at).
export const plainTextParagraphs = (raw) => {
  const t = String(raw || '').replace(/\r\n?/g, '\n');
  const blocks = t.split(/\n[ \t]*\n+/)
    .map((b) => b.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
  if (blocks.length > 1) return blocks.map((p) => '<p>' + esc(p) + '</p>');
  return ['<pre class="eo-raw">' + esc(t.replace(/[ \t]+$/gm, '').trim()) + '</pre>'];
};

// plainTextToHtml(raw, opts) → a full, themed HTML document string for the iframe. The
// caller passes resolved reading prefs (font family, theme colors, sizes) so this stays
// free of the app's theme tables. `base` injects a <base> so any stray links resolve.
export const plainTextToHtml = (raw, opts = {}) => {
  const {
    url = '', target = '_blank',
    fs = 19, lh = 1.7, maxw = 720,
    ff = 'Georgia,"Iowan Old Style","Times New Roman",serif',
    bg = '#ffffff', fg = '#23272e', acc = '#5b34d6',
  } = opts;
  const baseTag = url
    ? '<base href="' + esc(url) + '" target="' + esc(target) + '"><meta name="referrer" content="no-referrer">'
    : '';
  const css =
    ':root{--eo-fs:' + fs + 'px;--eo-lh:' + lh + ';--eo-maxw:' + maxw + 'px;--eo-ff:' + ff + ';--eo-bg:' + bg + ';--eo-fg:' + fg + ';--eo-acc:' + acc + ';}' +
    'html,body{margin:0;background:var(--eo-bg);}' +
    'body{font:var(--eo-fs)/var(--eo-lh) var(--eo-ff);color:var(--eo-fg);}' +
    '.eo-book{max-width:var(--eo-maxw);margin:0 auto;padding:54px 30px 180px;}' +
    'p{margin:0 0 1.15em;}' +
    '.eo-raw{white-space:pre-wrap;word-break:break-word;font:inherit;margin:0;}';
  return '<!doctype html><html><head><meta charset="utf-8">' + baseTag +
    '<style>' + css + '</style></head><body><div class="eo-book">' +
    plainTextParagraphs(raw).join('\n') + '</div></body></html>';
};
