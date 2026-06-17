// Doc view: renders sentences as clickable, citable elements.
// Citations from chat highlight the corresponding sentence.

import { isDegenerate } from '../parse/index.js';

export const renderDoc = (doc, root) => {
  root.innerHTML = '';
  // A held unit is one with no transformation on it: degenerate structure now,
  // or a semantic site (DEF role=site) added later by the role pass.
  const siteSeqs = new Set(
    doc.log.filter(e => e.op === 'DEF' && e.key === 'role' && e.value === 'site').map(e => e.sentIdx)
  );
  doc.sentences.forEach((s, idx) => {
    const held = isDegenerate(s) || siteSeqs.has(idx);
    const el = document.createElement('div');
    el.className = 'sentence' + (held ? ' chrome' : '');
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
