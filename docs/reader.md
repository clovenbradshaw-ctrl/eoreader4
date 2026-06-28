# The EO Reader (`index.html`)

`index.html` is now the **EO Reader** — a reading surface where every recognized
entity in a page is clickable and a right-hand side panel says what we know about it
(definition, mentions, neighbors/relations, sources, an ego-graph). It reads live URLs,
renders the fetched page as a page (iframe), and decorates it with clickable entities.
**Almost all of this is computed without an LLM** — purely from the structural parse
(`parseText` → `projectGraph`). The original chat app is preserved at `chat.html`.

What you can do:

- **Read a website as a website** — paste a URL; the fetched page renders in the center
  (sandboxed iframe) with its known names highlighted and clickable.
- **Read a book as a book** — import a `.txt`/`.md` file (📄) or search **Project
  Gutenberg** (type a title/author in the search bar). The work renders as a readable
  book — drop-cap, serif, the author's paragraphs — entities clickable. A book is
  **read fully** (fetched, PG boilerplate stripped, parsed) before it becomes a source
  and can be chatted with.
- **Chat, grounded** — a center chat answers from what you've read; every answer is
  quoted from your sources and links the entities/sources it drew on (no LLM). Chats are
  first-class: a "New chat" button and a Chats section live in the left panel, and any
  source has a ✦ button to chat about just that source.
- **Swap panels** — the ⇄ toolbar button swaps the sources/chats side and the entities
  side; the choice persists.

The implementation lives in `src/reader/app.dc.js` (logic) and `src/reader/view.xdc.html`
(view); the entity engine and the fetch proxy are the repo's own.

This UI is the front end the engine was always built for; its footer reads *"Live
projection of your reading log over the real eoreader4 engine."* It is React + a small
`<x-dc>` view runtime, driving the repo's own engine.

## Layout

- `index.html` — **generated**, self-contained. Do not hand-edit; run the build below.
- `src/reader/app.dc.js` — the app logic (`class Component extends DCLogic`). Edit here.
- `src/reader/view.xdc.html` — the `<x-dc>` view template. Edit here.
- `src/reader/app.props.txt` — the DC `data-props` schema (seedUrl, accent).
- `vendor/react.production.min.js`, `vendor/react-dom.production.min.js` — pinned React 18.
- `vendor/dc-runtime.js` — the `<x-dc>` view runtime (third-party; loaded as a UMD global).
- `scripts/build-reader.mjs` — assembles the three sources above into `index.html`.

## Build

```sh
node scripts/build-reader.mjs   # regenerate index.html after editing the sources
npm run serve                   # python http.server on :8000, then open /index.html
```

## Engine wiring

`window.__resources` (set in `index.html`) points each engine/data resource at a real
repo file, resolved to an absolute URL against `document.baseURI` (the app's dynamic
`import()`/`fetch` run inside `vendor/dc-runtime.js`, so relative paths would resolve
against `/vendor/`):

| resource      | path                                   | role |
|---------------|----------------------------------------|------|
| `eoEngine`    | `src/reader/eoreader4-bundle.js`       | the engine: `parseText`, `projectGraph`, `DEFAULT_PROJECTION_RULES` (a single-file build of `src/`) |
| `eoSvo`       | `src/reader/svo-llm.js`                | optional LLM relation reader — inert without `window.claude` |
| `eoPhase`/`eoEmbed` | `src/reader/eo/*.js`             | optional MiniLM "measured reading" lens classifier |
| `eoCells`/`eoCentroids` | `src/reader/eo/*.json`       | data for the lens classifier |

To run against the **live** source under `src/` instead of the prebuilt bundle (so
edits there take effect with no rebuild), point `eoEngine` at `src/reader/engine-entry.js`
in `scripts/build-reader.mjs` and rebuild. Both expose the same three names.

The reader fetches pages through the same proxy the rest of the repo uses
(`https://n8n.intelechia.com/webhook`, see `src/ingest/webfetch.js`).

## Without an LLM

Entity detection and everything the side panel shows come from `parseText` +
`projectGraph` — no model in the loop. The SVO-LLM relation reader and the MiniLM lens
classifier are optional enhancements that degrade gracefully when no model is present
(`this.SVO = null`; the classifier fails closed).
