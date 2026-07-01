// cantor/play — the thin Web Audio scheduler. A ScoreSpec (score.js) is a deterministic list of
// sounding events; this schedules them on an AudioContext the CALLER injects, so the module
// imports no browser global and is safe to load anywhere (Node included — it only ever touches
// the ctx passed in). The physics is already in the ScoreSpec; this only wires oscillators.
//
// Kept deliberately dumb, the way LIMNER's render.js only stamps SVG from computed geometry: no
// decisions here, just one oscillator + gain envelope + optional stereo pan per event. A caller
// with a real AudioContext hears the finding; a caller with a fake one (a test) sees the schedule.

// playScore(score, ctx, opts) → { duration, stop() }. `ctx` is a Web Audio AudioContext (or any
// object exposing createOscillator/createGain[/createStereoPanner] + currentTime + destination).
export const playScore = (score, ctx, { destination = null, when = 0.06 } = {}) => {
  if (!ctx || typeof ctx.createOscillator !== 'function') throw new TypeError('playScore needs an AudioContext');
  const out = destination || ctx.destination;
  const t0 = (ctx.currentTime || 0) + when;
  const voices = [];

  for (const e of score.events || []) {
    const osc = ctx.createOscillator();
    osc.type = e.timbre || 'sine';
    if (osc.frequency && 'value' in osc.frequency) osc.frequency.value = e.freq;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    const pan = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (pan && pan.pan && 'value' in pan.pan) pan.pan.value = e.pan || 0;

    osc.connect(gain);
    if (pan) { gain.connect(pan); pan.connect(out); } else { gain.connect(out); }

    const start = t0 + e.t;
    const end   = start + e.dur;
    // a short attack/release envelope so events read as discrete notes, not clicks.
    gain.gain.setValueAtTime?.(0, start);
    gain.gain.linearRampToValueAtTime?.(e.gain, start + 0.012);
    gain.gain.linearRampToValueAtTime?.(0, end);
    osc.start?.(start);
    osc.stop?.(end + 0.02);
    voices.push(osc);
  }

  return {
    duration: score.duration,
    stop: () => { for (const v of voices) { try { v.stop?.(); } catch { /* already stopped */ } } },
  };
};
