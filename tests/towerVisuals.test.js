import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWER_VISUALS } from '../src/data/towerVisuals.js';
import { TOWER_ORDER } from '../src/data/towers.js';

const KEYS = [
  'turnRate', 'bodyRadius', 'barrelLength', 'recoilDistance', 'recoilSeconds', 'flashSeconds', 'flashSize', 'chargeSeconds', 'spinRate',
  'trailLength', 'shellArcHeight', 'dripEverySeconds', 'streakLength', 'ringSeconds', 'scorchSeconds', 'cloudSeconds', 'shardCount',
  'beamSeconds', 'buildSeconds', 'dissolveSeconds', 'upgradeFlashSeconds',
];

test('exactly the five tower ids, frozen, with every key present', () => {
  assert.deepEqual(Object.keys(TOWER_VISUALS).sort(), [...TOWER_ORDER].sort());
  assert.ok(Object.isFrozen(TOWER_VISUALS));
  for (const id of TOWER_ORDER) {
    assert.ok(Object.isFrozen(TOWER_VISUALS[id]));
    for (const k of KEYS) assert.ok(Number.isFinite(TOWER_VISUALS[id][k]) && TOWER_VISUALS[id][k] >= 0, `${id}.${k}`);
  }
});

// barrelLength is measured from the tower centre (the barrel pokes out of the body), so the envelope is the larger of the two.
test('shapes fit inside the allowed envelope', () => {
  for (const id of TOWER_ORDER) {
    const v = TOWER_VISUALS[id];
    assert.ok(v.bodyRadius > 0 && v.bodyRadius <= 26, `${id} body`);
    assert.ok(Math.max(v.bodyRadius, v.barrelLength) <= 48, `${id} envelope`);
  }
});

test('durations that drive animations are positive', () => {
  for (const id of TOWER_ORDER) {
    const v = TOWER_VISUALS[id];
    assert.ok(v.buildSeconds > 0 && v.dissolveSeconds > 0 && v.upgradeFlashSeconds > 0, id);
    assert.ok(v.flashSeconds > 0, id);
  }
});

test('the spec values hold', () => {
  assert.equal(TOWER_VISUALS.lance.turnRate, 14);
  assert.equal(TOWER_VISUALS.sniper.chargeSeconds, 0.6);
  assert.equal(TOWER_VISUALS.mortar.shellArcHeight, 56);
  assert.equal(TOWER_VISUALS.frost.spinRate, 0.6);
  assert.equal(TOWER_VISUALS.frost.turnRate, 0);
  assert.equal(TOWER_VISUALS.poison.shardCount, 0);
  assert.equal(TOWER_VISUALS.frost.shardCount, 5);
});
