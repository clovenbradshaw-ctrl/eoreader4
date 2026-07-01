// cantor/score — MapSpec + data → a ScoreSpec. The auditory mirror of LIMNER's ViewSpec.
//
// KOINÉ's MapSpec is modality-independent: it names auditory CHANNELS (onset, pitch, loudness,
// pan, timbre) and the transfer each carries, but no Hz, no dB, no seconds. CANTOR lowers it to
// a ScoreSpec — a deterministic list of sounding events, each with a physical time/frequency/
// gain/pan and a `ref` back to the data row that produced it (grounding, exactly as every
// LIMNER mark carries a ref). This module owns the PHYSICS that L3 deferred: the data is already
// normalized to t ∈ [0,1] by the binding's own distribution inversion; here mel⁻¹ turns t into a
// frequency and the sone/phon scale turns t into a gain, so equal steps in the data sound like
// equal steps in perception. Pure and deterministic: same (MapSpec, data, opts) ⇒ same ScoreSpec.
//
// The Web Audio scheduling lives in play.js; nothing here touches an AudioContext.

// ── physical transfer inverses (L3, renderer-owned) ──────────────────────────
// mel⁻¹: place t linearly on the mel scale between the range endpoints, then to Hz. Equal data
// steps → equal MEL steps → equal perceived-pitch steps (not equal Hz, which would sound warped).
const mel   = (f) => 2595 * Math.log10(1 + f / 700);
const unmel = (m) => 700 * (10 ** (m / 2595) - 1);
export const freqOf = (t, [fLo, fHi] = [220, 880]) => {
  const m = mel(fLo) + Math.min(1, Math.max(0, t)) * (mel(fHi) - mel(fLo));
  return Math.round(unmel(m) * 100) / 100;
};

// sone/phon: loudness doubles per +10 phon. Map t linearly onto a phon range, then to a linear
// amplitude referenced so the loudest event is gain 1. Perceived loudness ≈ linear in the data.
export const gainOf = (t, [phonLo, phonHi] = [45, 90]) => {
  const phon = phonLo + Math.min(1, Math.max(0, t)) * (phonHi - phonLo);
  return Math.round(10 ** ((phon - phonHi) / 20) * 1e4) / 1e4;   // phonHi → 1.0, quieter below
};

const WAVEFORMS = Object.freeze(['sine', 'triangle', 'sawtooth', 'square']);

// ── data access + normalization ──────────────────────────────────────────────
const rowsOf = (data) => {
  if (data && Array.isArray(data.columns)) {
    const cols = data.columns;
    const n = Math.max(0, ...cols.map((c) => (c.values || []).length));
    return Array.from({ length: n }, (_, i) => Object.fromEntries(cols.map((c) => [c.id, c.values?.[i]])));
  }
  return Array.isArray(data) ? data : [];
};
const numeric = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'string' && Number.isNaN(Number(v))) { const d = Date.parse(v); return Number.isFinite(d) ? d : null; }
  return Number(v);
};
// normalize a raw value to t ∈ [0,1] using the binding's own domain + data-distribution inversion
// (the SAME inversion compile applied), so CANTOR and the compiler agree on where a value sits.
const normFor = (binding) => {
  const [lo, hi] = binding.domain || [0, 1];
  const log = binding.normalize === 'log';
  const f   = log ? (x) => Math.log1p(Math.max(0, x - lo)) : (x) => x - lo;
  const span = log ? Math.log1p(Math.max(1e-9, hi - lo)) : Math.max(1e-9, hi - lo);
  return (v) => { const x = numeric(v); return x == null ? null : Math.min(1, Math.max(0, f(x) / span)); };
};

// ── the ScoreSpec ────────────────────────────────────────────────────────────
export const makeScoreSpec = ({ events = [], duration = 0, channels = [], provenance = null } = {}) =>
  Object.freeze({
    events: Object.freeze(events.map((e) => Object.freeze({ ...e }))),
    duration, channels: Object.freeze([...channels]),
    provenance: provenance == null ? null : Object.freeze({ ...provenance }),
  });

// toScoreSpec(mapSpec, data, opts) → ScoreSpec.
//   opts.duration    total seconds the score spans (the time axis; default 8)
//   opts.pitchRange  [fLo,fHi] Hz for the pitch channel (default [220,880])
//   opts.phonRange   [pLo,pHi] for loudness (default [45,90])
//   opts.noteDur     seconds per event (default 0.14)
//   opts.timbres     categorical waveform set (default sine/triangle/sawtooth/square)
//   opts.refKey      a row field to use as the event ref (default: the row index)
export const toScoreSpec = (mapSpec, data, opts = {}) => {
  const duration = opts.duration ?? 8;
  const noteDur  = opts.noteDur ?? 0.14;
  const rows = rowsOf(data);
  const n = rows.length;

  const byChannel = new Map((mapSpec.bindings || []).map((b) => [b.channel, b]));
  const b = (id) => byChannel.get(id) || null;
  const onset = b('onset'), pitch = b('pitch'), loud = b('loudness'), pan = b('pan'), timbre = b('timbre');
  const nOnset = onset && normFor(onset), nPitch = pitch && normFor(pitch), nLoud = loud && normFor(loud), nPan = pan && normFor(pan);

  // categorical timbre: the variable's categories → a waveform index (declared on the binding's domain)
  const timbreCats = timbre?.domain || null;
  const waveOf = (v) => {
    if (!timbreCats) return opts.timbres?.[0] || 'sine';
    const i = Math.max(0, timbreCats.indexOf(String(v)));
    return (opts.timbres || WAVEFORMS)[i % (opts.timbres || WAVEFORMS).length];
  };

  const events = [];
  for (let i = 0; i < n; i++) {
    const row = rows[i];
    const t = nOnset ? (nOnset(row[onset.variable]) ?? i / Math.max(1, n)) : i / Math.max(1, n);
    events.push({
      ref:    opts.refKey ? String(row[opts.refKey]) : `row:${i}`,
      t:      Math.round(t * duration * 1e3) / 1e3,
      dur:    noteDur,
      freq:   nPitch ? freqOf(nPitch(row[pitch.variable]) ?? 0.5, opts.pitchRange) : (opts.baseFreq ?? 440),
      gain:   nLoud ? gainOf(nLoud(row[loud.variable]) ?? 0.5, opts.phonRange) : 0.5,
      pan:    nPan ? Math.round((2 * (nPan(row[pan.variable]) ?? 0.5) - 1) * 1e3) / 1e3 : 0,
      timbre: timbre ? waveOf(row[timbre.variable]) : (opts.timbres?.[0] || 'sine'),
    });
  }
  events.sort((a, c) => a.t - c.t || a.freq - c.freq);

  const channels = (mapSpec.bindings || []).map((x) => x.channel).filter((c) => AUDITORY_IDS.has(c));
  return makeScoreSpec({
    events, duration, channels,
    provenance: { mapspec_hash: mapSpec.provenance?.mapspec_hash ?? null, cantor_version: '0.1' },
  });
};

const AUDITORY_IDS = new Set(['onset', 'pitch', 'loudness', 'tempo', 'pan', 'timbre', 'mode', 'dissonance']);
