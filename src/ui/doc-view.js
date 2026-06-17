// Doc view: renders sentences as clickable, citable elements.
// Citations from chat highlight the corresponding sentence.

export const renderDoc = (doc, root) => {
  root.innerHTML = '';
  const chromeSeqs = new Set(
    doc.log.filter(e => e.op === 'NUL' && e.kind === 'chrome').map(e => e.sentIdx)
  );
  doc.sentences.forEach((s, idx) => {
    const el = document.createElement('div');
    el.className = 'sentence' + (chromeSeqs.has(idx) ? ' chrome' : '');
    el.dataset.idx = String(idx);
    el.innerHTML = `<span class="idx">s${idx}</span><span>${escapeHtml(s)}</span>`;
    root.appendChild(el);
  });
};

// Units the document DEF'd as sites (furniture) by their semantic role — dim
// them so the reader sees what was held back from grounding, and why.
export const markSiteSentences = (root, indices) => {
  for (const idx of indices) {
    const el = root.querySelector(`.sentence[data-idx="${idx}"]`);
    if (el) { el.classList.add('site'); el.title = 'site role — held back from grounding'; }
  }
};

export const highlightSources = (root, indices) => {
  for (const el of root.querySelectorAll('.sentence.cited')) {
    el.classList.remove('cited');
  }
  for (const idx of indices) {
    const el = root.querySelector(`.sentence[data-idx="${idx}"]`);
    if (el) el.classList.add('cited');
  }
  if (indices.length > 0) {
    const first = root.querySelector(`.sentence[data-idx="${indices[0]}"]`);
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
