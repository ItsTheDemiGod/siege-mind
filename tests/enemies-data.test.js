import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES, ENEMY_ORDER, ENEMY_IDS } from '../src/data/enemies.js';
import { THEME } from '../src/render/theme.js';
import { enemySize } from '../src/render/shapes.js';

test('exactly the five ids in the stated order', () => {
  assert.deepEqual([...ENEMY_ORDER], ['armoredGrunt', 'swarmling', 'fastRunner', 'regenerator', 'shieldedBruiser']);
  assert.deepEqual([...ENEMY_IDS], [...ENEMY_ORDER]);
  assert.deepEqual(Object.keys(ENEMIES), [...ENEMY_ORDER]);
});

test('numeric fields are finite and sane', () => {
  for (const d of Object.values(ENEMIES)) {
    for (const k of ['hp', 'speed', 'armor', 'regenFraction', 'shield', 'packSize', 'packIntervalTicks', 'threatCost', 'reward', 'leakDamage', 'radius']) {
      assert.ok(Number.isFinite(d[k]), `${d.id}.${k}`);
    }
    assert.ok(d.hp > 0 && d.speed > 0 && d.armor >= 0 && d.packSize >= 1 && d.packIntervalTicks >= 0);
    assert.ok(d.threatCost > 0 && d.reward >= 0 && d.leakDamage >= 1);
    if (d.packSize > 1) assert.ok(d.packIntervalTicks > 0, `${d.id} pack interval`);
    assert.equal(d.id, ENEMY_ORDER.find((id) => ENEMIES[id] === d));
  }
});

test('radius equals the render sizes', () => {
  assert.deepEqual(Object.fromEntries(ENEMY_ORDER.map((id) => [id, ENEMIES[id].radius])),
    { armoredGrunt: 16, swarmling: 9, fastRunner: 12, regenerator: 14, shieldedBruiser: 22 });
  for (const id of ENEMY_ORDER) assert.equal(ENEMIES[id].radius, enemySize(id));
});

test('ids match the theme enemy color keys', () => {
  for (const id of ENEMY_ORDER) assert.ok(id in THEME.enemy, id);
});

test('definitions are frozen', () => {
  assert.ok(Object.isFrozen(ENEMIES) && Object.isFrozen(ENEMY_ORDER));
  for (const d of Object.values(ENEMIES)) assert.ok(Object.isFrozen(d));
});

test('only the bruiser has a DoT-blocking shield; only the regenerator regenerates', () => {
  for (const d of Object.values(ENEMIES)) {
    assert.equal(d.shield > 0, d.id === 'shieldedBruiser');
    assert.equal(d.shieldBlocksDot, d.id === 'shieldedBruiser');
    assert.equal(d.regenFraction > 0, d.id === 'regenerator');
  }
});
