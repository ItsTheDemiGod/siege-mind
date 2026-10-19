import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trayEntry, priceMultiplier } from '../src/ui/trayState.js';
import { getTowerCost } from '../src/sim/towers.js';
import { TOWERS } from '../src/data/towers.js';
import { config } from '../src/data/config.js';
import { rig, place } from './helpers.js';

test('with no towers the price is the base price', () => {
  const g = rig({ startGold: 1000 });
  const e = trayEntry(g, 'lance');
  assert.equal(e.cost, TOWERS.lance.cost);
  assert.equal(e.base, TOWERS.lance.cost);
  assert.equal(priceMultiplier(g), 1);
  assert.equal(e.affordable, true);
  assert.equal(e.label, `Lance tower, ${TOWERS.lance.cost} gold, hotkey A`);
});

test('prices follow the number of towers owned and match getTowerCost', () => {
  const g = rig({ startGold: 100000 });
  place(g, 'lance', 15, 2);
  place(g, 'mortar', 14, 2);
  for (const id of Object.keys(TOWERS)) assert.equal(trayEntry(g, id).cost, getTowerCost(g, id));
  assert.equal(trayEntry(g, 'lance').cost, Math.round(TOWERS.lance.cost * (1 + 2 * config.economy.towerCostGrowth)));
  assert.equal(priceMultiplier(g), 1 + 2 * config.economy.towerCostGrowth);
});

test('affordability and the aria label follow the gold', () => {
  const g = rig({ startGold: TOWERS.lance.cost - 1 });
  const e = trayEntry(g, 'lance');
  assert.equal(e.affordable, false);
  assert.ok(e.label.endsWith(', not enough gold'));
  g.gold = e.cost;
  assert.equal(trayEntry(g, 'lance').affordable, true);
});

test('the price line states base price and growth percentage from the config', () => {
  const g = rig({ startGold: 1000 });
  const pct = Math.round(config.economy.towerCostGrowth * 1000) / 10;
  assert.equal(trayEntry(g, 'sniper').priceLine, `Price: ${TOWERS.sniper.cost} gold (base ${TOWERS.sniper.cost}, +${pct}% per tower owned)`);
});
