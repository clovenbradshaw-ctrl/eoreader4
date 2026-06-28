// Cross-source identity: a name borne by two sources is one nameless referent by default,
// but FORKS into distinct referents when a source's context defeats the coreference — the
// 1995 film "Heat" must not be the same referent as the weather phenomenon "heat".
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseText } from '../src/perceiver/parse/index.js';
import { referentMap, referentLabels } from '../src/reader/cross-source.js';

const page = (url, title, text) => {
  const doc = parseText(text, { coordSubjects: true });
  return { url, title, events: doc.log.snapshot(), sentences: doc.sentences };
};

// Two weather sources (CNN + CDC) and a film source whose title disambiguates the name.
const cnn = page('https://cnn.com/heat', 'A searing heat dome - CNN',
  'Heat is dangerous. The United States faces extreme Heat this week. Utah and Colorado swelter under the Heat. Extreme Heat warnings now cover Chicago and Dallas. The dangerous Heat brings record temperatures.');
const cdc = page('https://cdc.gov/heat', 'Heat-related Illnesses | CDC',
  'Heat illness is dangerous. Extreme Heat harms the body. Extreme Heat warnings save lives. Stay cool in dangerous Heat. The Heat raises body temperatures to record levels.');
const film = page('https://en.wikipedia.org/wiki/Heat_(1995_film)', 'Heat (1995 film) - Wikipedia',
  'Heat is a 1995 American crime film. Michael Mann directed Heat. Al Pacino starred in Heat. Robert De Niro appears in Heat. Los Angeles is the setting of Heat. Val Kilmer also stars in Heat.');

const heatIdOf = (remap, url) => remap.get(url)?.get('heat')?.id ?? null;

test('the film and the weather phenomenon are distinct nameless referents', () => {
  const { remap, forks } = referentMap([cnn, cdc, film]);
  const cnnId = heatIdOf(remap, cnn.url);
  const cdcId = heatIdOf(remap, cdc.url);
  const filmId = heatIdOf(remap, film.url);

  assert.ok(cnnId && cdcId && filmId, 'every source binds "heat" to a referent');
  // qua weather vs qua film: the film is NOT the weather referent.
  assert.notEqual(filmId, cnnId, 'film "Heat" forks away from the weather referent');
  assert.notEqual(filmId, cdcId, 'film "Heat" forks away from the CDC weather referent');
  // The two weather sources corroborate (shared topic terms) → one referent.
  assert.equal(cnnId, cdcId, 'the two weather sources stay one referent');

  // The fork carries its sense as a defeasible DEF, read off the disambiguated title.
  const filmFork = forks.find(f => f.id === filmId);
  assert.ok(filmFork, 'the film referent is recorded as a fork');
  assert.equal(filmFork.sense, '1995 film', 'sense is the title disambiguator');
});

test('referent ids are nameless — never the bare display token', () => {
  const { remap } = referentMap([cnn, cdc, film]);
  for (const url of [cnn.url, cdc.url, film.url]) {
    const id = heatIdOf(remap, url);
    assert.notEqual(id, 'heat', 'no bare token survives as an id');
    assert.doesNotMatch(id, /heat/, 'the id carries no readable name');
    assert.match(id, /^e[0-9a-z]+$/, 'the id is a nameless hash');
  }
});

test('an unambiguous shared name is one referent across sources (no over-fork)', () => {
  // "United States" appears in both weather sources with corroborating context: it must
  // remain a single referent, not fragment — defeasibility forks only on conflict.
  const { remap } = referentMap([cnn, cdc, film]);
  const usCnn = remap.get(cnn.url)?.get('united-states')?.id;
  const usCdc = remap.get(cdc.url)?.get('united-states')?.id;
  if (usCnn && usCdc) assert.equal(usCnn, usCdc, '"United States" stays one referent');
});

test('a name read in a single source is still a nameless referent', () => {
  const { remap } = referentMap([film]);
  const mann = remap.get(film.url)?.get('michael-mann')?.id;
  assert.ok(mann, 'a single-source name gets a referent id');
  assert.match(mann, /^e[0-9a-z]+$/, 'and it is nameless');
});

// The display-name regression: the web graph showed nameless hashIds in place of names.
// referentLabels inverts the re-key plan so every referent's name stays reachable — the
// reader's labelOf() consults it for referents projectGraph never labelled (those that
// appear only as a relation endpoint, never INS'd in their own right).
test('referentLabels recovers a readable name for every nameless referent', () => {
  const { remap } = referentMap([cnn, cdc, film]);
  const labels = referentLabels(remap);

  assert.ok(labels.size > 0, 'the index is populated');
  // Every nameless hashId maps to a readable name, never back to the bare hash.
  for (const [id, label] of labels) {
    assert.match(id, /^e[0-9a-z]+$/, 'keys are the nameless referent ids');
    assert.notEqual(label, id, 'the name is never the hashId itself');
    assert.ok(label && label.length > 0, 'every referent has a non-empty name');
  }
  // The name the remap assigned each referent is exactly the one the index returns.
  for (const byBase of remap.values())
    for (const r of byBase.values())
      assert.equal(labels.get(r.id), r.label, 'the index agrees with the remap');
});

// labelOf's fallback chain, reproduced: a referent that has an entity-with-label keeps it;
// one projectGraph left unlabelled (endpoint-only) recovers its name from the index rather
// than leaking the bare hashId; an unknown id degrades to itself.
test('the labelOf fallback never surfaces a bare hashId for a known referent', () => {
  const { remap } = referentMap([cnn, cdc, film]);
  const labels = referentLabels(remap);
  const entities = new Map();                          // empty: simulate endpoint-only nodes
  const labelOf = (id) => {
    const e = entities.get(id);
    if (e && e.label) return e.label;
    return labels.get(id) || id;
  };
  const heatId = remap.get(cnn.url)?.get('heat')?.id;
  assert.ok(heatId, 'the weather "heat" has a referent');
  assert.notEqual(labelOf(heatId), heatId, 'an endpoint-only referent shows its name, not the hash');
  assert.equal(labelOf(heatId), 'Heat', 'and the name is the display token');
  assert.equal(labelOf('e-nonexistent'), 'e-nonexistent', 'an unknown id degrades to itself');
});
