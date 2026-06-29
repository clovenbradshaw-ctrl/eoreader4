import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRich, formatInline } from '../src/ui/chat.js';

// The chat answer body renders as markdown-lite (renderRich): the light structure a
// multi-section answer carries — `## headings`, `**bold**`, `- lists` — becomes real HTML
// instead of literal punctuation, WITHOUT ever introducing un-escaped markup. These pin both
// halves: the structure is honoured, and the escape-first guarantee holds.

test('a plain paragraph is wrapped in <p>, text escaped', () => {
  assert.equal(renderRich('A simple answer.'), '<p>A simple answer.</p>');
  assert.equal(renderRich('a < b & c > d'), '<p>a &lt; b &amp; c &gt; d</p>');
});

test('blank-line blocks become separate paragraphs', () => {
  assert.equal(renderRich('One.\n\nTwo.'), '<p>One.</p><p>Two.</p>');
});

test('hard line wraps inside a paragraph become <br>', () => {
  assert.equal(renderRich('line one\nline two'), '<p>line one<br>line two</p>');
});

test('## heading becomes an <h3>, deeper headings an <h4>', () => {
  assert.equal(renderRich('## Visibility Design'), '<h3>Visibility Design</h3>');
  assert.equal(renderRich('# Lead'), '<h3>Lead</h3>');
  assert.equal(renderRich('### Detail'), '<h4>Detail</h4>');
});

test('a dash/star block becomes a <ul>; a numbered block becomes an <ol>', () => {
  assert.equal(renderRich('- first\n- second'), '<ul><li>first</li><li>second</li></ul>');
  assert.equal(renderRich('* a\n* b'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(renderRich('1. one\n2. two'), '<ol><li>one</li><li>two</li></ol>');
});

test('**bold** and *italic* render as <strong>/<em>', () => {
  assert.equal(formatInline('the **periscope** matters'), 'the <strong>periscope</strong> matters');
  assert.equal(formatInline('a *side* window'), 'a <em>side</em> window');
  // bold wins over italic on a doubled marker
  assert.equal(formatInline('**both**'), '<strong>both</strong>');
});

test('citations still linkify, and link to a web source when one is mapped', () => {
  assert.match(renderRich('Grounded.[s1]'), /<span class="cite" data-idx="1">\[s1\]<\/span>/);
  const sources = { 1: { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/X' } };
  const html = renderRich('Grounded.[s1]', sources);
  assert.match(html, /<a class="cite cite-web" data-idx="1" href="https:\/\/en\.wikipedia\.org\/wiki\/X"/);
});

test('markup in the source text cannot inject tags (escape-first)', () => {
  assert.equal(renderRich('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  // a bold span around hostile text still escapes the hostile text
  assert.equal(formatInline('**<img>**'), '<strong>&lt;img&gt;</strong>');
});

test('a full multi-section answer renders heading + bold + list together', () => {
  const answer = [
    'Charles Lindbergh had **no front windshield**.[s1]',
    '## Side Windows',
    'He relied on the **large windows**.[s2]',
    '- slipped the aircraft\n- used a periscope',
  ].join('\n\n');
  const html = renderRich(answer);
  assert.match(html, /<p>Charles Lindbergh had <strong>no front windshield<\/strong>/);
  assert.match(html, /<h3>Side Windows<\/h3>/);
  assert.match(html, /<ul><li>slipped the aircraft<\/li><li>used a periscope<\/li><\/ul>/);
});
