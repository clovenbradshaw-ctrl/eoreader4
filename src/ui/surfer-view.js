// The Surfer view — a glass box on the surfer's activities, at any cursor.
//
// The surfer (docs/surfing-the-fold.md) is the middle faculty: it does not choose where
// to look, it MEASURES where the field is steepest and steps there. Every other tab
// shows a finished object; this one shows the NAVIGATION — the three axes the surfer
// reads (focus · cursor · frame), the reach it measured, the stops it arrested on, the
// peak where the significance reading was taken. No model is ever in the loop.
//
// Three registers:
//
//   READING — drop the surfer's anchor anywhere in the loaded document and watch it
//   surf. `surfFold(doc, anchor)` is a pure function of the log and the field, so the
//   whole surf re-runs live and deterministically, no model called. PLAY it back at
//   various speeds: the playhead rides forward through the reach and ARRESTS on the
//   stops (dwelling in proportion to the Bayesian surprise), exactly as the surfer's
//   own cursor does. "What it did when reading a particular thing."
//
//   CHAT — every prompted turn ran a surf inside the fold; the audit recorded it
//   (turn.reading.surf + the fold step's Significance column). Selecting a turn replays
//   what the surfer did for that message. "What it did when prompted in the chat".
//
//   3D — the surfer reads THREE axes, so a flat strip flattens it. This register lifts
//   the surf into space: reading-order runs along X (the arrow of time the frame axis
//   orders), Bayesian surprise rises on Y (the wave the surfer rides), and the FOCUS
//   figure spreads across Z (each warmest figure its own lane). The surf becomes a
//   trajectory you can rotate and play — forward motion, the surprise it crests on, and
//   the focus shifting under it, all at once. Frame-breaks (RECs) are the lane changes.
//
// Nothing here computes meaning. The DOM-free surface (summarizeSurf, classifyStops,
// turnsWithSurf, surfPath3D, project3D) is exported so CI exercises it without a
// browser, the way replay-view exposes buildBeats and predict-view exposes defaultCursor.

import { surfFold } from '../surfer/index.js';

// ── Phosphor icons, placed by codepoint (vendor/phosphor, styles.css `.ph`) ───
const PH = {
  anchor: 'E514', peak: 'E7AE', focus: 'E47C', reframe: 'E094', surprise: 'ECE0',
  wave: 'E6DE', reading: 'E0E6', chat: 'E168', cube: 'E1DA', swimmer: 'E736',
  play: 'E3D0', pause: 'E39E', restart: 'E5A4', prev: 'E138', next: 'E13A',
  compass: 'E1C8', atmosphere: 'E1AA', lens: 'E30C', paradigm: 'E39C', stance: 'E628',
};
const ic = (name, extra = '') =>
  `<i class="ph${extra ? ' ' + extra : ''}" aria-hidden="true">&#x${PH[name]};</i>`;

// Playback speeds — ms a single cursor lingers before the next. The dwell STRETCHES on
// the arrests: the base step plus a bump proportional to that cursor's Bayesian surprise,
// so the replay races the flat and arrests on the peaks (the same discipline replay-view
// uses for the reading, applied here to the surf's own gradient).
const SPEEDS = [
  { label: '0.5×', base: 1400 },
  { label: '1×',   base: 700 },
  { label: '2×',   base: 350 },
  { label: '4×',   base: 175 },
];
const DEFAULT_SPEED = 1;
const ARREST_DWELL = 900;   // extra ms at bayes === 1, scaled by the cursor's surprise

// Mount the view once. `getDoc` is a live getter; `getAudit` returns the session audit
// log; `onSelectSentence` jumps the shared reading cursor. Returns { refresh }.
export const mountSurfer = (root, { getDoc, getAudit, onSelectSentence } = {}) => {
  let mode = 'reading';     // 'reading' | 'chat' | '3d'
  let built = null;         // the doc the reading/3d registers were built against
  let units = [];           // the current document's units
  let cursor = 0;           // the anchor the surfer is dropped at (reading + 3d share it)
  let curSurf = null;       // surfFold(doc, cursor), cached until the anchor moves
  let selectedTurn = null;  // the audit turn id shown in the chat register

  // Playback state, shared by the reading playhead and the 3d tracer.
  let playing = false, speed = DEFAULT_SPEED, playPos = 0, timer = null;
  // 3d camera state.
  let yaw = -0.6, pitch = 0.5, dragging = false, lastX = 0, lastY = 0, raf = 0;

  const audit = getAudit?.();
  audit?.subscribe?.(() => { if (mode === 'chat' && root.offsetParent !== null) renderChat(); });

  const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const stopRaf = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

  const reSurf = () => {
    const doc = getDoc?.();
    try { curSurf = doc ? surfFold(doc, cursor) : null; }
    catch { curSurf = null; }
    return curSurf;
  };

  const refresh = () => {
    const doc = getDoc?.();
    if (doc !== built) {
      built = doc; units = doc ? (doc.units || doc.sentences || []) : [];
      cursor = 0; playPos = 0; playing = false; clearTimer();
    }
    reSurf();
    renderShell();
    if (mode === 'reading') renderReading();
    else if (mode === 'chat') renderChat();
    else renderThree();
  };

  // The shell: the intro, the three register tabs, the body container.
  const renderShell = () => {
    stopRaf(); clearTimer(); playing = false;
    root.innerHTML =
      `<div class="sv-wrap">` +
        `<div class="sv-intro">The <b>surfer</b> reads a field the reading already maintains and steps ` +
          `down its gradient — <b>focus</b> (the warmest figure), <b>cursor</b> (arrest on Bayesian ` +
          `surprise), <b>frame</b> (a break is an arrest too). Nothing is chosen; every stop is read ` +
          `off physics. No model is called.</div>` +
        `<div class="sv-modes" role="tablist">` +
          `<button type="button" class="sv-mode${mode === 'reading' ? ' on' : ''}" data-mode="reading">${ic('reading')} Reading a document</button>` +
          `<button type="button" class="sv-mode${mode === 'chat' ? ' on' : ''}" data-mode="chat">${ic('chat')} Prompted in chat</button>` +
          `<button type="button" class="sv-mode${mode === '3d' ? ' on' : ''}" data-mode="3d">${ic('cube')} 3D</button>` +
        `</div>` +
        `<div class="sv-body"></div>` +
      `</div>`;
    root.querySelectorAll('.sv-mode').forEach(b =>
      b.addEventListener('click', () => {
        if (mode === b.dataset.mode) return;
        stopRaf(); clearTimer(); playing = false; playPos = 0;
        mode = b.dataset.mode;
        renderShell();
        if (mode === 'reading') renderReading();
        else if (mode === 'chat') renderChat();
        else renderThree();
      }));
  };

  // ── the transport bar, shared by the reading + 3d registers ────────────────
  const transportHtml = () =>
    `<div class="sv-transport">` +
      `<button type="button" class="sv-tbtn sv-restart" title="Back to the anchor">${ic('restart')}</button>` +
      `<button type="button" class="sv-tbtn sv-play" title="Play / pause the surf">${ic('play')}</button>` +
      `<span class="sv-speeds">` +
        SPEEDS.map((s, i) => `<button type="button" class="sv-speed${i === speed ? ' on' : ''}" data-speed="${i}">${s.label}</button>`).join('') +
      `</span>` +
      `<span class="sv-play-readout"></span>` +
    `</div>`;

  const wireTransport = (scope) => {
    scope.querySelector('.sv-restart')?.addEventListener('click', () => { stop(); setPlayPos(0); });
    scope.querySelector('.sv-play')?.addEventListener('click', () => (playing ? stop() : play()));
    scope.querySelectorAll('.sv-speed').forEach(b =>
      b.addEventListener('click', () => {
        speed = Number(b.dataset.speed);
        scope.querySelectorAll('.sv-speed').forEach((x, i) => x.classList.toggle('on', i === speed));
        if (playing) { clearTimer(); schedule(); }
      }));
  };

  const play = () => {
    const field = curSurf?.field || [];
    if (field.length < 2) return;
    if (playPos >= field.length - 1) playPos = 0;
    playing = true; paintTransport(); paintNow(); schedule();
  };
  const stop = () => { clearTimer(); playing = false; paintTransport(); };

  // The heartbeat — advance one cursor; the delay is the speed's base stretched by the
  // cursor's surprise, so the surf lingers on the arrests and races the flat between.
  const schedule = () => {
    clearTimer();
    if (!playing) return;
    const field = curSurf?.field || [];
    const f = field[playPos];
    const delay = SPEEDS[speed].base + Math.round((f?.bayes || 0) * ARREST_DWELL);
    timer = setTimeout(() => {
      if (!playing) return;
      if (playPos >= field.length - 1) { stop(); return; }
      playPos += 1; paintNow(); schedule();
    }, delay);
  };

  const setPlayPos = (i) => {
    const field = curSurf?.field || [];
    playPos = Math.max(0, Math.min(Math.max(0, field.length - 1), i | 0));
    paintNow();
  };

  const paintTransport = () => {
    const btn = root.querySelector('.sv-play');
    if (btn) btn.innerHTML = playing ? ic('pause') : ic('play');
  };

  // Repaint the "now" cursor — the reading strip's playhead, or the 3d tracer's readout.
  const paintNow = () => {
    const field = curSurf?.field || [];
    const f = field[playPos]; if (!f) return;
    const readout = root.querySelector('.sv-play-readout');
    const role = f.idx === curSurf.anchor ? 'anchor'
      : (curSurf.recCursors || []).includes(f.idx) ? 'frame-break'
      : f.idx === curSurf.peak ? 'peak'
      : (curSurf.stops || []).includes(f.idx) ? 'stop' : 'gliding';
    if (readout) readout.innerHTML = `${ic('swimmer')} L${f.idx} · ${playPos + 1}/${field.length} · ` +
      `<span class="sv-role sv-role-${role}">${role}</span>`;
    if (mode === 'reading') {
      root.querySelectorAll('.sv-cell.sv-cell-now').forEach(c => c.classList.remove('sv-cell-now'));
      root.querySelector(`.sv-cell[data-anchor="${f.idx}"]`)?.classList.add('sv-cell-now');
    }
    // 3d repaints continuously in its own rAF loop.
  };

  // ── READING register ──────────────────────────────────────────────────────
  const renderReading = () => {
    const body = root.querySelector('.sv-body');
    if (!body) return;
    if (!units.length) {
      body.innerHTML = `<div class="feed-empty">Load a document, then drop the surfer's anchor anywhere ` +
        `to watch it surf — the reach it measures, the surprises it arrests on, the frame-breaks, and the ` +
        `peak where it takes the significance reading. Scrub the anchor or press play: the whole surf ` +
        `re-runs, deterministically, with no model called.</div>`;
      return;
    }
    const last = units.length - 1;
    body.innerHTML =
      `<div class="sv-bar">` +
        `<button type="button" class="small sv-prev" title="Anchor back one line">${ic('prev')}</button>` +
        `<input type="range" class="sv-cursor" min="0" max="${last}" value="${cursor}">` +
        `<button type="button" class="small sv-next" title="Anchor forward one line">${ic('next')}</button>` +
        `<span class="sv-readout"></span>` +
      `</div>` +
      transportHtml() +
      `<div class="sv-panel"></div>`;

    body.querySelector('.sv-prev').addEventListener('click', () => setCursor(cursor - 1));
    body.querySelector('.sv-next').addEventListener('click', () => setCursor(cursor + 1));
    body.querySelector('.sv-cursor').addEventListener('input', (e) => setCursor(Number(e.target.value)));
    wireTransport(body);

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
    reSurf();
    stop(); playPos = 0;
    const slider = root.querySelector('.sv-cursor');
    if (slider) slider.value = String(cursor);
    if (mode === 'reading') renderReadingPanel();
  };

  const renderReadingPanel = () => {
    const panel = root.querySelector('.sv-panel');
    if (!panel || !curSurf) return;
    const sum = summarizeSurf(curSurf);
    const readout = root.querySelector('.sv-readout');
    if (readout) readout.textContent = `anchor L${sum.anchor} · reach L${sum.reachLo}–L${sum.reachHi}`;
    panel.innerHTML = surfSummaryHtml(sum) + fieldStripHtml(curSurf) + stopsHtml(curSurf, units);
    paintNow();
  };

  // ── CHAT register ─────────────────────────────────────────────────────────
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
    if (!turns.some(t => t.id === selectedTurn)) selectedTurn = turns[0].id;
    const list = turns.map(t =>
      `<button type="button" class="sv-turn${t.id === selectedTurn ? ' on' : ''}" data-turn="${t.id}">` +
        `<span class="sv-turn-id">${escapeHtml(t.id)}</span>` +
        `<span class="sv-turn-q">${escapeHtml(clip(t.question || '(no question)', 60))}</span>` +
        `<span class="sv-turn-meta">${ic('anchor')} L${t.surf.anchor} ${ic('peak')} L${t.surf.peak}</span>` +
      `</button>`).join('');
    body.innerHTML = `<div class="sv-turns">${list}</div><div class="sv-detail"></div>`;
    body.querySelector('.sv-turns').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-turn]');
      if (!b) return;
      selectedTurn = b.dataset.turn;
      body.querySelectorAll('.sv-turn').forEach(x => x.classList.toggle('on', x.dataset.turn === selectedTurn));
      renderChatDetail();
    });
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
    const sum = summarizeSurf(turn.surf);
    detail.innerHTML =
      `<div class="sv-detail-q"><span class="sv-turn-id">${escapeHtml(turn.id)}</span> ` +
        `${escapeHtml(turn.question || '(no question)')}</div>` +
      surfSummaryHtml(sum) + fieldStripHtml(turn.surf) + stopsHtml(turn.surf, null) + significanceHtml(turn.sig);
  };

  // ── 3D register — the surf lifted into its three axes ─────────────────────
  const renderThree = () => {
    const body = root.querySelector('.sv-body');
    if (!body) return;
    if (!units.length) {
      body.innerHTML = `<div class="feed-empty">Load a document, then drop the anchor to see the surf in ` +
        `space: reading-order runs left→right, Bayesian surprise rises up (the wave it rides), and the ` +
        `focus figure spreads in depth (each its own lane). Drag to rotate; press play to trace the path. ` +
        `Frame-breaks are the lane changes. No model is called.</div>`;
      return;
    }
    const last = units.length - 1;
    body.innerHTML =
      `<div class="sv-bar">` +
        `<button type="button" class="small sv-prev" title="Anchor back one line">${ic('prev')}</button>` +
        `<input type="range" class="sv-cursor" min="0" max="${last}" value="${cursor}">` +
        `<button type="button" class="small sv-next" title="Anchor forward one line">${ic('next')}</button>` +
        `<span class="sv-readout"></span>` +
      `</div>` +
      transportHtml() +
      `<div class="sv-3d"><canvas class="sv-canvas"></canvas>` +
        `<div class="sv-3d-hint">${ic('compass')} drag to rotate</div>` +
        `<div class="sv-axes">` +
          `<span class="sv-axis sv-axis-x">→ reading order (cursor)</span>` +
          `<span class="sv-axis sv-axis-y">↑ Bayesian surprise</span>` +
          `<span class="sv-axis sv-axis-z">⤢ focus (depth)</span>` +
        `</div>` +
      `</div>` +
      `<div class="sv-3d-legend"></div>`;

    body.querySelector('.sv-prev').addEventListener('click', () => setCursor(cursor - 1));
    body.querySelector('.sv-next').addEventListener('click', () => setCursor(cursor + 1));
    body.querySelector('.sv-cursor').addEventListener('input', (e) => { setCursor(Number(e.target.value)); render3DLegend(); });
    wireTransport(body);

    const canvas = body.querySelector('.sv-canvas');
    const onDown = (e) => { dragging = true; const p = pt(e); lastX = p.x; lastY = p.y; };
    const onMove = (e) => {
      if (!dragging) return;
      const p = pt(e);
      yaw += (p.x - lastX) * 0.01; pitch += (p.y - lastY) * 0.01;
      pitch = Math.max(-1.3, Math.min(1.3, pitch));
      lastX = p.x; lastY = p.y; e.preventDefault?.();
    };
    const onUp = () => { dragging = false; };
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp);

    render3DLegend();
    startRaf(canvas);
  };

  const pt = (e) => {
    const t = e.touches?.[0] || e;
    return { x: t.clientX || 0, y: t.clientY || 0 };
  };

  const render3DLegend = () => {
    const el = root.querySelector('.sv-3d-legend');
    if (!el || !curSurf) return;
    const { lanes } = surfPath3D(curSurf);
    const sum = summarizeSurf(curSurf);
    el.innerHTML =
      `<span class="sv-badge sv-anchor">${ic('anchor')} L${sum.anchor}</span>` +
      `<span class="sv-badge sv-peak">${ic('peak')} peak L${sum.peak}</span>` +
      (sum.focus ? `<span class="sv-badge sv-focus">${ic('focus')} ${escapeHtml(String(sum.focus))}</span>` : '') +
      `<span class="sv-lanes">${lanes.map(l => `<span class="sv-lane-chip">${escapeHtml(String(l.focus ?? '—'))}</span>`).join('')}</span>`;
  };

  const startRaf = (canvas) => {
    stopRaf();
    const ctx = canvas.getContext('2d');
    const loop = () => {
      if (mode !== '3d' || root.offsetParent === null || !canvas.isConnected) { raf = 0; return; }
      if (!dragging && !playing) yaw += 0.0035;   // gentle auto-rotate when idle
      draw3D(ctx, canvas, curSurf, { yaw, pitch, playPos: playing ? playPos : -1 });
      if (playing) {
        const readout = root.querySelector('.sv-play-readout');
        const f = (curSurf?.field || [])[playPos];
        if (readout && f) {
          const role = f.idx === curSurf.anchor ? 'anchor'
            : (curSurf.recCursors || []).includes(f.idx) ? 'frame-break'
            : f.idx === curSurf.peak ? 'peak'
            : (curSurf.stops || []).includes(f.idx) ? 'stop' : 'gliding';
          readout.innerHTML = `${ic('swimmer')} L${f.idx} · <span class="sv-role sv-role-${role}">${role}</span>`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  };

  refresh();
  return { refresh };
};

// ── the DOM-free surface (exported for CI) ────────────────────────────────────

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

// Why each stop is a stop, in reading order (surfing-the-fold.md "What it returns"): the
// ANCHOR (retrieval set it down), a FRAME-BREAK (a REC), or a SURPRISE-PEAK. Pure.
export const classifyStops = (surf = {}) => {
  const recs = new Set(Array.isArray(surf.recCursors) ? surf.recCursors : []);
  const stops = Array.isArray(surf.stops) ? [...surf.stops].sort((a, b) => a - b) : [];
  return stops.map(idx => ({
    idx,
    reason: idx === surf.anchor ? 'anchor' : recs.has(idx) ? 'frame-break' : 'surprise-peak',
  }));
};

// The audit turns that ran a surf, newest first, each paired with its recorded surf and
// (when it rode) its Significance column read off the fold step. Pure.
export const turnsWithSurf = (auditOrTurns) => {
  const turns = Array.isArray(auditOrTurns) ? auditOrTurns : (auditOrTurns?.turns || []);
  const out = [];
  for (const t of turns) {
    const surf = t?.reading?.surf;
    if (!surf) continue;
    const fold = (t.steps || []).find(s => s.name === 'fold')?.data?.surf || null;
    out.push({
      id: t.id, question: t.question,
      surf: { ...surf, focus: surf.focus ?? fold?.focus ?? null },
      sig: fold && (fold.atmosphere || fold.lensEntropy != null || fold.lenses != null || fold.paradigm || fold.stance)
        ? fold : null,
    });
  }
  return out.reverse();
};

// The surf as points in its three native axes — reading order (x), Bayesian surprise (y),
// and focus lane (z). Pure: reading-order across the reach maps to x∈[-1,1], surprise
// normalises to y∈[0,1], each distinct focus figure gets a z lane spread across [-1,1].
// Each point carries its `kind` (anchor · peak · frame-break · stop · glide) for markers.
export const surfPath3D = (surf = {}) => {
  const field = (Array.isArray(surf.field) ? surf.field : []).slice().sort((a, b) => a.idx - b.idx);
  const empty = { points: [], lanes: [], reach: { lo: 0, hi: 0 } };
  if (!field.length) return empty;
  const lo = field[0].idx, hi = field[field.length - 1].idx;
  const span = Math.max(1, hi - lo);
  const maxB = Math.max(1e-6, ...field.map(f => f.bayes || 0));
  // Focus lanes, in first-seen reading order.
  const laneOrder = [];
  for (const f of field) { const k = f.focus ?? '—'; if (!laneOrder.includes(k)) laneOrder.push(k); }
  const zOf = (k) => laneOrder.length < 2 ? 0 : -1 + 2 * (laneOrder.indexOf(k) / (laneOrder.length - 1));
  const recs = new Set(Array.isArray(surf.recCursors) ? surf.recCursors : []);
  const stops = new Set(Array.isArray(surf.stops) ? surf.stops : []);
  const points = field.map(f => {
    const kind = f.idx === surf.anchor ? 'anchor'
      : recs.has(f.idx) ? 'frame-break'
      : f.idx === surf.peak ? 'peak'
      : stops.has(f.idx) ? 'stop' : 'glide';
    return {
      idx: f.idx, focus: f.focus ?? null, bayes: f.bayes || 0,
      x: -1 + 2 * ((f.idx - lo) / span),
      y: (f.bayes || 0) / maxB,
      z: zOf(f.focus ?? '—'),
      kind,
    };
  });
  return { points, lanes: laneOrder.map(k => ({ focus: k === '—' ? null : k, z: zOf(k) })), reach: { lo, hi } };
};

// Rotate a 3D point (yaw about Y, then pitch about X) and perspective-project it to
// normalised screen coords. Pure — the projection the 3d canvas maps to pixels. Returns
// { x, y, depth }; larger depth is nearer the camera.
export const project3D = (p, { yaw = 0, pitch = 0, dist = 2.8, fov = 1.7 } = {}) => {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = p.x * cy - p.z * sy;
  const z1 = p.x * sy + p.z * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y2 = p.y * cp - z1 * sp;
  const z2 = p.y * sp + z1 * cp;
  const f = fov / Math.max(0.1, dist - z2);
  return { x: x1 * f, y: -y2 * f, depth: z2 };
};

// ── HTML builders (exported where cheap to check) ─────────────────────────────

export const surfSummaryHtml = (sum) =>
  `<div class="sv-sum">` +
    `<span class="sv-badge sv-anchor" title="where retrieval set the surfer down">${ic('anchor')} L${sum.anchor}</span>` +
    `<span class="sv-arrow">${ic('wave')}</span>` +
    `<span class="sv-badge sv-peak" title="the steepest stop — where the significance reading is taken">${ic('peak')} peak L${sum.peak}</span>` +
    (sum.focus ? `<span class="sv-badge sv-focus" title="the warmest figure across the stops">${ic('focus')} ${escapeHtml(String(sum.focus))}</span>` : '') +
    `<span class="sv-sum-n">${sum.stops} stop${sum.stops === 1 ? '' : 's'}` +
      (sum.recs ? ` · ${sum.recs} frame-break${sum.recs === 1 ? '' : 's'}` : '') + `</span>` +
    `<span class="sv-rode" title="the field the surfer rode">${escapeHtml(sum.rode)}</span>` +
  `</div>`;

export const fieldStripHtml = (surf = {}) => {
  const field = Array.isArray(surf.field) ? surf.field : [];
  if (!field.length) return '';
  const stops = new Set(Array.isArray(surf.stops) ? surf.stops : []);
  const recs  = new Set(Array.isArray(surf.recCursors) ? surf.recCursors : []);
  const max = Math.max(1e-6, ...field.map(f => f.bayes || 0));
  const cells = field.map(f => {
    const h = Math.round(((f.bayes || 0) / max) * 100);
    const lvl = f.bayes >= 0.5 ? 'high' : f.bayes >= 0.25 ? 'medium' : 'low';
    const isStop = stops.has(f.idx), isPeak = f.idx === surf.peak, isAnchor = f.idx === surf.anchor, isRec = recs.has(f.idx);
    const badge = isAnchor ? ic('anchor') : isRec ? ic('reframe') : isPeak ? ic('peak') : isStop ? ic('surprise') : '';
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
      : (f?.focus ? `<span class="sv-stop-focus">${ic('focus')} ${escapeHtml(String(f.focus))}</span>` : '<span class="sv-quiet">—</span>');
    return `<div class="sv-stop-row${isPeak ? ' sv-stop-row-peak' : ''}">` +
      `<span class="sv-cite" data-idx="${idx}">L${idx}</span>` +
      `<span class="sv-reason sv-reason-${reason}">${REASON_LABEL[reason]}</span>` +
      (isPeak ? `<span class="sv-reason sv-reason-peak">${ic('peak')} peak</span>` : '') +
      `<span class="sv-stop-text">${text}</span>` +
      meterHtml('sig', bayes) +
    `</div>`;
  }).join('');
  return `<div class="sv-stops"><div class="sv-strip-label">where it arrested — and why</div>${body}</div>`;
};

const REASON_LABEL = {
  'anchor':        `${ic('anchor')} anchor`,
  'frame-break':   `${ic('reframe')} frame-break`,
  'surprise-peak': `${ic('surprise')} surprise-peak`,
};

export const significanceHtml = (sig) => {
  if (!sig) return '';
  const parts = [];
  if (sig.atmosphere) {
    const a = sig.atmosphere;
    parts.push(kv('atmosphere', 'atmosphere', `${a.tone || '—'}${a.verdict ? ` · ${a.verdict}` : ''}` +
      (a.departure != null ? ` · departure ${Number(a.departure).toFixed(3)}` : '')));
  }
  if (sig.lensEntropy != null)
    parts.push(kv('lens', 'lens', `entropy ${Number(sig.lensEntropy).toFixed(3)}` +
      (sig.lenses != null ? ` · ${sig.lenses} real` : '')));
  if (sig.paradigm) parts.push(kv('paradigm', 'paradigm', String(sig.paradigm)));
  if (sig.paradigmRec) parts.push(kv('reframe', 'paradigm', `REC · Δ${Number(sig.paradigmRec.surpriseDelta ?? 0).toFixed(3)}`));
  if (sig.stance) {
    const s = sig.stance;
    parts.push(kv('stance', 'stance', `${s.op || '—'}${s.stance ? ` · ${s.stance}` : ''}` +
      (s.firmness != null ? ` · firmness ${Number(s.firmness).toFixed(2)}` : '') +
      (s.guard ? ` · guard ${s.guard}` : '')));
  }
  if (!parts.length) return '';
  return `<div class="sv-sig">` +
    `<div class="sv-strip-label">the significance column — read when a meaning model rode</div>` +
    parts.join('') + `</div>`;
};

const kv = (label, icon, v) =>
  `<div class="sv-kv"><span class="sv-kv-k">${ic(icon)} ${escapeHtml(label)}</span><span class="sv-kv-v">${escapeHtml(v)}</span></div>`;

const meterHtml = (label, value) => {
  const w = Math.max(2, Math.round((value || 0) * 100));
  const lvl = value >= 0.5 ? 'high' : value >= 0.25 ? 'medium' : 'low';
  return `<span class="sv-meter sv-meter-${lvl}" title="${escapeHtml(label)} ${(value || 0).toFixed(3)}"><i style="width:${w}%"></i></span>`;
};

// ── the 3d canvas draw (browser-only; the projection it uses is project3D) ─────
const KIND_COLOR = {
  anchor: '#93c5fd', peak: '#6ee7b7', 'frame-break': '#a7f3d0', stop: '#c4b5fd', glide: '#52525b',
};

const draw3D = (ctx, canvas, surf, { yaw, pitch, playPos }) => {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const cw = canvas.clientWidth || 480, ch = canvas.clientHeight || 300;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  if (!surf) return;
  const { points, lanes } = surfPath3D(surf);
  if (!points.length) return;

  const S = Math.min(cw, ch) * 0.42;
  const cx = cw / 2, cyc = ch / 2 + ch * 0.08;
  const toPx = (p) => { const q = project3D(p, { yaw, pitch }); return { x: cx + q.x * S, y: cyc + q.y * S, depth: q.depth }; };

  // The ground plane — the focus lanes running along the reading-order axis at y=0.
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(63,63,70,.5)';
  for (const l of lanes) {
    const a = toPx({ x: -1, y: 0, z: l.z }), b = toPx({ x: 1, y: 0, z: l.z });
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    // lane label at the near end
    ctx.fillStyle = '#71717a'; ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(String(l.focus ?? '—'), b.x + 4, b.y + 3);
  }
  // the reading-order axis
  const ax0 = toPx({ x: -1, y: 0, z: 0 }), ax1 = toPx({ x: 1, y: 0, z: 0 });
  ctx.strokeStyle = 'rgba(96,165,250,.4)';
  ctx.beginPath(); ctx.moveTo(ax0.x, ax0.y); ctx.lineTo(ax1.x, ax1.y); ctx.stroke();

  // The surf path — the wave the surfer rides, colored by surprise. Stems drop each
  // point to its lane so the height reads honestly against the ground.
  const proj = points.map(toPx);
  for (let i = 0; i < points.length; i++) {
    const base = toPx({ x: points[i].x, y: 0, z: points[i].z });
    ctx.strokeStyle = 'rgba(82,82,91,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(proj[i].x, proj[i].y); ctx.stroke();
  }
  ctx.lineWidth = 2; ctx.lineJoin = 'round';
  for (let i = 1; i < points.length; i++) {
    const s = points[i].bayes;
    ctx.strokeStyle = s >= 0.5 ? '#fca5a5' : s >= 0.25 ? '#fbbf24' : '#3f6ad8';
    ctx.beginPath(); ctx.moveTo(proj[i - 1].x, proj[i - 1].y); ctx.lineTo(proj[i].x, proj[i].y); ctx.stroke();
  }

  // Markers, painted back-to-front so nearer arrests sit on top.
  const order = points.map((p, i) => i).sort((a, b) => proj[a].depth - proj[b].depth);
  for (const i of order) {
    const p = points[i], pr = proj[i];
    const isArrest = p.kind !== 'glide';
    const r = p.kind === 'peak' ? 6 : p.kind === 'anchor' ? 5 : isArrest ? 4 : 2.4;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
    ctx.fillStyle = KIND_COLOR[p.kind] || '#52525b'; ctx.fill();
    if (p.kind === 'peak') { ctx.lineWidth = 2; ctx.strokeStyle = '#0b0b0d'; ctx.stroke(); }
  }

  // The tracer — the surfer, riding the path during playback.
  if (playPos >= 0 && playPos < proj.length) {
    const pr = proj[playPos];
    ctx.beginPath(); ctx.arc(pr.x, pr.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(110,231,183,.18)'; ctx.fill();
    ctx.beginPath(); ctx.arc(pr.x, pr.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#6ee7b7'; ctx.fill();
  }
};

const clip = (s, n) => { const t = String(s ?? ''); return t.length > n ? t.slice(0, n) + '…' : t; };
const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
