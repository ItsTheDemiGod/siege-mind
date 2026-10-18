import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTargetMode } from '../src/sim/towers.js';
import { applyDamage } from '../src/sim/damage.js';
import { rig, place, dummy, manualTick } from './helpers.js';

// Tower at tile (15,2): world center (992, 160). Enemies are pinned with explicit x/y/distance.
const setup = (type = 'lance') => {
  const game = rig();
  const tower = place(game, type);
  return { game, tower, at: (dx, dy = 0) => [tower.x + dx, tower.y + dy] };
};

test("'first' picks the greatest path distance", () => {
  const { game, tower, at } = setup();
  const a = dummy(game, 'armoredGrunt', ...at(40), { distance: 100, hp: 1e9 });
  const b = dummy(game, 'armoredGrunt', ...at(90), { distance: 300, hp: 1e9 });
  dummy(game, 'armoredGrunt', ...at(20), { distance: 50, hp: 1e9 });
  manualTick(game);
  assert.equal(tower.targetId, b.id);
  assert.notEqual(tower.targetId, a.id);
});

test("'strongest' picks the highest hp + shield", () => {
  const { game, tower, at } = setup('sniper');
  assert.equal(tower.targetMode, 'strongest');
  dummy(game, 'armoredGrunt', ...at(40), { distance: 300, hp: 120 });
  const bruiser = dummy(game, 'shieldedBruiser', ...at(60), { distance: 100 }); // 220 + 160
  manualTick(game);
  assert.equal(tower.targetId, bruiser.id);
});

test("'closest' picks the least distance to the tower", () => {
  const { game, tower, at } = setup();
  setTargetMode(game, tower.id, 'closest');
  dummy(game, 'armoredGrunt', ...at(100), { distance: 500, hp: 1e9 });
  const near = dummy(game, 'armoredGrunt', ...at(30, 10), { distance: 10, hp: 1e9 });
  manualTick(game);
  assert.equal(tower.targetId, near.id);
});

test('ties go to the lowest enemy id', () => {
  for (const mode of ['first', 'strongest', 'closest']) {
    const { game, tower, at } = setup();
    setTargetMode(game, tower.id, mode);
    const a = dummy(game, 'armoredGrunt', ...at(50), { distance: 200, hp: 500 });
    dummy(game, 'armoredGrunt', ...at(0, 50), { distance: 200, hp: 500 }); // same distance to the tower, same score
    manualTick(game);
    assert.equal(tower.targetId, a.id, mode);
  }
});

test('out-of-range and dead enemies are ignored', () => {
  const { game, tower, at } = setup();
  dummy(game, 'armoredGrunt', ...at(200), { distance: 900, hp: 1e9 }); // range is 150
  const dead = dummy(game, 'armoredGrunt', ...at(40), { distance: 800, hp: 1e9 });
  applyDamage(game, dead, { amount: 1e12, kind: 'direct', armorPierce: true });
  const ok = dummy(game, 'armoredGrunt', ...at(60), { distance: 10, hp: 1e9 });
  manualTick(game);
  assert.equal(tower.targetId, ok.id);
});

test('re-targets when the target dies or leaves range', () => {
  const { game, tower, at } = setup();
  const a = dummy(game, 'armoredGrunt', ...at(50), { distance: 400, hp: 1e9 });
  const b = dummy(game, 'armoredGrunt', ...at(60), { distance: 300, hp: 1e9 });
  manualTick(game);
  assert.equal(tower.targetId, a.id);
  a.x = tower.x + 500; // leaves range
  manualTick(game);
  assert.equal(tower.targetId, b.id);
  applyDamage(game, b, { amount: 1e12, kind: 'direct', armorPierce: true });
  manualTick(game);
  assert.equal(tower.targetId, -1);
});

test('angle points at the target and persists when there is none', () => {
  const { game, tower, at } = setup();
  dummy(game, 'armoredGrunt', ...at(0, 80), { distance: 1, hp: 1e9 }); // straight down
  manualTick(game);
  assert.ok(Math.abs(tower.angle - Math.PI / 2) < 1e-9);
  assert.equal(tower.targetId >= 0, true);
  const empty = setup();
  manualTick(empty.game);
  assert.equal(empty.tower.targetId, -1);
  assert.equal(empty.tower.angle, 0);
});
