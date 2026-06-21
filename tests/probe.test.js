import { test } from 'node:test';
import assert from 'node:assert/strict';

import { survey, renderMap, membraneBreaches, fusedHolons, crawlGraph } from '../src/probe/index.js';

// The Koestlerian probe surveys the code for holon-strain. The detectors are pure
// reads over the module/holon graph, so they are tested against PLANTED violations
// on synthetic graphs; the gate (deriveNull over the code's own strain) and the
// read-only/criterion-bound discipline are tested through survey().

// Build a synthetic graph: files = { rel: [imported rel…] }, holons = [dir…].
const G = (files, holons) => Object.freeze({
  root: 'src',
  files: new Map(Object.entries(files).map(([rel, imports]) =>
    [rel, { rel, dir: rel.split('/').slice(0, -1).join('/'), imports }])),
  holons: new Set(holons),
});

// ── detector 1: membrane breach ──────────────────────────────────────────────

test('membrane breach: reaching into another holon\'s internals is flagged; through its face is clean', () => {
  const g = G({
    'a/index.js': ['a/internal.js'],   // same-holon internal use — fine
    'a/internal.js': [],
    'a/i1.js': [], 'a/i2.js': [], 'a/i3.js': [],
    'b/index.js': [],
    'b/user.js': ['a/i1.js', 'a/i2.js', 'a/index.js'],   // 2 breaches + 1 clean (the face)
    'b/clean.js': ['b/internal.js'],   // same-holon — fine
    'b/internal.js': [],
  }, ['a', 'b']);

  const { findings } = membraneBreaches(g);
  const f = findings.find(x => x.locus === 'b/user.js');
  assert.ok(f, 'the reaching module is the locus');
  assert.equal(f.strain, 2, 'two internal reaches; the face import does not count');
  assert.ok(f.evidence.includes('a/i1.js') && !f.evidence.includes('a/index.js'), 'evidence is the offending internals only');
  assert.match(f.criterion, /membrane/i, 'cites the Koestler criterion');
  assert.ok(!findings.some(x => x.locus === 'b/clean.js'), 'same-holon imports are not breaches');
});

// ── detector 3: fused holon ──────────────────────────────────────────────────

test('fused holon: two disjoint holons coupled in both directions are flagged; nesting and one-way are not', () => {
  const g = G({
    'x/index.js': [], 'x/a.js': ['y/b.js'],        // x → y
    'y/index.js': [], 'y/b.js': [], 'y/c.js': ['x/a.js'],   // y → x  → x ⇄ y fused
    'p/index.js': [], 'p/a.js': ['q/b.js'],        // p → q only (one-way)
    'q/index.js': [], 'q/b.js': [],
    'core/index.js': ['core/sub/index.js'],        // nesting: core ⇄ core/sub
    'core/sub/index.js': ['core/util.js'], 'core/util.js': [],
  }, ['x', 'y', 'p', 'q', 'core', 'core/sub']);

  const { findings } = fusedHolons(g);
  const loci = findings.map(f => f.locus);
  assert.ok(loci.includes('x ⇄ y'), 'mutual disjoint coupling is fusion');
  assert.ok(!loci.some(l => l.includes('p') || l.includes('q')), 'one-directional coupling is not fusion');
  assert.ok(!loci.some(l => l.includes('core')), 'a part using its whole is nesting, not fusion');
  assert.match(findings[0].criterion, /sub-whole|membrane/i);
});

// ── survey: the alpha gate, ranking, abstention, criterion-bound ──────────────

test('survey gates against the code\'s own strain, ranks by z, and is read-only + criterion-bound', () => {
  const g = G({
    'a/index.js': [], 'a/i1.js': [], 'a/i2.js': [], 'a/i3.js': [],
    'b/index.js': [],
    'b/heavy.js': ['a/i1.js', 'a/i2.js', 'a/i3.js'],   // strain 3 — the outlier
    'b/light.js': [],   'b/c1.js': [], 'b/c2.js': [], 'b/c3.js': [],   // clean → the background of zeros
  }, ['a', 'b']);

  const report = survey({ graph: g, alpha: 0.01, commit: 'deadbeef' });

  assert.ok(Object.isFrozen(report) && Object.isFrozen(report.findings), 'the report is a frozen survey, not a mutable handle');
  const heavy = report.findings.find(f => f.locus === 'b/heavy.js');
  assert.ok(heavy, 'the outlier beats the null over the distribution of zeros');
  assert.ok(heavy.z > 0 && Number.isFinite(heavy.null), 'a finding carries its z and the null it beat');
  for (const f of report.findings) assert.ok(f.criterion, 'every finding cites a criterion (criterion-bound)');
  assert.ok(report.findings === report.findings.slice().sort((a, b) => b.z - a.z || b.strain - a.strain) ||
    report.findings.every((f, i, a) => i === 0 || a[i - 1].z >= f.z), 'ranked gravest-first by z');
});

test('survey abstains (NUL) on a signature whose distribution is too thin to gate', () => {
  // No fusion couplings at all → fused-holon has too thin a background to derive a null.
  const g = G({
    'a/index.js': [], 'a/i.js': [], 'b/index.js': [], 'b/u.js': ['a/i.js'],
    'b/c1.js': [], 'b/c2.js': [],
  }, ['a', 'b']);
  const report = survey({ graph: g, alpha: 0.01 });
  const abstained = report.notAssessed.map(n => n.signature || n);
  assert.ok(abstained.includes('fused-holon'), 'a thin distribution is not assessed, never silently approved');
});

// ── the real run (smoke): the probe's first map of the reorged code ───────────

test('survey runs on the real source tree and returns a criterion-bound map', () => {
  const report = survey({ root: 'src', alpha: 0.01 });
  assert.ok(Array.isArray(report.findings));
  for (const f of report.findings) {
    assert.ok(f.criterion && f.locus && Number.isFinite(f.strain), 'a real finding is located, measured, criterion-cited');
  }
  // Surface the first map for the human (the probe REPORTS; it does not act).
  console.log('\n' + renderMap(report) + '\n');
});

test('the graph crawler constitutes the real holon field', () => {
  const g = crawlGraph({ root: 'src' });
  assert.ok(g.files.size > 50, 'it perceives the modules');
  assert.ok(g.holons.has('src/core') && g.holons.has('src/core/enactor'), 'it perceives the holon faces, nested ones too');
});
