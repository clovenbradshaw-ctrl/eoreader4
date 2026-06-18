// Initialization animation — the reader assembling its perception apparatus.
//
// The boot is the reader building the three positions it is about to perceive,
// so the animation IS the architecture: three elements, one per grain band
// (Ground green, Figure violet, Pattern red — the triad: Existence, Structure,
// Significance), filling as the one instrument that serves all three comes
// online. Below them the five stages report the granular truth.
//
// It blocks nothing — the chat is usable from the first stage; this is a corner
// card, not a gate. It sits bottom-right, clear of the header controls, and
// minimizes to a small pill. It resolves to the TRUE state: if instruments fail
// it ends on a stated degraded state (geometric reader unavailable, holding at
// no-commit), never a spinner that hides the failure, never a fake checkmark.
// It is idempotent with the cache: a warm load runs once, fast, and confirms.
//
// Aesthetic: it matches the host app's dark surface (the product is dark),
// system monospace, 1px borders, no shadows, no gradients. Triad accents —
// emerald (Existence), violet (Structure), rose (Significance), amber (signal).

const STYLE_ID = 'eo-boot-style';

const CSS = `
.eo-boot{position:fixed;bottom:12px;right:12px;z-index:9999;
  --eo-ink:#e4e4e7;--eo-line:#3f3f46;--eo-mut:#a1a1aa;--eo-paper:#151518;
  --eo-existence:#6ee7b7;--eo-structure:#c4b5fd;--eo-significance:#fca5a5;--eo-signal:#fbbf24;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--eo-ink);}
.eo-boot *{box-sizing:border-box;}
.eo-boot-card{width:264px;background:var(--eo-paper);border:1px solid var(--eo-line);}
.eo-boot.min .eo-boot-card{display:none;}
.eo-boot:not(.min) .eo-boot-pill{display:none;}
.eo-boot-head{display:flex;align-items:center;justify-content:space-between;
  padding:.4rem .55rem;border-bottom:1px solid var(--eo-line);}
.eo-boot-title{font-size:.72rem;letter-spacing:.04em;text-transform:lowercase;}
.eo-boot-min{appearance:none;background:var(--eo-paper);color:var(--eo-ink);
  border:1px solid var(--eo-line);font:inherit;font-size:.7rem;line-height:1;
  padding:.05rem .35rem;cursor:pointer;border-radius:0;}
.eo-boot-min:hover{background:#26262b;}
.eo-boot-bands{display:flex;gap:.35rem;padding:.55rem;}
.eo-band{flex:1;border:1px solid var(--eo-line);}
.eo-band-label{font-size:.58rem;text-transform:uppercase;letter-spacing:.06em;
  padding:.1rem .25rem;border-bottom:1px solid var(--eo-line);color:var(--eo-mut);}
.eo-band-track{height:34px;position:relative;}
.eo-band-fill{position:absolute;left:0;bottom:0;width:100%;height:0;transition:height .4s ease;}
.eo-band-ground  .eo-band-fill{background:var(--eo-existence);}
.eo-band-figure  .eo-band-fill{background:var(--eo-structure);}
.eo-band-pattern .eo-band-fill{background:var(--eo-significance);}
.eo-boot.unavailable .eo-band-fill{opacity:.32;}
.eo-boot.live .eo-band-fill{animation:eo-live 1.6s ease-in-out infinite;}
@keyframes eo-live{0%,100%{opacity:1;}50%{opacity:.6;}}
.eo-boot-stages{list-style:none;margin:0;padding:.15rem .55rem .35rem;}
.eo-stage{display:flex;align-items:center;gap:.45rem;font-size:.68rem;padding:.13rem 0;color:var(--eo-mut);}
.eo-stage .box{width:.7rem;height:.7rem;border:1px solid var(--eo-line);flex:0 0 auto;position:relative;background:var(--eo-paper);}
.eo-stage[data-status="active"] .box{animation:eo-blink 1s steps(2) infinite;}
.eo-stage[data-status="active"] .box::after{content:"";position:absolute;inset:1px;}
.eo-stage[data-status="done"] .box::after{content:"";position:absolute;inset:1px;background:var(--eo-ink);}
.eo-stage[data-status="failed"] .box{color:var(--eo-significance);}
.eo-stage[data-status="failed"] .box::after{content:"\\00d7";position:absolute;inset:-.18rem 0 0 .04rem;
  color:var(--eo-significance);font-size:.8rem;line-height:1;}
.eo-stage[data-status="skipped"] .box::after{content:"";position:absolute;left:0;right:0;top:50%;
  border-top:1px solid var(--eo-mut);}
.eo-stage[data-status="done"]{color:var(--eo-ink);}
.eo-stage .nm{flex:1;}
.eo-stage .pc{font-variant-numeric:tabular-nums;}
.eo-stage-clearing[data-status="done"] .box::after{background:var(--eo-existence);}
.eo-stage-instruments .pc{color:var(--eo-signal);}
.eo-stage-centroids[data-status="done"] .box::after{background:var(--eo-structure);}
.eo-stage-warming[data-status="done"] .box::after{background:var(--eo-significance);}
@keyframes eo-blink{0%{opacity:1;}100%{opacity:.4;}}
.eo-boot-detail{font-size:.64rem;line-height:1.4;color:var(--eo-mut);
  padding:.4rem .55rem;border-top:1px solid var(--eo-line);}
.eo-boot.live .eo-boot-detail{color:var(--eo-existence);}
.eo-boot.unavailable .eo-boot-detail{color:var(--eo-significance);}
.eo-boot-pill{appearance:none;font:inherit;font-size:.66rem;cursor:pointer;border-radius:0;
  background:var(--eo-paper);border:1px solid var(--eo-line);padding:.2rem .5rem;color:var(--eo-ink);
  display:flex;align-items:center;gap:.35rem;}
.eo-boot-pill .dot{width:.5rem;height:.5rem;border:1px solid var(--eo-line);}
.eo-boot.live .eo-boot-pill .dot{background:var(--eo-existence);}
.eo-boot.unavailable .eo-boot-pill .dot{background:var(--eo-significance);}
.eo-boot.assembling .eo-boot-pill .dot{background:var(--eo-signal);}
`;

const STAGE_LABEL = {
  clearing:    'clearing',
  instruments: 'instruments',
  centroids:   'centroids',
  warming:     'warming',
  ready:       'ready',
};

// A single fill fraction for all three bands: one organ serves the three
// positions, so they assemble in unison. The number is the honest progress
// through the stages, not a decorative loop.
const fillFor = (st) => {
  const s = st.stages;
  if (s.ready === 'done') return st.geometricReader === 'live' ? 1 : Math.max(0.5, fillBody(st));
  return fillBody(st);
};
const fillBody = (st) => {
  const s = st.stages;
  let f = 0;
  if (s.clearing === 'done') f = 0.15; else if (s.clearing === 'active') f = 0.06;
  if (s.instruments === 'active' || s.instruments === 'done') f = 0.15 + 0.6 * (st.progress || 0);
  if (s.centroids === 'done') f = Math.max(f, 0.9);
  if (s.warming === 'done') f = Math.max(f, 0.97);
  return Math.min(1, f);
};

const ensureStyle = (doc) => {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  doc.head.appendChild(el);
};

// Mount the animation against an installer (anything with subscribe(cb) → cb is
// called with a state snapshot on change). Returns { el, destroy }. The
// animation never drives the install; it only reflects it.
export const mountBootAnimation = (root, installer, { autoMinDelayMs = 2600 } = {}) => {
  const doc = root.ownerDocument || document;
  ensureStyle(doc);

  const el = doc.createElement('div');
  el.className = 'eo-boot assembling';
  el.innerHTML = `
    <div class="eo-boot-card" role="status" aria-live="polite">
      <div class="eo-boot-head">
        <span class="eo-boot-title">perception apparatus</span>
        <button class="eo-boot-min" type="button" title="minimize">—</button>
      </div>
      <div class="eo-boot-bands">
        ${['ground', 'figure', 'pattern'].map(b => `
          <div class="eo-band eo-band-${b}">
            <div class="eo-band-label">${b}</div>
            <div class="eo-band-track"><div class="eo-band-fill"></div></div>
          </div>`).join('')}
      </div>
      <ol class="eo-boot-stages">
        ${installer.STAGES.map(s => `
          <li class="eo-stage eo-stage-${s}" data-stage="${s}" data-status="pending">
            <span class="box"></span><span class="nm">${STAGE_LABEL[s] || s}</span><span class="pc"></span>
          </li>`).join('')}
      </ol>
      <div class="eo-boot-detail">assembling the perception apparatus…</div>
    </div>
    <button class="eo-boot-pill" type="button" title="perception apparatus">
      <span class="dot"></span><span class="pill-label">geometric reader</span>
    </button>`;
  root.appendChild(el);

  const fills = [...el.querySelectorAll('.eo-band-fill')];
  const detail = el.querySelector('.eo-boot-detail');
  const pillLabel = el.querySelector('.pill-label');
  const stageRows = Object.fromEntries(
    [...el.querySelectorAll('.eo-stage')].map(li => [li.dataset.stage, li]));

  const minimize = () => el.classList.add('min');
  const restore = () => el.classList.remove('min');
  el.querySelector('.eo-boot-min').addEventListener('click', minimize);
  el.querySelector('.eo-boot-pill').addEventListener('click', restore);

  let autoMinTimer = null;
  const render = (st) => {
    el.classList.remove('assembling', 'live', 'unavailable');
    el.classList.add(st.geometricReader);
    const f = `${Math.round(fillFor(st) * 100)}%`;
    for (const fill of fills) fill.style.height = f;
    for (const stage of installer.STAGES) {
      const row = stageRows[stage];
      if (!row) continue;
      row.dataset.status = st.stages[stage] || 'pending';
      if (stage === 'instruments') {
        const pc = row.querySelector('.pc');
        pc.textContent = (st.stages.instruments === 'active' && st.progress)
          ? `${Math.round(st.progress * 100)}%` : '';
      }
    }
    detail.textContent = st.detail || '';
    pillLabel.textContent = st.geometricReader === 'live' ? 'geometric reader · live'
      : st.geometricReader === 'unavailable' ? 'geometric reader · no-commit'
      : 'geometric reader · assembling';
    // On a resolved boot, confirm then get out of the way — non-blocking.
    if (st.stages.ready === 'done' && !autoMinTimer) {
      autoMinTimer = setTimeout(minimize, autoMinDelayMs);
    }
  };

  const unsub = installer.subscribe(render);
  return {
    el,
    destroy() { unsub?.(); clearTimeout(autoMinTimer); el.remove(); },
  };
};
