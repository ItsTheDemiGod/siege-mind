import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/sim/game.js';
import { spawnEnemyNow, nukeAll } from '../src/sim/enemies.js';
import { upgradeTower, sellTower, placeTower, getTowerCost } from '../src/sim/towers.js';
import { startNextWave } from '../src/sim/waveRunner.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { ENEMIES } from '../src/data/enemies.js';
import { TOWERS } from '../src/data/towers.js';
import { config } from '../src/data/config.js';
import { record } from './helpers.js';

test('counters follow a scripted scenario and the gold ledgers match the GOLD_CHANGED events', () => {
  const g = createGame({ seed: 1, debugSpawnEveryTicks: 0, startGold: 1000 });
  const gold = record(g, EVENT_TYPES.GOLD_CHANGED);

  const lancePrice = getTowerCost(g, 'lance');
  const a = placeTower(g, 'lance', 15, 2).tower;
  const mortarPrice = getTowerCost(g, 'mortar'); // one tower owned: prices have grown
  placeTower(g, 'mortar', 14, 2);
  upgradeTower(g, a.id);
  sellTower(g, a.id);

  // two kills and one leak
  spawnEnemyNow(g, 'armoredGrunt');
  spawnEnemyNow(g, 'swarmling');
  nukeAll(g);
  const leaker = spawnEnemyNow(g, 'regenerator');
  leaker.distance = g.map.path.totalLength - 0.01;
  leaker.prevDistance = leaker.distance;
  stepGame(g);

  const s = g.stats;
  assert.equal(s.towersBuilt, 2);
  assert.equal(s.towersUpgraded, 1);
  assert.equal(s.towersSold, 1);
  assert.equal(s.kills, 2);
  assert.equal(s.leaks, 1);
  assert.equal(s.livesLost, ENEMIES.regenerator.leakDamage);
  assert.equal(s.enemiesSpawned, 3);
  assert.equal(s.wavesCleared, 0);

  const sum = (reason, sign = 1) => gold.filter(([, p]) => p.reason === reason).reduce((t, [, p]) => t + sign * p.delta, 0);
  assert.equal(s.goldFromKills, sum('kill'));
  assert.equal(s.goldFromKills, ENEMIES.armoredGrunt.reward + ENEMIES.swarmling.reward);
  assert.equal(s.goldSpent, sum('build', -1) + sum('upgrade', -1));
  assert.equal(s.goldSpent, lancePrice + mortarPrice + TOWERS.lance.upgrades[0].cost);
  assert.ok(mortarPrice > TOWERS.mortar.cost);
  assert.equal(s.goldRefunded, sum('sell'));
  assert.equal(s.goldRefunded, Math.floor((lancePrice + TOWERS.lance.upgrades[0].cost) * config.economy.sellRefundFraction));
  assert.equal(s.goldFromBonus, 0);
});

test('wave clear bonus and wavesCleared are counted', () => {
  const g = createGame({ seed: 1, debugSpawnEveryTicks: 0 });
  startNextWave(g);
  for (let i = 0; i < 5000 && g.waves.phase === 'running'; i++) { stepGame(g); nukeAll(g); }
  assert.equal(g.stats.wavesCleared, 1);
  assert.equal(g.stats.goldFromBonus, config.economy.waveClearBonusBase + config.economy.waveClearBonusPerWave); // wave 1
  assert.equal(g.stats.kills, g.stats.enemiesSpawned);
});
