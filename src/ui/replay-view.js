// The replay view — watch the reading happen, slowly, one proposition at a time.
//
// The other tabs show the reading as a finished object: the Graph is the fold at
// rest, the Log is the whole event stream, Predict scrubs a cursor you drag. This
// one plays the reading FORWARD in read-time. It steps the cursor down the document
// and, at each line, reveals the propositions that line yielded one at a time — an
// entity entering (INS), a bond forming (CON/SIG), a predicate asserted (DEF) — each
// scored against the expectation the reading carried in. You see the figure field
// fill, the surprises arrest it, and the summary settle, beat by beat.
//
// Nothing here computes meaning. Every beat is read off `readingAt(doc, cursor)` —
// the same per-cursor significance surface reading mode and the Predict tab already
// use (src/perceiver/reading.js). The view only paces and renders it. The DOM-free
// surface (`buildBeats`) is exported so CI exercises the sequencing without a browser,
// the way feed-view exposes feedHolons and predict-view exposes defaultCursor.

import { readingAt } from '../perceiver/index.js';

// Playback speed presets — milliseconds a single proposition lingers before the next.
// The reading SLOWS where it matters: the dwell on each beat is the base step plus a
// bump proportional to that line's Bayesian surprise (the significance channel), so
// the replay races the steady passages and arrests on the reveals, exactly as the
// reader's own cursor does (docs/bayesian-surprise.md, docs/surfing-the-fold.md).
const SPEEDS = [
  { label: '0.5×', base: 1700 },
  { label: '1×',   base: 850 },
  { label: '2×',   base: 420 },
  { label: '4×',   base: 210 },
];
const DEFAULT_SPEED = 1;       // index into SPEEDS — opens at 1×
const SIGNIFICANCE_DWELL = 1400; // extra ms at bayes === 1; scaled by the line's bayes
const TRAIL = 5;               // how many already-read lines stay visible above the cursor

// Mount the view once. `getDoc` is a live getter so the view always reads the current
// document; `onSelectSentence` jumps the shared reading cursor to a unit when a line is
// clicked. Returns { refresh, pause } — the caller calls refresh() when the tab is
// shown (rebuilds the beat list only when the document actually changed) and pause()
// when the tab is hidden, so the timer never runs against an unseen surface.
export const mountReplay = (root, { getDoc, onSelectSentence } = {}) => {
  let built = null;     // the doc the current beat list was built from
  let beats = null;     // buildBeats(doc) — the flat reveal sequence
  let pos = 0;          // the beat index currently shown
  let playing = false;
  let speed = DEFAULT_SPEED;
  let timer = null;

  const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };

  const empty = () => {
    clearTimer(); playing = false; built = null; beats = null; pos = 0;
    root.innerHTML = `<div class="feed-empty">Load a document, then press play to watch the ` +
      `reading happen — slowly, one proposition at a time. Each line arrives under the ` +
      `expectation the reading carried in; its propositions reveal one by one, scored by ` +
      `surprise. The reading lingers where belief moves and races where it doesn't. No model ` +
      `is called.</div>`;
  };

  const refresh = () => {
    const doc = getDoc?.();
    if (!doc) { empty(); return; }
    if (doc === built && beats) { render(); return; }   // already built for this doc
    clearTimer(); playing = false;
    root.innerHTML = `<div class="feed-empty">reading…</div>`;
    // Defer so the "reading…" line paints before the (synchronous) build runs.
    requestAnimationFrame(() => {
      if (getDoc?.() !== doc) return;                    // doc changed again mid-build
      try {
        beats = buildBeats(doc);
        built = doc;
        pos = 0;
        renderShell();
        render();
      } catch (err) {
        root.innerHTML = `<div class="feed-empty">could not build the reading — ${escapeHtml(String(err?.message || err))}</div>`;
      }
    });
  };

  // Pause without tearing down — the beat list and position survive, so re-showing the
  // tab resumes from the same place. Called when the tab is hidden.
  const pause = () => { clearTimer(); playing = false; const doc = getDoc?.(); if (doc === built && beats) renderControls(); };

  // The static shell: intro, the transport bar, the progress rail, the stage, and the
  // running reading panel. Rebuilt per document.
  const renderShell = () => {
    const lines = beats.length ? beats[beats.length - 1].c + 1 : 0;
    root.innerHTML =
      `<div class="rp-wrap">` +
        `<div class="rp-intro">Replaying the reading — one <b>proposition</b> at a time, in read-time. ` +
          `<span class="rp-dim">${beats.length} propositions · ${lines} lines</span></div>` +
        `<div class="rp-transport">` +
          `<button type="button" class="small rp-restart" title="Back to the start">⏮</button>` +
          `<button type="button" class="small rp-step-back" title="Previous proposition">‹</button>` +
          `<button type="button" class="rp-play" title="Play / pause"></button>` +
          `<button type="button" class="small rp-step" title="Next proposition">›</button>` +
          `<span class="rp-speeds"></span>` +
          `<span class="rp-readout"></span>` +
        `</div>` +
        `<div class="rp-rail"><i class="rp-rail-fill"></i></div>` +
        `<div class="rp-stage"></div>` +
      `</div>`;

    root.querySelector('.rp-restart').addEventListener('click', () => { stop(); setPos(0); });
    root.querySelector('.rp-step-back').addEventListener('click', () => { stop(); setPos(pos - 1); });
    root.querySelector('.rp-step').addEventListener('click', () => { stop(); setPos(pos + 1); });
    root.querySelector('.rp-play').addEventListener('click', () => (playing ? stop() : play()));

    const speeds = root.querySelector('.rp-speeds');
    SPEEDS.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'rp-speed' + (i === speed ? ' on' : '');
      b.textContent = s.label;
      b.addEventListener('click', () => { speed = i; renderControls(); if (playing) { clearTimer(); schedule(); } });
      speeds.appendChild(b);
    });

    // A click on a read line jumps the shared reading cursor there (the graph re-focuses).
    root.querySelector('.rp-stage').addEventListener('click', (ev) => {
      const c = ev.target.closest('[data-idx]');
      if (c && onSelectSentence) onSelectSentence(parseInt(c.dataset.idx, 10));
    });
  };

  const play = () => {
    if (!beats || !beats.length) return;
    if (pos >= beats.length - 1) pos = 0;   // restart if parked at the end
    playing = true; renderControls(); render(); schedule();
  };
  const stop = () => { clearTimer(); playing = false; renderControls(); };

  // The autoplay heartbeat. Each tick advances one beat; the delay is the speed's base
  // step stretched by the line's significance, so the replay arrests on the reveals.
  const schedule = () => {
    clearTimer();
    if (!playing) return;
    const beat = beats[pos];
    const bayes = beat?.reading?.bayes || 0;
    const delay = SPEEDS[speed].base + Math.round(bayes * SIGNIFICANCE_DWELL);
    timer = setTimeout(() => {
      if (!playing) return;
      if (pos >= beats.length - 1) { stop(); return; }   // reached the end — park
      pos += 1; render(); schedule();
    }, delay);
  };

  const setPos = (i) => {
    if (!beats || !beats.length) return;
    pos = Math.max(0, Math.min(beats.length - 1, i | 0));
    render();
  };

  const renderControls = () => {
    const playBtn = root.querySelector('.rp-play');
    if (playBtn) { playBtn.textContent = playing ? '❚❚' : '▶'; playBtn.classList.toggle('on', playing); }
    root.querySelectorAll('.rp-speed').forEach((b, i) => b.classList.toggle('on', i === speed));
  };

  // The full per-beat render — cheap, runs on every advance. Shows the trail of recent
  // lines, the line being read now, and the propositions revealed under it so far.
  const render = () => {
    const stage = root.querySelector('.rp-stage');
    if (!stage || !beats || !beats.length) return;
    const beat = beats[pos];
    const c = beat.c;

    renderControls();
    const rail = root.querySelector('.rp-rail-fill');
    if (rail) rail.style.width = `${((pos + 1) / beats.length * 100).toFixed(1)}%`;
    const readout = root.querySelector('.rp-readout');
    if (readout) readout.textContent = `line ${c} · ${pos + 1}/${beats.length}`;

    // The trail: the last few lines already fully read, dimmed, with their one-line
    // summaries — the reading accumulating behind the cursor.
    const trailLines = [];
    for (let k = c - TRAIL; k < c; k++) {
      if (k < 0) continue;
      const r = beat.readingByLine[k];
      if (!r) continue;
      trailLines.push(
        `<div class="rp-trail-line" data-idx="${k}">` +
          `<span class="rp-cite">L${k}</span>` +
          `<span class="rp-trail-text">${escapeHtml(clip(r.sentence, 90))}</span>` +
        `</div>`);
    }

    // The line currently under the cursor.
    const r = beat.reading;
    const pred = r.predicted.figures.length
      ? `expected ${r.predicted.figures.slice(0, 3).map(escapeHtml).join(', ')}` +
        (r.predicted.bonds.length ? ` · ${r.predicted.bonds.slice(0, 2).map(escapeHtml).join(', ')}` : '')
      : 'no expectations yet';

    // The propositions revealed so far on THIS line (every beat up to pos that shares c).
    const revealed = [];
    for (let p = 0; p <= pos; p++) {
      const b = beats[p];
      if (b.c !== c) continue;
      if (b.type === 'prop') revealed.push(propRow(b, b === beat));
      else if (b.type === 'held') revealed.push(heldRow(b, b === beat));
    }

    const sLevel = r.surprise >= 0.5 ? 'high' : r.surprise >= 0.25 ? 'medium' : 'low';

    stage.innerHTML =
      (trailLines.length ? `<div class="rp-trail">${trailLines.join('')}</div>` : '') +
      `<div class="rp-now">` +
        `<div class="rp-now-head">` +
          `<span class="rp-cite rp-cite-now" data-idx="${c}">L${c}</span>` +
          `<span class="rp-pred">${pred}</span>` +
        `</div>` +
        `<div class="rp-line">${escapeHtml(r.sentence || '')}</div>` +
        `<div class="rp-props">${revealed.join('') || `<div class="rp-quiet">reading…</div>`}</div>` +
        `<div class="rp-meters">` +
          meter('surprise', r.surprise, sLevel) +
          meter('significance', r.bayes, r.bayes >= 0.5 ? 'high' : r.bayes >= 0.25 ? 'medium' : 'low') +
        `</div>` +
        `<div class="rp-summary">${escapeHtml(r.summary || '')}</div>` +
      `</div>`;
  };

  empty();
  return { refresh, pause };
};

// ── the DOM-free surface (exported for CI) ───────────────────────────────────

// Flatten the per-line reading into the reveal sequence the player walks. For each
// unit `c`, one 'line' beat (the arrival, under the prediction it came in with) is
// followed by one beat per proposition the line yielded — the fired operators the
// reading surface already names in `reading.surprises` (an INS entry, a CON/SIG bond,
// a DEF predicate, a SEG focus shift). A steady line with nothing new yields a single
// 'held' beat so the replay never skips a line silently. Every beat carries its line's
// full reading plus `readingByLine` (the readings up to and including it) so the
// player can paint the trail without recomputing.
export const buildBeats = (doc) => {
  const units = doc.units || doc.sentences || [];
  const beats = [];
  const readingByLine = {};
  for (let c = 0; c < units.length; c++) {
    const reading = readingAt(doc, c);
    readingByLine[c] = reading;
    const snapshot = { ...readingByLine };   // readings known as of this line (causal)
    beats.push({ type: 'line', c, reading, readingByLine: snapshot });
    const props = reading.surprises || [];
    if (props.length) {
      for (const s of props) {
        beats.push({ type: 'prop', c, op: s.op, text: s.text, reading, readingByLine: snapshot });
      }
    } else {
      beats.push({ type: 'held', c, reading, readingByLine: snapshot });
    }
  }
  return beats;
};

// One revealed proposition: its operator chip and the plain-language clause the reading
// read. The current beat is marked so the eye lands on what just arrived.
export const propRow = (beat, current = false) =>
  `<div class="rp-prop${current ? ' rp-fresh' : ''}">` +
    `<span class="op ${beat.op}">${beat.op}</span>` +
    `<span class="rp-prop-text">${escapeHtml(beat.text || '')}</span>` +
  `</div>`;

// A steady line — belief held, nothing new to name. Rendered as a NUL (non-transformation):
// the line was read, but it was not turned into new structure.
export const heldRow = (beat, current = false) =>
  `<div class="rp-prop rp-held${current ? ' rp-fresh' : ''}">` +
    `<span class="op NUL">NUL</span>` +
    `<span class="rp-prop-text">${escapeHtml(steadyText(beat.reading))}</span>` +
  `</div>`;

const steadyText = (r) => {
  const conf = (r.predicted?.figures || []).filter(Boolean);
  if (r.held && conf.length) return `${conf.slice(0, 2).join(', ')} stay in focus — nothing new`;
  return 'read, held as-is — no new structure';
};

const meter = (label, value, level) => {
  const w = Math.max(2, Math.round((value || 0) * 100));
  return `<div class="rp-meter rp-meter-${level}">` +
    `<span class="rp-meter-l">${label}</span>` +
    `<span class="rp-meter-bar"><i style="width:${w}%"></i></span>` +
    `<span class="rp-meter-v">${Math.round((value || 0) * 100)}%</span>` +
  `</div>`;
};

const clip = (s, n) => { const t = String(s || ''); return t.length > n ? t.slice(0, n) + '…' : t; };

const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
