# Export for Substack — the conversation as a file that just pastes

The audit and the log already export — but as **JSONL**, for replay and inspection.
Neither produces something you'd *publish*. The shareable artifact of this app is
the **conversation**: the grounded Q&A you held with a document, citations and all.
"Export for Substack" hands that back as a file you can paste straight into a post.

## Why HTML, not Markdown

The whole problem is the paste. Substack's editor accepts pasted **rich HTML** —
`<h1>`/`<h2>` become its headings, `<strong>`/`<em>` its bold/italic, `<a>` its
links, `<blockquote>` its quote, `<ul>`/`<ol>` its lists, `<hr>` its divider — and
maps them onto its own formatting. But it does **not** parse pasted *Markdown*: drop
`## Heading` or `**bold**` into the editor and you get the literal characters back.

So a `.md` export would be the wrong shape — it reads fine in a text editor and
pastes as garbage into Substack. The reliable path is the opposite: emit clean,
semantic HTML, let the browser render it, and let the user copy the **rendered**
article. That is what `src/ui/substack.js` builds.

## The shape

`buildSubstackHtml(messages, opts)` (pure, DOM-free, unit-tested) returns one
self-contained page:

- **Questions are headings, answers are prose.** Each user turn becomes an `<h2>`,
  each assistant turn the Markdown-rendered answer — so the post reads as an
  interview with a skimmable outline.
- **Any Markdown the model emitted becomes real tags.** A small, contained
  block+inline renderer (`mdToHtml`) turns headings, lists, blockquotes, fenced
  code, bold/italic, links and rules into HTML. Everything is HTML-escaped *before*
  any tag is emitted, so model output can never inject markup.
- **Citations are kept, not dropped.** The app's `[sN]` tokens become muted
  superscript markers (`<sup class="cite">`). If Substack strips the `<sup>` on
  paste, the `[N]` text survives — the grounding is never silently lost.
- **Provenance rides along.** When the grounded documents are known they become a
  one-line source note under the title.

## Copying it perfectly

The page carries a **"Copy for Substack"** button (and the article alone is the copy
target — the toolbar and script are `.no-copy`). One click copies the rendered
article to the clipboard as rich HTML:

1. **Primary** — `navigator.clipboard.write` with a `ClipboardItem` carrying both
   `text/html` and `text/plain`, so Substack takes the HTML and plain editors take
   the text.
2. **Fallback** (also the `file://` path, where the async clipboard is often
   blocked) — select the article and `document.execCommand('copy')`. This is exactly
   a manual select-all + copy, which carries the same rich formatting.
3. **Last resort** — leave the article selected so the user can press Ctrl/Cmd-C.

Then: switch to the Substack composer, paste, done. The file is also readable on its
own (light/dark, sensible typography), but the formatting that survives the paste
rides on the semantic tags — never the CSS, which Substack discards.

## Where it lives

`exportSubstack(messages, opts)` is the download wrapper, mirroring `exportLog` /
`exportAudit` (the anchor must be in the document for Firefox/Safari to start the
download). The **Export for Substack** button in the Chat pane is wired in
`src/ui/app.js`; it stays disabled until the first exchange lands, so it never hands
back an empty post, and passes the selected documents as the provenance line.
