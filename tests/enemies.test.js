import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/sim/game.js';
import {
  spawnEnemyNow, queueEnemy, stepEnemies, enemyPose, enemyPosition, findEnemyAt, forEachEnemyInRadius,
} from '../src/sim/enemies.js';
import { applyDamage } from '../src/sim/damage.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { config } from '../src/data/config.js';

const newGame = (seed = 1) => createGame({ seed, debugSpawnEveryTicks: 0 });
const record = (game, ...types) => {
  const log = [];
  for (const t of types) game.events.on(t, (p) => log.push([t, p]));
  return log;
};
const run = (game, steps) => { for (let i = 0; i < steps; i++) stepGame(game); };

test('an enemy moves exactly speed * stepSeconds per step; prevDistance trails', () => {
  const game = newGame();
  const e = spawnEnemyNow(game, 'armoredGrunt');
  let before = e.distance;
  for (let i = 0; i < 100; i++) {
    stepGame(game);
    assert.equal(e.prevDistance, before);
    assert.ok(Math.abs(e.distance - e.prevDistance - 55 / 60) < 1e-9);
    before = e.distance;
  }
});

test('a grunt leaks after about 3520/55 s with exactly one ENEMY_LEAKED and is removed', () => {
  const game = newGame();
  const log = record(game, EVENT_TYPES.ENEMY_LEAKED);
  const e = spawnEnemyNow(game, 'armoredGrunt');
  const steps = Math.ceil((3520 / 55) * 60);
  run(game, steps - 5);
  assert.equal(log.length, 0);
  run(game, 10);
  assert.equal(log.length, 1);
  assert.equal(log[0][1].id, e.id);
  assert.equal(log[0][1].leakDamage, ENEMIES.armoredGrunt.leakDamage);
  assert.equal(game.enemies.length, 0);
  run(game, 60);
  assert.equal(log.length, 1);
});

test('ids are unique and increasing; ENEMY_SPAWNED carries type and position', () => {
  const game = newGame();
  const log = record(game, EVENT_TYPES.ENEMY_SPAWNED);
  const a = spawnEnemyNow(game, 'fastRunner');
  const b = spawnEnemyNow(game, 'regenerator');
  assert.ok(b.id > a.id);
  const [, p] = log[0];
  assert.equal(p.type, 'fastRunner');
  assert.equal(p.id, a.id);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  assert.throws(() => spawnEnemyNow(game, 'dragon'));
});

test('compaction preserves the order of survivors', () => {
  const game = newGame();
  const es = Array.from({ length: 5 }, () => spawnEnemyNow(game, 'swarmling'));
  applyDamage(game, es[1], { amount: 1e4, kind: 'direct' });
  applyDamage(game, es[3], { amount: 1e4, kind: 'direct' });
  stepEnemies(game);
  assert.deepEqual(game.enemies.map((e) => e.id), [es[0].id, es[2].id, es[4].id]);
});

test('a queued swarmling pack spawns packSize enemies packIntervalTicks apart', () => {
  const game = newGame();
  const log = record(game, EVENT_TYPES.ENEMY_SPAWNED);
  queueEnemy(game, 'swarmling');
  assert.equal(game.spawnQueue.length, ENEMIES.swarmling.packSize);
  run(game, 200);
  assert.equal(log.length, 8);
  const ticks = log.map(([, p]) => p.tick);
  for (let i = 1; i < ticks.length; i++) assert.equal(ticks[i] - ticks[i - 1], ENEMIES.swarmling.packIntervalTicks);
  assert.equal(game.spawnQueue.length, 0);
});

test('queueEnemy honours delayTicks and pack:false', () => {
  const game = newGame();
  const log = record(game, EVENT_TYPES.ENEMY_SPAWNED);
  queueEnemy(game, 'swarmling', { delayTicks: 30, pack: false });
  run(game, 29);
  assert.equal(log.length, 0);
  run(game, 2);
  assert.equal(log.length, 1);
  assert.equal(game.spawnQueue.length, 0);
});

test('the maxEnemies cap returns null and emits nothing', () => {
  const game = newGame();
  for (let i = 0; i < config.combat.maxEnemies; i++) assert.ok(spawnEnemyNow(game, 'swarmling'));
  const log = record(game, EVENT_TYPES.ENEMY_SPAWNED);
  assert.equal(spawnEnemyNow(game, 'swarmling'), null);
  assert.equal(log.length, 0);
  assert.equal(game.enemies.length, config.combat.maxEnemies);
});

test('lanes: deterministic per seed, in range per type, differ between seeds, independent of rngs.main', () => {
  const lanes = (seed, consume = 0) => {
    const g = newGame(seed);
    for (let i = 0; i < consume; i++) g.rngs.main.next();
    return ENEMY_ORDER.flatMap((t) => Array.from({ length: 20 }, () => spawnEnemyNow(g, t).lane));
  };
  assert.deepEqual(lanes(5), lanes(5));
  assert.deepEqual(lanes(5), lanes(5, 500));
  assert.notDeepEqual(lanes(5), lanes(6));
  const g = newGame(9);
  for (const t of ENEMY_ORDER) {
    const max = config.enemies.laneMax - ENEMIES[t].radius * 0.3;
    for (let i = 0; i < 40; i++) assert.ok(Math.abs(spawnEnemyNow(g, t).lane) <= max, t);
  }
});

test('findEnemyAt picks the nearest enemy and ignores dead ones', () => {
  const game = newGame();
  const a = spawnEnemyNow(game, 'armoredGrunt');
  const b = spawnEnemyNow(game, 'armoredGrunt');
  a.distance = 400; b.distance = 410; a.lane = 0; b.lane = 0;
  const out = { x: 0, y: 0, angle: 0 };
  enemyPosition(game, b, out);
  assert.equal(findEnemyAt(game, out.x, out.y).id, b.id);
  applyDamage(game, b, { amount: 1e5, kind: 'direct' });
  assert.equal(findEnemyAt(game, out.x, out.y).id, a.id); // a is 10 units away, within radius + pad
  assert.equal(findEnemyAt(game, out.x + 500, out.y + 500), null);
});

test('forEachEnemyInRadius visits exactly the enemies inside', () => {
  const game = newGame();
  const near = [100, 120, 140].map((d) => { const e = spawnEnemyNow(game, 'swarmling'); e.distance = d; e.lane = 0; return e; });
  const far = spawnEnemyNow(game, 'swarmling');
  far.distance = 1000; far.lane = 0;
  const c = enemyPosition(game, near[1], { x: 0, y: 0, angle: 0 });
  const seen = [];
  forEachEnemyInRadius(game, c.x, c.y, 30, (e) => seen.push(e.id));
  assert.deepEqual(seen.sort(), near.map((e) => e.id).sort());
});

test('enemyPose at alpha 0 and 1 matches previous and current positions', () => {
  const game = newGame();
  const e = spawnEnemyNow(game, 'fastRunner');
  run(game, 50);
  const a0 = enemyPose(game, e, 0, { x: 0, y: 0, angle: 0 });
  const a1 = enemyPose(game, e, 1, { x: 0, y: 0, angle: 0 });
  const prev = game.map.path.sampleAt(e.prevDistance, e.lane, { x: 0, y: 0, angle: 0 });
  const cur = enemyPosition(game, e, { x: 0, y: 0, angle: 0 });
  assert.deepEqual(a0, prev);
  assert.deepEqual(a1, cur);
});

test('stepEnemies on an empty game is a no-op', () => {
  const game = newGame();
  assert.doesNotThrow(() => stepEnemies(game));
});
