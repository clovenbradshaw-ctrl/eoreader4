// ui/essay-thread — the essay organ's chat-shaped emission, shared.
//
// The essay generates ACROSS MANY MESSAGES: a status beat while the planner runs, a title
// card once the arc is known, one streamed message per section, and a closing card with the
// word count against the floor and copy/download of the whole assembled piece. This factors
// that emission out of the standalone surface (src/ui/essay.js) so the chat app renders an
// essay the very same way, into ITS message list — createEssayThread(messagesEl) binds the
// renderers to whichever thread the essay lands in. DOM only; no generation logic (the walk
// lives in organs/out/essay.js) and no model.

import { ESSAY_MIN_WORDS } from '../organs/out/essay.js';

const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const createEssayThread = (messagesEl) => {
  const scrollDown = () => { messagesEl.scrollTop = messagesEl.scrollHeight; };

  // A plain assistant status message — the "Outlining the essay…" beat while the planner runs.
  const statusMessage = (text) => {
    const el = document.createElement('div');
    el.className = 'msg assistant essay thinking';
    el.innerHTML = `<div class="essay-status"><span class="dots"></span><span class="lbl">${escapeHtml(text)}</span></div>`;
    messagesEl.appendChild(el);
    scrollDown();
    return {
      el,
      set: (msg) => { const l = el.querySelector('.lbl'); if (l) l.textContent = msg; },
      remove: () => el.remove(),
      fail: (msg) => { const l = el.querySelector('.lbl'); if (l) l.textContent = msg; el.classList.remove('thinking'); },
    };
  };

  // The TITLE card — the first message of the essay, once the arc is planned. `sub` is an
  // optional one-line subtitle (the chat shows the essay type it is steering by).
  const titleMessage = (title, sub = '') => {
    const el = document.createElement('div');
    el.className = 'msg assistant essay done';
    el.innerHTML = `<div class="essay-body"><h1>${escapeHtml(title)}</h1>` +
                   (sub ? `<div class="essay-sub">${escapeHtml(sub)}</div>` : '') +
                   `</div>`;
    messagesEl.appendChild(el);
    scrollDown();
    return el;
  };

  // One SECTION message — a fresh assistant bubble the section streams into, then reflows to
  // a heading + paragraphs on close. Each is its own message in the thread.
  const sectionMessage = (heading) => {
    const el = document.createElement('div');
    el.className = 'msg assistant essay streaming';
    el.innerHTML = `<div class="essay-status"><span class="dots"></span><span class="lbl">Writing “${escapeHtml(heading)}”…</span></div>` +
                   `<div class="essay-body"><h2>${escapeHtml(heading)}</h2><div class="sec"></div></div>`;
    messagesEl.appendChild(el);
    scrollDown();
    const sec = el.querySelector('.sec');
    return {
      stream: (piece) => { sec.textContent += piece; scrollDown(); },
      // Close: drop the status, reflow the streamed text into paragraphs (blank-line split).
      finalize: ({ text } = {}) => {
        el.classList.remove('streaming');
        el.classList.add('done');
        el.querySelector('.essay-status')?.remove();
        const body = el.querySelector('.essay-body');
        const paras = String(text || sec.textContent || '')
          .split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
        const html = [`<h2>${escapeHtml(heading)}</h2>`];
        for (const p of paras) html.push(`<p>${p.split('\n').map(escapeHtml).join('<br>')}</p>`);
        if (paras.length === 0 && sec.textContent.trim()) html.push(`<p>${escapeHtml(sec.textContent.trim())}</p>`);
        body.innerHTML = html.join('');
        scrollDown();
      },
    };
  };

  const actionButton = (label, title, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'msg-action';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', () => onClick(b));
    return b;
  };

  // The CLOSING card — its own message, once every section has landed: the total word count
  // against the floor, copy / download of the WHOLE assembled essay, and (optionally) what
  // the essay TYPE just learned from this run (`learnedNote`).
  const closingMessage = (res, { learnedNote = '' } = {}) => {
    const el = document.createElement('div');
    el.className = 'msg assistant essay done';
    const meta = document.createElement('div');
    meta.className = 'essay-meta';
    const count = document.createElement('span');
    count.innerHTML = res.aborted
      ? `<span class="under">Stopped — ${res.words} words</span>`
      : (res.words >= ESSAY_MIN_WORDS
          ? `Essay complete · ${res.words} words across ${res.sections.length} sections — clears the ${ESSAY_MIN_WORDS.toLocaleString()}-word floor`
          : `<span class="under">${res.words} words across ${res.sections.length} sections — under the ${ESSAY_MIN_WORDS.toLocaleString()}-word floor</span>`);
    meta.appendChild(count);

    const actions = document.createElement('span');
    actions.className = 'essay-actions';
    actions.appendChild(actionButton('⧉ Copy', 'Copy the whole essay', async (b) => {
      try { await navigator.clipboard.writeText(res.text); b.textContent = '✓ Copied'; setTimeout(() => { b.textContent = '⧉ Copy'; }, 1200); } catch { /* ignore */ }
    }));
    actions.appendChild(actionButton('⇩ .md', 'Download the whole essay as Markdown', () => {
      const blob = new Blob([res.text], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(res.title || 'essay').replace(/[^\w-]+/g, '-').toLowerCase().slice(0, 60)}.md`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }));
    meta.appendChild(actions);
    el.appendChild(meta);

    // What the type learned from this run — the visible face of "types that learn".
    if (learnedNote) {
      const learned = document.createElement('div');
      learned.className = 'essay-learned';
      learned.textContent = learnedNote;
      el.appendChild(learned);
    }
    messagesEl.appendChild(el);
    scrollDown();
    return el;
  };

  return { statusMessage, titleMessage, sectionMessage, closingMessage };
};
