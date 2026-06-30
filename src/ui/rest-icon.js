// ui/rest-icon.js — a little phosphor-esque glyph for the engine's rest state.
//
// "Develop this, and let us show when it is resting — a little icon showing the current
// state." (docs/how-to-rest.md). The rest cycle (src/rest/cycle.js) is one instruction
// at a few postures: AWAKE it differentiates with the frontier moving; a BLINK takes the
// edge off (re-integrate the recent at near-full volume, no forgetting); a NIGHT descends
// the ladder with the frontier held still; once rested it stays in REST until the morning
// recouples its hypotheses. This module is pure presentation over those postures: a state
// name in, an SVG string out. No DOM, no engine import — so it is trivially testable and
// the same glyph renders in any surface that knows the state.
//
// The icons are hand-cut in the Phosphor idiom: a 24×24 box, 1.6px strokes, round caps
// and joins, currentColor so the host's palette drives them. An EYE for awake (the engine
// looking out), a softened lid for the blink, a MOON for the night, a MOON-with-stars once
// it has settled — the waking ladder, drawn.

// The posture vocabulary. The cycle's own states ('awake' | 'resting') plus the cadence
// the UI flashes ('blink' | 'night') and the idle loop's siblings ('surfing' | 'rested'),
// so one glyph serves both the rest cycle and the §15 idle view. Unknown names fall back
// to 'awake'.
export const REST_STATES = Object.freeze(['awake', 'surfing', 'blink', 'resting', 'night', 'rested']);

// Normalize a free state name to a glyph key. surfing ≈ awake (eyes open, looking out);
// night ≈ resting (asleep, integrating); rested is its own settled glyph.
const glyphKey = (state) => {
  switch (state) {
    case 'surfing': return 'awake';
    case 'night': return 'resting';
    case 'blink': return 'blink';
    case 'rested': return 'rested';
    case 'resting': return 'resting';
    default: return 'awake';
  }
};

// the glyph bodies — the inside of <svg>, currentColor-stroked, viewBox 0 0 24 24.
const BODIES = {
  // EYE — open, looking out. The almond + the iris (awake / surfing: differentiating).
  awake:
    '<path d="M2.5 12C4.5 7.5 8 5.5 12 5.5s7.5 2 9.5 6.5c-2 4.5-5.5 6.5-9.5 6.5S4.5 16.5 2.5 12Z"/>' +
    '<circle cx="12" cy="12" r="2.75"/>',
  // BLINK — the lid drawn down to a soft arc, a lash or two: the edge taken off, briefly.
  blink:
    '<path d="M3 11c2.5 3.2 5.7 4.8 9 4.8S18.5 14.2 21 11"/>' +
    '<path d="M6.2 14.4 5 16.2"/><path d="M12 16.7V18.8"/><path d="M17.8 14.4 19 16.2"/>',
  // MOON — a clean crescent: the frontier held still, the integral re-projected (night).
  resting:
    '<path d="M20.5 14.2A8.2 8.2 0 1 1 10.3 3.6 6.4 6.4 0 0 0 20.5 14.2Z"/>',
  // MOON + STARS — settled: the night run, its hypotheses waiting for the morning.
  rested:
    '<path d="M19.8 14.6A7.6 7.6 0 1 1 10.1 4.7 6 6 0 0 0 19.8 14.6Z"/>' +
    '<path d="M17 4.2 17.7 6 19.5 6.7 17.7 7.4 17 9.2 16.3 7.4 14.5 6.7 16.3 6Z"/>' +
    '<path d="M20.6 9.4 21 10.4 22 10.8 21 11.2 20.6 12.2 20.2 11.2 19.2 10.8 20.2 10.4Z"/>',
};

// restIconSvg — the glyph for a state, as an SVG string. `size` is the box edge in px;
// `title` is an accessible label (omit for aria-hidden decoration). The class is
// `rest-icon rest-icon--<key>` so the host can color/animate per posture.
export const restIconSvg = (state = 'awake', { size = 16, title = null } = {}) => {
  const key = glyphKey(state);
  const body = BODIES[key] || BODIES.awake;
  const a11y = title
    ? `role="img" aria-label="${escapeAttr(title)}"><title>${escapeAttr(title)}</title>`
    : 'aria-hidden="true">';
  return (
    `<svg class="rest-icon rest-icon--${key}" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${a11y}` +
    `${body}</svg>`
  );
};

// restStateLabel — the human word for a posture (for the chip beside the glyph).
export const restStateLabel = (state) => {
  switch (state) {
    case 'surfing': return 'surfing';
    case 'awake': return 'awake';
    case 'blink': return 'blinking';
    case 'night': return 'resting';
    case 'resting': return 'resting';
    case 'rested': return 'rested';
    default: return String(state || 'awake');
  }
};

// mountRestIcon — set an element's contents to the glyph for a state (a thin DOM helper
// for hosts that want to swap the icon in place). Returns the element. Pure-string callers
// can ignore this and use restIconSvg directly.
export const mountRestIcon = (el, state, opts) => {
  if (el) el.innerHTML = restIconSvg(state, opts);
  return el;
};

const escapeAttr = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
