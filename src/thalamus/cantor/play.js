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

  // one oscillator + gain (+ optional pan), wired and scheduled to run over [start,end].
  const voice = ({ freq, detune = 0, pan = 0, type = 'sine', start, end }) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    if (osc.frequency && 'value' in osc.frequency) osc.frequency.value = freq;
    if (detune && osc.detune && 'value' in osc.detune) osc.detune.value = detune;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner && panner.pan && 'value' in panner.pan) panner.pan.value = pan;
    osc.connect(gain);
    if (panner) { gain.connect(panner); panner.connect(out); } else { gain.connect(out); }
    osc.start?.(start);
    osc.stop?.(end + 0.02);
    voices.push(osc);
    return gain;
  };

  for (const e of score.events || []) {
    const start = t0 + e.t;
    const end   = start + e.dur;

    // A REST is a SHAPED SILENCE (docs/common-sense.md §IV): the character is the timbre of the
    // nothing, never its volume. `clean` schedules no voice — the absence is heard as the pulse
    // that failed to land, in the rhythm around it.
    if (e.kind === 'rest') {
      if (e.character === 'clean') continue;                            // the never-created: pure gap
      if (e.character === 'decay') {                                    // the destroyed: a fading ghost
        const g = voice({ freq: e.freq, pan: e.pan, start, end });
        g.gain.setValueAtTime?.(0.14, start);
        (g.gain.exponentialRampToValueAtTime || g.gain.linearRampToValueAtTime)?.call(g.gain, 0.0001, end);
      } else if (e.character === 'loaded') {                            // the withheld: held, beating tension
        for (const detune of [-6, 6]) {
          const g = voice({ freq: e.freq, detune, pan: e.pan, start, end });
          g.gain.setValueAtTime?.(0, start);
          g.gain.linearRampToValueAtTime?.(0.05, start + 0.03);        // quiet, strained, sustained
          g.gain.linearRampToValueAtTime?.(0, end);
        }
      }
      continue;
    }

    // A NOTE: a short attack/release envelope so events read as discrete notes, not clicks.
    const g = voice({ freq: e.freq, pan: e.pan, type: e.timbre || 'sine', start, end });
    g.gain.setValueAtTime?.(0, start);
    g.gain.linearRampToValueAtTime?.(e.gain, start + 0.012);
    g.gain.linearRampToValueAtTime?.(0, end);
  }

  return {
    duration: score.duration,
    stop: () => { for (const v of voices) { try { v.stop?.(); } catch { /* already stopped */ } } },
  };
};
