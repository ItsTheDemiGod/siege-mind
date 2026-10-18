import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/sim/game.js';
import { spawnEnemyNow } from '../src/sim/enemies.js';
import { applyStatus, isPoisoned, effectiveSpeed } from '../src/sim/statuses.js';
import { applyDamage } from '../src/sim/damage.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { ENEMIES } from '../src/data/enemies.js';
import { config } from '../src/data/config.js';

const setup = (type) => {
  const game = createGame({ seed: 3, debugSpawnEveryTicks: 0 });
  const events = [];
  game.events.on(EVENT_TYPES.ENEMY_DAMAGED, (p) => events.push(p));
  return { game, enemy: spawnEnemyNow(game, type), events };
};
const run = (game, seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) stepGame(game); };
const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('slow 0.5 halves the distance covered in 1 s', () => {
  const a = setup('armoredGrunt');
  run(a.game, 1);
  const b = setup('armoredGrunt');
  applyStatus(b.game, b.enemy, { type: 'slow', factor: 0.5, duration: 5 });
  run(b.game, 1);
  near(b.enemy.distance, a.enemy.distance / 2, 1e-6);
  assert.equal(effectiveSpeed(ENEMIES.armoredGrunt, b.enemy), 27.5);
});

test('slow expires on time', () => {
  const { game, enemy } = setup('armoredGrunt');
  applyStatus(game, enemy, { type: 'slow', factor: 0.5, duration: 1 });
  run(game, 1.1);
  assert.equal(enemy.slowFactor, 1);
  assert.equal(enemy.slowRemaining, 0);
});

test('strongest slow wins; weaker does not override; refresh extends the duration', () => {
  const { game, enemy } = setup('armoredGrunt');
  applyStatus(game, enemy, { type: 'slow', factor: 0.4, duration: 2 });
  applyStatus(game, enemy, { type: 'slow', factor: 0.7, duration: 5 });
  assert.equal(enemy.slowFactor, 0.4);
  assert.equal(enemy.slowRemaining, 5);
  applyStatus(game, enemy, { type: 'slow', factor: 0.3, duration: 1 });
  assert.equal(enemy.slowFactor, 0.3);
  assert.equal(enemy.slowRemaining, 5);
});

test('slow factor is clamped to slowMinFactor', () => {
  const { game, enemy } = setup('armoredGrunt');
  applyStatus(game, enemy, { type: 'slow', factor: 0.01, duration: 1 });
  assert.equal(enemy.slowFactor, config.statuses.slowMinFactor);
});

test('poison stacks up to the max and no further', () => {
  const { game, enemy } = setup('armoredGrunt');
  for (let i = 0; i < 9; i++) applyStatus(game, enemy, { type: 'poison', dps: 5, duration: 3 });
  assert.equal(enemy.poisonStacks, config.statuses.poisonMaxStacks);
  assert.ok(isPoisoned(enemy));
});

test('2 stacks of dps 5 deal about 10 damage per second', () => {
  const { game, enemy } = setup('armoredGrunt');
  applyStatus(game, enemy, { type: 'poison', dps: 5, duration: 5 });
  applyStatus(game, enemy, { type: 'poison', dps: 5, duration: 5 });
  run(game, 1);
  near(enemy.maxHp - enemy.hp, 10, 0.2);
});

test('dps per stack is the max of old and new; duration refreshes to the max', () => {
  const { game, enemy } = setup('armoredGrunt');
  applyStatus(game, enemy, { type: 'poison', dps: 8, duration: 2 });
  applyStatus(game, enemy, { type: 'poison', dps: 3, duration: 6 });
  assert.equal(enemy.poisonDps, 8);
  assert.equal(enemy.poisonRemaining, 6);
});

test('poison expires', () => {
  const { game, enemy } = setup('armoredGrunt');
  applyStatus(game, enemy, { type: 'poison', dps: 5, duration: 1 });
  run(game, 1.2);
  assert.equal(isPoisoned(enemy), false);
  assert.equal(enemy.poisonStacks, 0);
  const hp = enemy.hp;
  run(game, 1);
  assert.equal(enemy.hp, hp);
});

test('poison suppresses regeneration; regeneration resumes at 2% maxHp per second', () => {
  const { game, enemy } = setup('regenerator');
  enemy.hp = 100;
  applyStatus(game, enemy, { type: 'poison', dps: 0.0001, duration: 2 });
  run(game, 1);
  assert.ok(enemy.hp <= 100, `hp ${enemy.hp}`);
  run(game, 1.1); // poison ends
  const before = enemy.hp;
  run(game, 1);
  near(enemy.hp - before, 0.02 * enemy.maxHp, 0.2);
});

test('DoT events are aggregated and sum to the hp lost, including the flush on death', () => {
  const { game, enemy, events } = setup('armoredGrunt');
  for (let i = 0; i < 5; i++) applyStatus(game, enemy, { type: 'poison', dps: 10, duration: 60 });
  run(game, 1);
  const perSecond = events.filter((e) => e.kind === 'dot').length;
  near(perSecond, 60 / config.combat.dotEventTicks, 1);
  run(game, 5); // 50 dps kills 120 hp (armor ignored) within ~2.4 s
  assert.equal(enemy.alive, false);
  const total = events.filter((e) => e.kind === 'dot').reduce((s, e) => s + e.amount, 0);
  near(total, enemy.maxHp, 1e-6);
});

test('poison source is carried into events', () => {
  const { game, enemy, events } = setup('armoredGrunt');
  applyStatus(game, enemy, { type: 'poison', dps: 20, duration: 2, source: 'poison#3' });
  run(game, 0.5);
  assert.ok(events.length > 0);
  assert.ok(events.every((e) => e.source === 'poison#3'));
});

test('applyStatus validates input and ignores dead enemies', () => {
  const { game, enemy } = setup('armoredGrunt');
  for (const bad of [
    null, { type: 'burn' }, { type: 'slow', factor: 0, duration: 1 }, { type: 'slow', factor: 1.5, duration: 1 },
    { type: 'slow', factor: 0.5, duration: -1 }, { type: 'poison', dps: NaN, duration: 1 }, { type: 'poison', dps: 5, duration: 'x' },
  ]) assert.throws(() => applyStatus(game, enemy, bad), TypeError);
  applyDamage(game, enemy, { amount: 1e6, kind: 'direct' });
  applyStatus(game, enemy, { type: 'poison', dps: 5, duration: 1 });
  applyStatus(game, enemy, { type: 'slow', factor: 0.5, duration: 1 });
  assert.equal(enemy.poisonStacks, 0);
  assert.equal(enemy.slowFactor, 1);
});

test('poison on a shielded bruiser is blocked until the shield breaks', () => {
  const { game, enemy } = setup('shieldedBruiser');
  applyStatus(game, enemy, { type: 'poison', dps: 20, duration: 5 });
  run(game, 1);
  assert.equal(enemy.hp, 220);
  applyDamage(game, enemy, { amount: 160, kind: 'direct' });
  run(game, 1);
  assert.ok(enemy.hp < 220);
});
