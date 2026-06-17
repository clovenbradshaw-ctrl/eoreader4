// Naive subject–verb–object → CON edges (or DEF predicates).
// The simplest path that respects the contract: only emit on admitted
// entities; never invent links.

const SVO_RE = /^([A-Z][a-zA-Z'\s]+?)\s+(is|are|was|were|has|have|had|owns|leads|builds|writes|wrote|made|makes|sent|sends|knows|met|meets|said|says)\s+(.+?)[.!?]?$/;

const OBJ_RE = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b/g;

const COPULAR = new Set(['is', 'are', 'was', 'were']);

export const parseRelations = (sentence, admission) => {
  const m = sentence.match(SVO_RE);
  if (!m) return [];
  const subjLabel = m[1].trim();
  const verb = m[2].toLowerCase();
  const restRaw = m[3].trim();
  if (!admission.isAdmitted(subjLabel)) return [];

  const out = [];
  const re = new RegExp(OBJ_RE.source, 'g');
  let mm;
  while ((mm = re.exec(restRaw)) !== null) {
    const objLabel = mm[1].trim();
    if (admission.isAdmitted(objLabel) && objLabel !== subjLabel) {
      out.push({
        op: 'CON',
        src: admission.idOf(subjLabel),
        tgt: admission.idOf(objLabel),
        via: verb,
      });
    }
  }
  if (out.length === 0 && COPULAR.has(verb)) {
    out.push({
      op: 'DEF',
      id: admission.idOf(subjLabel),
      key: 'predicate',
      value: restRaw,
    });
  }
  return out;
};
