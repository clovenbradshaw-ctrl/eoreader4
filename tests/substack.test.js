import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mdToHtml, buildSubstackPost, buildSubstackHtml, exportSubstack } from '../src/ui/substack.js';

// The Markdown→HTML the answers may carry. Substack parses pasted HTML but not
// pasted Markdown, so the export must turn ## and ** into real tags, not ship them
// as literal characters.
test('mdToHtml maps the block + inline constructs a chat answer carries', () => {
  assert.equal(mdToHtml('# Title'), '<h1>Title</h1>');
  assert.equal(mdToHtml('## Sub'), '<h2>Sub</h2>');
  assert.equal(mdToHtml('Plain text.'), '<p>Plain text.</p>');
  assert.equal(mdToHtml('a\n\nb'), '<p>a</p>\n<p>b</p>');
  assert.equal(mdToHtml('**bold**'), '<p><strong>bold</strong></p>');
  assert.equal(mdToHtml('*em*'), '<p><em>em</em></p>');
  assert.equal(mdToHtml('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(mdToHtml('1. one\n2. two'), '<ol><li>one</li><li>two</li></ol>');
  assert.equal(mdToHtml('> a quote'), '<blockquote>a quote</blockquote>');
  assert.equal(mdToHtml('---'), '<hr>');
  assert.equal(mdToHtml('use `code` here'), '<p>use <code>code</code> here</p>');
  assert.equal(mdToHtml('[text](https://example.com)'),
    '<p><a href="https://example.com">text</a></p>');
});

// HTML in model output is escaped before any tag is emitted — it can never inject markup.
test('mdToHtml escapes HTML in the source text', () => {
  const html = mdToHtml('<script>alert(1)</script>');
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

// The [sN] citation tokens become muted superscript markers — kept, not dropped,
// because grounding is the whole point of this app's answers.
test('mdToHtml turns [sN] citation tokens into superscript markers', () => {
  assert.equal(mdToHtml('See [s12] and [s3].'),
    '<p>See <sup class="cite">[12]</sup> and <sup class="cite">[3]</sup>.</p>');
});

// Regression: an ordinary number in the prose must survive untouched (an earlier
// code-span placeholder scheme would have eaten it).
test('mdToHtml leaves ordinary numbers in the prose alone', () => {
  assert.equal(mdToHtml('In 1862 he left, aged 37.'), '<p>In 1862 he left, aged 37.</p>');
});

// snake_case is not emphasis — underscore emphasis is bounded by non-word edges.
test('mdToHtml does not italicise snake_case identifiers', () => {
  assert.equal(mdToHtml('call read_file_content now'), '<p>call read_file_content now</p>');
});

// The transcript shape: each question is a heading, each answer the rendered prose.
test('buildSubstackPost renders user turns as headings and assistant turns as prose', () => {
  const post = buildSubstackPost([
    { role: 'user', content: 'What is it?' },
    { role: 'assistant', content: 'It is **X** [s2].' },
  ]);
  assert.equal(post, '<h2>What is it?</h2>\n<p>It is <strong>X</strong> <sup class="cite">[2]</sup>.</p>');
});

test('buildSubstackPost skips empty turns', () => {
  assert.equal(buildSubstackPost([
    { role: 'user', content: '   ' },
    { role: 'assistant', content: 'Hi' },
  ]), '<p>Hi</p>');
});

// The standalone page: a real document with the article to copy and the one-click
// copy button, the title escaped, and a provenance line when the docs are known.
test('buildSubstackHtml wraps the post in a copyable, self-contained page', () => {
  const html = buildSubstackHtml(
    [{ role: 'user', content: 'Who wrote it?' }, { role: 'assistant', content: 'The author.' }],
    { docNames: ['book.txt'] });

  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<article id="post">/);
  assert.match(html, /id="copy"/);                       // the one-click copy affordance
  assert.match(html, /navigator\.clipboard/);            // rich-HTML clipboard write
  assert.match(html, /execCommand\('copy'\)/);           // the file:// fallback
  assert.match(html, /<title>In conversation with book\.txt<\/title>/);
  assert.match(html, /<h1>In conversation with book\.txt<\/h1>/);
  assert.match(html, /Grounded in book\.txt/);           // provenance footer
  assert.match(html, /<h2>Who wrote it\?<\/h2>/);
});

test('buildSubstackHtml escapes the title', () => {
  const html = buildSubstackHtml([{ role: 'user', content: 'x' }], { title: 'A & B <c>' });
  assert.match(html, /<title>A &amp; B &lt;c&gt;<\/title>/);
});

test('buildSubstackHtml defaults the title with no docs', () => {
  const html = buildSubstackHtml([{ role: 'user', content: 'hi' }]);
  assert.match(html, /<title>A conversation<\/title>/);
  assert.doesNotMatch(html, /Grounded in/);              // no provenance without docs
});

// The download guard: nothing said yet means no file is handed back (and the DOM
// is never touched, so this is safe to assert under node).
test('exportSubstack is a no-op when there is nothing to publish', () => {
  assert.equal(exportSubstack([]), undefined);
  assert.equal(exportSubstack(null), undefined);
  assert.equal(exportSubstack([{ role: 'user', content: '  ' }]), undefined);
});
