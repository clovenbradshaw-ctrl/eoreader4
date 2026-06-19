// The predict view — scrub the cursor, see the next move predicted.
//
// The grounded counterpart to the chat: instead of asking a model for the next
// sentence, this predicts the next MOVE — an operator firing over a ten-symbol
// alphabet — from the reading's own move-log. No model is called. At each cursor it
// shows the moves so far, the posterior over the next move (recurrence × structure ×
// grammar, normalised), the actual next move scored against it, the surprise, and
// the sharpness — recomputed CAUSALLY at each step (the prediction at c uses only
// moves up to c). See docs/cursor-predictor.md.
//
// Sits beside the Feed tab. Feed shows what the model would be FED; this shows what
// the reader EXPECTS next, before any word is rendered.

import {
  buildMoveLog, moveNotation, predictNextMove, scoreSeries,
  persistenceAccuracy, marginalAccuracy, shuffleMoves,
} from '../predict/index.js';

const POSTERIOR_ROWS = 6;     // how many of the ten symbols to show in the panel
const RECENT_MOVES = 8;       // how much of the move-log so far to print

// Mount the view once. `getDoc` is a live getter so the view always reads the
// current document; `onSelectSentence` jumps the shared reading cursor to a unit.
// Returns { refresh } — the caller calls refresh() when the tab is shown, and the
// move-log is rebuilt only when the document actually changed.
export const mountPredict = (root, { getDoc, onSelectSentence } = {}) => {
  let built = null;     // the doc the current move-log was built from
  let ml = null;        // the move-log { moves, alphabet, frameByCursor, … }
  let series = null;    // scoreSeries(ml) — accuracy + per-position, computed once
  let cursor = 0;       // the move index the scrubber sits at

  const empty = () => {
    built = null; ml = null; series = null;
    root.innerHTML = `<div class="feed-empty">Load a document, then scrub the cursor here to watch ` +
      `the reader predict its next move — the operator, not the word — and be right, wrong, and ` +
      `surprised, move by move. The model is never called.</div>`;
  };

  const refresh = () => {
    const doc = getDoc?.();
    if (!doc) { empty(); return; }
    if (doc === built && ml) return;            // already built for this doc
    root.innerHTML = `<div class="feed-empty">building the move-log…</div>`;
    // Defer so the "building…" line paints before the (synchronous) build runs.
    requestAnimationFrame(() => {
      if (getDoc?.() !== doc) return;           // doc changed again mid-build
      try {
        ml = buildMoveLog(doc);
        series = scoreSeries(ml);
        built = doc;
        cursor = defaultCursor(ml);
        renderShell();
        renderPanel();
      } catch (err) {
        root.innerHTML = `<div class="feed-empty">could not build the move-log — ${escapeHtml(String(err?.message || err))}</div>`;
      }
    });
  };

  // The static shell: the intro, the scrubber bar, the quick-jumps, the panel
  // container, and the (collapsed) controls battery. Rebuilt per document.
  const renderShell = () => {
    const last = ml.moves.length - 2;
    root.innerHTML =
      `<div class="pv-wrap">` +
        `<div class="pv-intro">Predicting the next <b>move</b> — an operator over ten symbols — from the ` +
          `move-log, not a model. <span class="pv-dim">${ml.moves.length} moves · ${ml.units.length} units</span></div>` +
        `<div class="pv-bar">` +
          `<button type="button" class="small pv-prev">‹</button>` +
          `<input type="range" class="pv-cursor" min="0" max="${last}" value="${cursor}">` +
          `<button type="button" class="small pv-next">›</button>` +
          `<span class="pv-readout"></span>` +
        `</div>` +
        `<div class="pv-jumps"></div>` +
        `<div class="pv-panel"></div>` +
        controlsHtml(ml, series) +
      `</div>`;

    root.querySelector('.pv-prev').addEventListener('click', () => setCursor(cursor - 1));
    root.querySelector('.pv-next').addEventListener('click', () => setCursor(cursor + 1));
    const slider = root.querySelector('.pv-cursor');
    slider.addEventListener('input', () => setCursor(Number(slider.value)));

    // Quick-jumps to the frame breaks (the REC moves) and the flattest posterior —
    // the dramatic points the spec's tests turn on.
    const jumps = root.querySelector('.pv-jumps');
    const breaks = ml.moves.filter(m => m.op === 'REC' && m.i > 0);
    for (const b of breaks) {
      jumps.appendChild(jumpChip(`break ▸ c${b.cursor}`, b.i - 1, 'REC'));
    }
    const flattest = [...series.perPosition].sort((a, b) => a.concentration - b.concentration)[0];
    if (flattest) jumps.appendChild(jumpChip('flattest ▸ VOID', flattest.i, 'NUL'));

    // Clicking a unit citation jumps the shared reading cursor to that sentence.
    root.querySelector('.pv-panel').addEventListener('click', (ev) => {
      const c = ev.target.closest('[data-idx]');
      if (c && onSelectSentence) onSelectSentence(parseInt(c.dataset.idx, 10));
    });
  };

  const jumpChip = (label, toI, op) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pv-jump';
    b.innerHTML = `<span class="op ${op}">${op}</span>${escapeHtml(label)}`;
    b.addEventListener('click', () => setCursor(toI));
    return b;
  };

  const setCursor = (i) => {
    const last = ml.moves.length - 2;
    cursor = Math.max(0, Math.min(last, i | 0));
    const slider = root.querySelector('.pv-cursor');
    if (slider) slider.value = String(cursor);
    renderPanel();
  };

  // The panel — recomputed on every cursor move (cheap: one predictNextMove call).
  const renderPanel = () => {
    const panel = root.querySelector('.pv-panel');
    if (!panel) return;
    const p = predictNextMove(ml, cursor);
    const here = ml.moves[cursor];
    const unit = ml.units[here.cursor] || '';

    root.querySelector('.pv-readout').textContent = `move ${cursor}/${ml.moves.length - 1} · unit c${here.cursor}`;

    const recent = ml.moves.slice(Math.max(0, cursor - RECENT_MOVES + 1), cursor + 1);
    const movesHtml = recent.map(m => chip(m, m.i === cursor)).join(' ');

    const rows = p.posterior.slice(0, POSTERIOR_ROWS)
      .filter(([, prob]) => prob >= 0.005)
      .map(([op, prob]) => postRow(op, prob, p.actual)).join('');

    const conf = p.flat ? 'flat — no grounded expectation'
      : p.sharpness > 0.6 ? 'confident' : p.sharpness > 0.35 ? 'tentative' : 'weak';

    let actualHtml = `<div class="pv-note">end of log — no next move</div>`;
    if (p.actualMove) {
      const mark = p.correctTop1
        ? `<span class="pv-ok">✓ predicted top-1</span>`
        : `<span class="pv-rank">rank ${p.rank}/${ml.alphabet.length}</span>`;
      actualHtml =
        `<div class="pv-actual">${chip(p.actualMove)} ${mark}` +
          `<span class="pv-cite" data-idx="${p.actualMove.cursor}">c${p.actualMove.cursor}</span>` +
          (p.actualMove.label ? `<span class="pv-actual-label">${escapeHtml(p.actualMove.label)}</span>` : '') +
        `</div>` +
        `<div class="pv-surprise pv-surprise-${p.surprise}">surprise: <b>${p.surprise}</b> ` +
          `<span class="pv-dim">(${p.surprisalBits.toFixed(2)} bits)</span></div>`;
    }

    panel.innerHTML =
      `<div class="pv-unit"><span class="pv-cite" data-idx="${here.cursor}">c${here.cursor}</span> ` +
        `${escapeHtml(unit.slice(0, 120))}${unit.length > 120 ? '…' : ''}</div>` +

      `<div class="pv-block">` +
        `<div class="pv-label">moves so far</div>` +
        `<div class="pv-moves">${movesHtml}</div>` +
      `</div>` +

      `<div class="pv-block">` +
        `<div class="pv-label">predicted next move — posterior</div>` +
        `<div class="pv-post">${rows}</div>` +
        `<div class="pv-sharp">sharpness <b>${p.sharpness.toFixed(2)}</b> · ` +
          `concentration ${p.concentration.toFixed(2)} ` +
          `<span class="pv-conf ${p.flat ? 'flat' : ''}">${conf}</span></div>` +
      `</div>` +

      `<div class="pv-block">` +
        `<div class="pv-label">actual next move</div>` +
        actualHtml +
      `</div>`;
  };

  empty();
  return { refresh };
};

// The move just before the strongest-strain REC — the planted boundary, so the
// view opens on the dramatic prediction. Falls back to the start. Exported (with
// the two HTML builders below) as the view's pure, DOM-free surface — the part CI
// covers without a browser, the same way feed-view exposes feedHolons.
export const defaultCursor = (ml) => {
  const breaks = ml.moves.filter(m => m.op === 'REC' && m.i > 0);
  if (!breaks.length) return 0;
  const strongest = breaks.sort((a, b) =>
    (ml.frameByCursor[b.cursor]?.ratio || 0) - (ml.frameByCursor[a.cursor]?.ratio || 0))[0];
  return strongest.i - 1;
};

// One posterior row: the operator chip, the probability, and a bar. The actual
// next move's row is marked so the eye finds it against the prediction.
export const postRow = (op, prob, actual) => {
  const w = Math.max(2, Math.round(prob * 100));
  return `<div class="pv-post-row${op === actual ? ' is-actual' : ''}">` +
    `<span class="op ${op}">${op}</span>` +
    `<span class="pv-prob">${prob.toFixed(2)}</span>` +
    `<span class="pv-pbar"><i style="width:${w}%"></i></span>` +
  `</div>`;
};

// A move as an operator chip, with the EVA verdict sign and the register mark
// (a dot for the enacted cognition stream).
export const chip = (m, current = false) => {
  const sign = m.op === 'EVA' && m.verdict ? (m.verdict === 'strain' ? '−' : '+') : '';
  const mark = m.register === 'enacted' ? '<span class="pv-en">·</span>' : '';
  return `<span class="op ${m.op}${current ? ' pv-cur' : ''}" title="${escapeHtml(moveNotation(m))}">${m.op}${sign}</span>${mark}`;
};

// The controls battery — the falsification numbers, collapsed by default.
const controlsHtml = (ml, series) => {
  const recOnly = scoreSeries(ml, { weights: { recurrence: 1, structure: 0, grammar: 0 } });
  const pers = persistenceAccuracy(ml);
  const marg = marginalAccuracy(ml);
  const shuf = [1, 2, 3, 4, 5].map(s => scoreSeries(shuffleMoves(ml, s)).accuracy);
  const shufMean = shuf.reduce((a, b) => a + b, 0) / shuf.length;
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  const row = (label, val, note = '') =>
    `<div class="pv-ctl-row"><span class="pv-ctl-l">${label}</span>` +
    `<span class="pv-ctl-v">${val}</span><span class="pv-ctl-n">${note}</span></div>`;
  return `<details class="pv-controls">` +
    `<summary>controls — the falsification battery</summary>` +
    row('persistence (next = last)', pct(pers.accuracy)) +
    row(`marginal (always ${marg.top})`, pct(marg.accuracy)) +
    row('recurrence only', pct(recOnly.accuracy)) +
    row('full (rec × structure × grammar)', pct(series.accuracy), 'frame-aware') +
    row('shuffled move order', pct(shufMean), shufMean < series.accuracy - 0.15 ? 'collapses to chance ✓' : '') +
    row('mean sharpness · flat rate', `${series.meanSharpness.toFixed(2)} · ${pct(series.flatRate)}`) +
  `</details>`;
};

const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
