// The log view — the entire source cited verbatim, and every transformation
// logged on top of it. Like git: each source unit is content-addressed by a
// hash, and every transformation (INS mint/sight, CON, SIG, DEF, SYN) cites
// the source hash it was read from. Read top to bottom and you watch meaning
// accrete on the text in passes, each event traceable to the exact bytes it
// came from.
//
// Each transformation also carries its eo-address — operator(Site, Stance) —
// computed live by `eoNotation`, never stamped on the event. The log stays the
// single source of truth; the address is a reading of it. Surfacing it per row
// makes "the spec is the notation" literal: every cut is a point on the EO cube.

import { eoNotation, eoAddressOfEvent } from '../core/index.js';

export const renderLog = (doc, root, { onSelectSentence } = {}) => {
  root.innerHTML = '';
  if (!doc || !doc.log) {
    root.innerHTML = `<div class="graph-empty">No document yet — the source and its transformations appear here once one is read.</div>`;
    return;
  }
  const events = doc.log.events || doc.log.snapshot?.() || [];
  const label = new Map();
  for (const e of events) if (e.op === 'INS' && !label.has(e.id)) label.set(e.id, e.label);
  const name = (id) => label.get(id) || id;

  // Index by source unit. The NUL/source events ARE the document, in order;
  // every other event hangs off the unit it cites.
  const source = [];
  const xforms = new Map();        // sentIdx → [transformation events]
  const conventions = [];          // REC — document-level, no single line
  for (const e of events) {
    if (e.op === 'NUL' && e.kind === 'source') { source[e.sentIdx] = e; continue; }
    if (e.op === 'REC') { conventions.push(e); continue; }
    if (e.sentIdx == null) continue;
    (xforms.get(e.sentIdx) || xforms.set(e.sentIdx, []).get(e.sentIdx)).push(e);
  }

  const head = document.createElement('div');
  head.className = 'log-head';
  head.innerHTML =
    `<div class="log-title">${events.length} events — the source cited verbatim, then every transformation</div>` +
    `<div class="log-sub">each unit is content-addressed; every transformation cites the hash it read</div>` +
    `<div class="log-sub">every cut carries its address — <span class="log-addr">operator(Site, Stance)</span> — read live, never stored</div>`;
  root.appendChild(head);

  if (conventions.length) {
    const sec = document.createElement('div');
    sec.className = 'log-level';
    sec.innerHTML = `<div class="log-level-head"><span class="op REC">Pass 0 · conventions</span>` +
      `<span class="log-count">${conventions.length}</span>` +
      `<span class="log-note">names &amp; speech the document taught the reader</span></div>`;
    const rows = document.createElement('div');
    rows.className = 'log-rows';
    for (const e of conventions) {
      const r = document.createElement('div');
      r.className = 'log-row';
      r.innerHTML = `<span class="op REC">REC</span>${addr(e)}<span class="log-desc">learn: “${escapeHtml(e.token)}” marks speech${e.weight ? ` ×${e.weight}` : ''}</span>`;
      rows.appendChild(r);
    }
    sec.appendChild(rows);
    root.appendChild(sec);
  }

  const doary = document.createElement('div');
  doary.className = 'log-doc';
  for (let i = 0; i < source.length; i++) {
    const src = source[i];
    if (!src) continue;
    const xs = xforms.get(i) || [];
    const unit = document.createElement('div');
    unit.className = 'log-unit' + (xs.length ? '' : ' held');
    unit.innerHTML =
      `<div class="log-src"><span class="log-cite" data-idx="${i}">s${i}</span>` +
      `<span class="log-hash">${src.hash || ''}</span>` +
      `<span class="log-text">${escapeHtml(src.text)}</span></div>` +
      (xs.length ? `<div class="log-xforms">${xs.map(e => chip(e, name)).join('')}</div>` : '');
    doary.appendChild(unit);
  }
  root.appendChild(doary);

  root.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-idx]');
    if (a && onSelectSentence) onSelectSentence(parseInt(a.dataset.idx, 10));
  });
};

// A transformation chip carries the operator, its eo-address, and the reading.
const chip = (e, name) => {
  const op = (e.op === 'DEF' && e.key === 'role') ? 'SEG' : e.op;
  return `<span class="op ${op}" title="${tip(e)}">${addr(e)}${escapeHtml(desc(e, name))}</span>`;
};

// The reading's address, computed from the event at read time. eoNotation gives
// the compact operator(Domain,Grain) — e.g. DEF(Int,Fig). The tooltip spells out
// the three faces the cube reads off it: Site (where), Stance (how held), Act.
const addr = (e) => {
  const a = eoAddressOfEvent(e);
  return a ? `<span class="log-addr">${escapeHtml(eoNotation(e))}</span>` : '';
};

const tip = (e) => {
  const a = eoAddressOfEvent(e);
  const faces = a
    ? `${eoNotation(e)} · Site ${a.site.domain}·${a.site.grain} · Stance ${a.resolution.mode}·${a.resolution.grain} · Act ${a.act.mode}×${a.act.domain}`
    : e.op;
  return escapeHtml(faces + (e.cites ? ` · cites ${e.cites}` : ''));
};

const desc = (e, name) => {
  switch (e.op) {
    case 'INS': return `${e.kind === 'mint' ? '✶ mint ' : ''}${e.label}`;
    case 'SYN': return `${name(e.from)} ≡ ${name(e.to)}`;
    case 'CON': return `${name(e.src)} —${e.via || 'with'}→ ${name(e.tgt)}${e.w != null && e.w < 1 ? ` (${e.w})` : ''}`;
    case 'SIG': return `${name(e.src)} ⟨${e.via || 'says'}⟩ ${name(e.tgt)}`;
    case 'DEF': return e.key === 'role' ? `role: ${e.value}` : `${name(e.id)}: ${trunc(e.value)}`;
    case 'SEG': return `retract #${e.refSeq}`;
    default:    return e.op;
  }
};

const trunc = (s) => { const t = String(s || ''); return t.length > 70 ? t.slice(0, 70) + '…' : t; };
const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
