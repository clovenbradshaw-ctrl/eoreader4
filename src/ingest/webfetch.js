// The web FETCH/SEARCH client — the live half that feeds the admission core (websource.js).
// (docs/web-search.md)
//
// The proxy is a CORS fetch proxy: GET <proxy>?url=<http(s) URL> returns that URL's raw body as
// text (the n8n `feed` webhook — feed-friendly Accept, 5 redirects, 15s, CORS *). It is NOT a
// search engine, so SEARCH is done by fetching a feed-SEARCH URL (Google News RSS by default)
// and parsing the items — the same one fetch primitive carries both. The local talker never
// reaches the network; this mechanical layer fetches and the admission core binds.

import { admitWebSource } from './websource.js';

// The proxy the user pointed us at. Overridable per client; no auto-fire is wired here — a
// caller (a confirmed user action) constructs the client and admits the results into scope.
export const DEFAULT_FEED_PROXY = 'https://n8n.intelechia.com/webhook/feed';

// Search by FEED: a query → a feed-search URL the proxy can fetch. Google News RSS is the
// default (the proxy's Accept headers prefer feeds); swap `searchUrl` for another engine.
const NEWS_RSS = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}`;

const decodeEntities = (s) => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

const firstTag = (block, name) => {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  return m ? decodeEntities(m[1]).trim() : '';
};

// Strip an HTML page to readable text: drop script/style, turn block ends into newlines, remove
// the rest of the tags, decode entities, collapse whitespace. Pragmatic, dependency-free — the
// readability the proxy does not do server-side (the proxy is feed-oriented, returns raw body).
export const htmlToText = (html) => decodeEntities(String(html || '')
  .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer|blockquote)>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' '))
  .replace(/[ \t]+/g, ' ')
  .replace(/ +([.,;:!?])/g, '$1')          // inline tags removed → no space before punctuation
  .replace(/\n{3,}/g, '\n\n')
  .replace(/[ \t]*\n[ \t]*/g, '\n')
  .trim();

// parseFeed(xml) → items [{ title, link, summary, published }] for RSS (<item>) and Atom
// (<entry>). Pure and regex-based (no DOM in Node), defensive: a malformed block yields a
// best-effort item, never a throw.
export const parseFeed = (xml) => {
  const s = String(xml || '');
  const out = [];
  const isAtom = /<entry\b/i.test(s) && !/<item\b/i.test(s);
  const blocks = s.match(isAtom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const title = firstTag(b, 'title');
    let link = firstTag(b, 'link');
    if (!link || isAtom) {                       // Atom: <link href="…">
      const m = /<link\b[^>]*\bhref=["']([^"']+)["']/i.exec(b);
      if (m) link = decodeEntities(m[1]).trim();
    }
    const summary = htmlToText(firstTag(b, 'description') || firstTag(b, 'summary') || firstTag(b, 'content'));
    const published = firstTag(b, 'pubDate') || firstTag(b, 'updated') || firstTag(b, 'published') || '';
    if (title || link) out.push({ title, link, summary, published });
  }
  return out;
};

// createWebClient({ proxy, fetchImpl, searchUrl }) → the fetch/search instrument. `fetchImpl` is
// injectable (the real fetch in app/Node; a fake in tests). `fetchUrl` is the one primitive;
// `search` rides it over a feed-search URL.
export const createWebClient = ({
  proxy = DEFAULT_FEED_PROXY,
  fetchImpl = (typeof fetch !== 'undefined' ? fetch : null),
  searchUrl = NEWS_RSS,
} = {}) => {
  const proxied = (url) => `${proxy}?url=${encodeURIComponent(url)}`;
  const fetchUrl = async (url) => {
    if (!fetchImpl) throw new Error('webfetch: no fetch implementation available');
    const res = await fetchImpl(proxied(url));
    const text = await res.text();
    return { url, text, ok: res.ok !== false, status: res.status ?? 200 };
  };
  const search = async (query, { k = 8 } = {}) => parseFeed((await fetchUrl(searchUrl(query))).text).slice(0, k);
  return { proxy, proxied, fetchUrl, search };
};

const nowIso = () => { try { return new Date().toISOString(); } catch { return null; } };

// Fetch one page through the proxy and ADMIT it as a web source (websource.js). The page's HTML
// is reduced to text before admission so the parse sees prose, not tags.
export const fetchAndAdmit = async (url, { client, store = null, fetched_at = nowIso() } = {}) => {
  const c = client || createWebClient();
  const { text } = await c.fetchUrl(url);
  const payload = { url, text: htmlToText(text), fetched_at, engine: 'feed-proxy' };
  return store ? store.admit(payload) : admitWebSource(payload);
};

// searchAndAdmit(query) → search by feed, then admit the top results. By default the feed item
// (title + summary) is admitted as a light source; with `fetchPages` each result's full page is
// fetched through the proxy and admitted instead. Returns [{ item, doc, record, … }].
export const searchAndAdmit = async (query, { client, store = null, k = 5, fetchPages = false, fetched_at = nowIso() } = {}) => {
  const c = client || createWebClient();
  const items = await c.search(query, { k });
  const out = [];
  for (const it of items) {
    let text = it.summary || it.title || '';
    if (fetchPages && it.link) {
      try { text = htmlToText((await c.fetchUrl(it.link)).text) || text; } catch { /* keep the summary */ }
    }
    const payload = { url: it.link || c.proxied(query), title: it.title, text,
                      excerpt: it.summary, retrieval_query: query, engine: 'feed-proxy', fetched_at };
    const admitted = store ? store.admit(payload) : admitWebSource(payload);
    out.push({ item: it, ...admitted });
  }
  return out;
};
