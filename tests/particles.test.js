import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createParticleSystem, KIND } from '../src/render/particles.js';
import { createFloatText } from '../src/render/floatText.js';
import { createShake } from '../src/render/shake.js';
import { createRng } from '../src/sim/rng.js';

const make = (capacity = 50, seed = 1) => createParticleSystem({ capacity, rng: createRng(seed).fork('fx') });

test('never exceeds capacity; emit returns -1 when full', () => {
  const p = make(10);
  const c = p.registerColor('#ffffff');
  for (let i = 0; i < 10; i++) assert.ok(p.emit(KIND.SPARK, 0, 0, 0, 0, 1, 2, 1, c) >= 0);
  assert.equal(p.emit(KIND.SPARK, 0, 0, 0, 0, 1, 2, 1, c), -1);
  p.burst(0, 0, { count: 100, color: c });
  assert.equal(p.count, 10);
});

test('expired particles free their slots and slots are reused', () => {
  const p = make(5);
  const c = p.registerColor('#fff');
  for (let i = 0; i < 5; i++) p.emit(KIND.SPARK, i, 0, 0, 0, 0.5, 2, 1, c);
  p.update(0.6);
  assert.equal(p.count, 0);
  assert.ok(p.emit(KIND.SPARK, 0, 0, 0, 0, 1, 2, 1, c) >= 0);
});

test('same seed gives identical burst results', () => {
  const run = (seed) => {
    const p = make(50, seed);
    p.burst(10, 20, { count: 20, color: p.registerColor('#fff') });
    p.update(0.1);
    return Array.from({ length: p.count }, (_, i) => p.positionOf(i));
  };
  assert.deepEqual(run(5), run(5));
  assert.notDeepEqual(run(5), run(6));
});

test('setLimit and density reduce the active cap', () => {
  const p = make(100);
  const c = p.registerColor('#fff');
  p.setLimit(40);
  assert.equal(p.limit, 40);
  p.setDensity(0.5);
  assert.equal(p.limit, 20);
  p.burst(0, 0, { count: 100, color: c });
  assert.equal(p.count, 20);
  p.setDensity(0.25);
  p.update(0.001);
  assert.ok(p.count <= 10);
});

test('update(0) changes nothing; clear works', () => {
  const p = make(10);
  const c = p.registerColor('#fff');
  p.emit(KIND.SPARK, 5, 5, 100, 0, 1, 2, 1, c, 0);
  p.update(0);
  assert.deepEqual(p.positionOf(0), [5, 5]);
  p.clear();
  assert.equal(p.count, 0);
});

test('registerColor is stable per hex', () => {
  const p = make(1);
  assert.equal(p.registerColor('#abc'), p.registerColor('#abc'));
  assert.notEqual(p.registerColor('#abc'), p.registerColor('#abd'));
});

test('shake with enabled=false stays at zero; enabled shake decays to zero', () => {
  const off = createShake({ rng: createRng(1).fork('fx') });
  off.setEnabled(false);
  off.add(1);
  off.update(0.016);
  assert.deepEqual([off.offsetX, off.offsetY, off.trauma], [0, 0, 0]);

  const on = createShake({ rng: createRng(1).fork('fx') });
  on.add(1);
  on.update(0.016);
  assert.ok(on.trauma > 0);
  for (let i = 0; i < 200; i++) on.update(0.016);
  assert.deepEqual([on.offsetX, on.offsetY, on.trauma], [0, 0, 0]);
});

test('floatText respects its cap and expires', () => {
  const f = createFloatText({ capacity: 8 });
  f.setCap(3);
  for (let i = 0; i < 10; i++) f.spawn('+1', 0, 0, { life: 0.5 });
  assert.equal(f.count, 3);
  assert.equal(f.spawn('x', 0, 0), false);
  f.update(0.6);
  assert.equal(f.count, 0);
  assert.equal(f.spawn('x', 0, 0), true);
});
