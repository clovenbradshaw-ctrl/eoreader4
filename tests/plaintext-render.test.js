import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { looksPlainText, plainTextParagraphs, plainTextToHtml } from '../src/ingest/plaintext.js';

// REGRESSION: a Project Gutenberg .txt (or any plain-text body) opened in the reader
// used to be dropped into the iframe as raw HTML, so the browser's default
// white-space:normal collapsed every newline and the whole book reflowed into one
// run-on, justified blob (see ingest/plaintext.js). These tests pin the fix: the body
// is detected as plain text and its paragraph structure is rebuilt as real <p> blocks.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('looksPlainText trusts an explicit text/plain content-type', () => {
  assert.equal(looksPlainText('text/plain; charset=utf-8', 'anything'), true);
  assert.equal(looksPlainText('text/html', '<p>hi</p>'), false);
});

test('looksPlainText sniffs the body when content-type is missing', () => {
  assert.equal(looksPlainText('', 'Just some prose with\n\nblank lines.'), true);
  assert.equal(looksPlainText('', '<!doctype html><html><body><p>x</p></body></html>'), false);
  assert.equal(looksPlainText('', '<div>chunk</div>'), false);
});

test('blank-line paragraphs become separate <p> blocks', () => {
  const raw = 'First paragraph here.\n\nSecond paragraph here.\n\nThird one.';
  const ps = plainTextParagraphs(raw);
  assert.equal(ps.length, 3);
  assert.deepEqual(ps, ['<p>First paragraph here.</p>', '<p>Second paragraph here.</p>', '<p>Third one.</p>']);
});

test('hard line wraps inside a paragraph collapse to spaces', () => {
  const raw = 'A line that was hard-wrapped\nat seventy columns\nlike Gutenberg does.\n\nNext.';
  const ps = plainTextParagraphs(raw);
  assert.equal(ps[0], '<p>A line that was hard-wrapped at seventy columns like Gutenberg does.</p>');
});

test('a body with no blank lines is kept verbatim in a pre-wrap block', () => {
  const raw = 'line one\nline two\nline three';
  const ps = plainTextParagraphs(raw);
  assert.equal(ps.length, 1);
  assert.match(ps[0], /^<pre class="eo-raw">/);
  assert.match(ps[0], /line one\nline two\nline three/);
});

test('paragraph text is HTML-escaped (no markup injection)', () => {
  const ps = plainTextParagraphs('a < b & c > d\n\nsecond');
  assert.equal(ps[0], '<p>a &lt; b &amp; c &gt; d</p>');
});

test('plainTextToHtml produces a real document with the reading column', () => {
  const html = plainTextToHtml('One.\n\nTwo.', { url: 'https://example.org/book.txt' });
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<base href="https:\/\/example\.org\/book\.txt"/);
  assert.match(html, /<p>One\.<\/p>/);
  assert.match(html, /<p>Two\.<\/p>/);
  assert.match(html, /\.eo-book\{max-width:var\(--eo-maxw\)/);
});

test('a real Gutenberg .txt fixture renders as many paragraphs, not one blob', () => {
  const raw = readFileSync(join(root, 'pg5200.txt'), 'utf8');
  const ps = plainTextParagraphs(raw);
  // Metamorphosis has hundreds of paragraphs; the bug produced exactly 1.
  assert.ok(ps.length > 50, `expected many paragraphs, got ${ps.length}`);
  assert.ok(ps.every((p) => p.startsWith('<p>')), 'every block should be a <p>');
});

// The reader app is shipped as two inlined copies (index.html and src/reader/app.dc.js).
// Guard that both still route plain-text bodies through the explicit renderer rather
// than the raw-as-HTML path, so the regression can't silently come back in either copy.
for (const page of ['index.html', 'src/reader/app.dc.js']) {
  test(`${page} renders plain-text bodies with _plainTextDoc`, () => {
    const src = readFileSync(join(root, page), 'utf8');
    assert.match(src, /_isPlainText\s*\(/, `${page} is missing the _isPlainText guard`);
    assert.match(src, /_plainTextDoc\s*\(/, `${page} is missing the _plainTextDoc renderer`);
    // loadCenter must consult the content-type, not assume HTML.
    assert.match(src, /content-type['"]\)\|\|''\)?;return r\.text\(\)/,
      `${page} loaders must capture the content-type before reading the body`);
  });
}
