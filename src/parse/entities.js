// Two-sighting entity admission.
// A capitalised span is a candidate on first sighting; it is admitted on
// the second. Only admitted entities can be subjects of relations or be
// cited as sources for facts. This is the ceiling the low places on
// what the high is allowed to claim.

const CAP_RE = /\b([A-Z][a-zA-Z]+(?:\s+(?:[A-Z][a-zA-Z]+|de|von|van|of|the))*)\b/g;

// Sentence-initial capitals that aren't names. The greedy regex above will
// happily eat "Then Alice" as one phrase; we strip these leading starters
// before counting so admission tracks the real entity.
const CAP_STARTERS = new Set([
  'The','A','An','This','That','These','Those',
  'I','You','He','She','It','We','They',
  'My','Your','His','Her','Its','Our','Their',
  'Then','Now','Here','There','When','Where','Why','How','What','Who','Whom',
  'Yes','No','Maybe','Perhaps','Otherwise','Also','However','Indeed','Still',
  'But','And','So','Or','Nor','Yet','For','Because','Although','While','Since',
  'In','On','At','To','From','By','With','Of','Up','Down','Over','Under',
  'If','Unless','Until','Once',
]);

const idFor = (label) =>
  label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

const cleanLabel = (raw) => {
  const words = raw.trim().split(/\s+/);
  while (words.length > 0 && CAP_STARTERS.has(words[0])) words.shift();
  if (words.length === 0) return null;
  if (words.length === 1 && CAP_STARTERS.has(words[0])) return null;
  return words.join(' ');
};

export const createEntityAdmission = () => {
  const counts   = new Map(); // label → count
  const admitted = new Map(); // label → id (post-admission)

  const observe = (sentence) => {
    const seenInSentence = new Set();
    const out = [];
    const re = new RegExp(CAP_RE.source, 'g');
    let m;
    while ((m = re.exec(sentence)) !== null) {
      const label = cleanLabel(m[1]);
      if (!label) continue;
      if (seenInSentence.has(label)) continue;
      seenInSentence.add(label);
      const c = (counts.get(label) ?? 0) + 1;
      counts.set(label, c);
      if (admitted.has(label)) {
        out.push({ status: 'present', id: admitted.get(label), label });
      } else if (c >= 2) {
        const id = idFor(label);
        admitted.set(label, id);
        out.push({ status: 'admit', id, label });
      } else {
        out.push({ status: 'candidate', label });
      }
    }
    return out;
  };

  return {
    observe,
    isAdmitted: (label) => admitted.has(label),
    idOf:       (label) => admitted.get(label),
    get counts()   { return counts; },
    get admitted() { return admitted; },
  };
};
