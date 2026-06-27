// The feed view — write a message, see what it would hand the model, before it
// is ever sent. The model is never called; the probe runs the turn's assembling
// stages only (turn/feed.js → route · converse · retrieve · fold · prompt).
//
// Two things, stacked:
//
//   1. The graph AROUND THE TERMS, as nested holons. NOT the visible graph:
//      graph-view caps to the 40 most-sighted figures and fades the rest with
//      γ-decay around a cursor. This is the activated window in full — every
//      figure and every bond the message lit up — each bond nested under the
//      figure it leaves, each traced to the line it was read from. Unclipped on
//      purpose: this is the graph the fold saw, not the graph the eye is shown.
//
//   2. The model feed itself: the notes (the arrows, capped exactly as the prompt
//      caps them), the verbatim excerpts, and the whole prompt text. The
//      mechanical truth of what the talker is handed — clipping and all.
//
// The probe runs with EMPTY history, so the same message over the same document
// always reads the same: an instrument, not a conversation.

import { buildFeed } from '../turn/index.js';

// Mount the input + results container once. The caller supplies live getters so
// the probe always reads the current document and embedder.
export const mountFeed = (root, { getDoc, getEmbedder, onSelectSentence } = {}) => {
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'feed-wrap';
  wrap.innerHTML =
    `<form class="feed-form">` +
      `<input type="text" class="feed-input" autocomplete="off" ` +
        `placeholder="Write a message — see the graph around its terms, and what the model would be fed…">` +
      `<button type="submit" class="small">Probe</button>` +
    `</form>` +
    `<div class="feed-results"><div class="feed-empty">Write a message and probe. You'll see the graph ` +
      `around its terms as nested holons (unclipped), and the exact prompt the model would be fed. ` +
      `The model is never called.</div></div>`;
  root.appendChild(wrap);

  const form    = wrap.querySelector('.feed-form');
  const input   = wrap.querySelector('.feed-input');
  const results = wrap.querySelector('.feed-results');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    results.innerHTML = `<div class="feed-empty">probing “${escapeHtml(message)}”…</div>`;
    try {
      const feed = await buildFeed({
        question: message, doc: getDoc?.() || null, embedder: getEmbedder?.(), history: [],
      });
      renderFeed(results, feed, { message, onSelectSentence });
    } catch (err) {
      results.innerHTML = `<div class="feed-empty">probe failed — ${escapeHtml(String(err?.message || err))}</div>`;
    }
  });

  // Jump to a cited line when a holon's source index is clicked (delegated).
  results.addEventListener('click', (ev) => {
    const c = ev.target.closest('[data-idx]');
    if (c && onSelectSentence) onSelectSentence(parseInt(c.dataset.idx, 10));
  });
};

// Render a computed feed into `root`. Separated from the probe so the rendering
// is exercised independently and the holon shaping below stays pure.
export const renderFeed = (root, feed, { message = '', onSelectSentence } = {}) => {
  root.innerHTML = '';
  const route = feed?.route || 'grounded';

  const head = document.createElement('div');
  head.className = 'feed-head';
  head.innerHTML =
    `<div class="feed-msg">${escapeHtml(message || feed?.question || '')}</div>` +
    `<div class="feed-route">route: <span class="feed-route-tag ${route}">${escapeHtml(route)}</span></div>`;
  root.appendChild(head);

  // A mechanical short-circuit feeds no model at all — say so, and show the
  // answer the mechanical path produced instead.
  if (feed?.terminate || feed?.mechanical) {
    root.appendChild(noteEl('Answered mechanically — no model feed for this message.'));
    if (feed.answer) root.appendChild(section('mechanical answer', pre(feed.answer)));
    return;
  }

  // 1) The graph around the terms — nested holons, unclipped.
  const structure = feed?.note?.levels?.structure;
  const holons = feedHolons(structure);
  const units  = feed?.doc?.units || feed?.doc?.sentences || [];
  const tree   = holonTree(holons, { units, filename: feed?.doc?.docId, sentences: units.length });
  if (holons.length === 0) {
    tree.appendChild(noteEl(route === 'chat'
      ? 'No document graph — this is the chat feed (no excerpts, no arrows).'
      : 'No figures in the window this message activated.'));
  }
  // When the message NAMED a referent, the graph is centred on that referent —
  // everything tied to its identity, coreference collapsed — not the figures the
  // retrieval window drifted across. Say so, naming it canonically, so the
  // centring is legible and not mistaken for the window.
  const focusIds = feed?.focus || [];
  if (focusIds.length) {
    const labelOf = feed?.doc?.admission?.labelOf;
    const labels = focusIds.map(id => (labelOf && labelOf(id)) || id);
    tree.insertBefore(
      noteEl(`centred on the referent ${labels.join(', ')} — everything tied to it, coreference collapsed`),
      tree.firstChild,
    );
  }

  const sig = feed?.note?.levels?.significance;
  if (sig && sig.surprise >= 0.2 && sig.summary) {
    tree.appendChild(noteEl(`significance: ${sig.summary}`));
  }
  root.appendChild(section('the graph around these terms — nested holons, unclipped', tree));

  // 2) The model feed itself — what the talker is actually handed.
  const fed = document.createElement('div');
  fed.className = 'feed-fed';

  const notesText = feed?.note?.text || '';
  fed.appendChild(subhead('notes the model is fed', 'the arrows, capped as the prompt caps them'));
  fed.appendChild(notesText ? pre(notesText) : noteEl('(no notes — nothing structured to hand over)'));

  fed.appendChild(subhead('excerpts the model is fed', 'verbatim spans, in the order they are handed over'));
  const spans = feed?.spans || [];
  if (spans.length) {
    const list = document.createElement('div');
    list.className = 'feed-spans';
    for (const s of spans) list.appendChild(spanRow(s));
    fed.appendChild(list);
  } else {
    fed.appendChild(noteEl('(no excerpts retrieved)'));
  }

  root.appendChild(section('what the model is fed', fed));

  // The whole prompt, verbatim — collapsed by default, the ground truth on demand.
  if (feed?.promptText) {
    const det = document.createElement('details');
    det.className = 'feed-prompt';
    det.innerHTML = `<summary>the full prompt (${feed.promptText.length} chars)</summary>`;
    det.appendChild(pre(feed.promptText));
    root.appendChild(det);
  }
};

// Shape the structure surface into a nested holon tree — the graph around the
// message's terms, UNCLIPPED: every figure becomes a holon; every bond nests
// under the figure it leaves; properties nest as leaves. No top-N cap and no
// γ-fade (that is the visible graph's job). A bond endpoint that was never
// ranked as a figure still gets a holon, so no arrow is orphaned. Pure and
// DOM-free, so the shaping is unit-testable without a document or a screen.
export const feedHolons = (structure) => {
  if (!structure) return [];
  const { figures = [], relations = [], defs = [] } = structure;

  const holons = figures.map(f => ({ id: f.id, label: f.label, count: f.count || 0, bonds: [], defs: [] }));
  const byId = new Map(holons.map(h => [h.id, h]));
  const ensure = (ref) => {
    let h = byId.get(ref.id);
    if (!h) { h = { id: ref.id, label: ref.label, count: 0, bonds: [], defs: [] }; byId.set(ref.id, h); holons.push(h); }
    return h;
  };

  for (const r of relations) {
    // SIG is speech (⟨says⟩), CON is a plain bond (--with-->). The verb on the
    // edge is the relation; the operator only picks the bracket it reads in.
    ensure(r.src).bonds.push({ op: r.op, via: r.via || (r.op === 'SIG' ? 'says' : 'with'), to: r.tgt, idx: r.idx,
      polarity: r.polarity || '+', modality: r.modality || 'realis' });
  }
  for (const d of defs) ensure({ id: d.id, label: d.label }).defs.push({ value: d.value, idx: d.idx });

  return holons;
};

// ---- DOM helpers ----------------------------------------------------------

const holonTree = (holons, { units = [], filename, sentences } = {}) => {
  const tree = document.createElement('div');
  tree.className = 'feed-tree';

  // The document is the top holon; figures nest inside it; bonds nest in figures.
  const doc = document.createElement('details');
  doc.className = 'holon holon-doc';
  doc.open = true;
  doc.innerHTML =
    `<summary><span class="holon-kind">document</span> ` +
    `<span class="holon-label">${escapeHtml(filename || 'the document')}</span> ` +
    `<span class="holon-meta">${sentences || 0} sentences · ${holons.length} figures in scope</span></summary>`;
  tree.appendChild(doc);

  for (const h of holons) {
    const fig = document.createElement('details');
    fig.className = 'holon holon-fig';
    fig.open = true;
    const count = h.count ? `<span class="holon-count">×${h.count}</span>` : '';
    fig.innerHTML =
      `<summary><span class="op INS">INS</span><span class="holon-label">${escapeHtml(h.label)}</span>${count}</summary>`;

    for (const b of h.bonds) {
      const row = document.createElement('div');
      row.className = 'holon-bond';
      // EOT surface (docs/eot-surface-syntax.md): a bond is a LINK `-> object : relation`;
      // speech stays the ⟨attribution⟩ form. Polarity rides on the relation (¬rel — a
      // negated bond is never shown as the bare positive); modality trails as its mood.
      const not = b.polarity === '−' ? '¬' : '';
      const isSig = b.op === 'SIG';
      const arrow = isSig ? `⟨${not}${escapeHtml(b.via)}⟩` : '-&gt;';
      const relTail = isSig ? '' : ` <span class="holon-rel">: ${not}${escapeHtml(b.via)}</span>`;
      const mood = (b.modality && b.modality !== 'realis')
        ? ` <span class="holon-mood">⟨${escapeHtml(b.modality)}⟩</span>` : '';
      row.innerHTML =
        `<span class="op ${b.op}">${b.op}</span>` +
        `<span class="holon-arrow">${arrow}</span> ` +
        `<span class="holon-label">${escapeHtml(b.to?.label ?? b.to?.id ?? '?')}</span>${relTail}${mood}` +
        cite(b.idx);
      const line = units[b.idx];
      if (line != null) {
        const ln = document.createElement('div');
        ln.className = 'holon-line';
        ln.textContent = String(line);
        row.appendChild(ln);
      }
      fig.appendChild(row);
    }
    for (const d of h.defs) {
      const row = document.createElement('div');
      row.className = 'holon-def';
      row.innerHTML = `<span class="op DEF">DEF</span><span class="holon-arrow">: ${escapeHtml(d.value)}</span>${cite(d.idx)}`;
      fig.appendChild(row);
    }
    doc.appendChild(fig);
  }
  return tree;
};

const spanRow = (s) => {
  const el = document.createElement('div');
  el.className = 'feed-span';
  const tag = s.via === 'surf' ? 'surf' : (s.score != null ? s.score.toFixed(2) : '');
  el.innerHTML =
    `<span class="feed-span-cite" data-idx="${s.idx}">s${s.idx}</span>` +
    (tag ? `<span class="feed-span-tag">${escapeHtml(tag)}</span>` : '') +
    `<span class="feed-span-text">${escapeHtml(s.text)}</span>`;
  return el;
};

const cite = (idx) =>
  idx != null ? `<span class="holon-cite" data-idx="${idx}">s${idx}</span>` : '';

const section = (title, bodyEl) => {
  const sec = document.createElement('div');
  sec.className = 'feed-section';
  const h = document.createElement('div');
  h.className = 'feed-section-head';
  h.textContent = title;
  sec.appendChild(h);
  sec.appendChild(bodyEl);
  return sec;
};

const subhead = (title, note) => {
  const el = document.createElement('div');
  el.className = 'feed-subhead';
  el.innerHTML = `<span class="feed-subhead-t">${escapeHtml(title)}</span>` +
    (note ? `<span class="feed-subhead-n">${escapeHtml(note)}</span>` : '');
  return el;
};

const pre = (text) => {
  const el = document.createElement('pre');
  el.className = 'feed-pre';
  el.textContent = String(text ?? '');
  return el;
};

const noteEl = (text) => {
  const el = document.createElement('div');
  el.className = 'feed-note';
  el.textContent = String(text ?? '');
  return el;
};

const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
