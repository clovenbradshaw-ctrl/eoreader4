// exp-0002 · STIMULUS (blind) — two reading streams with opposite novelty autocorrelation.
//
// No labels. Each stream is a sequence of one-figure sentences ("<Name> spoke."); the only
// thing that differs is the TIME-STRUCTURE of when a genuinely new figure appears. The measure
// reads the streams without knowing which is which; the held key (key.json) carries the
// prediction. The "pressure" is the construction recipe below, recorded so the draw replays.
//
//   seed_of_record: deterministic construction (no RNG) — the two canonical novelty regimes.
//     stream-01: bursts of newcomers separated by recurrence droughts  → novelty POSITIVELY
//                autocorrelated (a newcomer makes the next-step newcomer MORE likely).
//     stream-02: a fixed recurring core with single newcomers maximally spaced  → novelty
//                ANTI-correlated (a newcomer makes the next-step newcomer LESS likely).

const NAMES = [
  'Ada Long', 'Ben Cole', 'Cara Dove', 'Dan Funk', 'Eve Gray', 'Fin Hale',
  'Gus Iver', 'Hana Joss', 'Ivy Kerr', 'Jon Lowe', 'Kim Moss', 'Lee Nash',
];

export const sentenceOf = (n) => `${NAMES[n]} spoke.`;
export const textOf = (idx) => idx.map(sentenceOf).join(' ');

// stream-01 — burst / drought (positively autocorrelated novelty).
const clustered = [0, 1, 2, 0, 1, 2, 0, 1, 3, 4, 5, 3, 4, 5, 3, 4, 6, 7, 8, 6, 7, 8, 6, 7];

// stream-02 — a recurring 4-core, one newcomer every sixth line (anti-correlated novelty).
const anti = (() => { const s = []; let k = 4; for (let i = 0; i < 24; i++) { s.push(i % 4); if (i % 6 === 5) s.push(k++); } return s; })();

export const streams = [
  { id: 'stream-01', idx: clustered },
  { id: 'stream-02', idx: anti },
];
