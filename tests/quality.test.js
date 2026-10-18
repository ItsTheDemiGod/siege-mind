import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQualityController } from '../src/render/quality.js';
import { config } from '../src/data/config.js';

const run = (q, fps, seconds) => {
  const dt = 1 / fps;
  for (let t = 0; t < seconds; t += dt) q.update(dt);
};

test('30 FPS for 3.1 s downgrades high to medium', () => {
  const q = createQualityController();
  run(q, 30, 3.1);
  assert.equal(q.tier, 'medium');
});

test('44 FPS for 2 s then 60 FPS does not downgrade', () => {
  const q = createQualityController();
  run(q, 44, 2);
  run(q, 60, 5);
  assert.equal(q.tier, 'high');
});

test('second downgrade waits for the cooldown', () => {
  const q = createQualityController();
  run(q, 20, 3.5);
  assert.equal(q.tier, 'medium');
  run(q, 20, 5); // inside the 10 s cooldown
  assert.equal(q.tier, 'medium');
  run(q, 20, 8);
  assert.equal(q.tier, 'low');
});

test('low never goes lower', () => {
  const q = createQualityController({ tier: 'low' });
  run(q, 10, 60);
  assert.equal(q.tier, 'low');
});

test('auto=false never downgrades', () => {
  const q = createQualityController({ auto: false });
  run(q, 10, 30);
  assert.equal(q.tier, 'high');
});

test('setTier notifies listeners; unsubscribe works', () => {
  const q = createQualityController();
  const seen = [];
  const off = q.onChange((t, why) => seen.push([t, why]));
  q.setTier('low');
  q.setTier('low'); // no-op
  off();
  q.setTier('medium');
  assert.deepEqual(seen, [['low', 'manual']]);
});

test('stall frames are ignored', () => {
  const q = createQualityController();
  for (let i = 0; i < 20; i++) q.update(0.5);
  assert.equal(q.tier, 'high');
});

test('params follow the tier; never upgrades by itself', () => {
  const q = createQualityController();
  assert.equal(q.params, config.quality.high);
  q.setTier('medium');
  assert.equal(q.params.particleCap, 800);
  run(q, 60, 30);
  assert.equal(q.tier, 'medium');
});
