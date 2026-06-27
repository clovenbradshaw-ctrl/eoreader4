// The audit view. One row per turn; click to expand the verbatim record.
// The whole point of the audit is to show what actually happened — so
// don't summarize. Show the prompt, show the raw output, show the bindings.

export const renderAuditTurn = (root, turn) => {
  // Clear the empty-state placeholder on first render.
  const placeholder = root.querySelector('.empty');
  if (placeholder) placeholder.remove();

  // Replace existing row if we've seen this turn before; otherwise prepend.
  const existing = root.querySelector(`.turn[data-id="${turn.id}"]`);
  // Preserve the user's open/closed choice on already-finished turns.
  const keepOpen = existing && !existing.classList.contains('in-flight')
    && existing.classList.contains('open');
  const el = renderRow(turn);
  if (keepOpen) el.classList.add('open');
  if (existing) existing.replaceWith(el);
  else if (root.firstChild) root.insertBefore(el, root.firstChild);
  else root.appendChild(el);
};

export const renderEmptyAudit = (root) => {
  root.innerHTML = '<div class="empty">Run a turn to see the trail.</div>';
};

export const exportAudit = (audit) => {
  const text = audit.exportJSONL();
  if (!text) return;            // nothing run yet — don't hand back an empty file
  const blob = new Blob([text], { type: 'application/x-ndjson' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `eoreader4-audit-${Date.now()}.jsonl`;
  // The anchor must be IN the document for the click to start a download in
  // Firefox/Safari — a detached node only works in Chromium. Append, click, remove.
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const renderRow = (turn) => {
  const el = document.createElement('div');
  el.className = 'turn';
  // The active turn stays open so the trail is visible as it runs.
  // Finished turns keep whatever state the user last set; first finish
  // collapses to a tidy row that can be clicked open.
  if (turn.finishedAt == null) el.classList.add('open', 'in-flight');
  el.dataset.id = turn.id;
  const route = turn.route || 'in flight';
  const dur   = turn.durationMs != null ? `${turn.durationMs}ms` : '';
  el.innerHTML = `
    <div class="q">
      <span>${escapeHtml(turn.question)}</span>
      <span class="route">${route} ${dur}</span>
    </div>
    <div class="body"></div>
  `;
  const q    = el.querySelector('.q');
  const body = el.querySelector('.body');
  q.addEventListener('click', () => el.classList.toggle('open'));

  for (const s of turn.steps) {
    const line = document.createElement('div');
    line.className = 'step';
    line.innerHTML =
      `<span class="name">${escapeHtml(s.name)}</span>` +
      `<span class="ms">+${s.t}ms</span>` +
      `<span class="data">${escapeHtml(stringify(s.data))}</span>`;
    body.appendChild(line);
    // Self-directed inquiry: surface the engine's OWN follow-up questions legibly, not just
    // in the step JSON — these are the open figures it chose to go read more about.
    const asked = s.name === 'inquire' ? (s.data?.asked || []) : [];
    for (const q of asked) {
      body.insertAdjacentHTML('beforeend',
        `<div class="step inquiry-q"><span class="name">↳ asked</span><span class="data">${escapeHtml(q)}</span></div>`);
    }
  }
  // The mechanical reading — every piece that came through between the question and the
  // phrase: the spans the surfer/retrieval delivered (with their text), the surfer's own
  // per-cursor field (the surprise trace, its peak ★ and frame-break stops ⟳), and the note.
  if (turn.reading) {
    const r = turn.reading;
    body.insertAdjacentHTML('beforeend', `<div class="label">reading — spans delivered to the phraser</div>`);
    for (const s of (r.spans || [])) {
      body.insertAdjacentHTML('beforeend',
        `<div class="step span"><span class="name">[s${s.idx}]${s.via ? ' ' + escapeHtml(s.via) : ''}${s.terrain ? ' · ' + escapeHtml(s.terrain) : ''}</span>` +
        `<span class="ms">${s.score ?? ''}</span>` +
        `<span class="data">${escapeHtml(s.text)}</span></div>`);
    }
    if (r.surf) {
      const peak = r.surf.peak, stops = new Set(r.surf.stops || []), recs = new Set(r.surf.recCursors || []);
      body.insertAdjacentHTML('beforeend',
        `<div class="label">surfer field — bayes/surprise per cursor (★ peak · ⟳ frame-break · • stop)${r.surf.rode ? ' · rode ' + escapeHtml(r.surf.rode) : ''}</div>`);
      for (const f of (r.surf.field || [])) {
        const mark = (f.idx === peak ? '★' : '') + (recs.has(f.idx) ? '⟳' : '') + (stops.has(f.idx) ? '•' : '');
        body.insertAdjacentHTML('beforeend',
          `<div class="step field"><span class="name">${mark || '·'} c${f.idx}${f.focus ? ' ' + escapeHtml(String(f.focus)) : ''}</span>` +
          `<span class="ms">b=${f.bayes ?? '–'}</span>` +
          `<span class="data">surprise ${f.surprisalBits ?? '–'} bits</span></div>`);
      }
    }
    if (r.note) {
      body.insertAdjacentHTML('beforeend',
        `<div class="label">note — the reading handed to the phraser</div><div class="raw">${escapeHtml(r.note)}</div>`);
    }
  }
  if (turn.prompt) {
    body.insertAdjacentHTML('beforeend',
      `<div class="label">prompt</div><div class="raw">${escapeHtml(turn.prompt)}</div>`);
  }
  if (turn.rawOutput) {
    body.insertAdjacentHTML('beforeend',
      `<div class="label">raw output</div><div class="raw">${escapeHtml(turn.rawOutput)}</div>`);
  }
  if (turn.bound && turn.bound.length) {
    body.insertAdjacentHTML('beforeend',
      `<div class="label">bound</div><div class="raw">${escapeHtml(stringify(turn.bound, 2))}</div>`);
  }
  if (turn.vetoes && turn.vetoes.length) {
    body.insertAdjacentHTML('beforeend',
      `<div class="label">vetoes</div><div class="raw">${escapeHtml(stringify(turn.vetoes, 2))}</div>`);
  }
  return el;
};

const stringify = (x, indent) => {
  try {
    return JSON.stringify(x, null, indent);
  } catch {
    return String(x);
  }
};

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
