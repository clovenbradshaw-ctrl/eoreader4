// thalamus/transfer — perceptual linearization (Law L3). The encoding is NEVER data→channel
// directly; it is  channel = transfer( normalize(data, distribution) ).
//
// TWO nonlinearities are inverted, in order:
//   1. normalize() inverts the DATA's own distribution — a skewed/log variable is
//      compressed (log1p) before it touches a channel, so its mass is not crushed into a
//      channel's low end (L5). Output is t ∈ [0,1].
//   2. applyTransfer() applies the CHANNEL's perceptual correction — Stevens' power law and
//      its kin — so equal steps in the data read as equal steps in PERCEPTION. Area is the
//      explicit case: perceived area ≈ actual area, so a magnitude on a size channel drives
//      the RADIUS as √t (else big values look bigger than they are). Pitch (mel), loudness
//      (sone), and lightness (L*) are named here but their physical mapping lives in the
//      renderer — the channel's native unit IS the perceptual scale, so in normalized
//      perceptual space the correction is identity and CANTOR/LIMNER convert to Hz/dB/L*.
//
// Naming the transfer on every binding is L3's contract; the physics of a specific channel
// is the backend's. A general tool cannot delegate L3 to the user — a naive linear map is
// perceptually warped before anyone reads it — so the transfer is tool-owned, always present.

// The forward data normalizer for a variable's declared distribution. Returns a pure fn
// value → t ∈ [0,1] over [min,max], plus the pre-transform it applied (for the binding/reason).
export const normalizer = ({ range, distribution_hint = 'linear' } = {}) => {
  const [lo, hi] = range || [0, 1];
  const compress = (distribution_hint === 'log' || distribution_hint === 'skewed');
  // log1p over the shifted range so a heavy right tail does not swallow the low end (L5).
  const f = compress ? (x) => Math.log1p(Math.max(0, x - lo)) : (x) => x - lo;
  const span = compress ? Math.log1p(Math.max(1e-9, hi - lo)) : Math.max(1e-9, hi - lo);
  const t = (v) => Math.min(1, Math.max(0, f(Number(v)) / span));
  return { t, pre: compress ? 'log' : 'linear', domain: [lo, hi] };
};

// The channel-side perceptual correction: normalized data t ∈ [0,1] → normalized channel
// drive ∈ [0,1], such that PERCEIVED magnitude ∝ t. Geometric channels correct explicitly;
// perceptual-unit channels (mel/sone/cieL) are identity here and the renderer maps to physics.
export const applyTransfer = (transfer, t) => {
  const u = Math.min(1, Math.max(0, Number(t) || 0));
  switch (transfer) {
    case 'sqrt': return Math.sqrt(u);          // area → radius: perceived area ∝ value
    case 'log':  return Math.log1p(u) / Math.log1p(1);
    case 'mel':                                 // pitch — renderer maps t→Hz via mel⁻¹
    case 'sone':                                // loudness — renderer maps t→dB via sone⁻¹
    case 'cieL':                                // lightness — renderer maps t→L*
    case 'linear':
    default:     return u;
  }
};

// A one-line description of what a transfer inverts — for the critique gutter and the doc.
export const describeTransfer = (transfer) => ({
  linear: 'no perceptual correction (channel is already linear)',
  log:    'log compression for a heavy-tailed distribution',
  sqrt:   'area correction — radius ∝ √value so perceived area ∝ value (Stevens)',
  mel:    'pitch on the mel/ERB scale (renderer maps to Hz)',
  sone:   'loudness on the sone scale (renderer maps to dB; Stevens power law)',
  cieL:   'lightness on CIE L* (renderer maps to luminance)',
}[transfer] || 'unknown transfer');
