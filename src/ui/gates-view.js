// The Gates view — the limits on the logits, watched live.
//
// Every other tab shows what the reader FOUND; this one shows what the reader is not
// allowed to SAY. The lens port (src/write/lens-port.js) is a LogitProcessor: it reshapes
// the model's next-token distribution during decode, through the same lens the reading was
// taken through. One equation governs it —
//
//   bias(token, t) = g(H_t) · [ λ·personality(token) + μ·relevance(token | surf_t) ] + void(token)
//
//   • void        — the conscience, moved PRE-HOC: a numeral/date gate and a permitted-
//                   entity trie clamp ungrounded fact-bearing tokens to −∞. It sits OUTSIDE
//                   the entropy gate — a conscience does not relax where the model is
//                   confident — and suppresses facts, never grammar. This is the HARD limit.
//   • relevance μ — the surfer's Born-rule salience over figures, up-weighting the tokens
//                   that name what the reading is about. A soft, gated bias.
//   • personality λ — the Horizon's departure from σ, projected to tokens (the pantheon
//                   gods). Identically zero on a Horizon that has not committed.
//   • g(H_t)      — the entropy gate: 0 where the model is forced (grammar, connective
//                   tissue — perturbing it only breaks fluency) rising to 1 at a content
//                   choice point, exactly where salience should decide.
//
// Two registers, both real time:
//
//   LIVE TAPE — the model's `onLensEvent` feed (WebLLM + Lens on), forwarded token by
//   token: each void-gate suppression, each masked-name void-conflict, each span-gated
//   re-grounding, as it fires. Watch a number get clamped, or an invented name hit the
//   wall of the entity trie, the instant the decoder reaches for it.
//
//   TURN CARDS — read off the audit (audit.subscribe), one card per prompted turn, newest
//   first, updating the moment the `llm` step lands: how hard the logits were held this
//   turn (numerals suppressed, names masked, conflicts, re-groundings), which pantheon
//   gods mounted the voice, and the standing frame the logits decoded inside (register,
//   token ceiling, void terrain).
//
// The lens port is OFF by default — the golden path decodes with unconstrained logits. The
// surface says so honestly rather than drawing empty meters: no lens, no limit to show.
//
// The DOM-free surface (readLogitGates, describeEvent, EVENT_STYLE) is exported so CI
// exercises it without a browser, the way the other views expose their pure cores.

// ── the pure core (exported for tests) ────────────────────────────────────────────────

// The steering equation, as one string — the persistent header, so the limits are named
// even before a turn runs. The UI bolds the terms; this is the plain text.
export const STEERING_EQUATION =
  'bias(token) = g(H) · [ λ·personality + μ·relevance ] + void';

const stepData = (turn, name) => turn?.steps?.find(s => s.name === name)?.data || null;

// readLogitGates — project one audit turn onto the limits that governed its logits. Pure;
// tolerant of a partial (in-flight) turn — a stage not yet reached simply reads null/false,
// so the card fills in live as the pipeline folds forward.
export const readLogitGates = (turn) => {
  if (!turn) return null;
  const route = stepData(turn, 'route');
  const llm   = stepData(turn, 'llm');
  const ans   = stepData(turn, 'answerable');
  const lens  = llm?.lens || null;              // present only when the lens port steered

  const mounted = (lens?.mounted || []).map(m => ({
    god: m.god, op: m.op, weight: m.weight, locked: !!m.locked,
  }));

  return {
    id:        turn.id,
    question:  turn.question || '',
    finished:  turn.finishedAt != null,
    route:     turn.route || route?.route || null,
    grounding: turn.grounding || route?.grounding || null,
    // Did the lens port actually reshape the logits this turn? True iff the llm step
    // carried lens provenance (webllm + Lens on + doc/surf in hand). Off → golden path.
    lensOn:    !!lens,
    maxTokens: llm?.maxTokens ?? null,          // the length ceiling the decode ran under
    reached:   llm != null,                     // the llm stage has run (logits were drawn)
    // The void gate's measured bite this turn.
    void: lens ? {
      suppressed:    lens.suppressed    || 0,   // numeral/date logits clamped to −∞
      voidConflicts: lens.voidConflicts || 0,   // a masked name/number the model reached for
      regrounded:    lens.regrounded    || 0,   // a span re-grounded a masked surface → trie widened
      events:        lens.events        || 0,   // total steering events logged
    } : null,
    mounted,                                    // the personality (λ) gods that voiced this turn
    // The frame the logits decoded inside — not logit-level, but the standing limits around them.
    voidTerrain: ans?.terrain === 'void' ? (ans.kind || 'void') : null,
    // The outcome the limits produced.
    gated:  !!turn.gated,                       // a gate substituted a decline / regenerated
    voided: !!turn.gatedVoided,                 // the collapse gate voided (nothing grounded)
    flags:  (turn.flags || []).map(f => ({ id: f.id, message: f.message, refuses: !!f.refuses })),
  };
};

// Per-event presentation for the live tape. Each lens-port event names a distinct limit
// firing; the style carries the severity colour and the phrasing.
export const EVENT_STYLE = {
  reset:           { cls: 'lg-ev-reset', icon: '↺', label: 'decode ground restored' },
  suppress:        { cls: 'lg-ev-suppress', icon: '⊘', label: 'void gate' },
  'void-conflict': { cls: 'lg-ev-conflict', icon: '⚠', label: 'void-conflict' },
  rec:             { cls: 'lg-ev-rec', icon: '↑', label: 're-ground' },
};

// describeEvent — one live-tape line for a raw lens-port event. Pure string; the mount
// wraps it in the coloured row. Unknown event types degrade to their JSON, never dropped.
export const describeEvent = (ev) => {
  if (!ev || typeof ev !== 'object') return '';
  switch (ev.type) {
    case 'reset':
      return 'decode reset — the logits return to the maximally-mixed ground between turns';
    case 'suppress':
      return `void gate suppressed ${ev.n || 0} ${ev.kind || 'fact'}-shaped logit${(ev.n || 0) === 1 ? '' : 's'} → −∞ (ungrounded, not carried by any span)`;
    case 'void-conflict': {
      const surf = ev.surface ? `“${ev.surface}”` : 'a masked token';
      const why = ev.reason === 'entity-trie'
        ? 'the model reached for a name past the grounded entity trie'
        : 'the model reached for an ungrounded number';
      return `void-conflict — ${surf}: ${why}. Masks would empty the nucleus, so the unbiased argmax survives (logged for review).`;
    }
    case 'rec':
      return ev.supported
        ? `re-grounded “${ev.surface}” — a source span justifies it, so the trie widens (the gate tightens without new holes)`
        : `“${ev.surface}” logged for review — no span supports it, so the limit holds`;
    default:
      try { return JSON.stringify(ev); } catch { return String(ev); }
  }
};

// ── the mount (the DOM half) ──────────────────────────────────────────────────────────

const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TAPE_CAP = 140;   // the live tape is a ring — the last N logit interventions

// mountGates — wire the surface once. `getAudit` returns the session audit (the turn
// cards); `getModel` returns the live model (the per-token tape, when it exposes
// onLensEvent). Returns { refresh } like the sibling views; app.js re-renders on tab open.
export const mountGates = (root, { getAudit, getModel, onSelectSentence } = {}) => {
  root.classList.add('lg-root');
  root.innerHTML = `
    <div class="lg-head">
      <div class="lg-title">The limits on the logits</div>
      <div class="lg-eq">${equationHtml()}</div>
      <div class="lg-legend">
        <span class="lg-lamp lg-void">void</span> hard −∞ on ungrounded facts ·
        <span class="lg-lamp lg-mu">μ relevance</span> up-weights the reading's figures ·
        <span class="lg-lamp lg-lambda">λ personality</span> the mounted voice ·
        <span class="lg-lamp lg-gate">g(H)</span> forced ↔ open
      </div>
    </div>
    <div class="lg-tape-wrap">
      <div class="lg-subhead">Live · logit interventions as they fire <span class="lg-tape-status" data-role="tape-status">waiting for a steered decode…</span></div>
      <div class="lg-tape" data-role="tape"></div>
    </div>
    <div class="lg-subhead">Per turn · how hard the logits were held</div>
    <div class="lg-turns" data-role="turns"><div class="lg-empty">Ask something with the Lens port on (WebLLM) to see the logits steered. With Lens off, the golden path decodes unconstrained — no limit to show.</div></div>
  `;
  const tapeEl   = root.querySelector('[data-role="tape"]');
  const tapeStat = root.querySelector('[data-role="tape-status"]');
  const turnsEl  = root.querySelector('[data-role="turns"]');

  // ── the live tape: subscribe to the model's per-token logit-limit feed ───────────────
  let unsubModel = null;
  let wiredModel = null;      // the model instance the tape is currently subscribed to
  let tapeCount = 0;
  const pushTape = (ev) => {
    const style = EVENT_STYLE[ev?.type] || { cls: 'lg-ev-other', icon: '·', label: ev?.type || 'event' };
    const row = document.createElement('div');
    row.className = `lg-ev ${style.cls}`;
    row.innerHTML =
      `<span class="lg-ev-icon">${style.icon}</span>` +
      `<span class="lg-ev-t">t${ev?.t ?? ''}</span>` +
      `<span class="lg-ev-text">${escapeHtml(describeEvent(ev))}</span>`;
    tapeEl.insertBefore(row, tapeEl.firstChild);
    while (tapeEl.childElementCount > TAPE_CAP) tapeEl.removeChild(tapeEl.lastChild);
    tapeStat.textContent = `${++tapeCount} interventions this session`;
  };
  const wireModel = () => {
    const model = getModel?.();
    if (model === wiredModel) return;       // already wired to this exact instance
    // The model changed (lazy load, or a backend switch) — drop the stale subscription.
    try { unsubModel?.(); } catch { /* best-effort */ }
    unsubModel = null; wiredModel = model || null;
    if (!model || typeof model.onLensEvent !== 'function') {
      // No lens port on this backend (echo/structure, or WebLLM not yet loaded). The tape
      // stays honest; a later re-open re-checks (models load lazily, refresh() re-runs this).
      tapeStat.textContent = 'this backend has no lens port — logits decode unconstrained';
      return;
    }
    tapeStat.textContent = 'armed — watching the decoder';
    unsubModel = model.onLensEvent(pushTape);
  };

  // ── the turn cards: subscribe to the audit ───────────────────────────────────────────
  const audit = getAudit?.();
  const renderTurn = (turn) => {
    if (!turn?.question) return;            // skip the empty scaffold turn
    const model = readLogitGates(turn);
    if (!model) return;
    const existing = turnsEl.querySelector(`.lg-turn[data-id="${model.id}"]`);
    const el = renderTurnCard(model);
    if (existing) existing.replaceWith(el);
    else {
      const empty = turnsEl.querySelector('.lg-empty');
      if (empty) empty.remove();
      turnsEl.insertBefore(el, turnsEl.firstChild);
    }
  };
  const unsubAudit = audit?.subscribe?.(renderTurn);
  // Backfill any turns already run before the tab was first opened.
  for (const t of (audit?.turns || [])) renderTurn(t);

  const refresh = () => { wireModel(); };
  wireModel();

  return {
    refresh,
    cleanup: () => { try { unsubModel?.(); } catch {} try { unsubAudit?.(); } catch {} },
  };
};

// equationHtml — the steering equation with each term wrapped so the CSS can colour it.
const equationHtml = () =>
  `<span class="lg-eq-out">bias</span> = ` +
  `<span class="lg-gate">g(H)</span> · [ ` +
  `<span class="lg-lambda">λ·personality</span> + ` +
  `<span class="lg-mu">μ·relevance</span> ] + ` +
  `<span class="lg-void">void</span>`;

// renderTurnCard — one turn's logit limits as a card. Newest first; live-updates in place
// as the pipeline folds forward (the card is rebuilt on every audit notify for this turn).
const renderTurnCard = (m) => {
  const el = document.createElement('div');
  el.className = 'lg-turn' + (m.finished ? '' : ' in-flight');
  el.dataset.id = m.id;

  const chips = [];
  if (m.route)     chips.push(`<span class="lg-chip">${escapeHtml(m.route)}</span>`);
  if (m.maxTokens) chips.push(`<span class="lg-chip" title="the token ceiling the decode ran under">≤ ${m.maxTokens} tok</span>`);
  if (m.voidTerrain) chips.push(`<span class="lg-chip lg-chip-void" title="the field the answer was drawn from typed VOID — the reading found nothing there">void terrain · ${escapeHtml(m.voidTerrain)}</span>`);

  // The logit-limit body: either the measured void bite + mounted voice, or the honest
  // "unconstrained" note when the lens port did not steer this turn.
  let body;
  if (m.lensOn && m.void) {
    const v = m.void;
    body =
      `<div class="lg-meters">` +
        meter('lg-void',   '⊘ void gate',  `${v.suppressed} logits → −∞`, v.suppressed > 0) +
        meter('lg-conflict', '⚠ conflicts', `${v.voidConflicts} reached past the field`, v.voidConflicts > 0) +
        meter('lg-rec',    '↑ re-grounded', `${v.regrounded} span-widened`, v.regrounded > 0) +
        meter('lg-mu',     'μ relevance',  m.mounted.length || v.events ? 'steering active' : 'armed', true) +
      `</div>` +
      mountedHtml(m.mounted);
  } else if (m.reached) {
    body = `<div class="lg-unconstrained">Logits unconstrained this turn — the lens port did not steer (golden path). The token distribution was the model's own.</div>`;
  } else {
    body = `<div class="lg-unconstrained">No model call — this turn was answered mechanically or short-circuited before the decoder.</div>`;
  }

  const flags = m.flags.length
    ? `<div class="lg-flags">` + m.flags.map(f =>
        `<span class="lg-flag${f.refuses ? ' refuses' : ''}" title="${escapeHtml(f.message || '')}">${escapeHtml(f.id)}</span>`).join('') +
      `</div>`
    : '';
  const outcome = m.gated
    ? `<span class="lg-outcome gated" title="a gate substituted a decline or made the model answer again">gated${m.voided ? ' · voided' : ''}</span>`
    : '';

  el.innerHTML =
    `<div class="lg-turn-head">` +
      `<span class="lg-q">${escapeHtml(m.question)}</span>` +
      `<span class="lg-chips">${chips.join('')}${outcome}</span>` +
    `</div>` +
    body + flags;
  return el;
};

// A single measured limit, shown as a labelled readout that lights when it bit this turn.
const meter = (cls, label, value, active) =>
  `<span class="lg-meter ${cls}${active ? ' hot' : ''}">` +
    `<span class="lg-meter-l">${label}</span>` +
    `<span class="lg-meter-v">${escapeHtml(value)}</span>` +
  `</span>`;

// The pantheon gods that mounted the voice (the λ term): each an operator face steering at
// its own weight, locked when the field pinned it (a NUL-on-VOID lock cannot be overridden).
const mountedHtml = (mounted) => {
  if (!mounted?.length) return '';
  const gods = mounted.map(m =>
    `<span class="lg-god" title="${escapeHtml(m.op || '')} face, weight ${m.weight}${m.locked ? ' (locked)' : ''}">` +
      `${escapeHtml(m.god)}${m.locked ? ' 🔒' : ''} <span class="lg-god-w">${fmtW(m.weight)}</span>` +
    `</span>`).join('');
  return `<div class="lg-gods"><span class="lg-gods-l">λ voice:</span>${gods}</div>`;
};

const fmtW = (w) => (Number.isFinite(w) ? (Math.round(w * 100) / 100).toString() : '');
