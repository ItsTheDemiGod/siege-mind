import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/sim/game.js';
import {
  canPlaceTower, placeTower, upgradeTower, sellTower, setTargetMode, towerAt, getTowerById, getTowerStats,
} from '../src/sim/towers.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { TOWERS, TOWER_ORDER } from '../src/data/towers.js';
import { config } from '../src/data/config.js';
import { rig, place, TILE, record, dummy, manualTick } from './helpers.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('placement failure reasons, with no state change', () => {
  const g = rig({ startGold: 10 });
  const snap = () => JSON.stringify([g.gold, g.towers, g.occupancy]);
  const before = snap();
  const cases = [
    [['dragon', TILE.col, TILE.row], 'unknown_type'],
    [['lance', -1, 0], 'out_of_bounds'],
    [['lance', 99, 3], 'out_of_bounds'],
    [['lance', 5, 1], 'not_buildable'], // path
    [['lance', 8, 2], 'not_buildable'], // blocked decor
    [['lance', TILE.col, TILE.row], 'insufficient_gold'],
  ];
  for (const [args, reason] of cases) {
    const r = placeTower(g, ...args);
    assert.deepEqual([r.ok, r.reason], [false, reason], reason);
    assert.equal(snap(), before);
  }
  const rich = rig();
  place(rich, 'lance');
  assert.equal(placeTower(rich, 'lance', TILE.col, TILE.row).reason, 'occupied');
});

test('tower limit', () => {
  const g = rig({ startGold: 1e9 });
  const cells = g.map.buildableCells();
  for (let i = 0; i < config.towers.maxTowers; i++) assert.ok(placeTower(g, 'lance', cells[i].col, cells[i].row).ok);
  const next = cells[config.towers.maxTowers];
  const r = placeTower(g, 'lance', next.col, next.row);
  assert.deepEqual([r.ok, r.reason], [false, 'tower_limit']);
});

test('check order: out of bounds beats gold; unknown type beats everything', () => {
  const g = rig({ startGold: 0 });
  assert.equal(canPlaceTower(g, 'nope', -5, -5).reason, 'unknown_type');
  assert.equal(canPlaceTower(g, 'lance', -5, -5).reason, 'out_of_bounds');
  assert.equal(canPlaceTower(g, 'lance', 5, 1).reason, 'not_buildable');
});

test('successful placement: gold, occupancy, event payload, lookup', () => {
  const g = rig({ startGold: 200 });
  const log = record(g, EVENT_TYPES.TOWER_PLACED);
  const r = placeTower(g, 'lance', TILE.col, TILE.row);
  assert.equal(r.ok, true);
  assert.equal(g.gold, 200 - TOWERS.lance.cost);
  const t = r.tower;
  assert.equal(towerAt(g, TILE.col, TILE.row), t);
  assert.equal(getTowerById(g, t.id), t);
  assert.equal(t.targetMode, 'first');
  assert.equal(t.level, 0);
  assert.equal(t.invested, TOWERS.lance.cost);
  assert.deepEqual(log[0][1], { id: t.id, type: 'lance', col: TILE.col, row: TILE.row, x: t.x, y: t.y, tick: 0, cost: 60 });
  assert.equal(towerAt(g, 0, 0), null);
  assert.equal(placeTower(g, 'frost', 14, 2).tower.targetMode, null);
});

test('upgrade: costs, levels, stats per the table, max level and gold rejections', () => {
  const g = rig({ startGold: 60 + 45 + 80 });
  const t = place(g, 'lance');
  const log = record(g, EVENT_TYPES.TOWER_UPGRADED);
  assert.deepEqual(upgradeTower(g, t.id), { ok: true });
  assert.equal(t.level, 1);
  assert.equal(g.gold, 80);
  assert.deepEqual(log[0][1], { id: t.id, type: 'lance', level: 1, tick: 0, cost: 45 });
  assert.equal(upgradeTower(g, t.id).ok, true);
  assert.equal(t.level, 2);
  assert.equal(t.invested, 60 + 45 + 80);
  assert.deepEqual(upgradeTower(g, t.id), { ok: false, reason: 'max_level' });
  assert.deepEqual(upgradeTower(g, 999), { ok: false, reason: 'unknown_tower' });
  const poor = rig({ startGold: 60 });
  const p = place(poor, 'lance');
  assert.deepEqual(upgradeTower(poor, p.id), { ok: false, reason: 'insufficient_gold' });
  assert.equal(p.level, 0);
  assert.equal(poor.gold, 0);
});

test('upgrade clamps the cooldown to the new interval', () => {
  const g = rig();
  const t = place(g, 'sniper');
  t.cooldown = 210;
  upgradeTower(g, t.id);
  assert.equal(t.cooldown, getTowerStats('sniper', 1).intervalTicks);
});

test('sell refunds floor(0.7 * invested), frees the tile, emits TOWER_SOLD', () => {
  const g = rig({ startGold: 1000 });
  const t = place(g, 'mortar');
  upgradeTower(g, t.id);
  const before = g.gold;
  const log = record(g, EVENT_TYPES.TOWER_SOLD);
  const r = sellTower(g, t.id);
  const refund = Math.floor((100 + 75) * 0.7);
  assert.deepEqual(r, { ok: true, refund });
  assert.equal(g.gold, before + refund);
  assert.equal(towerAt(g, TILE.col, TILE.row), null);
  assert.equal(g.towers.length, 0);
  assert.deepEqual(log[0][1], { id: t.id, type: 'mortar', level: 1, col: TILE.col, row: TILE.row, x: t.x, y: t.y, refund, tick: 0 });
  assert.deepEqual(sellTower(g, t.id), { ok: false, refund: 0 });
  assert.equal(placeTower(g, 'lance', TILE.col, TILE.row).ok, true); // tile reusable
});

test('a sold tower no longer fires', () => {
  const g = rig();
  const t = place(g, 'sniper');
  dummy(g, 'armoredGrunt', t.x + 50, t.y, { hp: 1e9 });
  const fired = record(g, EVENT_TYPES.TOWER_FIRED);
  manualTick(g);
  assert.equal(fired.length, 1);
  sellTower(g, t.id);
  for (let i = 0; i < 400; i++) manualTick(g);
  assert.equal(fired.length, 1);
});

test('setTargetMode validation', () => {
  const g = rig();
  const lance = place(g, 'lance');
  const frost = place(g, 'frost', 14, 2);
  assert.equal(setTargetMode(g, lance.id, 'closest'), true);
  assert.equal(lance.targetMode, 'closest');
  assert.equal(setTargetMode(g, lance.id, 'weakest'), false);
  assert.equal(lance.targetMode, 'closest');
  assert.equal(setTargetMode(g, 999, 'first'), false);
  assert.equal(setTargetMode(g, frost.id, 'first'), false);
  assert.equal(frost.targetMode, null);
});

test('getTowerStats matches hand-computed values at every level', () => {
  const s = getTowerStats;
  near(s('lance', 0).damage, 24); near(s('lance', 0).range, 150); assert.equal(s('lance', 0).intervalTicks, 54);
  near(s('lance', 1).damage, 32.4); near(s('lance', 1).range, 165); assert.equal(s('lance', 1).intervalTicks, 49);
  near(s('lance', 2).damage, 43.2); near(s('lance', 2).range, 180); assert.equal(s('lance', 2).intervalTicks, 43);
  near(s('lance', 0).dps, 24 * 60 / 54);

  near(s('mortar', 0).damage, 36); near(s('mortar', 0).splashRadius, 60); assert.equal(s('mortar', 0).intervalTicks, 90);
  near(s('mortar', 1).damage, 50.4); near(s('mortar', 1).splashRadius, 66); near(s('mortar', 1).range, 183.6); assert.equal(s('mortar', 1).intervalTicks, 81);
  near(s('mortar', 2).damage, 68.4); near(s('mortar', 2).splashRadius, 72); near(s('mortar', 2).range, 197.2); assert.equal(s('mortar', 2).intervalTicks, 72);

  near(s('frost', 0).slowFactor, 0.5); near(s('frost', 0).slowSeconds, 1.6); near(s('frost', 0).damage, 4);
  near(s('frost', 1).slowFactor, 0.42); near(s('frost', 1).damage, 6); near(s('frost', 1).range, 121); assert.equal(s('frost', 1).intervalTicks, 54);
  near(s('frost', 2).slowFactor, 0.33); near(s('frost', 2).damage, 8); near(s('frost', 2).range, 132); assert.equal(s('frost', 2).intervalTicks, 48);

  near(s('poison', 0).poisonDps, 8); near(s('poison', 0).cloudRadius, 28); assert.equal(s('poison', 0).intervalTicks, 75);
  near(s('poison', 1).poisonDps, 11.2); near(s('poison', 1).cloudRadius, 33.6); assert.equal(s('poison', 1).intervalTicks, 68);
  near(s('poison', 2).poisonDps, 15.2); near(s('poison', 2).cloudRadius, 39.2); near(s('poison', 2).range, 168); assert.equal(s('poison', 2).intervalTicks, 60);
  near(s('poison', 0).dps, 8);

  near(s('sniper', 0).damage, 90); near(s('sniper', 0).range, 320); assert.equal(s('sniper', 0).intervalTicks, 210);
  near(s('sniper', 1).damage, 121.5); near(s('sniper', 1).range, 345.6); assert.equal(s('sniper', 1).intervalTicks, 189);
  near(s('sniper', 2).damage, 162); near(s('sniper', 2).range, 368); assert.equal(s('sniper', 2).intervalTicks, 168);
  assert.equal(s('sniper', 2).shieldMult, 3);
});

test('every tower type is placeable and upgradeable end to end', () => {
  const g = rig();
  const cells = g.map.buildableCells();
  TOWER_ORDER.forEach((type, i) => {
    const t = place(g, type, cells[i].col, cells[i].row);
    assert.equal(upgradeTower(g, t.id).ok, true);
    assert.equal(upgradeTower(g, t.id).ok, true);
    assert.equal(t.level, 2);
  });
  stepGame(g);
});

test('createGame without towers still has empty tower state', () => {
  const g = createGame({ seed: 2, debugSpawnEveryTicks: 0 });
  assert.deepEqual([g.towers.length, g.projectiles.length, g.nextTowerId], [0, 0, 1]);
  assert.equal(g.occupancy.length, g.map.cols * g.map.rows);
});

// ---- Phase 4A.2: tower price growth and the tower cap ----
import { getTowerCost } from '../src/sim/towers.js';

test('getTowerCost: base price with no towers, grows with the number owned, throws on unknown types', () => {
  const g = rig({ startGold: 1e6 });
  const growth = config.economy.towerCostGrowth;
  for (const id of TOWER_ORDER) assert.equal(getTowerCost(g, id), TOWERS[id].cost);
  const cells = g.map.buildableCells();
  for (let n = 1; n <= 5; n++) {
    placeTower(g, 'lance', cells[n].col, cells[n].row);
    for (const id of TOWER_ORDER) assert.equal(getTowerCost(g, id), Math.round(TOWERS[id].cost * (1 + growth * n)), `${id} with ${n} owned`);
  }
  assert.throws(() => getTowerCost(g, 'dragon'), RangeError);
});

test('the price paid equals getTowerCost, invested equals it, the refund is floor(0.7 * invested), selling lowers the next price', () => {
  const g = rig({ startGold: 100000 });
  const cells = g.map.buildableCells();
  placeTower(g, 'lance', cells[0].col, cells[0].row);
  placeTower(g, 'mortar', cells[1].col, cells[1].row);
  const quoted = getTowerCost(g, 'frost');
  const before = g.gold;
  const log = record(g, EVENT_TYPES.TOWER_PLACED);
  const t = placeTower(g, 'frost', cells[2].col, cells[2].row).tower;
  assert.equal(before - g.gold, quoted);
  assert.equal(t.invested, quoted);
  assert.equal(log[0][1].cost, quoted);
  const priceWith3 = getTowerCost(g, 'lance');
  const gold = g.gold;
  assert.deepEqual(sellTower(g, t.id), { ok: true, refund: Math.floor(quoted * config.economy.sellRefundFraction) });
  assert.equal(g.gold, gold + Math.floor(quoted * config.economy.sellRefundFraction));
  assert.ok(getTowerCost(g, 'lance') <= priceWith3);
  assert.equal(getTowerCost(g, 'lance'), Math.round(TOWERS.lance.cost * (1 + config.economy.towerCostGrowth * 2)));
});

test('a failed placement does not change the price; upgrade prices ignore the tower count', () => {
  const g = rig({ startGold: 1e6 });
  const first = place(g, 'lance');
  const price = getTowerCost(g, 'lance');
  assert.equal(placeTower(g, 'lance', 5, 1).ok, false); // path tile
  assert.equal(getTowerCost(g, 'lance'), price);
  const goldBefore = g.gold;
  upgradeTower(g, first.id);
  assert.equal(goldBefore - g.gold, TOWERS.lance.upgrades[0].cost);
  const cells = g.map.buildableCells().filter((c) => !(c.col === TILE.col && c.row === TILE.row));
  for (let i = 0; i < 10; i++) placeTower(g, 'frost', cells[i].col, cells[i].row);
  const g2 = g.gold;
  upgradeTower(g, first.id);
  assert.equal(g2 - g.gold, TOWERS.lance.upgrades[1].cost);
});

test('the tower limit is config.towers.maxTowers (60) and the reason still applies', () => {
  assert.equal(config.towers.maxTowers, 60);
  const g = rig({ startGold: 1e9 });
  const cells = g.map.buildableCells();
  for (let i = 0; i < config.towers.maxTowers; i++) assert.ok(placeTower(g, 'lance', cells[i].col, cells[i].row).ok);
  const next = cells[config.towers.maxTowers];
  assert.deepEqual(placeTower(g, 'lance', next.col, next.row), { ok: false, reason: 'tower_limit' });
});
