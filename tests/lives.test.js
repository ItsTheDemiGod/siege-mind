import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/sim/game.js';
import { spawnEnemyNow } from '../src/sim/enemies.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { ENEMIES } from '../src/data/enemies.js';
import { config } from '../src/data/config.js';
import { record } from './helpers.js';

const make = (opts = {}) => createGame({ seed: 1, debugSpawnEveryTicks: 0, ...opts });

/** Put an enemy a hair before the exit so the next step leaks it. */
function readyToLeak(game, type) {
  const e = spawnEnemyNow(game, type);
  e.distance = game.map.path.totalLength - 0.01;
  e.prevDistance = e.distance;
  return e;
}

test('lives start at the config value or the override', () => {
  assert.equal(make().lives, config.game.startLives);
  assert.equal(make({ startLives: 7 }).lives, 7);
});

test('a leak removes leakDamage lives and emits LIVES_CHANGED', () => {
  const g = make();
  const log = record(g, EVENT_TYPES.LIVES_CHANGED);
  readyToLeak(g, 'shieldedBruiser');
  stepGame(g);
  assert.equal(g.lives, 20 - ENEMIES.shieldedBruiser.leakDamage);
  assert.deepEqual(log[0][1], { lives: 17, delta: -3, tick: 1 });
  readyToLeak(g, 'armoredGrunt');
  stepGame(g);
  assert.equal(g.lives, 16);
});

test('lives clamp at 0 with a partial applied delta, and the game is lost', () => {
  const g = make({ startLives: 2 });
  const lives = record(g, EVENT_TYPES.LIVES_CHANGED);
  const over = record(g, EVENT_TYPES.GAME_OVER);
  readyToLeak(g, 'shieldedBruiser'); // 3 damage against 2 lives
  stepGame(g);
  assert.equal(g.lives, 0);
  assert.deepEqual(lives[0][1].delta, -2);
  assert.equal(over.length, 1);
  assert.equal(over[0][1].result, 'lost');
  assert.equal(g.over, true);
  assert.equal(g.result, 'lost');
});

test('several leaks in one tick produce exactly one GAME_OVER', () => {
  const g = make({ startLives: 2 });
  const over = record(g, EVENT_TYPES.GAME_OVER);
  for (let i = 0; i < 4; i++) readyToLeak(g, 'armoredGrunt');
  stepGame(g);
  assert.equal(g.lives, 0);
  assert.equal(over.length, 1);
  assert.equal(g.stats.livesLost, 2); // never counts more than the lives that existed
});

test('GAME_OVER carries the result, wave, lives, tick and a stats copy', () => {
  const g = make({ startLives: 1 });
  const over = record(g, EVENT_TYPES.GAME_OVER);
  readyToLeak(g, 'armoredGrunt');
  stepGame(g);
  const p = over[0][1];
  assert.deepEqual([p.result, p.wave, p.lives, p.tick], ['lost', 0, 0, 1]);
  assert.equal(p.stats.leaks, 1);
  assert.notEqual(p.stats, g.stats);
});
