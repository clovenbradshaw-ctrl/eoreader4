import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildDensity, eigenLenses, vonNeumann } from '../src/core/index.js';
import {
  reverseComplement, parseFasta, codonsOf, codonVector, codonReadings, frameReading, isStop,
} from '../src/organs/in/locus.js';

const entropy = (rho) => vonNeumann(eigenLenses(rho).map((l) => l.weight).filter((w) => w > 1e-12));

// ── Test 0: the synthetic positive control (docs/genome-rho.md) ──────────────
// Two overlapping readings A,B; one vantage asserts both, a second DEFEATS A. Signed,
// the defeat must cancel A and collapse ρ to a single lens; unsigned keeps two.
test('Test 0 — signing a defeat collapses the planted cancellation', () => {
  const A = [1, 0, 0, 0], B = [0.8, 0.6, 0, 0];
  const vecs = [A, B, A];
  const unsigned = buildDensity(vecs).rho;
  const signed = buildDensity(vecs, null, [1, 1, -1]).rho;

  const su = eigenLenses(unsigned).map((l) => l.weight).filter((w) => w > 1e-9);
  const ss = eigenLenses(signed).map((l) => l.weight).filter((w) => Math.abs(w) > 1e-9);
  assert.equal(su.length, 2, 'unsigned keeps both readings');
  assert.equal(ss.length, 1, 'signed annihilates A, leaving one lens');
  assert.ok(entropy(signed) < entropy(unsigned) - 1e-6, 'signed entropy is lower');
  assert.ok(entropy(signed) < 1e-9, 'signed collapses to a pure state');
});

// ── locus mechanics ──────────────────────────────────────────────────────────
test('reverse complement is an involution and complements correctly', () => {
  assert.equal(reverseComplement('ATGC'), 'GCAT');
  assert.equal(reverseComplement(reverseComplement('GATTACA')), 'GATTACA');
});

test('parseFasta drops header and whitespace, uppercases', () => {
  assert.equal(parseFasta('>x desc\nacgt\nAC GT\n'), 'ACGTACGT');
});

test('codonsOf respects frame and skips non-ACGT triplets', () => {
  assert.deepEqual(codonsOf('AAACCCGGG', 0), ['AAA', 'CCC', 'GGG']);
  assert.deepEqual(codonsOf('AAACCCGGG', 1), ['AAC', 'CCG']);
  assert.deepEqual(codonsOf('AANCCCTTT', 0), ['CCC', 'TTT']);   // only the AAN codon is dropped
});

test('codonVector: prefix basis is 84-dim with 3 set bits, position basis 12-dim', () => {
  const p = codonVector('GCT', 'prefix');
  assert.equal(p.length, 84);
  assert.equal(p.reduce((s, x) => s + x, 0), 3);          // p1, p2, p3 prefixes
  const q = codonVector('GCT', 'position');
  assert.equal(q.length, 12);
  assert.equal(q.reduce((s, x) => s + x, 0), 3);          // one bit per position
});

test('codonReadings yields one vector per in-frame codon', () => {
  const { codons, vectors } = codonReadings('ATGAAATAG', { basis: 'prefix' });
  assert.deepEqual(codons, ['ATG', 'AAA', 'TAG']);
  assert.equal(vectors.length, 3);
});

test('frameReading: an uninterrupted ORF scores salience 1; an internal stop chops it', () => {
  const orf = frameReading('AAACCCGGGTTTAAACCC', 0);   // no stop codons → one long run
  assert.equal(orf.stops, 0);
  assert.equal(orf.salience, 1);                          // (longestRun/codons)^2 = 1
  const broken = frameReading('AAATAACCCGGGTTT', 0);     // TAA stop at codon 2
  assert.ok(isStop('TAA'));
  assert.ok(broken.salience < 1, 'a stop breaks the run, lowering salience');
});
