import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepGame } from '../src/sim/game.js';
import { upgradeTower, getTowerStats } from '../src/sim/towers.js';
import { getEnemyById, refreshEnemyPosition } from '../src/sim/enemies.js';
import { applyDamage } from '../src/sim/damage.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { TOWER_ORDER } from '../src/data/towers.js';
import { rig, place, dummy, manualTick, record } from './helpers.js';

const E = EVENT_TYPES;
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

/** Pin an enemy on the path at the point nearest to a world position (for tests that use full stepGame). */
function placeOnPath(game, enemy, x, y) {
  let best = 0;
  let bestD = Infinity;
  const p = { x: 0, y: 0, angle: 0 };
  for (let d = 0; d <= game.map.path.totalLength; d += 2) {
    game.map.path.sampleAt(d, 0, p);
    const dd = Math.hypot(p.x - x, p.y - y);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  enemy.distance = best; enemy.prevDistance = best; enemy.lane = 0;
  refreshEnemyPosition(game, enemy);
}

test('consecutive shots are exactly intervalTicks apart, for every tower, before and after an upgrade', () => {
  for (const type of TOWER_ORDER) {
    for (const level of [0, 1]) {
      const g = rig();
      const t = place(g, type);
      for (let l = 0; l < level; l++) upgradeTower(g, t.id);
      dummy(g, 'armoredGrunt', t.x + 50, t.y, { distance: 100, hp: 1e12 });
      const log = record(g, E.TOWER_FIRED);
      for (let i = 0; i < 700; i++) manualTick(g);
      const ticks = log.map(([, p]) => p.tick);
      assert.ok(ticks.length >= 3, `${type} fired ${ticks.length}`);
      const interval = getTowerStats(type, level).intervalTicks;
      for (let i = 1; i < ticks.length; i++) assert.equal(ticks[i] - ticks[i - 1], interval, `${type} L${level}`);
    }
  }
});

test('lance kills a grunt in 5 shots, each hit nominal (armor ignored)', () => {
  const g = rig();
  const t = place(g, 'lance');
  const grunt = dummy(g, 'armoredGrunt', t.x + 50, t.y, { distance: 100 });
  const fired = record(g, E.TOWER_FIRED);
  const dmg = record(g, E.ENEMY_DAMAGED);
  for (let i = 0; i < 1000 && grunt.alive; i++) manualTick(g);
  assert.equal(grunt.alive, false);
  assert.equal(fired.length, 5);
  assert.equal(dmg.length, 5);
  for (const [, p] of dmg) near(p.amount, 24);
});

test('mortar shell flight time is distance / speed, with linear splash falloff and nothing outside', () => {
  const g = rig();
  const t = place(g, 'mortar');
  const center = dummy(g, 'swarmling', t.x + 100, t.y, { distance: 100, hp: 1e9 });
  const e30 = dummy(g, 'swarmling', t.x + 130, t.y, { distance: 50, hp: 1e9 });
  const e60 = dummy(g, 'swarmling', t.x + 100, t.y + 60, { distance: 40, hp: 1e9 });
  const e70 = dummy(g, 'swarmling', t.x + 100, t.y + 70, { distance: 30, hp: 1e9 });
  const hp0 = center.maxHp;
  const fired = record(g, E.TOWER_FIRED);
  let impactTick = -1;
  g.events.on(E.PROJECTILE_IMPACT, (p) => { if (impactTick < 0) impactTick = g.tick; assert.equal(p.kind, 'shell'); assert.equal(p.hits, 3); });
  for (let i = 0; i < 40; i++) manualTick(g);
  assert.equal(impactTick - fired[0][1].tick, Math.ceil(100 / (240 / 60)));
  near(hp0 - center.hp, 36);
  near(hp0 - e30.hp, 27);
  near(hp0 - e60.hp, 18);
  assert.equal(e70.hp, hp0);
});

test('a mortar shell misses a runner that keeps walking but hits stationary and slowed enemies', () => {
  const run = (speedFactor) => {
    const g = rig();
    const t = place(g, 'mortar');
    const r = dummy(g, 'fastRunner', t.x + 160, t.y, { distance: 100, hp: 1e9 });
    const impacts = [];
    g.events.on(E.PROJECTILE_IMPACT, (p) => impacts.push(p));
    for (let i = 0; i < 60; i++) {
      r.x += (130 * speedFactor) / 60;
      manualTick(g);
    }
    return impacts[0];
  };
  assert.equal(run(1).hit, false);
  assert.equal(run(0).hit, true);
  assert.equal(run(0.3).hit, true);
});

test('frost slows exactly the enemies inside its range and never fires without one', () => {
  const g = rig();
  const t = place(g, 'frost');
  const fired = record(g, E.TOWER_FIRED);
  for (let i = 0; i < 200; i++) manualTick(g);
  assert.equal(fired.length, 0);
  const inside = dummy(g, 'armoredGrunt', t.x + 50, t.y, { distance: 10, hp: 1000 });
  const outside = dummy(g, 'armoredGrunt', t.x + 200, t.y, { distance: 20, hp: 1000 });
  manualTick(g);
  assert.equal(fired.length, 1);
  assert.equal(inside.slowFactor, 0.5);
  near(inside.slowRemaining, 1.6);
  assert.equal(outside.slowFactor, 1);
  assert.equal(outside.slowRemaining, 0);
  near(1000 - inside.hp, 4);
  assert.equal(outside.hp, 1000);
});

test('upgraded frost uses its absolute slow factor', () => {
  const g = rig();
  const t = place(g, 'frost');
  upgradeTower(g, t.id);
  upgradeTower(g, t.id);
  const e = dummy(g, 'armoredGrunt', t.x + 50, t.y, { distance: 10, hp: 1000 });
  manualTick(g);
  near(e.slowFactor, 0.33);
});

test('poison stacks on the target and the cloud only, and does nothing to a shielded bruiser', () => {
  const g = rig();
  const t = place(g, 'poison');
  const target = dummy(g, 'armoredGrunt', t.x + 100, t.y, { distance: 300, hp: 1e9 });
  const inCloud = dummy(g, 'armoredGrunt', t.x + 120, t.y, { distance: 100, hp: 1e9 });
  const outside = dummy(g, 'armoredGrunt', t.x + 140, t.y, { distance: 90, hp: 1e9 });
  let impact = null;
  g.events.on(E.PROJECTILE_IMPACT, (p) => { impact ??= p; });
  for (let i = 0; i < 40 && !impact; i++) manualTick(g);
  assert.ok(impact);
  assert.equal(impact.hits, 2);
  assert.deepEqual([target.poisonStacks, inCloud.poisonStacks, outside.poisonStacks], [1, 1, 0]);
  assert.equal(target.poisonSource, 'poison');
  assert.equal(target.poisonTowerId, t.id);

  const g2 = rig();
  const t2 = place(g2, 'poison');
  const bruiser = dummy(g2, 'shieldedBruiser', 0, 0);
  placeOnPath(g2, bruiser, t2.x, t2.y);
  for (let i = 0; i < 200; i++) stepGame(g2);
  assert.ok(bruiser.poisonStacks >= 1, 'poison was applied');
  assert.equal(bruiser.hp, bruiser.maxHp);
  assert.equal(bruiser.shield, bruiser.maxShield);
});

test('the sniper breaks a full bruiser shield in one shot and the overflow reaches hp', () => {
  const g = rig();
  const t = place(g, 'sniper');
  const b = dummy(g, 'shieldedBruiser', t.x + 120, t.y, { distance: 100 });
  manualTick(g);
  assert.equal(b.shield, 0);
  near(b.hp, 220 - (90 - 160 / 3));
});

test('a homing bolt fizzles when its target dies', () => {
  const g = rig();
  const t = place(g, 'lance');
  const e = dummy(g, 'armoredGrunt', t.x + 120, t.y, { distance: 50, hp: 1e9 });
  const impacts = [];
  g.events.on(E.PROJECTILE_IMPACT, (p) => impacts.push(p));
  manualTick(g);
  assert.equal(g.projectiles.length, 1);
  applyDamage(g, e, { amount: 1e12, kind: 'direct', armorPierce: true });
  manualTick(g);
  assert.deepEqual(impacts.map((p) => [p.hit, p.hits]), [[false, 0]]);
  assert.equal(g.projectiles.length, 0);
});

test('projectile accounting: spawned = impacted + in flight, never finished entries', () => {
  const g = rig();
  const a = place(g, 'lance');
  place(g, 'mortar', 14, 2);
  place(g, 'poison', 16, 2);
  dummy(g, 'armoredGrunt', a.x + 60, a.y, { distance: 100, hp: 1e12 });
  let spawned = 0;
  let impacts = 0;
  g.events.on(E.TOWER_FIRED, (p) => { if (p.kind === 'bolt' || p.kind === 'shell') spawned++; });
  g.events.on(E.PROJECTILE_IMPACT, () => { impacts++; });
  for (let i = 0; i < 600; i++) {
    manualTick(g);
    assert.equal(spawned - impacts, g.projectiles.length);
    for (const p of g.projectiles) assert.ok(p.remaining > 0);
  }
});

test('damage and kill events carry towerId and the tower type as source; counters match the events', () => {
  const g = rig();
  const t = place(g, 'lance');
  dummy(g, 'armoredGrunt', t.x + 50, t.y, { distance: 100 });
  const dmg = record(g, E.ENEMY_DAMAGED);
  const kills = record(g, E.ENEMY_KILLED);
  const fired = record(g, E.TOWER_FIRED);
  for (let i = 0; i < 600; i++) manualTick(g);
  assert.ok(dmg.length > 0 && kills.length === 1);
  for (const [, p] of dmg) assert.deepEqual([p.towerId, p.source], [t.id, 'lance']);
  assert.deepEqual([kills[0][1].towerId, kills[0][1].source], [t.id, 'lance']);
  near(t.damageDealt, dmg.reduce((s, [, p]) => s + p.amount, 0));
  assert.equal(t.kills, 1);
  assert.equal(t.shots, fired.length);
  assert.equal(getEnemyById(g, kills[0][1].id), null);
});

test('a poison DoT kill is attributed to the poisoning tower', () => {
  const g = rig();
  const t = place(g, 'poison');
  const e = dummy(g, 'swarmling', 0, 0);
  placeOnPath(g, e, t.x, t.y);
  const kills = record(g, E.ENEMY_KILLED);
  const dots = record(g, E.ENEMY_DAMAGED);
  for (let i = 0; i < 500 && kills.length === 0; i++) stepGame(g);
  assert.equal(kills.length, 1);
  assert.deepEqual([kills[0][1].towerId, kills[0][1].source], [t.id, 'poison']);
  assert.ok(dots.some(([, p]) => p.kind === 'dot' && p.towerId === t.id));
  assert.equal(t.kills, 1);
  assert.ok(t.damageDealt > 0);
});
