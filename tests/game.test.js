import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, stepGame, snapshotGame } from '../src/sim/game.js';
import { nukeAll } from '../src/sim/enemies.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { config } from '../src/data/config.js';

const run = (seed, steps, spawnEvery = 20) => {
  const g = createGame({ seed, debugSpawnEveryTicks: spawnEvery });
  for (let i = 0; i < steps; i++) stepGame(g);
  return g;
};

test('same seed gives deep-equal snapshots after 5000 steps', () => {
  const a = snapshotGame(run(42, 5000));
  assert.deepEqual(a, snapshotGame(run(42, 5000)));
  assert.ok(a.enemies.length > 0 || a.nextEnemyId > 1);
});

test('different seeds produce different snapshots', () => {
  assert.notDeepEqual(snapshotGame(run(1, 3000)), snapshotGame(run(2, 3000)));
});

test('stepping never calls Math.random', () => {
  const original = Math.random;
  Math.random = () => { throw new Error('Math.random used in sim'); };
  try {
    run(5, 1500);
  } finally {
    Math.random = original;
  }
});

test('enemy count never exceeds maxEnemies and no dead entry survives a step', () => {
  const g = createGame({ seed: 7, debugSpawnEveryTicks: 1 });
  for (let i = 0; i < 3000; i++) {
    stepGame(g);
    assert.ok(g.enemies.length <= config.combat.maxEnemies);
    for (const e of g.enemies) assert.equal(e.alive, true);
  }
});

test('snapshotGame survives a JSON round-trip unchanged', () => {
  const g = run(11, 700);
  nukeAll(g); // also exercises dead enemies in the snapshot
  const snap = snapshotGame(g);
  assert.ok(snap.nextEnemyId > 1);
  assert.deepEqual(JSON.parse(JSON.stringify(snap)), snap);
  const live = snapshotGame(run(12, 700));
  assert.ok(live.enemies.length > 0);
  assert.deepEqual(JSON.parse(JSON.stringify(live)), live);
});

test('debugSpawnEveryTicks: 0 produces no enemies', () => {
  const g = run(3, 2000, 0);
  assert.equal(g.enemies.length, 0);
  assert.equal(g.nextEnemyId, 1);
});

test('startGame emits GAME_STARTED with the seed', () => {
  const g = createGame({ seed: 'abc', debugSpawnEveryTicks: 0 });
  const got = [];
  g.events.on(EVENT_TYPES.GAME_STARTED, (p) => got.push(p));
  startGame(g);
  assert.deepEqual(got, [{ seed: 'abc' }]);
});

test('time follows tick; rngs.main is rng', () => {
  const g = run(1, 120, 0);
  assert.equal(g.tick, 120);
  assert.ok(Math.abs(g.time - 2) < 1e-9);
  assert.equal(g.rng, g.rngs.main);
});

test('nukeAll kills everything through the damage path', () => {
  const g = run(4, 600);
  const kills = [];
  g.events.on(EVENT_TYPES.ENEMY_KILLED, (p) => kills.push(p));
  const n = g.enemies.length;
  nukeAll(g);
  assert.equal(kills.length, n);
  stepGame(g);
  assert.ok(g.enemies.every((e) => e.alive));
});
