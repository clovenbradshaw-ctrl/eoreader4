// The log view — see the append-only log the graph is a fold of, organised by
// the recursive levels of reading. The graph is not the source of truth; this
// is. Each level reads what the level below admitted and refines it, so the
// meaning is approached in passes, never decided in one:
//
//   Pass 0 · conventions   REC          what the document taught the reader
//   Level 1 · existence    NUL · INS    what is held, what is admitted
//   Level 2 · structure    SYN CON SIG DEF SEG   how figures bond and merge
//   Level 3 · significance DEF role     the role a unit plays (site vs figure)
//
// Every event traces to the line it came from — click [sN] to jump there.

const LEVELS = [
  { key: 'p0', name: 'Pass 0 · conventions', note: 'what this document taught the reader',
    match: (e) => e.op === 'REC' },
  { key: 'l1', name: 'Level 1 · existence', note: 'lines held, figures admitted — counting',
    match: (e) => e.op === 'NUL' || e.op === 'INS' },
  { key: 'l2', name: 'Level 2 · structure', note: 'bonds, attributions, syntheses — the graph',
    match: (e) => e.op === 'CON' || e.op === 'SIG' || e.op === 'SYN' || e.op === 'SEG' ||
                  (e.op === 'DEF' && e.key !== 'role') },
  { key: 'l3', name: 'Level 3 · significance / role', note: 'the role a unit plays — semantic',
    match: (e) => (e.op === 'DEF' && e.key === 'role') || e.op === 'EVA' },
];

export const renderLog = (doc, root, { onSelectSentence } = {}) => {
  root.innerHTML = '';
  if (!doc || !doc.log) {
    root.innerHTML = `<div class="graph-empty">No document yet — the event log appears here once one is read.</div>`;
    return;
  }
  const events = doc.log.events || doc.log.snapshot?.() || [];
  const label = new Map();
  for (const e of events) if (e.op === 'INS' && !label.has(e.id)) label.set(e.id, e.label);
  const name = (id) => label.get(id) || id;

  const head = document.createElement('div');
  head.className = 'log-head';
  head.innerHTML =
    `<div class="log-title">${events.length} events — the graph is a fold of this log</div>` +
    `<div class="log-sub">each level reads what the one below admitted, approaching the meaning in passes</div>`;
  root.appendChild(head);

  for (const lvl of LEVELS) {
    const evs = events.filter(lvl.match);
    if (evs.length === 0) continue;
    const sec = document.createElement('div');
    sec.className = 'log-level';
    sec.innerHTML =
      `<div class="log-level-head"><span class="op ${opOf(evs[0])}">${lvl.name}</span>` +
      `<span class="log-count">${evs.length}</span><span class="log-note">${lvl.note}</span></div>`;
    const list = document.createElement('div');
    list.className = 'log-rows';
    for (const e of evs) list.appendChild(row(e, name));
    sec.appendChild(list);
    root.appendChild(sec);
  }

  root.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-idx]');
    if (a && onSelectSentence) onSelectSentence(parseInt(a.dataset.idx, 10));
  });
};

const opOf = (e) => (e.op === 'DEF' && e.key === 'role') ? 'SEG' : e.op;

const row = (e, name) => {
  const el = document.createElement('div');
  el.className = 'log-row';
  const src = e.sentIdx != null ? `<span class="log-cite" data-idx="${e.sentIdx}">s${e.sentIdx}</span>` : '';
  el.innerHTML = `<span class="op ${e.op}">${e.op}</span><span class="log-desc">${describe(e, name)}</span>${src}`;
  return el;
};

const describe = (e, name) => {
  const esc = escapeHtml;
  switch (e.op) {
    case 'REC': return `learn: “${esc(e.token)}” marks speech${e.weight ? ` ×${e.weight}` : ''}`;
    case 'NUL': return `hold: “${esc(trunc(e.text))}”`;
    case 'INS': return `${esc(e.label)}`;
    case 'SYN': return `${esc(name(e.from))} ≡ ${esc(name(e.to))}`;
    case 'CON': return `${esc(name(e.src))} —${esc(e.via || 'with')}→ ${esc(name(e.tgt))}${weight(e)}`;
    case 'SIG': return `${esc(name(e.src))} ⟨${esc(e.via || 'says')}⟩ ${esc(name(e.tgt))}${weight(e)}`;
    case 'DEF': return e.key === 'role'
      ? `${esc(e.id)} → role: ${esc(e.value)}`
      : `${esc(name(e.id))}: ${esc(e.value)}`;
    case 'SEG': return `retract #${e.refSeq}`;
    default:    return esc(JSON.stringify(e));
  }
};

const weight = (e) => (e.w != null && e.w < 1) ? ` <span class="log-w">coupling ${e.w}</span>` : '';
const trunc = (s) => { const t = String(s || ''); return t.length > 60 ? t.slice(0, 60) + '…' : t; };
const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
