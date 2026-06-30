import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runArtifact, createSpecLibrary, artifactKindOf, assembleOutput } from '../src/tasks/index.js';

// The UI writer path (src/ui/app.js · runWrite) is wired entirely from injected faces — an
// `exampleSearch` (the web) and a `generate` (the model). This test reconstructs that exact
// wiring with stubs, so a regression in the contract the UI depends on is caught here without
// a browser: the shape `exampleSearch` returns must be readable by `acquireSpec`'s default
// extractor, and `runArtifact` must compose a real artifact from the learned form.

// Real public-domain Emily Dickinson poems — the EXAMPLES the engine learns the form from.
const DICKINSON = [
`Because I could not stop for Death –
He kindly stopped for me –
The Carriage held but just Ourselves –
And Immortality.

We slowly drove – He knew no haste
And I had put away
My labor and my leisure too,
For His Civility –`,

`Hope is the thing with feathers –
That perches in the soul –
And sings the tune without the words –
And never stops – at all –

And sweetest – in the Gale – is heard –
And sore must be the storm –
That could abash the little Bird
That kept so many warm –`,
];

// The UI's `exampleSearch` resolves to whatever `searchAndAdmit` returns: an array of admitted
// records, each carrying a parsed `doc` whose `.text` is the full page. `acquireSpec`'s default
// extractor reads `r.doc.text`, so a search-shaped result feeds the learner with no custom
// extractor — the contract runWrite relies on.
const searchAndAdmitShaped = async () =>
  DICKINSON.map((text, i) => ({ item: { url: `ex://${i}` }, doc: { docId: `d${i}`, text }, record: { excerpt: text.slice(0, 80) } }));

test('the UI writer path composes a poem from search-shaped examples + a stub model', async () => {
  const request = 'write an emily dickinson poem';
  assert.equal(artifactKindOf(request), 'emily dickinson poem', 'the request is understood as a make-this, not a question');

  const seen = [];
  // A stub renderer standing in for model.phrase: it records the per-leaf instruction it was
  // handed (so we can assert the learned form crossed the membrane) and emits one stanza.
  const generate = async (view) => {
    seen.push(view.goal);
    return { output: `stanza for: ${view.role}`, sources: [] };
  };

  const library = createSpecLibrary();
  const res = await runArtifact({ request, library, exampleSearch: searchAndAdmitShaped, generate });

  // It LEARNED the form from the examples (not the offline arc floor).
  assert.equal(res.spec.source, 'learned', 'the shape was learned from the examples, not the floor');
  assert.equal(res.spec.format, 'verse', 'a poem is verse');
  assert.ok(res.spec.sections.length >= 2, 'the learned poem has stanza sections');

  // The learned form crossed into the renderer's instruction — the meter/dash detail the model
  // is told to honor (proof the substrate fixed the structure and the model only renders).
  assert.ok(seen.some((g) => /lines/.test(g)), 'each leaf instruction carries the learned line form');

  // It actually WROTE something — the assembled artifact, not a memory of Dickinson.
  const out = assembleOutput(res.graph.root).trim();
  assert.ok(out.length > 0, 'an artifact was composed');
  assert.equal(out, res.output.trim(), 'res.output is the assembled artifact');
  assert.equal(res.progress.done, res.progress.total, 'every leaf landed');
});

test('a learned kind is reused with no second search', async () => {
  const library = createSpecLibrary();
  let searches = 0;
  const exampleSearch = async () => { searches += 1; return searchAndAdmitShaped(); };
  const generate = async (view) => ({ output: view.role, sources: [] });

  await runArtifact({ request: 'write an emily dickinson poem', library, exampleSearch, generate });
  await runArtifact({ request: 'write an emily dickinson poem about the sea', library, exampleSearch, generate });
  assert.equal(searches, 1, 'the second request reuses the learned shape — the internet is consulted once');
});
