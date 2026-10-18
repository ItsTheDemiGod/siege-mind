import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBeamPool, createDecalPool } from '../src/render/effectPools.js';
import { config } from '../src/data/config.js';
import { hash01 } from '../src/render/hash.js';

test('default capacities come from config and are respected', () => {
  const b = createBeamPool();
  const d = createDecalPool();
  assert.equal(b.capacity, config.fx.beamCapacity);
  assert.equal(d.capacity, config.fx.decalCapacity);
  for (let i = 0; i < b.capacity; i++) assert.equal(b.spawn(0, 0, 10, 10, 1), true);
  assert.equal(b.spawn(0, 0, 1, 1, 1), false);
  for (let i = 0; i < d.capacity; i++) assert.equal(d.spawn(i, 0, 30, 1), true);
  assert.equal(d.spawn(0, 0, 30, 1), false);
  assert.equal(d.count, d.capacity);
});

test('expiry frees slots for reuse; update(0) changes nothing', () => {
  const d = createDecalPool(2);
  d.spawn(1, 1, 20, 0.5);
  d.spawn(2, 2, 20, 5);
  d.update(0);
  assert.equal(d.count, 2);
  d.update(0.6);
  assert.equal(d.count, 1);
  assert.equal(d.spawn(3, 3, 20, 1), true);
  assert.equal(d.count, 2);
  d.clear();
  assert.equal(d.count, 0);
});

test('hash01 is deterministic, in [0,1) and well spread', () => {
  for (let i = 0; i < 500; i++) {
    const v = hash01(i, 3);
    assert.ok(v >= 0 && v < 1);
    assert.equal(v, hash01(i, 3));
  }
  let sum = 0;
  for (let i = 0; i < 4000; i++) sum += hash01(i, i * 7);
  assert.ok(Math.abs(sum / 4000 - 0.5) < 0.03);
  assert.notEqual(hash01(1, 2), hash01(2, 1));
});
