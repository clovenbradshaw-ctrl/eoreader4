// Graph view: see and explore the projected graph with a cursor.
//
// The graph is `doc.projectGraph(frame)` — a fold of the event log. Two
// cursors meet here:
//
//   - The mouse cursor explores. Hover a node to light up its neighbourhood,
//     drag to pull it loose, click to jump to the line it was admitted on.
//   - The reading cursor (the slider, or a clicked sentence) re-projects the
//     graph with γ-decay around a reading position: edges and figures far
//     from where you are reading fade, the local graph stays bright. This is
//     `frame.cursor` flowing straight into the pure projection.
//
// No library. A small spring/charge simulation lays nodes out in a fixed
// 600×460 coordinate space that the SVG scales to fit, so it renders the same
// whether the pane is visible or hidden when first built.

import { readingAt, structureSurface, predictNext } from '../read/index.js';
import { enactedReadingTo, enactedReadingMeaning } from '../enact/index.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 600, H = 460, CX = W / 2, CY = H / 2;
const CAP = 40;          // most-sighted entities to draw
const GAMMA = 0.7;       // matches DEFAULT_PROJECTION_RULES.decay_gamma

export const renderGraph = (doc, root, { onSelectSentence, getModel, embedder, geometricEmbedder, isGeometricLive } = {}) => {
  root.innerHTML = '';
  if (!doc || typeof doc.projectGraph !== 'function') {
    root.innerHTML = `<div class="graph-empty">No document yet — load one and its graph appears here.</div>`;
    return noop();
  }

  const base = doc.projectGraph({});
  const ents = [...base.entities.values()].sort((a, b) => b.sightings - a.sightings);
  if (ents.length === 0) {
    root.innerHTML = `<div class="graph-empty">No figures admitted yet. The graph fills in as names recur.</div>`;
    return noop();
  }

  const keep = new Set(ents.slice(0, CAP).map(e => e.id));
  const mentions = doc.mentions || new Map();
  const units = doc.units || doc.sentences || [];
  const S = units.length;

  // ---- model ---------------------------------------------------------------
  const nodes = ents.filter(e => keep.has(e.id)).map((e, i) => {
    const a = (i / keep.size) * Math.PI * 2;
    return {
      id: e.id, label: e.label, sightings: e.sightings,
      first: (mentions.get(e.id) || [])[0] ?? e.firstSeen ?? 0,
      x: CX + Math.cos(a) * 170, y: CY + Math.sin(a) * 150,
      vx: 0, vy: 0, fixed: false, deg: 0,
    };
  });
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  const aggregate = (edges) => {
    const m = new Map();
    for (const e of edges) {
      if (!keep.has(e.from) || !keep.has(e.to) || e.from === e.to) continue;
      const key = `${e.from}|${e.to}`;
      let L = m.get(key);
      if (!L) { L = { key, a: e.from, b: e.to, weight: 0, kind: e.kind, vias: new Map(), idxs: [] }; m.set(key, L); }
      L.weight += e.weight || 0;
      if (e.via) L.vias.set(e.via, (L.vias.get(e.via) || 0) + 1);
      if (e.sentIdx != null) L.idxs.push(e.sentIdx);
    }
    return m;
  };

  const baseLinks = aggregate(base.edges);
  const links = [...baseLinks.values()];
  const baseMax = links.reduce((m, l) => Math.max(m, l.weight), 1e-6);
  for (const l of links) { (nodeById.get(l.a)).deg++; (nodeById.get(l.b)).deg++; }

  // ---- dom -----------------------------------------------------------------
  const wrap = document.createElement('div');
  wrap.className = 'graph-wrap';
  wrap.innerHTML = `
    <div class="graph-bar">
      <button type="button" class="small graph-step" data-d="-1" title="Step back">◀</button>
      <input type="range" class="graph-cursor" min="0" max="${S}" value="${S}" step="1" title="Reading cursor" />
      <button type="button" class="small graph-step" data-d="1" title="Step forward">▶</button>
      <span class="graph-readout">whole document</span>
      <button type="button" class="small graph-play" title="Play the reading">▷ Read</button>
      <button type="button" class="small graph-whole">Whole doc</button>
    </div>
    <svg class="graph-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"></svg>
    <div class="graph-tip" hidden></div>
    <div class="reading-panel" hidden></div>
  `;
  root.appendChild(wrap);

  const svg     = wrap.querySelector('.graph-svg');
  const slider  = wrap.querySelector('.graph-cursor');
  const readout = wrap.querySelector('.graph-readout');
  const tip     = wrap.querySelector('.graph-tip');
  const panel   = wrap.querySelector('.reading-panel');
  const gEdges  = document.createElementNS(NS, 'g');
  const gNodes  = document.createElementNS(NS, 'g');
  svg.appendChild(gEdges);
  svg.appendChild(gNodes);

  for (const l of links) {
    l.el = document.createElementNS(NS, 'line');
    l.el.setAttribute('class', `gedge ${l.kind || 'con'}`);
    gEdges.appendChild(l.el);
  }
  for (const n of nodes) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'gnode');
    const r = 5 + 3.2 * Math.log(1 + n.sightings);
    n.r = r;
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', r);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('class', 'glabel');
    t.setAttribute('dy', -r - 3);
    t.textContent = n.label;
    g.appendChild(c); g.appendChild(t);
    gNodes.appendChild(g);
    n.el = g;
    wireNode(n, g);
  }

  // ---- layout simulation ---------------------------------------------------
  let alpha = 1, raf = 0, ticks = 0;
  const step = () => {
    for (const n of nodes) { n.vx *= 0.85; n.vy *= 0.85; }
    // charge repulsion (O(n²) — n ≤ 40)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 0.01;
        const f = (2400 / d2) * alpha;
        const d = Math.sqrt(d2);
        const ux = dx / d, uy = dy / d;
        a.vx += ux * f; a.vy += uy * f;
        b.vx -= ux * f; b.vy -= uy * f;
      }
    }
    // spring attraction along edges — the physics of the graph: a heavier
    // bond (more mass on its ends, higher coupling) is a stiffer, shorter
    // spring, so strongly-bonded figures sit closer.
    for (const l of links) {
      const a = nodeById.get(l.a), b = nodeById.get(l.b);
      let dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const strength = Math.min(1, l.weight / baseMax);
      const rest = 120 - 55 * strength;                 // stiffer bonds rest closer
      const f = (d - rest) * (0.012 + 0.03 * strength) * alpha;
      const ux = dx / d, uy = dy / d;
      a.vx += ux * f; a.vy += uy * f;
      b.vx -= ux * f; b.vy -= uy * f;
    }
    // gravity to centre + integrate
    for (const n of nodes) {
      if (n.fixed) { n.vx = n.vy = 0; continue; }
      n.vx += (CX - n.x) * 0.004 * alpha;
      n.vy += (CY - n.y) * 0.004 * alpha;
      n.x = clamp(n.x + n.vx, 16, W - 16);
      n.y = clamp(n.y + n.vy, 16, H - 16);
    }
    draw();
    alpha *= 0.985;
    if (++ticks < 600 && alpha > 0.02) raf = requestAnimationFrame(step);
    else raf = 0;
  };

  const draw = () => {
    for (const l of links) {
      const a = nodeById.get(l.a), b = nodeById.get(l.b);
      l.el.setAttribute('x1', a.x); l.el.setAttribute('y1', a.y);
      l.el.setAttribute('x2', b.x); l.el.setAttribute('y2', b.y);
    }
    for (const n of nodes) n.el.setAttribute('transform', `translate(${n.x},${n.y})`);
  };

  const reheat = () => { alpha = Math.max(alpha, 0.4); if (!raf) raf = requestAnimationFrame(step); };

  // ---- reading cursor ------------------------------------------------------
  const styleLinks = (weightOf) => {
    for (const l of links) {
      const w = weightOf ? (weightOf.get(l.key)?.weight ?? 0) : l.weight;
      const rel = w / baseMax;
      l.el.style.strokeWidth = (0.5 + 2.4 * Math.sqrt(Math.max(rel, 0))).toFixed(2);
      l.el.style.opacity = (w <= 1e-6 ? 0.05 : Math.min(1, 0.18 + rel)).toFixed(3);
    }
  };

  let readingMode = false;
  let playTimer = null;
  let predReq = 0;

  const applyCursor = (cur) => {
    if (cur >= S) {
      readout.textContent = 'whole document';
      styleLinks(baseLinks);
      for (const n of nodes) n.el.style.opacity = '1';
      if (readingMode) panel.hidden = true;
      return;
    }
    readout.textContent = `reading at s${cur}`;
    const g = doc.projectGraph({ cursor: cur });
    styleLinks(aggregate(g.edges));
    for (const n of nodes) {
      const ms = mentions.get(n.id) || [];
      let d = Infinity;
      for (const i of ms) d = Math.min(d, Math.abs(i - cur));
      const op = isFinite(d) ? Math.max(0.12, Math.pow(GAMMA, Math.min(d, 12))) : 0.1;
      n.el.style.opacity = op.toFixed(3);
    }
    if (readingMode) updateReading(cur);
  };

  // The three levels of reading, surfaced as the cursor moves. Existence (the
  // line), structure (the EO events it added), significance (what was
  // predicted and how surprising the line turned out).
  const updateReading = (cur) => {
    panel.hidden = false;
    const sig = readingAt(doc, cur);
    const struct = structureSurface(doc, [cur]);
    const evChips = [
      ...struct.figures.filter(f => (mentions.get(f.id) || [])[0] === cur)
        .map(f => chip('INS', `${f.label} enters`)),
      ...struct.relations.map(r => chip(r.op, `${r.src.label} ${r.via || ''} ${r.tgt.label}`)),
      ...struct.defs.map(d => chip('DEF', `${d.label}: ${d.value}`)),
      ...struct.merges.map(m => chip('SYN', `${m.from.label} ≡ ${m.to.label}`)),
    ];
    if (evChips.length === 0) evChips.push(chip('NUL', 'held — no new structure'));

    const pct = Math.round(sig.surprise * 100);
    // The enacted loop, folded to this cursor — the reading's OWN frames (terms,
    // strain, restructurings) as of here, distinct from the depicted significance
    // above it. The arrow above reads what the clause REPORTS; this reads what the
    // reading has DONE establishing and breaking its terms up to this point (§2).
    panel.innerHTML =
      `<div class="rl rl1"><span class="rl-tag">existence</span>` +
        `<span class="rl-body">s${cur}: ${escapeHtml(sig.sentence || '')}</span></div>` +
      `<div class="rl rl2"><span class="rl-tag">structure</span>` +
        `<span class="rl-body">${evChips.join(' ')}</span></div>` +
      `<div class="rl rl3"><span class="rl-tag">significance</span>` +
        `<span class="rl-body">` +
          `${chip('REC', 'predict: ' + (sig.predicted.figures.join(', ') || '—'))} ` +
          `${chip('EVA', `surprise ${sig.surprisalBits} bits`)}` +
          `<span class="surprise-bar"><i style="width:${pct}%"></i></span>` +
          `<div class="rl-summary">${escapeHtml(sig.summary)}</div>` +
          `<div class="rl-pred" hidden></div>` +
        `</span></div>` +
      `<div class="rl rl4"><span class="rl-tag">enacted loop</span>` +
        `<span class="rl-body">${enactedStrip(enactedReadingTo(doc, cur))}</span></div>`;

    // The cheap (γ-mass) fold is shown above instantly; deepen it to the meaning
    // reader when the geometric organ is live and the doc is short enough to embed.
    maybeDeepen(cur);

    // Predictive coding: ask the model to read the past and predict the next
    // line, then measure the embedding distance to what actually comes. Async,
    // so it fills in after the instant mechanical pass. Skipped during play.
    const model = getModel && getModel();
    const predEl = panel.querySelector('.rl-pred');
    if (model && embedder && !playTimer && predEl) {
      const req = ++predReq;
      predEl.hidden = false;
      predEl.innerHTML = `<span class="rl-pred-tag">predicting next…</span>`;
      predictNext(doc, cur, { model, embedder }).then(p => {
        if (req !== predReq || !p) { if (req === predReq) predEl.hidden = true; return; }
        const s = Math.round(p.surprise * 100);
        predEl.innerHTML =
          `<span class="rl-pred-tag">LLM predicted next:</span> “${escapeHtml(p.prediction)}” ` +
          `<span class="rl-pred-score">embeds ${(p.similarity).toFixed(2)} → surprise ${s}%</span>`;
      }).catch(() => { if (req === predReq) predEl.hidden = true; });
    }
  };

  const stepCursor = (delta) => {
    if (!readingMode) toggleReading(true);
    let v = parseInt(slider.value, 10);
    if (v >= S) v = -1;
    v = clamp(v + delta, 0, S - 1);
    slider.value = String(v);
    applyCursor(v);
  };

  const toggleReading = (on) => {
    readingMode = on;
    wrap.querySelector('.graph-play').textContent = on ? '❚❚ Pause' : '▷ Read';
    if (on) {
      let v = parseInt(slider.value, 10);
      if (v >= S) { v = 0; slider.value = '0'; }
      applyCursor(v);
    } else {
      stopPlay();
      panel.hidden = true;
    }
  };

  const startPlay = () => {
    toggleReading(true);
    playTimer = setInterval(() => {
      let v = parseInt(slider.value, 10);
      if (v >= S - 1) { stopPlay(); return; }
      stepCursor(1);
    }, 1100);
  };
  const stopPlay = () => {
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    wrap.querySelector('.graph-play').textContent = readingMode ? '▷ Resume' : '▷ Read';
  };

  slider.addEventListener('input', () => applyCursor(parseInt(slider.value, 10)));
  wrap.querySelectorAll('.graph-step').forEach(b =>
    b.addEventListener('click', () => stepCursor(parseInt(b.dataset.d, 10))));
  wrap.querySelector('.graph-play').addEventListener('click', () =>
    playTimer ? stopPlay() : startPlay());
  wrap.querySelector('.graph-whole').addEventListener('click', () => {
    stopPlay(); toggleReading(false);
    slider.value = String(S); applyCursor(S);
  });

  const chip = (op, text) => `<span class="op ${op}" title="${op}">${escapeHtml(text)}</span>`;

  // Render the enacted-loop fold at the cursor: one row per layer showing the
  // terms the frame stands on, a strain bar (Σ surprise toward the layer's REC
  // threshold), and how many times the frame has restructured up to here. The
  // strain bar IS the protective belt filling; a REC is the belt giving way. A
  // thrash (a layer oscillating between two frames) is surfaced as the threshold
  // error it is, never hidden as turbulence (§11).
  const enactedStrip = (en) => {
    const rows = [];
    for (const layer of en.frames.keys()) {
      const f = en.frames.get(layer);
      const ratio = f.threshold ? Math.min(1, f.strain / f.threshold) : 0;
      const recN = en.stats[layer]?.recs || 0;
      const terms = (f.terms || []).slice(0, 3).join(', ') || '—';
      rows.push(
        `<div class="en-frame">` +
          `<span class="en-layer">${escapeHtml(layer)}</span>` +
          `<span class="en-terms" title="terms the frame stands on">${escapeHtml(terms)}</span>` +
          `<span class="surprise-bar en-strain" title="strain ${f.strain.toFixed(2)} / ${f.threshold} → REC">` +
            `<i style="width:${Math.round(ratio * 100)}%"></i></span>` +
          `${chip('REC', `${recN}×`)}` +
        `</div>`,
      );
    }
    const thrashing = Object.entries(en.stats).filter(([, v]) => v.thrash).map(([l]) => l);
    const note = thrashing.length
      ? `<div class="rl-summary">thrash: ${escapeHtml(thrashing.join(', '))} — threshold too low (§11)</div>`
      : '';
    return rows.join('') + note;
  };

  // Deepen the enacted strip from the γ-mass skeleton to the meaning reader: the
  // surprise becomes prediction error in the centroids' space, so frames
  // restructure on sense-turns the cheap reader is blind to (§11). Only when the
  // geometric organ is live, and only for documents short enough to embed
  // responsively — a long doc holds at the skeleton rather than block reading on
  // thousands of embeddings. The cheap strip is already on screen; this replaces
  // it when the (cached, async) meaning fold resolves. Stale folds are dropped.
  let enactReq = 0;
  const MEANING_MAX = 400;
  const maybeDeepen = (cur) => {
    if (!geometricEmbedder?.measuresMeaning || !(isGeometricLive && isGeometricLive())) return;
    if (S > MEANING_MAX) return;
    const body = panel.querySelector('.rl4 .rl-body');
    if (!body) return;
    body.insertAdjacentHTML('beforeend', `<div class="rl-summary en-deepening">meaning reader: deepening…</div>`);
    const req = ++enactReq;
    enactedReadingMeaning(doc, cur, { embedder: geometricEmbedder }).then((deep) => {
      if (req !== enactReq) return;                              // cursor moved on
      const b = panel.querySelector('.rl4 .rl-body');
      if (!b) return;
      if (!deep || deep.reader !== 'meaning') { b.querySelector('.en-deepening')?.remove(); return; }
      b.innerHTML = enactedStrip(deep) + `<div class="rl-summary">meaning reader · semantic surprise</div>`;
    }).catch(() => { panel.querySelector('.en-deepening')?.remove(); });
  };

  // ---- hover / select / drag ----------------------------------------------
  function wireNode(n, g) {
    g.addEventListener('mouseenter', () => highlight(n, true));
    g.addEventListener('mouseleave', () => { if (!dragging) highlight(n, false); hideTip(); });
    g.addEventListener('mousemove', (e) => showTip(n, e));
    g.addEventListener('pointerdown', (e) => startDrag(n, e));
    g.addEventListener('click', () => {
      if (n.first != null && onSelectSentence) onSelectSentence(n.first);
      flashSelect(n);
    });
  }

  const neighbours = (n) => {
    const set = new Set([n.id]);
    for (const l of links) {
      if (l.a === n.id) set.add(l.b);
      if (l.b === n.id) set.add(l.a);
    }
    return set;
  };

  const highlight = (n, on) => {
    svg.classList.toggle('focusing', on);
    if (!on) {
      for (const m of nodes) m.el.classList.remove('hl', 'dim');
      for (const l of links) l.el.classList.remove('hl', 'dim');
      return;
    }
    const near = neighbours(n);
    for (const m of nodes) m.el.classList.toggle('dim', !near.has(m.id));
    for (const m of nodes) m.el.classList.toggle('hl', near.has(m.id));
    for (const l of links) {
      const inc = l.a === n.id || l.b === n.id;
      l.el.classList.toggle('hl', inc);
      l.el.classList.toggle('dim', !inc);
    }
  };

  const flashSelect = (n) => {
    for (const m of nodes) m.el.classList.remove('sel');
    n.el.classList.add('sel');
  };

  // tooltip
  const showTip = (n, e) => {
    const rels = links
      .filter(l => l.a === n.id || l.b === n.id)
      .sort((x, y) => y.weight - x.weight).slice(0, 4)
      .map(l => {
        const other = l.a === n.id ? l.b : l.a;
        const via = [...l.vias.keys()][0] || 'related to';
        const dir = l.a === n.id ? `${via} →` : `← ${via}`;
        return `${dir} ${nodeById.get(other)?.label || other}`;
      });
    tip.innerHTML =
      `<strong>${escapeHtml(n.label)}</strong> · ${n.sightings} mention${n.sightings === 1 ? '' : 's'}` +
      (rels.length ? `<br>${rels.map(escapeHtml).join('<br>')}` : '');
    tip.hidden = false;
    const box = root.getBoundingClientRect();
    tip.style.left = `${e.clientX - box.left + 12}px`;
    tip.style.top  = `${e.clientY - box.top + 12}px`;
  };
  const hideTip = () => { tip.hidden = true; };

  // drag
  let dragging = null;
  const toSvg = (e) => {
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const m = svg.getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : { x: e.offsetX, y: e.offsetY };
  };
  const startDrag = (n, e) => {
    e.preventDefault();
    dragging = n; n.fixed = true;
    svg.setPointerCapture?.(e.pointerId);
    highlight(n, true);
  };
  svg.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = toSvg(e);
    dragging.x = clamp(p.x, 16, W - 16);
    dragging.y = clamp(p.y, 16, H - 16);
    draw();
  });
  const endDrag = () => {
    if (!dragging) return;
    highlight(dragging, false);
    dragging = null; reheat();
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  raf = requestAnimationFrame(step);

  return {
    setCursor(idx) {
      const v = (idx == null || idx >= S) ? S : Math.max(0, Math.min(S, idx | 0));
      slider.value = String(v);
      applyCursor(v);
    },
    reheat,
    destroy() { stopPlay(); if (raf) cancelAnimationFrame(raf); root.innerHTML = ''; },
  };
};

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const noop = () => ({ setCursor() {}, reheat() {}, destroy() {} });
const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
