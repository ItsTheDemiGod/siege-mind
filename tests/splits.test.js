import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedsOf } from '../experiments/protocol.js';
import { TRAIN_SEEDS, VALIDATION_SEEDS, splitSeeds } from '../experiments/splits.js';

test('train has 20 seeds, validation 10, they are disjoint and their union is the tuning set', () => {
  assert.equal(TRAIN_SEEDS.length, 20);
  assert.equal(VALIDATION_SEEDS.length, 10);
  assert.deepEqual([TRAIN_SEEDS[0], TRAIN_SEEDS.at(-1), VALIDATION_SEEDS[0], VALIDATION_SEEDS.at(-1)], [1001, 1020, 1021, 1030]);
  assert.ok(TRAIN_SEEDS.every((s) => !VALIDATION_SEEDS.includes(s)));
  assert.deepEqual([...TRAIN_SEEDS, ...VALIDATION_SEEDS], seedsOf('tuning'));
});

test('splitSeeds returns copies, "all" is the tuning set and unknown names throw', () => {
  assert.deepEqual(splitSeeds('train'), [...TRAIN_SEEDS]);
  assert.deepEqual(splitSeeds('validation'), [...VALIDATION_SEEDS]);
  assert.deepEqual(splitSeeds('all'), seedsOf('tuning'));
  splitSeeds('train').push(1);
  assert.equal(splitSeeds('train').length, 20);
  for (const bad of ['', 'Train', undefined, 'heldout']) assert.throws(() => splitSeeds(bad), RangeError);
  assert.ok(!VALIDATION_SEEDS.some((s) => seedsOf('heldout').includes(s)));
});
