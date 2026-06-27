# Internet-native — the web is the memory, the readings are the phenomena

> The internet is the noumenon: the ground-in-itself the engine never sees whole.
> A *reading* is the phenomenon: what the surf actually constructs when it reads a page.
> Memory is not a private store beside the web — it **is** the web. So the web is always
> the ground, never a per-message option the user manages.

This is a stance, and it has consequences in the UI and in the spine.

## The stance

- **Noumenon = the internet.** The world the engine reads but never possesses. In the
  density-operator terms of the persistent Horizon (`docs/surfing-next.md` §4,
  `src/surfer/horizon.js`), this is the cold-start ground σ — the maximally-mixed prior,
  the unread world before any page has been witnessed.
- **Phenomena = the readings.** Every surf of a fetched page is an *appearance* the engine
  constructs — spans, edges, a meaning graph. The phenomenon is never the page itself; it is
  the engine's reading of it, brought back under the same grounding discipline as everything
  else it reads (`docs/web-search.md`).
- **Memory = the internet.** The Horizon accumulates the readings (phenomena) by a γ-decayed
  fold; the ground it departs from and re-grounds toward (σ) stands in for the noumenal web.
  So "memory" is the moved operator between the unread world and what has been read this
  session — not a cache the user curates.

## The consequence: minimal settings, no send-time options

If the web is the tool's memory, you do not *opt into* your own memory. So:

- **No web chip.** Web search is fixed to `auto` (`src/ui/app.js`). Every turn searches up
  front and answers grounded in what it gathered — the inverted gather → surf → answer flow.
- **No grounding-register chip.** The register is fixed to `auto`: the turn grounds on
  whatever it gathered (web + any loaded document), and falls to general knowledge only when
  nothing covers the question. There is no "free form" / "chat with document" to manage.
- **One setting the user modifies:** the model backend (header `<select>`). A document is
  still optional — drop one and it *joins* the web in the grounding scope — but it is an
  augmentation of the ground, not the ground itself.
- **The per-claim source view** (transparency) stays, because it is a per-*answer* view
  preference, not a send-time option.

## Where it lives

| concern | file |
|---|---|
| always-on web, fixed registers | `src/ui/app.js` (no chips; `webSearch`/`grounding` constants) |
| the gather → surf → answer flow | `src/ui/app.js` (`webMode === 'auto'`), `src/turn/web.js` |
| web reading under grounding discipline | `docs/web-search.md` |
| the noumenal ground σ / accumulated phenomena | `src/surfer/horizon.js`, `docs/surfing-next.md` §4 |
