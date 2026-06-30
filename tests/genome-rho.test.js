import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildDensity, eigenLenses, vonNeumann } from '../src/core/index.js';
import { mutualNearestPairs } from '../src/perceiver/index.js';
import {
  reverseComplement, parseFasta, codonsOf, codonVector, codonReadings, frameReading, isStop,
  rcCanonical, complementSignedReadings, ALL_DNA_CODONS, codonContextVectors,
} from '../src/organs/in/locus.js';

const entropy = (rho) => vonNeumann(eigenLenses(rho).map((l) => l.weight).filter((w) => w > 1e-12));
const fro = (A) => { let s = 0; for (const r of A) for (const x of r) s += x * x; return Math.sqrt(s); };
const residual = (seq) => {
  const { vectors, signs } = complementSignedReadings(seq);
  const s = buildDensity(vectors, null, signs), u = buildDensity(vectors, null, null);
  const raw = (d) => d.rho.map((r) => r.map((x) => x * d.trace));
  return fro(raw(s)) / fro(raw(u));
};

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

test('rcCanonical: a codon and its reverse complement share a canon, carry opposite signs', () => {
  const a = rcCanonical('GCT');           // rc = AGC; AGC < GCT → canon AGC, GCT is the rc member
  const b = rcCanonical('AGC');
  assert.equal(a.canon, b.canon, 'both map to the same canonical form');
  assert.equal(a.sign * b.sign, -1, 'opposite orientation signs');
});

test('Test 1b — signed residual: a strand ⊕ its reverse complement cancels exactly (calibration)', () => {
  // The mechanism, by construction: in a basis where complementation is a sign flip, a
  // sequence read together with its reverse complement must cancel to ~0 (Test 0 on real
  // sequence). This CONFIRMS the interference build; it does not discover the symmetry.
  const seq = 'ATGGCATTAGCCTAGGCATCGGATCCAATTGGCCAATTGGAACCGGTTAACCGGATCGATCGTAGCTAGC';
  assert.ok(residual(seq + reverseComplement(seq)) < 1e-9, 'w ⊕ RC(w) cancels to zero');
  assert.ok(residual('AAAGAAGAGAAGGAAGAAAGGAGAAAGAGGAAAGAA') > 1e-6, 'a strand-biased sequence has non-zero parity residual');
});

test('Test 1b — a reverse-complement-balanced strand has a far smaller residual than a biased one', () => {
  // A real, measured property on top of the calibrated mechanism: parity-respecting
  // sequence sits near the floor; a purine-only strand (no parity) sits far above it.
  const balanced = 'ACGTACGTACGTACGTACGTACGTACGTACGTACGT';     // every base balanced
  const biased = 'AAAGAAGAGAAGGAAGAAAGGAGAAAGAGGAAAGAA';        // purines only, parity broken
  assert.ok(residual(balanced) < residual(biased), 'balanced strand violates parity less than a biased one');
});

test('Test 1c mechanism — RC is a relabeling symmetry: position 2 never matches, prefix-overlap ≤ 1', () => {
  const dot = (a, b) => codonVector(a).reduce((s, x, k) => s + x * codonVector(b)[k], 0);
  let maxRcOverlap = 0;
  for (const c of ALL_DNA_CODONS) {
    const rc = reverseComplement(c);
    assert.notEqual(c[1], rc[1], `position 2 should never match for ${c}/${rc}`);
    maxRcOverlap = Math.max(maxRcOverlap, dot(c, rc));
  }
  assert.ok(maxRcOverlap <= 1, 'an RC pair shares at most one prefix feature');
  assert.equal(dot('GCT', 'GCA'), 2, 'a same-box pair shares two (p1, p2) — strictly more');
});

test('Test 1c — the agnostic merge surfaces boxes, not reverse-complement pairs (real E. coli)', () => {
  const seq = parseFasta(readFileSync(new URL('../data/genome/ecoli_mg1655_1-300k.fasta', import.meta.url), 'utf8'));
  const { codons, vectors } = codonContextVectors(seq);
  const cos = (u, v) => { let d = 0; for (let i = 0; i < u.length; i++) d += u[i] * v[i]; return d; };
  const doc = { units: codons, spectrumQuery: (i) => `${i}` };
  const retrieve = (_d, q, k) => { const i = +q; return codons.map((_, j) => ({ idx: j, score: cos(vectors[i], vectors[j]) })).sort((a, b) => b.score - a.score).slice(0, k); };
  const pairs = mutualNearestPairs(doc, { retrieve });
  const rc = pairs.filter((p) => reverseComplement(codons[p.i]) === codons[p.j]).length;
  const box = pairs.filter((p) => codons[p.i].slice(0, 2) === codons[p.j].slice(0, 2)).length;
  assert.ok(rc <= box, 'reverse-complement pairs do not exceed same-box pairs');
  assert.ok(rc <= Math.ceil(pairs.length / 63) + 1, 'reverse-complement pairs are not enriched above chance');
});

test('frameReading: an uninterrupted ORF scores salience 1; an internal stop chops it', () => {
  const orf = frameReading('AAACCCGGGTTTAAACCC', 0);   // no stop codons → one long run
  assert.equal(orf.stops, 0);
  assert.equal(orf.salience, 1);                          // (longestRun/codons)^2 = 1
  const broken = frameReading('AAATAACCCGGGTTT', 0);     // TAA stop at codon 2
  assert.ok(isStop('TAA'));
  assert.ok(broken.salience < 1, 'a stop breaks the run, lowering salience');
});
