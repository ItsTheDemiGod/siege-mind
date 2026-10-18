import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/sim/rng.js';

const seq = (rng, n) => Array.from({ length: n }, () => rng.next());

test('same seed gives identical sequence of 1000 values', () => {
  assert.deepEqual(seq(createRng(7), 1000), seq(createRng(7), 1000));
});

test('different seeds differ', () => {
  assert.notDeepEqual(seq(createRng(1), 10), seq(createRng(2), 10));
});

test('string seeds work and are stable', () => {
  assert.deepEqual(seq(createRng('hello'), 20), seq(createRng('hello'), 20));
  assert.notDeepEqual(seq(createRng('hello'), 20), seq(createRng('world'), 20));
});

test('golden values for seed 12345', () => {
  // Changing the algorithm changes these numbers (and every recorded run); update only on purpose.
  assert.deepEqual(seq(createRng(12345), 5), [
    0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203, 0.5094283693470061,
  ]);
});

test('mean of 10000 values is near 0.5', () => {
  const rng = createRng(99);
  let sum = 0;
  for (let i = 0; i < 10000; i++) sum += rng.next();
  const mean = sum / 10000;
  assert.ok(mean > 0.45 && mean < 0.55, `mean ${mean}`);
});

test('int stays within inclusive bounds and hits both ends', () => {
  const rng = createRng(3);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = rng.int(2, 6);
    assert.ok(Number.isInteger(v) && v >= 2 && v <= 6);
    seen.add(v);
  }
  assert.ok(seen.has(2) && seen.has(6));
});

test('range stays within [min,max)', () => {
  const rng = createRng(4);
  for (let i = 0; i < 2000; i++) {
    const v = rng.range(-1.5, 2.5);
    assert.ok(v >= -1.5 && v < 2.5);
  }
});

test('chance(0) never and chance(1) always', () => {
  const rng = createRng(5);
  for (let i = 0; i < 1000; i++) {
    assert.equal(rng.chance(0), false);
    assert.equal(rng.chance(1), true);
  }
});

test('pick throws on an empty array and returns members otherwise', () => {
  const rng = createRng(6);
  assert.throws(() => rng.pick([]));
  for (let i = 0; i < 50; i++) assert.ok(['a', 'b', 'c'].includes(rng.pick(['a', 'b', 'c'])));
});

test('shuffle keeps elements, is in place, and is deterministic per seed', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = createRng(8).shuffle(a);
  assert.equal(out, a);
  assert.deepEqual([...a].sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(createRng(8).shuffle([1, 2, 3, 4, 5, 6, 7, 8]), a);
});

test('weightedIndex respects zero weights and roughly matches weights', () => {
  const rng = createRng(10);
  const counts = [0, 0, 0, 0];
  const weights = [1, 0, 3, 6];
  for (let i = 0; i < 20000; i++) counts[rng.weightedIndex(weights)]++;
  assert.equal(counts[1], 0);
  [0.1, 0, 0.3, 0.6].forEach((p, i) => {
    assert.ok(Math.abs(counts[i] / 20000 - p) < 0.03, `index ${i}: ${counts[i] / 20000} vs ${p}`);
  });
});

test('weightedIndex throws on negative or all-zero weights', () => {
  const rng = createRng(11);
  assert.throws(() => rng.weightedIndex([1, -1]));
  assert.throws(() => rng.weightedIndex([0, 0]));
  assert.throws(() => rng.weightedIndex([]));
});

test('getState/setState reproduces the exact continuation', () => {
  const rng = createRng(12);
  seq(rng, 10);
  const state = rng.getState();
  const expected = seq(rng, 20);
  rng.setState(state);
  assert.deepEqual(seq(rng, 20), expected);
});

test('fork is independent of parent consumption, deterministic, and label-dependent', () => {
  const p1 = createRng(13);
  const p2 = createRng(13);
  seq(p2, 500);
  assert.deepEqual(seq(p1.fork('director'), 10), seq(p2.fork('director'), 10));
  assert.notDeepEqual(seq(p1.fork('director'), 10), seq(p1.fork('combat'), 10));
  const child = p1.fork('x');
  const before = p1.getState();
  seq(child, 50);
  assert.equal(p1.getState(), before); // consuming the child does not touch the parent
});

test('seed property is the unsigned seed; invalid types throw', () => {
  assert.equal(createRng(-1).seed, 4294967295);
  for (const bad of [1.5, NaN, Infinity, null, undefined, {}, [], true]) {
    assert.throws(() => createRng(bad), TypeError);
  }
});
