// The Rest view — the instrument still reading after the first pass. (SPEC §15/§16)
//
// Load a document and the perceiver reads it once. That first ingress resolves
// what it can at first sighting — but some referents arrive thin: introduced and
// barely connected, named only later, or left genuinely void. This view is the
// §15 idle loop pointed at THAT open set: it keeps working the voids the first
// read left, and as you let it process further it surfaces — from later in the
// SAME document — what it could not learn at ingress.
//
// Everything load-bearing is the real engine (src/write/): the fold + integral,
// the open-Resolution ledger (voids.js), the governed idle loop (idle.js). What
// the loop surfaces is REAFFERENT by construction (§8) — dashed, "you decide",
// canGround === false — and only YOUR confirm (the witness act) grounds it and
// closes the gap. The genuine voids (a referent nothing later resolves) stay open:
// the instrument never invents what the text leaves void.
//
// The open set is derived from the REAL projected graph (core/project.js):
// entities the first-ingress horizon left under-characterized, with the relations
// a deeper read folds in. The DOM-free surface (deriveOpen / buildIdle) is exported
// so CI exercises the derivation + the engine wiring without a browser.

import { createFold } from '../write/fold.js';
import { createIdleLoop, seededRng } from '../write/idle.js';
import { openLedger } from '../write/voids.js';
import { firm } from '../core/index.js';
import { restIconSvg, restStateLabel } from './rest-icon.js';
import { buildDream, renderDream } from './dream-view.js';

// ── the derivation: what the first ingress left open (pure) ──────────────────
// Read the projected graph and split each entity's edges at an INGRESS HORIZON (a
// sentence index): the early read vs. the rest of the document. An entity is OPEN
// when it appeared at ingress but the first read left it thin — un-characterized
// (no early relation → void identity) or barely connected (one early relation →
// hedged) — or the reader explicitly marked it void. `deeper` carries the relations
// a later pass folds in, each citing the sentence it was read from.
export const deriveOpen = (doc, { horizonFrac = 0.34, minSightings = 3 } = {}) => {
  const g = doc.projectGraph ? doc.projectGraph() : { entities: new Map(), edges: [], voids: [], representative: (x) => x };
  const sentences = doc.sentences || [];
  // Clip to the document BODY — a Project Gutenberg file wraps the work in a header
  // and a license footer (prose that parses into "Foundation"/"Royalty" entities and
  // would drown the story). The standard *** START/END OF *** markers delimit the
  // body; absent them this is the whole document. Chrome the parser already held
  // (NUL) never produced edges, so this only adds the footer the detector misses.
  const [lo, hi] = bodyBounds(sentences);
  const inBody = (i) => i != null && i >= lo && i < hi;
  const H = lo + Math.max(2, Math.floor((hi - lo) * horizonFrac));   // the initial-ingress horizon, within the body
  const rep = g.representative || ((x) => x);
  const labelOf = (id) => g.entities.get(rep(id))?.label || g.entities.get(id)?.label || id;

  const edgesByEnt = new Map();
  for (const e of g.edges) {
    if (!inBody(e.sentIdx)) continue;                     // story edges only, not the license
    for (const end of [rep(e.from), rep(e.to)]) {
      if (!edgesByEnt.has(end)) edgesByEnt.set(end, []);
      edgesByEnt.get(end).push(e);
    }
  }
  const voidNodes = new Set((g.voids || []).filter(v => inBody(v.sentIdx)).map(v => rep(v.node)));
  const S = hi;

  const cand = [];                 // { id, head, band, why, firstIdx, sightings }
  const deeper = new Map();        // id → [{ via, other, sentIdx }]  (the later read)
  for (const [id, ent] of g.entities) {
    if (rep(id) !== id) continue;  // only canonical referents (merged aliases fold in)
    const head = ent.label || id;
    const es = (edgesByEnt.get(id) || []).slice().sort((a, b) => (a.sentIdx ?? 0) - (b.sentIdx ?? 0));
    const firstIdx = es.length ? (es[0].sentIdx ?? 0) : 0;
    const early = es.filter(e => (e.sentIdx ?? 0) < H);
    const late  = es.filter(e => (e.sentIdx ?? 0) >= H);
    const isVoid = voidNodes.has(id);
    if (es.length === 0 && !isVoid) continue;            // no story relation at all → a footer/license term, not a referent in play

    // appeared at ingress (first mention in the early read, or it recurs), and the
    // first read left it thin (≤1 early relation) — or it was marked void.
    const appearedAtIngress = firstIdx < H || (ent.sightings || 0) >= 2;
    const thin = early.length <= 1 || isVoid;
    const worthIt = isVoid || late.length > 0 || (ent.sightings || 0) >= 2;
    if (!(appearedAtIngress && thin && worthIt)) continue;

    const band = (isVoid || early.length === 0) ? 'void' : 'hedged';
    const why = isVoid ? 'the first read marked its identity unresolved'
      : early.length === 0 ? 'introduced early, not yet characterized'
      : 'mentioned once — barely connected at first sight';
    cand.push({ id, head, band, why, firstIdx, sightings: ent.sightings || 0 });
    deeper.set(id, late.map(e => ({
      via: e.via || e.kind || 'relates to',
      other: labelOf(rep(e.from) === id ? e.to : e.from),
      sentIdx: e.sentIdx ?? null,
      text: clip(sentences[e.sentIdx]),               // the exafferent passage that resolves it
    })).filter(d => d.other && d.other !== head));
  }
  // The recurrence cut. A referent the reader WORKS recurs through the discourse;
  // a capitalized word the parser over-promoted once or twice does not. Rather than
  // a fixed number, the floor is RELATIVE to the strongest open thread (so it scales
  // with the document) with a small absolute minimum — the same "let the signal set
  // the threshold" discipline as the void boundary. Incidental words fall below it.
  const peak = cand.reduce((m, c) => Math.max(m, c.sightings), 0);
  const floor = Math.max(minSightings, peak * 0.2);
  const open = cand
    .filter(c => c.sightings >= floor)
    .sort((a, b) => b.sightings - a.sightings || (deeper.get(b.id)?.length || 0) - (deeper.get(a.id)?.length || 0));
  return { open, deeper, horizon: H, S };
};

// ── build the live idle state over the real open set (pure; no DOM) ──────────
// Construct the write-faculty fold from the open referents (void → void attr;
// hedged → firm low-p), the resolution map, and the governed idle loop whose surf
// is the DEEPER READ: it resolves a void only once processing has reached the
// sentence that carries the resolving relation. Returns everything the view drives.
export const buildIdle = (doc, opts = {}) => {
  const { open, deeper, horizon, S } = deriveOpen(doc, opts);
  const fold = createFold();
  const resolution = new Map();
  const whyById = new Map();
  for (const o of open) {
    fold.appear(o.id, { head: o.head });
    // VOID identity → leave it INS-without-DEF: openLedger bands it `void`, and a
    // later confirm RECORDS a firm descriptor that settles it (a lingering void
    // attribute could never be closed — the dossier is append-only). HEDGED → a firm
    // but low-p descriptor, which a confirm firms up.
    if (o.band === 'hedged') {
      fold.record(o.id, { t: o.firstIdx, op: 'DEF', attr: o.why, res: 'firm' });
      resolution.set(o.id, firm(0.4));
    }
    whyById.set(o.id, o.why);
  }
  const resolved = new Set();
  // the surf: re-surf the open set against what has been PROCESSED so far (`reach`,
  // a sentence index carried on the arrival). A void resolves only when a deeper
  // relation for it sits within reach — anchored in the document, never invented.
  const surf = ({ void: v, docs }) => {
    const reach = Math.max(horizon, ...docs.map(d => d.reach ?? horizon));
    const later = (deeper.get(v.rid) || []).filter(e => (e.sentIdx ?? Infinity) <= reach);
    if (later.length && !resolved.has(v.rid)) {
      resolved.add(v.rid);
      return { rec: 0.9, bearsOn: later[0] };
    }
    const progressLeft = [...deeper.keys()].some(id =>
      !resolved.has(id) && (deeper.get(id) || []).some(e => (e.sentIdx ?? Infinity) <= reach));
    return { rec: progressLeft ? 0.3 : 0.0 };       // keep surfing while progress remains; settle when none
  };
  const idle = createIdleLoop({ fold, surf, medianBand: 0.1, rng: seededRng(7), enactment: doc.docId || 'reading-on', resolution });
  return { fold, resolution, deeper, idle, open, horizon, S, resolved, whyById };
};

// bodyBounds — the sentence range of the work itself, between Project Gutenberg's
// standard *** START OF *** / *** END OF *** markers. Returns [lo, hi) over the
// sentence list; absent the markers, the whole document (so a plain file is
// unaffected). A widely-used convention, not a doc-specific hack.
export const bodyBounds = (sentences = []) => {
  let lo = 0, hi = sentences.length;
  const s = sentences.findIndex(x => /\*\*\*\s*START OF/i.test(x));
  const e = sentences.findIndex(x => /\*\*\*\s*END OF/i.test(x));
  if (s >= 0) lo = s + 1;
  if (e >= 0 && e > lo) hi = e;
  return [lo, hi];
};

// clip a sentence to a readable excerpt (the deeper read's evidence).
const clip = (s) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= 130 ? t : t.slice(0, 128).replace(/\s+\S*$/, '') + '…';
};

// The human-readable form of a learned candidate. When the resolving passage is
// known, lead with it (the exafferent evidence, grounded by its cite); otherwise
// fall back to the typed relation read deeper in the document.
export const summarizeCandidate = (head, bearsOn) => {
  const cite = bearsOn.sentIdx != null ? ` (c${bearsOn.sentIdx})` : '';
  return bearsOn.text
    ? `${head} — “${bearsOn.text}”${cite}`
    : `Further on, ${head} ${bearsOn.via} ${bearsOn.other}${cite}`;
};

// ── the view ──────────────────────────────────────────────────────────────
export const mountIdle = (root, { getDoc, onSelectSentence } = {}) => {
  let built = null;            // the doc the current state was built from
  let st = null;              // { fold, resolution, deeper, idle, open, horizon, S, resolved }
  let reach = 0;             // the sentence index processed up to (the deeper read)
  let cands = [];            // surfaced reafferent candidates awaiting your verdict
  let phase = 'resting';     // resting | surfing — drives the field
  let dream = null;          // the last night's report (buildDream) — null until told to dream
  let raf = 0, amp = 2, targetAmp = 2, t = 0;

  const empty = () => {
    built = null; st = null; cands = []; dream = null;
    stopField();
    root.innerHTML = `<div class="feed-empty">Load a document, then come back here to watch the instrument keep ` +
      `working what the first read left open — referents it introduced but could not yet characterize, names ` +
      `given only later, relations still hedged. It re-reads on its own; what it finds is yours to confirm.</div>`;
  };

  const refresh = () => {
    const doc = getDoc?.();
    if (!doc) { empty(); return; }
    if (doc === built && st) return;
    try {
      st = buildIdle(doc);
      built = doc;
      reach = st.horizon;
      cands = [];
      dream = null;
      phase = 'resting';
      render();
      startField();
    } catch (err) {
      root.innerHTML = `<div class="feed-empty">could not read the open set — ${escapeHtml(String(err?.message || err))}</div>`;
    }
  };

  // process further: extend the read, run the governed idle loop, collect what it
  // learns. One arrival drains every void the new reach can resolve, then quiesces.
  const processFurther = () => {
    if (!st || reach >= st.S) return;
    const step = Math.max(1, Math.ceil((st.S - st.horizon) / 3));
    reach = Math.min(st.S, reach + step);
    phase = 'surfing'; targetAmp = 13; render();
    // let the field show motion, then run the (synchronous) loop and settle
    setTimeout(() => {
      const r = st.idle.arrive({ reach });
      for (const c of r.candidates) {
        const head = st.fold.headOf(c.rid);
        cands.unshift({ id: c.rid + ':' + (c.body.sentIdx ?? cands.length), rid: c.rid, head, body: c.body, cand: c });
      }
      phase = 'resting'; targetAmp = 2; render();
    }, 520);
  };

  const restNow = () => { phase = 'resting'; targetAmp = 2; if (st) st.reach = reach; render(); };

  // dreamNow — tell the model to DREAM: hold the frontier still and run a night over the
  // document's real graph — prune the spurious, re-project the loud day toward baseline,
  // and (the dreamer) strengthen the meaningful-but-untraversed, Born-weighted. What it
  // produces is hypotheses; the panel shows the pruning and the strengthening side by side.
  const dreamNow = () => {
    const doc = getDoc?.();
    if (!doc) return;
    phase = 'resting'; targetAmp = 6;
    try { dream = buildDream(doc); }
    catch (err) { dream = { error: String(err?.message || err) }; }
    render();
  };
  const wakeFromDream = () => { dream = null; targetAmp = 2; render(); };

  // confirm = the witness act (§16): ground the candidate and CLOSE the gap. The
  // engine records a firm descriptor, the referent leaves the open set, and we jump
  // to the sentence it was read from so the closure is legible in the text.
  const confirm = (key) => {
    const c = cands.find(x => x.id === key);
    if (!c || !st) return;
    st.idle.confirm(c.cand, { by: 'human' });
    st.fold.record(c.rid, { t: c.body.sentIdx ?? reach, op: 'DEF', attr: `${c.body.via} ${c.body.other}`, res: 'firm' });
    st.resolution.set(c.rid, firm(0.85));
    cands = cands.filter(x => x.id !== key);
    render();
    if (c.body.sentIdx != null) onSelectSentence?.(c.body.sentIdx);
  };
  const dismiss = (key) => { cands = cands.filter(x => x.id !== key); render(); };

  const render = () => {
    if (!st) return;
    const ledger = openLedger(st.fold, { resolution: st.resolution });
    const done = reach >= st.S;
    const stateName = phase === 'surfing' ? 'surfing' : (done && !cands.length ? 'rested' : 'resting');
    root.innerHTML =
      `<div class="iv-wrap">` +
        `<div class="iv-field">` +
          `<div class="iv-top">` +
            // a little phosphor-esque glyph for the current posture — eye open while
            // surfing, the moon once it rests (rest-icon.js; docs/how-to-rest.md).
            `<span class="iv-state ${phase}">${restIconSvg(stateName, { size: 15, title: restStateLabel(stateName) })}${stateName}</span>` +
            `<span class="iv-tele">read through c${Math.min(reach, st.S)} / ${st.S} · ${ledger.length} open</span>` +
          `</div>` +
          `<canvas class="iv-canvas" width="600" height="48" aria-hidden="true"></canvas>` +
          `<div class="iv-note">${phase === 'surfing' ? 're-surfing the open set against what was just read' : (done ? 'nothing more to fold in — the rest is genuinely open' : 'idle — re-reads on its own; it will not call you back')}</div>` +
        `</div>` +

        `<div class="iv-sec-h">Open<span class="iv-rule"></span></div>` +
        `<div class="iv-sub">what the first read could not settle — where reading on can still pay</div>` +
        `<div class="iv-open">` +
          (ledger.length ? ledger.map(openRow).join('') :
            `<div class="feed-empty">The first read characterized everything it saw — nothing left open.</div>`) +
        `</div>` +

        `<div class="iv-sec-h">Noticed on a deeper read<span class="iv-rule"></span></div>` +
        `<div class="iv-sub">unconfirmed — read from later in the document, never decided for you</div>` +
        `<div class="iv-cands">` +
          (cands.length ? cands.map(candCard).join('') :
            `<div class="feed-empty">${done ? 'Nothing more surfaced. The remaining open questions are voids the text never resolves.' : 'Nothing yet — let it process further.'}</div>`) +
        `</div>` +

        `<div class="iv-drive">` +
          `<button type="button" class="small iv-more"${done ? ' disabled' : ''}>Process further ▸</button>` +
          `<button type="button" class="small iv-rest">Let it rest</button>` +
          `<button type="button" class="small iv-dream">Dream ☾</button>` +
          (dream ? `<button type="button" class="small iv-wake">Wake</button>` : '') +
        `</div>` +
        (dream
          ? (dream.error
              ? `<div class="feed-empty">could not dream — ${escapeHtml(dream.error)}</div>`
              : renderDream(dream))
          : '') +
      `</div>`;

    root.querySelector('.iv-more')?.addEventListener('click', processFurther);
    root.querySelector('.iv-rest')?.addEventListener('click', restNow);
    root.querySelector('.iv-dream')?.addEventListener('click', dreamNow);
    root.querySelector('.iv-wake')?.addEventListener('click', wakeFromDream);
    root.querySelectorAll('[data-confirm]').forEach(b => b.addEventListener('click', () => confirm(b.dataset.confirm)));
    root.querySelectorAll('[data-dismiss]').forEach(b => b.addEventListener('click', () => dismiss(b.dataset.dismiss)));
    root.querySelectorAll('[data-idx]').forEach(b => b.addEventListener('click', () => onSelectSentence?.(parseInt(b.dataset.idx, 10))));
    bindCanvas();
  };

  const openRow = (e) => {
    const why = st.whyById.get(e.rid) || e.reason || '';
    return `<div class="iv-q">` +
      `<div><div class="iv-qt">${escapeHtml(st.fold.headOf(e.rid))}</div><div class="iv-qr">${escapeHtml(e.rid)} — ${escapeHtml(why)}</div></div>` +
      `<span class="iv-band ${e.band}">${e.band}</span>` +
    `</div>`;
  };

  const candCard = (c) =>
    `<div class="iv-cand">` +
      `<div class="iv-tag">⟂ candidate · unconfirmed · bears on ${escapeHtml(c.head)}` +
        (c.body.sentIdx != null ? ` · <span class="iv-cite" data-idx="${c.body.sentIdx}">c${c.body.sentIdx}</span>` : '') + `</div>` +
      `<div class="iv-body">${escapeHtml(summarizeCandidate(c.head, c.body))}</div>` +
      `<div class="iv-acts">` +
        `<button type="button" class="small iv-ok" data-confirm="${escapeHtml(c.id)}">Confirm — make it yours</button>` +
        `<button type="button" class="small" data-dismiss="${escapeHtml(c.id)}">Dismiss</button>` +
      `</div>` +
    `</div>`;

  // ── the field signature (canvas) ──
  let cv = null, ctx = null;
  const bindCanvas = () => { cv = root.querySelector('.iv-canvas'); ctx = cv?.getContext('2d') || null; };
  const startField = () => {
    if (raf || typeof requestAnimationFrame !== 'function') return;
    if (matchMedia?.('(prefers-reduced-motion:reduce)')?.matches) return;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!ctx || !cv) return;
      amp += (targetAmp - amp) * 0.06; t += phase === 'surfing' ? 0.05 : 0.012;
      const w = cv.width, h = cv.height, mid = h / 2;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = phase === 'surfing' ? 'rgba(147,197,253,.85)' : 'rgba(110,231,183,.5)';
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const k = x / w * Math.PI * 6;
        const env = phase === 'surfing' ? (0.6 + 0.4 * Math.sin(x / w * Math.PI)) : 1;
        const y = mid + Math.sin(k + t) * amp * env;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
  };
  const stopField = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

  empty();
  return { refresh };
};

const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
