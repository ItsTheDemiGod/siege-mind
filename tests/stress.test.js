import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStress } from '../src/ui/stress.js';
import { createGame, snapshotGame } from '../src/sim/game.js';
import { TOWER_ORDER } from '../src/data/towers.js';

const make = () => createGame({ seed: 1, debugSpawnEveryTicks: 3, startGold: 1e6 });

test('places 40 towers on distinct tiles, five types round-robin', () => {
  const g = make();
  assert.equal(applyStress(g), 40);
  assert.equal(g.towers.length, 40);
  assert.equal(new Set(g.towers.map((t) => `${t.col},${t.row}`)).size, 40);
  for (const type of TOWER_ORDER) assert.equal(g.towers.filter((t) => t.type === type).length, 8);
});

test('every 4th tower is level 2, the others level 0', () => {
  const g = make();
  applyStress(g);
  g.towers.forEach((t, i) => assert.equal(t.level, i % 4 === 0 ? 2 : 0, `tower ${i}`));
});

test('deterministic: two games get identical layouts', () => {
  const a = make();
  const b = make();
  applyStress(a);
  applyStress(b);
  assert.deepEqual(snapshotGame(a).towers, snapshotGame(b).towers);
});
