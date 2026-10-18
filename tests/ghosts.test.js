import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGhostPool } from '../src/render/ghosts.js';
import { config } from '../src/data/config.js';

test('default capacity comes from config and is respected', () => {
  const g = createGhostPool();
  assert.equal(g.capacity, config.fx.ghostCapacity);
  for (let i = 0; i < g.capacity; i++) assert.ok(g.spawn('lance', i, 0, 0, 0, 1) >= 0);
  assert.equal(g.spawn('lance', 0, 0, 0, 0, 1), -1);
  assert.equal(g.count, g.capacity);
});

test('expiry frees slots and slots are reused', () => {
  const g = createGhostPool(2);
  const a = g.spawn('mortar', 1, 1, 0, 1, 0.5);
  g.spawn('frost', 2, 2, 0, 2, 5);
  assert.equal(g.spawn('sniper', 3, 3, 0, 0, 1), -1);
  g.update(0.6);
  assert.equal(g.count, 1);
  assert.equal(g.slots[a].active, false);
  assert.equal(g.spawn('sniper', 3, 3, 0, 0, 1), a);
  assert.equal(g.slots[a].type, 'sniper');
});

test('update(0) changes nothing; clear empties the pool', () => {
  const g = createGhostPool(3);
  g.spawn('lance', 1, 2, 0.5, 1, 1);
  g.update(0);
  assert.equal(g.slots[0].age, 0);
  assert.equal(g.count, 1);
  g.clear();
  assert.equal(g.count, 0);
  assert.ok(g.slots.every((s) => !s.active));
});
