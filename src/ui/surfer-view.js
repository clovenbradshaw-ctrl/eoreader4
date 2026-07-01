// The Surfer view — a glass box on the surfer's activities, at any cursor.
//
// The surfer (docs/surfing-the-fold.md) is the middle faculty: it does not choose
// where to look, it MEASURES where the field is steepest and steps there. Every other
// tab shows a finished object; this one shows the NAVIGATION — the three axes the
// surfer reads (focus · cursor · frame), the reach it measured, the stops it arrested
// on, the peak where the significance reading was taken. It answers "what did it do,
// exactly, here?" without a model in the loop.
//
// Two registers, mirroring the two places the surfer runs:
//
//   READING — drop the surfer's anchor anywhere in the loaded document and watch it
//   surf. `surfFold(doc, anchor)` is a pure function of the log and the field (same
//   document, same anchor, same path), so scrubbing the cursor re-runs the whole surf
//   live, deterministically, with no model called. This is "what it did when reading a
//   particular thing".
//
//   CHAT — every prompted turn ran a surf inside the fold stage; the audit recorded it
//   (turn.reading.surf + the fold step's significance column). Selecting a turn replays
//   exactly what the surfer did for that message — the same reach/stops/peak, plus the
//   Significance column (Atmosphere · Lens · Stance) when it rode. This is "what it did
//   when prompted in the chat".
//
// Nothing here computes meaning. The reading register reads off surfFold; the chat
// register reads off the recorded audit. The DOM-free surface (summarizeSurf,
// classifyStops, turnsWithSurf) is exported so CI exercises it without a browser, the
// way replay-view exposes buildBeats and predict-view exposes defaultCursor.

import { surfFold } from '../surfer/index.js';

// Mount the view once. `getDoc` is a live getter for the current document; `getAudit`
// returns the session audit log (with .turns and .subscribe); `onSelectSentence` jumps
// the shared reading cursor to a unit (switching to the Text tab). Returns { refresh }
// — the caller calls refresh() when the tab is shown.
export const mountSurfer = (root, { getDoc, getAudit, onSelectSentence } = {}) => {
  let mode = 'reading';     // 'reading' | 'chat'
  let built = null;         // the doc the reading register was built against
  let units = [];           // the current document's units (for the sentence text)
  let cursor = 0;           // the anchor the surfer is dropped at (reading register)
  let selectedTurn = null;  // the audit turn id shown in the chat register

  // Re-render the chat list live as new turns land, but only while this tab is the one
  // on screen (offsetParent is null when hidden) — never tick against an unseen surface.
  const audit = getAudit?.();
  audit?.subscribe?.(() => {
    if (mode === 'chat' && root.offsetParent !== null) renderChat();
  });

  const refresh = () => {
    const doc = getDoc?.();
    if (doc !== built) {                        // document changed — reset the reading anchor
      built = doc;
      units = doc ? (doc.units || doc.sentences || []) : [];
      cursor = 0;
    }
    renderShell();
    if (mode === 'reading') renderReading();
    else renderChat();
  };

  // The static shell: the intro, the register toggle, and the body container. The
  // toggle swaps between the two registers without a rebuild of the whole tab.
  const renderShell = () => {
    root.innerHTML =
      `<div class="sv-wrap">` +
        `<div class="sv-intro">The <b>surfer</b> reads a field the reading already maintains and steps ` +
          `down its gradient — <b>focus</b> (the warmest figure), <b>cursor</b> (arrest on Bayesian ` +
          `surprise), <b>frame</b> (a break is an arrest too). Nothing is chosen; every stop is read ` +
          `off physics. No model is called.</div>` +
        `<div class="sv-modes" role="tablist">` +
          `<button type="button" class="sv-mode${mode === 'reading' ? ' on' : ''}" data-mode="reading">Reading a document</button>` +
          `<button type="button" class="sv-mode${mode === 'chat' ? ' on' : ''}" data-mode="chat">Prompted in chat</button>` +
        `</div>` +
        `<div class="sv-body"></div>` +
      `</div>`;
    root.querySelectorAll('.sv-mode').forEach(b =>
      b.addEventListener('click', () => {
        if (mode === b.dataset.mode) return;
        mode = b.dataset.mode;
        renderShell();
        if (mode === 'reading') renderReading(); else renderChat();
      }));
  };

  // ── READING register — drop the anchor, surf it live ──────────────────────

  const renderReading = () => {
    const body = root.querySelector('.sv-body');
    if (!body) return;
    if (!units.length) {
      body.innerHTML = `<div class="feed-empty">Load a document, then drop the surfer's anchor anywhere ` +
        `to watch it surf — the reach it measures, the surprises it arrests on, the frame-breaks, and the ` +
        `peak where it takes the significance reading. Scrub the cursor: the whole surf re-runs, ` +
        `deterministically, with no model called.</div>`;
      return;
    }
    const last = units.length - 1;
    body.innerHTML =
      `<div class="sv-bar">` +
        `<button type="button" class="small sv-prev" title="Anchor back one line">‹</button>` +
        `<input type="range" class="sv-cursor" min="0" max="${last}" value="${cursor}">` +
        `<button type="button" class="small sv-next" title="Anchor forward one line">›</button>` +
        `<span class="sv-readout"></span>` +
      `</div>` +
      `<div class="sv-panel"></div>`;

    body.querySelector('.sv-prev').addEventListener('click', () => setCursor(cursor - 1));
    body.querySelector('.sv-next').addEventListener('click', () => setCursor(cursor + 1));
    const slider = body.querySelector('.sv-cursor');
    slider.addEventListener('input', () => setCursor(Number(slider.value)));

    // A click on a field cell re-anchors the surf there (stays in this tab). A click on
    // an L-citation jumps the shared reading cursor to that sentence (switches to Text).
    const panel = body.querySelector('.sv-panel');
    panel.addEventListener('click', (ev) => {
      const cell = ev.target.closest('[data-anchor]');
      if (cell) { setCursor(parseInt(cell.dataset.anchor, 10)); return; }
      const cite = ev.target.closest('[data-idx]');
      if (cite && onSelectSentence) onSelectSentence(parseInt(cite.dataset.idx, 10));
    });
    renderReadingPanel();
  };

  const setCursor = (i) => {
    cursor = Math.max(0, Math.min(units.length - 1, i | 0));
    const slider = root.querySelector('.sv-cursor');
    if (slider) slider.value = String(cursor);
    renderReadingPanel();
  };

  // The panel — recomputed on every anchor move (cheap: one surfFold over the reach).
  const renderReadingPanel = () => {
    const panel = root.querySelector('.sv-panel');
    if (!panel) return;
    const doc = getDoc?.();
    if (!doc) return;
    let surf;
    try { surf = surfFold(doc, cursor); }
    catch (err) { panel.innerHTML = `<div class="feed-empty">could not surf here — ${escapeHtml(String(err?.message || err))}</div>`; return; }

    const sum = summarizeSurf(surf);
    const readout = root.querySelector('.sv-readout');
    if (readout) readout.textContent = `anchor L${sum.anchor} · reach L${sum.reachLo}–L${sum.reachHi}`;

    panel.innerHTML =
      surfSummaryHtml(sum) +
      fieldStripHtml(surf) +
      stopsHtml(surf, units);
  };

  // ── CHAT register — replay what the surfer did on each prompted turn ───────

  const renderChat = () => {
    const body = root.querySelector('.sv-body');
    if (!body) return;
    const turns = turnsWithSurf(getAudit?.());
    if (!turns.length) {
      body.innerHTML = `<div class="feed-empty">Ask something in the chat. Every prompted turn runs a ` +
        `surf inside the fold — it seeds at the retrieval hit and steps to the peak where it takes the ` +
        `reading. Each turn appears here with exactly what the surfer did: the reach, the stops, the ` +
        `peak, the focus figure, and the Significance column when it rode.</div>`;
      return;
    }
    // Keep the selection valid; default to the most recent turn.
    if (!turns.some(t => t.id === selectedTurn)) selectedTurn = turns[0].id;

    const list = turns.map(t =>
      `<button type="button" class="sv-turn${t.id === selectedTurn ? ' on' : ''}" data-turn="${t.id}">` +
        `<span class="sv-turn-id">${escapeHtml(t.id)}</span>` +
        `<span class="sv-turn-q">${escapeHtml(clip(t.question || '(no question)', 60))}</span>` +
        `<span class="sv-turn-meta">L${t.surf.anchor}→L${t.surf.peak} · ${t.surf.stops?.length || 0} stop${(t.surf.stops?.length || 0) === 1 ? '' : 's'}</span>` +
      `</button>`).join('');

    body.innerHTML =
      `<div class="sv-turns">${list}</div>` +
      `<div class="sv-detail"></div>`;

    body.querySelector('.sv-turns').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-turn]');
      if (!b) return;
      selectedTurn = b.dataset.turn;
      body.querySelectorAll('.sv-turn').forEach(x => x.classList.toggle('on', x.dataset.turn === selectedTurn));
      renderChatDetail();
    });
    // A cite click in the detail jumps the shared reading cursor to that sentence.
    body.querySelector('.sv-detail').addEventListener('click', (ev) => {
      const cite = ev.target.closest('[data-idx]');
      if (cite && onSelectSentence) onSelectSentence(parseInt(cite.dataset.idx, 10));
    });
    renderChatDetail();
  };

  const renderChatDetail = () => {
    const detail = root.querySelector('.sv-detail');
    if (!detail) return;
    const turn = turnsWithSurf(getAudit?.()).find(t => t.id === selectedTurn);
    if (!turn) { detail.innerHTML = ''; return; }
    const { surf, sig } = turn;
    const sum = summarizeSurf(surf);
    // The turn's own units are not held in the audit, so name each stop by its recorded
    // field focus (the warmest figure the surfer read there) rather than the sentence text.
    detail.innerHTML =
      `<div class="sv-detail-q"><span class="sv-turn-id">${escapeHtml(turn.id)}</span> ` +
        `${escapeHtml(turn.question || '(no question)')}</div>` +
      surfSummaryHtml(sum) +
      fieldStripHtml(surf) +
      stopsHtml(surf, null) +
      significanceHtml(sig);
  };

  refresh();
  return { refresh };
};

// ── the DOM-free surface (exported for CI) ────────────────────────────────────

// The compact reading of a surf: the axes and the extent, read off the returned object
// (surfFold's return, or the audit's recorded reading.surf). Pure — no DOM.
export const summarizeSurf = (surf = {}) => {
  const field = Array.isArray(surf.field) ? surf.field : [];
  const idxs = field.map(f => f.idx).filter(n => Number.isFinite(n));
  const byIdx = new Map(field.map(f => [f.idx, f]));
  const peakF = byIdx.get(surf.peak);
  return {
    anchor: surf.anchor ?? 0,
    peak:   surf.peak ?? 0,
    focus:  surf.focus ?? null,
    rode:   surf.rode || 'bayesian-figure',
    stops:  Array.isArray(surf.stops) ? surf.stops.length : 0,
    recs:   Array.isArray(surf.recCursors) ? surf.recCursors.length : 0,
    reachLo: idxs.length ? Math.min(...idxs) : (surf.anchor ?? 0),
    reachHi: idxs.length ? Math.max(...idxs) : (surf.anchor ?? 0),
    peakBayes: peakF ? peakF.bayes : null,
  };
};

// Why each stop is a stop, in reading order. The surfer arrests for three reasons, in
// precedence: the ANCHOR (retrieval set it down there), a FRAME-BREAK (a REC — a frame
// broke under strain), or a SURPRISE-PEAK (the strongest remaining Bayesian surprise).
// Pure — the same classification the docs describe (surfing-the-fold.md "What it returns").
export const classifyStops = (surf = {}) => {
  const recs = new Set(Array.isArray(surf.recCursors) ? surf.recCursors : []);
  const stops = Array.isArray(surf.stops) ? [...surf.stops].sort((a, b) => a - b) : [];
  return stops.map(idx => ({
    idx,
    reason: idx === surf.anchor ? 'anchor' : recs.has(idx) ? 'frame-break' : 'surprise-peak',
  }));
};

// The audit turns that ran a surf, newest first, each paired with its recorded surf and
// (when it rode) its Significance column read off the fold step. Accepts the audit log
// object (with .turns) or a bare turns array. Pure — reads the record, computes nothing.
export const turnsWithSurf = (auditOrTurns) => {
  const turns = Array.isArray(auditOrTurns) ? auditOrTurns : (auditOrTurns?.turns || []);
  const out = [];
  for (const t of turns) {
    const surf = t?.reading?.surf;
    if (!surf) continue;
    // The fold step carries the focus + the Significance column (Atmosphere/Lens/Stance/
    // Paradigm) when the meaning column rode; reading.surf carries the field + reach.
    const fold = (t.steps || []).find(s => s.name === 'fold')?.data?.surf || null;
    out.push({
      id: t.id,
      question: t.question,
      surf: { ...surf, focus: surf.focus ?? fold?.focus ?? null },
      sig: fold && (fold.atmosphere || fold.lensEntropy != null || fold.lenses != null || fold.paradigm || fold.stance)
        ? fold : null,
    });
  }
  return out.reverse();   // newest first (turns are appended in order)
};

// ── HTML builders (exported for CI where cheap to check) ──────────────────────

// The one-line reading: anchor → peak, focus, stops, mode.
export const surfSummaryHtml = (sum) =>
  `<div class="sv-sum">` +
    `<span class="sv-badge sv-anchor" title="where retrieval set the surfer down">⚓ L${sum.anchor}</span>` +
    `<span class="sv-arrow">→</span>` +
    `<span class="sv-badge sv-peak" title="the steepest stop — where the significance reading is taken">★ peak L${sum.peak}</span>` +
    (sum.focus ? `<span class="sv-badge sv-focus" title="the warmest figure across the stops">◉ ${escapeHtml(String(sum.focus))}</span>` : '') +
    `<span class="sv-sum-n">${sum.stops} stop${sum.stops === 1 ? '' : 's'}` +
      (sum.recs ? ` · ${sum.recs} frame-break${sum.recs === 1 ? '' : 's'}` : '') + `</span>` +
    `<span class="sv-rode" title="the field the surfer rode">${escapeHtml(sum.rode)}</span>` +
  `</div>`;

// The field strip: one cell per cursor in the reach, its height the Bayesian surprise
// (significance) it carries, badged where the surfer arrested. The anchor, the peak, and
// every frame-break are marked; the flat between the stops is visibly flat. This is the
// gradient the surfer stepped down, drawn.
export const fieldStripHtml = (surf = {}) => {
  const field = Array.isArray(surf.field) ? surf.field : [];
  if (!field.length) return '';
  const stops = new Set(Array.isArray(surf.stops) ? surf.stops : []);
  const recs  = new Set(Array.isArray(surf.recCursors) ? surf.recCursors : []);
  const max = Math.max(1e-6, ...field.map(f => f.bayes || 0));
  const cells = field.map(f => {
    const h = Math.round(((f.bayes || 0) / max) * 100);
    const lvl = f.bayes >= 0.5 ? 'high' : f.bayes >= 0.25 ? 'medium' : 'low';
    const isStop = stops.has(f.idx);
    const isPeak = f.idx === surf.peak;
    const isAnchor = f.idx === surf.anchor;
    const isRec = recs.has(f.idx);
    const badge = isAnchor ? '⚓' : isRec ? '⟲' : isPeak ? '★' : isStop ? '•' : '';
    const cls = ['sv-cell', `sv-lvl-${lvl}`, isStop ? 'sv-stop' : '', isPeak ? 'sv-cell-peak' : ''].filter(Boolean).join(' ');
    const title = `L${f.idx}${f.focus ? ' · ' + f.focus : ''} — significance ${(f.bayes || 0).toFixed(3)}` +
      (Number.isFinite(f.surprisalBits) ? `, surprise ${f.surprisalBits.toFixed(2)} bits` : '') +
      (isAnchor ? ' · ANCHOR' : '') + (isRec ? ' · FRAME-BREAK' : '') +
      (isPeak && !isAnchor && !isRec ? ' · PEAK' : '') + (f.verdict ? ` · ${f.verdict}` : '');
    return `<span class="${cls}" data-anchor="${f.idx}" title="${escapeHtml(title)}">` +
      `<i class="sv-cell-bar" style="height:${Math.max(3, h)}%"></i>` +
      (badge ? `<span class="sv-cell-badge">${badge}</span>` : '') +
    `</span>`;
  }).join('');
  return `<div class="sv-strip-wrap">` +
    `<div class="sv-strip-label">the field the surfer measured — height is Bayesian surprise, badges are arrests</div>` +
    `<div class="sv-strip">${cells}</div>` +
  `</div>`;
};

// The stops list: each arrest, why it arrested, and (when units are in hand) the line it
// landed on. In reading mode the sentence text is shown; in chat mode the audit did not
// keep the turn's document, so the stop is named by the field focus it recorded.
export const stopsHtml = (surf, units) => {
  const rows = classifyStops(surf);
  if (!rows.length) return '';
  const byIdx = new Map((surf.field || []).map(f => [f.idx, f]));
  const body = rows.map(({ idx, reason }) => {
    const f = byIdx.get(idx);
    const isPeak = idx === surf.peak;
    const bayes = f ? (f.bayes || 0) : 0;
    const text = units && units[idx] != null
      ? escapeHtml(clip(units[idx], 120))
      : (f?.focus ? `<span class="sv-stop-focus">◉ ${escapeHtml(String(f.focus))}</span>` : '<span class="sv-quiet">—</span>');
    return `<div class="sv-stop-row${isPeak ? ' sv-stop-row-peak' : ''}">` +
      `<span class="sv-cite" data-idx="${idx}">L${idx}</span>` +
      `<span class="sv-reason sv-reason-${reason}">${REASON_LABEL[reason]}</span>` +
      (isPeak ? `<span class="sv-reason sv-reason-peak">★ peak</span>` : '') +
      `<span class="sv-stop-text">${text}</span>` +
      meterHtml('sig', bayes) +
    `</div>`;
  }).join('');
  return `<div class="sv-stops">` +
    `<div class="sv-strip-label">where it arrested — and why</div>${body}</div>`;
};

const REASON_LABEL = {
  'anchor':        '⚓ anchor',
  'frame-break':   '⟲ frame-break',
  'surprise-peak': '• surprise-peak',
};

// The Significance column, when the meaning-measuring fold rode it: the interpretive
// Atmosphere (departure from the corpus prior), the Lens spread (von Neumann entropy =
// the predictive uncertainty of the next unit), the Paradigm verdict, and the Stance
// (how the surfer moved ρ at the commit, and whether the confabulation guard fired).
export const significanceHtml = (sig) => {
  if (!sig) return '';
  const parts = [];
  if (sig.atmosphere) {
    const a = sig.atmosphere;
    parts.push(kv('atmosphere', `${a.tone || '—'}${a.verdict ? ` · ${a.verdict}` : ''}` +
      (a.departure != null ? ` · departure ${Number(a.departure).toFixed(3)}` : '')));
  }
  if (sig.lensEntropy != null)
    parts.push(kv('lens', `entropy ${Number(sig.lensEntropy).toFixed(3)}` +
      (sig.lenses != null ? ` · ${sig.lenses} real` : '')));
  if (sig.paradigm) parts.push(kv('paradigm', String(sig.paradigm)));
  if (sig.paradigmRec) parts.push(kv('reframe', `REC · Δ${Number(sig.paradigmRec.surpriseDelta ?? 0).toFixed(3)}`));
  if (sig.stance) {
    const s = sig.stance;
    parts.push(kv('stance', `${s.op || '—'}${s.stance ? ` · ${s.stance}` : ''}` +
      (s.firmness != null ? ` · firmness ${Number(s.firmness).toFixed(2)}` : '') +
      (s.guard ? ` · guard ${s.guard}` : '')));
  }
  if (!parts.length) return '';
  return `<div class="sv-sig">` +
    `<div class="sv-strip-label">the significance column — read when a meaning model rode</div>` +
    parts.join('') + `</div>`;
};

const kv = (k, v) =>
  `<div class="sv-kv"><span class="sv-kv-k">${escapeHtml(k)}</span><span class="sv-kv-v">${escapeHtml(v)}</span></div>`;

const meterHtml = (label, value) => {
  const w = Math.max(2, Math.round((value || 0) * 100));
  const lvl = value >= 0.5 ? 'high' : value >= 0.25 ? 'medium' : 'low';
  return `<span class="sv-meter sv-meter-${lvl}" title="${escapeHtml(label)} ${(value || 0).toFixed(3)}">` +
    `<i style="width:${w}%"></i></span>`;
};

const clip = (s, n) => { const t = String(s ?? ''); return t.length > n ? t.slice(0, n) + '…' : t; };

const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
