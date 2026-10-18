import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, stepGame, snapshotGame } from '../src/sim/game.js';
import { EVENT_TYPES } from '../src/sim/events.js';

const run = (seed, steps) => {
  const g = createGame({ seed });
  for (let i = 0; i < steps; i++) stepGame(g);
  return g;
};

test('same seed gives deep-equal snapshots after 5000 steps', () => {
  assert.deepEqual(snapshotGame(run(42, 5000)), snapshotGame(run(42, 5000)));
});

test('different seeds produce different snapshots', () => {
  assert.notDeepEqual(snapshotGame(run(1, 3000)), snapshotGame(run(2, 3000)));
});

test('stepping never calls Math.random', () => {
  const original = Math.random;
  Math.random = () => { throw new Error('Math.random used in sim'); };
  try {
    run(5, 600);
  } finally {
    Math.random = original;
  }
});

test('prevDistance equals the distance from the previous step', () => {
  const g = createGame({ seed: 3 });
  let before = new Map();
  for (let i = 0; i < 2000; i++) {
    stepGame(g);
    for (const w of g.walkers) {
      if (before.has(w.id)) assert.equal(w.prevDistance, before.get(w.id));
    }
    before = new Map(g.walkers.map((w) => [w.id, w.distance]));
  }
});

test('walkers are removed at the end and the array stays small', () => {
  const g = createGame({ seed: 9 });
  let max = 0;
  for (let i = 0; i < 20000; i++) {
    stepGame(g);
    max = Math.max(max, g.walkers.length);
    for (const w of g.walkers) assert.ok(w.distance < g.map.path.totalLength);
  }
  assert.ok(max < 60, `max ${max}`);
  assert.ok(max > 0);
});

test('startGame emits GAME_STARTED with the seed', () => {
  const g = createGame({ seed: 'abc' });
  const got = [];
  g.events.on(EVENT_TYPES.GAME_STARTED, (p) => got.push(p));
  startGame(g);
  assert.deepEqual(got, [{ seed: 'abc' }]);
});

test('snapshotGame survives a JSON round-trip unchanged', () => {
  const snap = snapshotGame(run(11, 700));
  assert.ok(snap.walkers.length > 0);
  assert.deepEqual(JSON.parse(JSON.stringify(snap)), snap);
});

test('time follows tick', () => {
  const g = run(1, 120);
  assert.equal(g.tick, 120);
  assert.ok(Math.abs(g.time - 2) < 1e-9);
});
