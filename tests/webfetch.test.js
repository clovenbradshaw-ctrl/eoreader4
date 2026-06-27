import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseFeed, htmlToText, createWebClient, searchAndAdmit, fetchAndAdmit, DEFAULT_FEED_PROXY,
} from '../src/ingest/webfetch.js';

// The live half over the CORS feed proxy (docs/web-search.md): GET <proxy>?url=<URL> → raw body.
// Search is done by fetching a feed-SEARCH URL and parsing its items. The offline tests inject a
// fake fetch; one live test (gated behind EO_LIVE_PROXY=1) verifies the real proxy contract.

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>q - Google News</title>
  <item><title>Kafka's Metamorphosis at 110</title><link>https://example.org/a</link>
    <description>&lt;p&gt;A look back at the &lt;b&gt;novella&lt;/b&gt;.&lt;/p&gt;</description>
    <pubDate>Sat, 27 Jun 2026 00:00:00 GMT</pubDate></item>
  <item><title>Grete Samsa, reconsidered</title><link>https://example.org/b</link>
    <description><![CDATA[On the sister's role.]]></description></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>Atom item one</title><link href="https://example.org/x" rel="alternate"/>
    <summary>First summary.</summary><updated>2026-06-27T00:00:00Z</updated></entry>
</feed>`;

// A fake fetch: route the proxied URL by the inner ?url= target to canned bodies.
const fakeFetch = (routes) => async (proxiedUrl) => {
  const inner = decodeURIComponent(new URL(proxiedUrl).searchParams.get('url') || '');
  const body = routes[inner];
  return { ok: body != null, status: body != null ? 200 : 404, text: async () => body ?? '' };
};

test('parseFeed reads RSS items (title, link, summary, date), decoding entities and CDATA', () => {
  const items = parseFeed(RSS);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Kafka's Metamorphosis at 110");
  assert.equal(items[0].link, 'https://example.org/a');
  assert.match(items[0].summary, /A look back at the novella\./);   // HTML in the description stripped
  assert.equal(items[1].summary, "On the sister's role.");          // CDATA unwrapped
});

test('parseFeed reads Atom entries (link via href)', () => {
  const items = parseFeed(ATOM);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Atom item one');
  assert.equal(items[0].link, 'https://example.org/x');
});

test('htmlToText strips tags and decodes entities', () => {
  assert.equal(htmlToText('<h1>Title</h1><p>A &amp; B.</p><script>x()</script>'), 'Title\nA & B.');
});

test('the client builds the proxy URL as ?url=<encoded> and returns the body', async () => {
  let seen = null;
  const fetchImpl = async (u) => { seen = u; return { ok: true, status: 200, text: async () => 'BODY' }; };
  const c = createWebClient({ proxy: 'https://p.example/feed', fetchImpl });
  const r = await c.fetchUrl('https://news.example/rss?q=a&b=2');
  assert.equal(seen, 'https://p.example/feed?url=' + encodeURIComponent('https://news.example/rss?q=a&b=2'));
  assert.equal(r.text, 'BODY');
});

test('search → admit: feed results become provenance-tagged sources in scope', async () => {
  const searchUrl = (q) => `https://news.example/rss?q=${encodeURIComponent(q)}`;
  const client = createWebClient({
    proxy: 'https://p.example/feed', searchUrl,
    fetchImpl: fakeFetch({ [searchUrl('grete')]: RSS }),
  });
  const admitted = await searchAndAdmit('grete', { client, k: 2 });
  assert.equal(admitted.length, 2);
  assert.equal(admitted[0].doc.sourceKind, 'web-source');
  assert.equal(admitted[0].doc.web.url, 'https://example.org/a');
  assert.equal(admitted[0].record.retrieval_query, 'grete');
  assert.ok((admitted[0].doc.units || admitted[0].doc.sentences).length >= 1, 'the result admitted as a parsed doc');
});

test('fetchAndAdmit pulls a page through the proxy and admits its text', async () => {
  const client = createWebClient({
    proxy: 'https://p.example/feed',
    fetchImpl: fakeFetch({ 'https://example.org/a': '<h1>Grete</h1><p>She played the violin.</p>' }),
  });
  const { doc, record } = await fetchAndAdmit('https://example.org/a', { client });
  assert.equal(record.url, 'https://example.org/a');
  assert.match(doc.text, /Grete\nShe played the violin\./);
});

// Live contract check against the real proxy — opt-in (the default run stays offline/green):
//   EO_LIVE_PROXY=1 node --test tests/webfetch.test.js
test('LIVE: the real feed proxy fetches a URL and search-by-feed returns items', { skip: !process.env.EO_LIVE_PROXY }, async () => {
  const c = createWebClient({ proxy: DEFAULT_FEED_PROXY });
  const page = await c.fetchUrl('https://example.com/');
  assert.match(page.text, /Example Domain/);
  const items = await c.search('kafka metamorphosis', { k: 5 });
  assert.ok(items.length > 0 && items[0].title, 'the feed proxy returned search items');
});
