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

import { placeTower, upgradeTower } from '../src/sim/towers.js';

const withTowers = (seed, steps) => {
  const g = createGame({ seed, debugSpawnEveryTicks: 25, startGold: 5000 });
  const plan = { 10: ['lance', 15, 2], 20: ['mortar', 14, 2], 30: ['frost', 16, 2], 40: ['poison', 13, 2], 50: ['sniper', 12, 2] };
  for (let i = 0; i < steps; i++) {
    stepGame(g);
    if (plan[g.tick]) placeTower(g, ...plan[g.tick]);
    if (g.tick === 400) for (const t of g.towers) upgradeTower(g, t.id);
  }
  return g;
};

test('same seed + same scripted placements give deep-equal snapshots after 6000 steps; different seeds differ', () => {
  const a = snapshotGame(withTowers(21, 6000));
  assert.deepEqual(a, snapshotGame(withTowers(21, 6000)));
  assert.notDeepEqual(a, snapshotGame(withTowers(22, 6000)));
  assert.equal(a.towers.length, 5);
  assert.ok(a.towers.some((t) => t.shots > 0));
  assert.ok(Number.isFinite(a.gold));
});

test('snapshot with towers and projectiles survives a JSON round trip', () => {
  const g = withTowers(5, 900);
  const snap = snapshotGame(g);
  assert.ok(snap.towers.length > 0);
  assert.deepEqual(JSON.parse(JSON.stringify(snap)), snap);
});

test('stepping with towers firing never calls Math.random', () => {
  const original = Math.random;
  Math.random = () => { throw new Error('Math.random used in sim'); };
  try {
    const g = withTowers(7, 1500);
    assert.ok(g.towers.reduce((s, t) => s + t.shots, 0) > 0);
  } finally {
    Math.random = original;
  }
});

// ---- Phase 4A: waves, lives and scripted commands ----
import { startNextWave } from '../src/sim/waveRunner.js';

const scripted = (seed, steps) => {
  const g = createGame({ seed, startGold: 100000 });
  const plan = { 5: ['lance', 15, 2], 10: ['mortar', 14, 2], 15: ['frost', 16, 2], 20: ['poison', 13, 2], 25: ['sniper', 12, 2] };
  for (let i = 0; i < steps; i++) {
    stepGame(g);
    if (plan[g.tick]) placeTower(g, ...plan[g.tick]);
    if (g.tick === 30 || g.tick === 3000) startNextWave(g);
  }
  return g;
};

test('same seed + same scripted commands give deep-equal snapshots after 8000 steps; different seeds differ', () => {
  const a = snapshotGame(scripted(31, 8000));
  assert.deepEqual(a, snapshotGame(scripted(31, 8000)));
  assert.notDeepEqual(a, snapshotGame(scripted(32, 8000)));
  assert.ok(a.stats.enemiesSpawned > 0 && a.waves.current >= 1);
});

test('snapshot with lives, stats and waves populated survives a JSON round trip', () => {
  const g = scripted(4, 2500);
  const snap = snapshotGame(g);
  assert.equal(snap.lives, g.lives);
  assert.ok(snap.stats.enemiesSpawned > 0);
  assert.equal(snap.waves.phase, g.waves.phase);
  assert.deepEqual(JSON.parse(JSON.stringify(snap)), snap);
});

test('a whole wave never calls Math.random', () => {
  const original = Math.random;
  Math.random = () => { throw new Error('Math.random used in sim'); };
  try {
    const g = createGame({ seed: 8, startGold: 100000 });
    placeTower(g, 'lance', 15, 2);
    startNextWave(g);
    for (let i = 0; i < 4000; i++) stepGame(g);
    assert.ok(g.stats.enemiesSpawned > 0);
  } finally {
    Math.random = original;
  }
});

test('the debug auto-spawn is off by default and on when debugSpawnEveryTicks > 0', () => {
  const off = createGame({ seed: 1 });
  for (let i = 0; i < 600; i++) stepGame(off);
  assert.equal(off.stats.enemiesSpawned, 0);
  const on = createGame({ seed: 1, debugSpawnEveryTicks: 30 });
  for (let i = 0; i < 600; i++) stepGame(on);
  assert.ok(on.stats.enemiesSpawned > 0);
});
