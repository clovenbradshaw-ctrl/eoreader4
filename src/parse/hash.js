// Content addressing — git for the hashes.
//
// The log is the entire source cited verbatim, then transformations on top.
// Like git, each citation is content-addressed: a source unit carries the hash
// of its text, and every transformation *cites* that hash. The provenance is
// verifiable — a CON/DEF/INS points at the exact bytes it was read from, and
// if the source changes, the hash changes, and the citation no longer matches.
//
// FNV-1a → 8 hex chars. Short like a git abbreviated SHA; deterministic and
// dependency-free (no async WebCrypto), which is all the citation needs.

export const contentHash = (s) => {
  let x = 0x811c9dc5;
  const str = String(s ?? '');
  for (let i = 0; i < str.length; i++) {
    x ^= str.charCodeAt(i);
    x = Math.imul(x, 0x01000193);
  }
  return (x >>> 0).toString(16).padStart(8, '0');
};
