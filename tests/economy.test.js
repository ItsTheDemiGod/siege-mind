import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { earnGold, spendGold, canAfford } from '../src/sim/economy.js';
import { spawnEnemyNow } from '../src/sim/enemies.js';
import { applyDamage } from '../src/sim/damage.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { ENEMIES } from '../src/data/enemies.js';
import { config } from '../src/data/config.js';

const newGame = (opts = {}) => createGame({ seed: 1, debugSpawnEveryTicks: 0, ...opts });
const goldEvents = (game) => { const log = []; game.events.on(EVENT_TYPES.GOLD_CHANGED, (p) => log.push(p)); return log; };

test('starting gold comes from config and from the override', () => {
  assert.equal(newGame().gold, config.game.startGold);
  assert.equal(newGame({ startGold: 777 }).gold, 777);
});

test('earn and spend change gold and emit GOLD_CHANGED with the right payload', () => {
  const g = newGame({ startGold: 100 });
  const log = goldEvents(g);
  g.tick = 5;
  earnGold(g, 25, 'kill');
  assert.deepEqual(log[0], { gold: 125, delta: 25, reason: 'kill', tick: 5 });
  assert.equal(spendGold(g, 60, 'build'), true);
  assert.deepEqual(log[1], { gold: 65, delta: -60, reason: 'build', tick: 5 });
  assert.equal(g.gold, 65);
});

test('overspend returns false and changes nothing', () => {
  const g = newGame({ startGold: 50 });
  const log = goldEvents(g);
  assert.equal(spendGold(g, 51, 'build'), false);
  assert.equal(g.gold, 50);
  assert.equal(log.length, 0);
  assert.equal(canAfford(g, 50), true);
  assert.equal(canAfford(g, 51), false);
});

test('invalid amounts throw TypeError', () => {
  const g = newGame();
  for (const bad of [NaN, -1, '5', Infinity, undefined, null]) {
    assert.throws(() => earnGold(g, bad, 'x'), TypeError, String(bad));
    assert.throws(() => spendGold(g, bad, 'x'), TypeError, String(bad));
    assert.throws(() => canAfford(g, bad), TypeError, String(bad));
  }
});

test('a kill earns exactly the enemy reward once', () => {
  const g = newGame({ startGold: 0 });
  const log = goldEvents(g);
  const e = spawnEnemyNow(g, 'armoredGrunt');
  applyDamage(g, e, { amount: 1e6, kind: 'direct' });
  applyDamage(g, e, { amount: 1e6, kind: 'direct' });
  assert.equal(g.gold, ENEMIES.armoredGrunt.reward);
  assert.equal(log.length, 1);
  assert.equal(log[0].reason, 'kill');
});

test('gold never goes negative; zero-amount spends and earns emit nothing', () => {
  const g = newGame({ startGold: 10 });
  const log = goldEvents(g);
  assert.equal(spendGold(g, 11, 'x'), false);
  assert.equal(spendGold(g, 10, 'x'), true);
  assert.equal(g.gold, 0);
  earnGold(g, 0, 'x');
  assert.equal(spendGold(g, 0, 'x'), true);
  assert.equal(log.length, 1);
  assert.ok(g.gold >= 0);
});

test('two games with separate buses do not double-count', () => {
  const a = newGame({ startGold: 0 });
  const b = newGame({ startGold: 0 });
  applyDamage(a, spawnEnemyNow(a, 'swarmling'), { amount: 1e6, kind: 'direct' });
  assert.equal(a.gold, ENEMIES.swarmling.reward);
  assert.equal(b.gold, 0);
});
