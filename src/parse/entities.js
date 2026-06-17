// Two-sighting entity admission.
// A capitalised span is a candidate on first sighting; it is admitted on
// the second. Only admitted entities can be subjects of relations or be
// cited as sources for facts. This is the ceiling the low places on
// what the high is allowed to claim.

const CAP_RE = /\b([A-Z][a-zA-Z]+(?:\s+(?:[A-Z][a-zA-Z]+|de|von|van|of|the))*)\b/g;

const idFor = (label) =>
  label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export const createEntityAdmission = () => {
  const counts   = new Map(); // label → count
  const admitted = new Map(); // label → id (post-admission)

  const observe = (sentence) => {
    const seenInSentence = new Set();
    const out = [];
    const re = new RegExp(CAP_RE.source, 'g');
    let m;
    while ((m = re.exec(sentence)) !== null) {
      const label = m[1].trim();
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
