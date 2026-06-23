// E002 score — BLIND. Reads the held key and the read-only measurement and judges
// generalization: does E001's reserve fix lower held-out predictive surprisal on a
// real, independently-drawn stream, and does its edge come from recency structure
// (the control) rather than a luckier average constant?

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const m = JSON.parse(readFileSync(join(HERE, 'measure-out.json'), 'utf8'));
const key = JSON.parse(readFileSync(join(HERE, 'key.json'), 'utf8'));

const EPS = 0.005;   // bits — an improvement below this is noise
const primary = m.ordered.improvement > EPS;
// The edge must come from recency structure: ordered improvement clearly exceeds
// shuffled improvement. (Shuffled keeps the exact tokens; only novelty's temporal
// structure is destroyed.)
const recency = m.ordered.improvement > m.shuffled.improvement + EPS;

let verdict;
if (primary && recency) verdict = 'CONFIRMED';
else if (!primary) verdict = 'LOCATED-GAP';
else verdict = 'PARTIAL';

const report = {
  experiment: m.experiment,
  seedOfRecord: key.seedOfRecord,
  ordered: m.ordered,
  shuffled: m.shuffled,
  control: {
    recencyEdge: round4(m.ordered.improvement - m.shuffled.improvement),
    interpretation: recency
      ? 'the fix exploits novelty-rate VARIATION (recency structure), not just a better average constant'
      : 'the fix does NOT beat its own shuffle by margin — its gain is a better average level, not recency tracking',
  },
  instrument: m.instrument,
  verdict,
  reasons: [
    primary ? `the signal reserve lowers held-out surprisal on real content by ${m.ordered.improvement} bits/step`
            : `the signal reserve does NOT lower held-out surprisal on real content (${m.ordered.improvement})`,
    recency ? `the edge is recency: ordered ${m.ordered.improvement} > shuffled ${m.shuffled.improvement}`
            : `the edge is NOT recency-specific: ordered ${m.ordered.improvement} vs shuffled ${m.shuffled.improvement}`,
  ],
};
console.log(JSON.stringify(report, null, 2));
process.exit(verdict === 'CONFIRMED' ? 0 : (verdict === 'LOCATED-GAP' ? 2 : 1));

function round4(x) { return Math.round(x * 10000) / 10000; }
