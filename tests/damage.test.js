import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { spawnEnemyNow } from '../src/sim/enemies.js';
import { applyDamage, resolveDamage } from '../src/sim/damage.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { ENEMIES } from '../src/data/enemies.js';
import { config } from '../src/data/config.js';

const setup = (type) => {
  const game = createGame({ seed: 1, debugSpawnEveryTicks: 0 });
  const events = [];
  for (const t of [EVENT_TYPES.ENEMY_DAMAGED, EVENT_TYPES.ENEMY_KILLED]) game.events.on(t, (p) => events.push([t, p]));
  return { game, enemy: spawnEnemyNow(game, type), events };
};
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('direct damage is reduced by flat armor', () => {
  const { game, enemy } = setup('armoredGrunt');
  const r = applyDamage(game, enemy, { amount: 40, kind: 'direct' });
  assert.equal(r.hpDamage, 34);
  assert.equal(enemy.hp, 86);
});

test('armor never reduces damage below the 20% floor', () => {
  const g = setup('armoredGrunt');
  near(applyDamage(g.game, g.enemy, { amount: 10, kind: 'direct' }).hpDamage, 4);
  const h = setup('armoredGrunt');
  near(applyDamage(h.game, h.enemy, { amount: 3, kind: 'direct' }).hpDamage, 0.6);
});

test('armorPierce ignores armor', () => {
  const { game, enemy } = setup('armoredGrunt');
  assert.equal(applyDamage(game, enemy, { amount: 40, kind: 'direct', armorPierce: true }).hpDamage, 40);
});

test('shield absorbs first: four direct 40s break a 160 shield, the fifth deals 37 to hp', () => {
  const { game, enemy } = setup('shieldedBruiser');
  for (let i = 0; i < 4; i++) {
    const r = applyDamage(game, enemy, { amount: 40, kind: 'direct' });
    assert.equal(r.shieldDamage, 40);
    assert.equal(r.hpDamage, 0);
  }
  assert.equal(enemy.shield, 0);
  assert.equal(enemy.hp, 220);
  assert.equal(applyDamage(game, enemy, { amount: 40, kind: 'direct' }).hpDamage, 37);
});

test('shieldMult 3 with 60 piercing: breaks the shield and overflows 60 - 160/3 to hp', () => {
  const { game, enemy } = setup('shieldedBruiser');
  const r = applyDamage(game, enemy, { amount: 60, kind: 'direct', armorPierce: true, shieldMult: 3 });
  near(r.shieldDamage, 160);
  near(r.hpDamage, 60 - 160 / 3, 1e-9);
  assert.equal(enemy.shield, 0);
});

test('overflow conversion with a partial shield (armor applies only to the overflow)', () => {
  const { game, enemy } = setup('shieldedBruiser');
  enemy.shield = 20;
  const r = applyDamage(game, enemy, { amount: 50, kind: 'direct' });
  assert.equal(r.shieldDamage, 20);
  near(r.hpDamage, 30 - 3); // 30 overflow minus armor 3
  const m = setup('shieldedBruiser');
  m.enemy.shield = 30;
  const s = applyDamage(m.game, m.enemy, { amount: 20, kind: 'direct', shieldMult: 3, armorPierce: true });
  near(s.shieldDamage, 30);
  near(s.hpDamage, 20 - 10);
});

test('DoT ignores armor', () => {
  const { game, enemy } = setup('armoredGrunt');
  assert.equal(applyDamage(game, enemy, { amount: 5, kind: 'dot' }).hpDamage, 5);
});

test('DoT is blocked by the bruiser shield and lands once it breaks', () => {
  const { game, enemy } = setup('shieldedBruiser');
  const blocked = applyDamage(game, enemy, { amount: 10, kind: 'dot' });
  assert.equal(blocked.blocked, true);
  assert.equal(enemy.hp, 220);
  applyDamage(game, enemy, { amount: 160, kind: 'direct' });
  assert.equal(enemy.shield, 0);
  assert.equal(enemy.alive, true);
  assert.equal(applyDamage(game, enemy, { amount: 10, kind: 'dot' }).hpDamage, 10);
});

test('damage to a dead enemy is ignored and never double-kills', () => {
  const { game, enemy, events } = setup('swarmling');
  applyDamage(game, enemy, { amount: 1000, kind: 'direct' });
  const again = applyDamage(game, enemy, { amount: 1000, kind: 'direct' });
  assert.deepEqual(again, { shieldDamage: 0, hpDamage: 0, blocked: false, killed: false });
  assert.equal(events.filter(([t]) => t === EVENT_TYPES.ENEMY_KILLED).length, 1);
});

test('ENEMY_KILLED carries reward, progress, source, position', () => {
  const { game, enemy, events } = setup('armoredGrunt');
  enemy.distance = 1760;
  applyDamage(game, enemy, { amount: 1000, kind: 'direct', armorPierce: true, source: 'lance#1' });
  const kill = events.find(([t]) => t === EVENT_TYPES.ENEMY_KILLED)[1];
  assert.equal(kill.reward, ENEMIES.armoredGrunt.reward);
  near(kill.progress, 0.5);
  assert.equal(kill.source, 'lance#1');
  assert.equal(kill.id, enemy.id);
  assert.equal(kill.type, 'armoredGrunt');
  assert.ok(Number.isFinite(kill.x) && Number.isFinite(kill.y));
  assert.equal(enemy.alive, false);
});

test('ENEMY_DAMAGED payload fields', () => {
  const { game, enemy, events } = setup('shieldedBruiser');
  applyDamage(game, enemy, { amount: 40, kind: 'direct', source: 's1' });
  const [type, p] = events[0];
  assert.equal(type, EVENT_TYPES.ENEMY_DAMAGED);
  assert.deepEqual(Object.keys(p).sort(), ['amount', 'hpDamage', 'id', 'kind', 'shieldDamage', 'source', 'tick', 'towerId', 'type', 'x', 'y']);
  assert.equal(p.amount, 40);
  assert.equal(p.shieldDamage, 40);
  assert.equal(p.kind, 'direct');
  assert.equal(p.source, 's1');
});

test('direct hit sets lastHitTick; DoT does not emit per hit', () => {
  const { game, enemy, events } = setup('armoredGrunt');
  game.tick = 7;
  applyDamage(game, enemy, { amount: 5, kind: 'dot' });
  assert.equal(events.length, 0);
  assert.equal(enemy.lastHitTick, -1);
  applyDamage(game, enemy, { amount: 20, kind: 'direct' });
  assert.equal(enemy.lastHitTick, 7);
});

test('invalid amounts and kinds throw TypeError', () => {
  const { game, enemy } = setup('armoredGrunt');
  for (const amount of [NaN, -1, '5', Infinity, undefined]) {
    assert.throws(() => applyDamage(game, enemy, { amount, kind: 'direct' }), TypeError, String(amount));
  }
  assert.throws(() => applyDamage(game, enemy, { amount: 5, kind: 'magic' }), TypeError);
});

test('killEpsilon: hp within epsilon of zero counts as dead', () => {
  const { game, enemy } = setup('swarmling');
  enemy.hp = 10 + config.combat.killEpsilon / 2;
  assert.equal(applyDamage(game, enemy, { amount: 10, kind: 'direct', armorPierce: true }).killed, true);
});

test('resolveDamage does not mutate', () => {
  const { enemy } = setup('shieldedBruiser');
  const before = { ...enemy };
  resolveDamage(ENEMIES.shieldedBruiser, enemy, { amount: 300, kind: 'direct' }, config.combat);
  assert.deepEqual(enemy, before);
});
