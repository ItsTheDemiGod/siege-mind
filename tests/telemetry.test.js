import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { TOWERS, TOWER_ORDER } from '../src/data/towers.js';
import { hpMultiplierForWave } from '../src/data/waves.js';
import { createGame, stepGame, snapshotGame, startGame } from '../src/sim/game.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { spawnEnemyNow } from '../src/sim/enemies.js';
import { upgradeTower, sellTower, getTowerStats } from '../src/sim/towers.js';
import { applyDamage } from '../src/sim/damage.js';
import { applyStatus, updateStatuses } from '../src/sim/statuses.js';
import { startNextWave } from '../src/sim/waveRunner.js';
import { attachTelemetry } from '../src/sim/telemetry.js';
import { SOURCE_IDS, roundTo, validateRun } from '../src/sim/telemetrySchema.js';
import { getBot } from '../experiments/bots.js';
import { rig, place, dummy, manualTick, record } from './helpers.js';

const D = config.telemetry.floatDigits;
const r6 = (x) => roundTo(x, D);
const direct = (amount, source, towerId) => ({ amount, kind: 'direct', armorPierce: true, ...(source ? { source } : {}), ...(towerId === undefined ? {} : { towerId }) });
const dealt = (r) => r.shieldDamage + r.hpDamage;

/** A game with wave 1 open and its queue emptied so tests control every enemy. */
function openWave(opts = {}) {
  const game = rig(opts);
  const tele = attachTelemetry(game);
  startNextWave(game);
  game.spawnQueue.length = 0;
  return { game, tele };
}

test('per-type counts, damage by source and kills by source match a hand computation for all five types', () => {
  const { game, tele } = openWave();
  const lance = place(game, 'lance');
  const sniper = place(game, 'sniper', 14, 2);
  const expected = {};
  for (const type of ENEMY_ORDER) {
    const e = spawnEnemyNow(game, type);
    const hit = dealt(applyDamage(game, e, direct(20, 'lance', lance.id)));
    const kill = dealt(applyDamage(game, e, direct(1e6, 'sniper', sniper.id)));
    expected[type] = { lance: hit, sniper: kill };
  }
  const run = tele.getRun();
  const wave = run.waves[0];
  for (const type of ENEMY_ORDER) {
    const t = wave.byType[type];
    assert.deepEqual([t.spawned, t.killed, t.leaked], [1, 1, 0]);
    assert.equal(t.damageBySource.lance, r6(expected[type].lance));
    assert.equal(t.damageBySource.sniper, r6(expected[type].sniper));
    assert.equal(t.killedBySource.sniper, 1);
    assert.equal(t.killedBySource.lance, 0);
    assert.equal(t.damageTaken, r6(expected[type].lance + expected[type].sniper));
  }
  assert.equal(wave.spawnedUnits, ENEMY_ORDER.length);
  assert.equal(run.totals.killed, ENEMY_ORDER.length);
});

test('damage attribution: tower sources, towerId, debug and unknown sources', () => {
  const { game, tele } = openWave();
  const lance = place(game, 'lance');
  const e = spawnEnemyNow(game, 'regenerator');
  const a = dealt(applyDamage(game, e, direct(10, 'lance', lance.id)));
  const b = dealt(applyDamage(game, e, direct(7))); // no source: debug
  const c = dealt(applyDamage(game, e, direct(5, 'laser'))); // unknown source: other
  const run = tele.getRun();
  const s = run.waves[0].byType.regenerator.damageBySource;
  assert.equal(s.lance, r6(a));
  assert.equal(s.debug, r6(b));
  assert.equal(s.other, r6(c));
  assert.equal(run.towers[0].damageDealt, r6(a));
  assert.equal(run.towers[0].damageByEnemyType.regenerator, r6(a));
  assert.equal(run.enemies[0].killer, null);
  assert.deepEqual(Object.keys(run.enemies[0].damageBySource), [...SOURCE_IDS]);
  assert.equal(run.enemies[0].outcome, 'alive');
});

test('a poison damage-over-time kill is attributed to poison and to the poisoning tower', () => {
  const { game, tele } = openWave();
  const poison = place(game, 'poison');
  const e = spawnEnemyNow(game, 'fastRunner');
  applyStatus(game, e, { type: 'poison', dps: 1e6, duration: 5, source: 'poison', towerId: poison.id });
  updateStatuses(game, e, 1);
  const run = tele.getRun();
  const t = run.waves[0].byType.fastRunner;
  assert.equal(t.killed, 1);
  assert.equal(t.killedBySource.poison, 1);
  assert.ok(t.damageBySource.poison > 0);
  assert.equal(run.towers[0].kills, 1);
  assert.equal(run.towers[0].killsByEnemyType.fastRunner, 1);
  assert.deepEqual(run.enemies[0].killer, { source: 'poison', towerId: poison.id });
});

test('a leak records progress 1, time alive, a leaked enemy record and lost lives', () => {
  const { game, tele } = openWave();
  const e = spawnEnemyNow(game, 'swarmling');
  e.distance = game.map.path.totalLength - 0.01;
  e.prevDistance = e.distance;
  stepGame(game);
  const run = tele.getRun();
  const t = run.waves[0].byType.swarmling;
  assert.deepEqual([t.spawned, t.killed, t.leaked], [1, 0, 1]);
  assert.equal(t.leakRate, 1);
  assert.equal(t.meanProgress, 1);
  assert.equal(t.meanTimeAliveSeconds, r6(config.sim.stepSeconds));
  assert.equal(run.waves[0].livesLost, ENEMIES.swarmling.leakDamage);
  assert.equal(run.totals.livesLost, ENEMIES.swarmling.leakDamage);
  assert.equal(run.enemies[0].outcome, 'leaked');
  assert.equal(run.enemies[0].progress, 1);
  assert.equal(run.enemies[0].killer, null);
});

test('ordering trap: the final leak is counted even though GAME_OVER fires first, and the partial wave is built on demand', () => {
  const { game, tele } = openWave({ startLives: 1 });
  const e = spawnEnemyNow(game, 'armoredGrunt');
  e.distance = game.map.path.totalLength - 0.01;
  e.prevDistance = e.distance;
  stepGame(game);
  assert.equal(game.over, true);
  assert.equal(game.result, 'lost');
  const run = tele.getRun();
  assert.equal(run.totals.leaked, game.stats.leaks);
  assert.equal(run.totals.leaked, 1);
  assert.equal(run.waves[0].complete, false);
  assert.equal(run.waves[0].leaked, 1);
  assert.equal(run.waves[0].endTick, game.tick);
  assert.equal(run.waves[0].livesAfter, 0);
  assert.equal(run.result.over, true);
  assert.equal(run.result.result, 'lost');
  assert.deepEqual(tele.getRun(), run);
  assert.deepEqual(validateRun(run), []);
});

test('events after GAME_OVER on the same tick still reach the collector', () => {
  const { game, tele } = openWave({ startLives: 1 });
  const a = spawnEnemyNow(game, 'armoredGrunt');
  const b = spawnEnemyNow(game, 'armoredGrunt');
  for (const e of [a, b]) { e.distance = game.map.path.totalLength - 0.01; e.prevDistance = e.distance; }
  stepGame(game);
  assert.equal(game.stats.leaks, 2);
  assert.equal(tele.getRun().totals.leaked, 2);
});

test('debug spawns outside a wave go to offWave and never into waves; totals still reconcile', () => {
  const game = rig();
  const tele = attachTelemetry(game);
  const e = spawnEnemyNow(game, 'fastRunner'); // wave 0: prep
  applyDamage(game, e, direct(1e6, 'sniper'));
  const run = tele.getRun();
  assert.equal(run.waves.length, 0);
  assert.equal(run.offWave.byType.fastRunner.spawned, 1);
  assert.equal(run.offWave.byType.fastRunner.killed, 1);
  assert.equal(run.enemies[0].wave, 0);
  assert.equal(run.totals.spawned, 1);
  assert.deepEqual(validateRun(run), []);
});

test('gold buckets: prep, during and totals by reason', () => {
  const game = rig({ startGold: 1000 });
  const tele = attachTelemetry(game);
  const deltas = { build: 0, upgrade: 0, sell: 0, kill: 0, wave_clear: 0 };
  game.events.on(EVENT_TYPES.GOLD_CHANGED, (ev) => { deltas[ev.reason] += ev.delta; });
  const prepTower = place(game, 'lance');
  const prepPrice = prepTower.invested;
  const sold = sellTower(game, prepTower.id);
  startNextWave(game);
  game.spawnQueue.length = 0;
  const goldAtStart = game.gold;
  const during = place(game, 'frost');
  const e = spawnEnemyNow(game, 'swarmling');
  applyDamage(game, e, direct(1e6, 'frost', during.id));
  const refund = sellTower(game, during.id).refund;
  stepGame(game); // nothing alive and nothing queued: the wave ends and pays the bonus
  const run = tele.getRun();
  const g = run.waves[0].gold;
  assert.equal(g.prepSpent, prepPrice);
  assert.equal(g.prepRefunded, sold.refund);
  assert.equal(g.atStart, goldAtStart);
  assert.equal(g.spentDuring, TOWERS.frost.cost);
  assert.equal(g.earnedKills, ENEMIES.swarmling.reward);
  assert.equal(g.refundedDuring, refund);
  assert.equal(g.clearBonus, config.economy.waveClearBonusBase + config.economy.waveClearBonusPerWave * 1);
  assert.equal(g.atEnd, game.gold);
  assert.equal(run.waves[0].complete, true);
  assert.equal(run.totals.gold.spent, -(deltas.build + deltas.upgrade));
  assert.equal(run.totals.gold.refunded, deltas.sell);
  assert.equal(run.totals.gold.earnedKills, deltas.kill);
  assert.equal(run.totals.gold.clearBonus, deltas.wave_clear);
});

test('tower records: place, upgrade twice, sell; the sold record keeps the final counters', () => {
  const game = rig();
  const tele = attachTelemetry(game);
  const t = place(game, 'lance');
  upgradeTower(game, t.id);
  upgradeTower(game, t.id);
  const e = dummy(game, 'armoredGrunt', t.x + 20, t.y, { distance: 100 });
  e.hp = e.maxHp = 1e6;
  for (let i = 0; i < 200; i++) manualTick(game);
  const before = { damageDealt: t.damageDealt, kills: t.kills, shots: t.shots, invested: t.invested };
  assert.ok(before.shots > 0 && before.damageDealt > 0);
  const { refund } = sellTower(game, t.id);
  const rec = tele.getRun().towers[0];
  assert.equal(rec.sold, true);
  assert.equal(rec.refund, refund);
  assert.equal(rec.refund, Math.floor(before.invested * config.economy.sellRefundFraction));
  assert.equal(rec.damageDealt, r6(before.damageDealt));
  assert.equal(rec.kills, before.kills);
  assert.equal(rec.shots, before.shots);
  assert.equal(rec.invested, before.invested);
  assert.equal(rec.finalLevel, 2);
  assert.deepEqual(rec.upgrades.map((u) => [u.level, u.cost]), TOWERS.lance.upgrades.map((u, i) => [i + 1, u.cost]));
  assert.equal(rec.builtPhase, 'prep');
  assert.equal(rec.soldWave, game.waves.current);
});

test('the loadout snapshot at wave start matches the towers', () => {
  const game = rig();
  const tele = attachTelemetry(game);
  const a = place(game, 'lance');
  place(game, 'mortar', 14, 2);
  place(game, 'mortar', 13, 2);
  upgradeTower(game, a.id);
  startNextWave(game);
  const l = tele.getRun().waves[0].loadout;
  assert.equal(l.totalTowers, game.towers.length);
  assert.equal(l.totalInvested, game.towers.reduce((n, t) => n + t.invested, 0));
  assert.equal(l.nominalDps, r6(game.towers.reduce((n, t) => n + getTowerStats(t.type, t.level).dps, 0)));
  assert.deepEqual(Object.keys(l.byType), [...TOWER_ORDER]);
  assert.deepEqual(l.byType.lance, { count: 1, levels: [0, 1, 0] });
  assert.deepEqual(l.byType.mortar, { count: 2, levels: [2, 0, 0] });
  assert.deepEqual(l.byType.sniper, { count: 0, levels: [0, 0, 0] });
});

test('late attachment records attachedAtTick and ignores events about unknown entities', () => {
  const game = rig();
  const tower = place(game, 'lance');
  const e = spawnEnemyNow(game, 'armoredGrunt');
  for (let i = 0; i < 5; i++) stepGame(game);
  const tele = attachTelemetry(game);
  assert.doesNotThrow(() => {
    applyDamage(game, e, direct(5, 'lance', tower.id));
    upgradeTower(game, tower.id);
    sellTower(game, tower.id);
    applyDamage(game, e, direct(1e6, 'sniper'));
  });
  const run = tele.getRun();
  assert.equal(run.meta.attachedAtTick, 5);
  assert.ok(run.meta.ignoredEvents >= 3);
  assert.equal(tele.counts().ignoredEvents, run.meta.ignoredEvents);
  assert.equal(run.towers.length, 0);
});

test('maxEnemyRecords caps the enemy list but not the aggregates', () => {
  const game = rig();
  const tele = attachTelemetry(game, { maxEnemyRecords: 2 });
  for (let i = 0; i < 5; i++) applyDamage(game, spawnEnemyNow(game, 'swarmling'), direct(1e6, 'lance'));
  const run = tele.getRun();
  assert.equal(run.enemies.length, 2);
  assert.equal(run.meta.enemyRecordsDropped, 3);
  assert.equal(run.offWave.byType.swarmling.killed, 5);
  assert.equal(tele.counts().enemyRecordsDropped, 3);
});

test("'summary' detail has no enemies and the same waves, towers, totals and offWave as 'full'", () => {
  const game = rig();
  const full = attachTelemetry(game, { detail: 'full' });
  const summary = attachTelemetry(game, { detail: 'summary' });
  startNextWave(game);
  game.spawnQueue.length = 0;
  const t = place(game, 'lance');
  applyDamage(game, spawnEnemyNow(game, 'armoredGrunt'), direct(1e6, 'lance', t.id));
  const f = full.getRun();
  const s = summary.getRun();
  assert.equal('enemies' in s, false);
  assert.equal(s.meta.detail, 'summary');
  for (const k of ['waves', 'towers', 'totals', 'offWave', 'result', 'config', 'definitions']) assert.deepEqual(s[k], f[k], k);
  assert.deepEqual(validateRun(s), []);
});

test('attachDirector stores an independent deep copy and rejects bad input', () => {
  const { game, tele } = openWave();
  const record = { weights: { grunt: 0.2 }, reason: 'x', list: [1, 2] };
  tele.attachDirector(1, record);
  record.weights.grunt = 9;
  record.list.push(3);
  const run = tele.getRun();
  assert.deepEqual(run.waves[0].director, { weights: { grunt: 0.2 }, reason: 'x', list: [1, 2] });
  run.waves[0].director.weights.grunt = 5;
  assert.equal(tele.getRun().waves[0].director.weights.grunt, 0.2);
  assert.throws(() => tele.attachDirector(1, new Map()), TypeError);
  assert.throws(() => tele.attachDirector(1, { f: () => 1 }), TypeError);
  assert.throws(() => tele.attachDirector(1, { n: NaN }), TypeError);
  assert.throws(() => tele.attachDirector(7, { a: 1 }), RangeError);
  assert.equal(game.over, false);
});

test('attach validates its options', () => {
  const game = rig();
  assert.throws(() => attachTelemetry(game, { detail: 'verbose' }), RangeError);
  assert.throws(() => attachTelemetry(game, { meta: { nested: { a: 1 } } }), TypeError);
  assert.throws(() => attachTelemetry(game, { meta: { seed: 5 } }), RangeError);
  const run = attachTelemetry(game, { meta: { app: 'x', n: 2, ok: true } }).getRun();
  assert.deepEqual([run.meta.app, run.meta.n, run.meta.ok], ['x', 2, true]);
});

test('dispose restores the listener counts, keeps getRun working and is idempotent', () => {
  const game = rig();
  const types = Object.values(EVENT_TYPES);
  const before = Object.fromEntries(types.map((t) => [t, game.events.listenerCount(t)]));
  const tele = attachTelemetry(game);
  assert.ok(types.some((t) => game.events.listenerCount(t) > before[t]));
  applyDamage(game, spawnEnemyNow(game, 'swarmling'), direct(1e6, 'lance'));
  tele.dispose();
  tele.dispose();
  for (const t of types) assert.equal(game.events.listenerCount(t), before[t], t);
  applyDamage(game, spawnEnemyNow(game, 'swarmling'), direct(1e6, 'lance'));
  assert.equal(tele.getRun().offWave.byType.swarmling.killed, 1);
});

test('handlers copy primitives: mutating an emitted payload afterwards changes nothing', () => {
  const game = rig();
  const tele = attachTelemetry(game);
  const e = spawnEnemyNow(game, 'regenerator');
  const payload = { id: e.id, type: e.type, amount: 5, shieldDamage: 0, hpDamage: 5, kind: 'direct', source: 'lance', towerId: -1 };
  game.events.emit(EVENT_TYPES.ENEMY_DAMAGED, payload);
  payload.amount = 999;
  payload.source = 'debug';
  const run = tele.getRun();
  assert.equal(run.enemies[0].damageBySource.lance, 5);
  assert.equal(run.enemies[0].damageBySource.debug, 0);
});

test('events about unknown ids never throw', () => {
  const game = rig();
  const tele = attachTelemetry(game);
  const emit = (t, p) => game.events.emit(t, p);
  assert.doesNotThrow(() => {
    emit(EVENT_TYPES.ENEMY_DAMAGED, { id: 99, type: 'swarmling', amount: 1, source: 'lance', towerId: 5 });
    emit(EVENT_TYPES.ENEMY_KILLED, { id: 99, type: 'swarmling', progress: 0.5, tick: 1, source: 'lance', towerId: 5, reward: 1 });
    emit(EVENT_TYPES.ENEMY_LEAKED, { id: 99, type: 'swarmling', tick: 1, leakDamage: 0 });
    emit(EVENT_TYPES.TOWER_FIRED, { towerId: 42, type: 'lance' });
    emit(EVENT_TYPES.TOWER_UPGRADED, { id: 42, level: 1, tick: 1, cost: 1 });
    emit(EVENT_TYPES.TOWER_SOLD, { id: 42, refund: 1, tick: 1 });
    emit(EVENT_TYPES.PROJECTILE_IMPACT, { type: 'nothing', hit: true });
  });
  assert.equal(tele.counts().ignoredEvents, 7);
});

// ---------- integration over a full game ----------
const ACT_EVERY_TICKS = 120;
function runGame({ telemetry, seed = 1, totalWaves = 15, checkpoints = [] }) {
  const game = createGame({ seed, debugSpawnEveryTicks: 0, totalWaves });
  const tele = telemetry ? attachTelemetry(game, { detail: telemetry }) : null;
  startGame(game);
  const bot = getBot('balanced');
  const snaps = [];
  while (!game.over && game.tick < 600000) {
    const phase = game.waves.phase;
    if (phase === 'prep' || phase === 'intermission' || game.tick % ACT_EVERY_TICKS === 0) bot.act(game);
    stepGame(game);
    if (checkpoints.includes(game.tick)) snaps.push(snapshotGame(game));
  }
  snaps.push(snapshotGame(game));
  return { game, tele, snaps };
}

test('observation only: a full game with telemetry attached is identical, tick by tick, to one without', () => {
  const checkpoints = [1000, 15000, 30000, 45000, 60000];
  const a = runGame({ telemetry: false, checkpoints });
  const b = runGame({ telemetry: 'full', checkpoints });
  assert.equal(a.snaps.length, checkpoints.length + 1);
  a.snaps.forEach((s, i) => assert.deepEqual(b.snaps[i], s, `snapshot ${i}`));
  assert.equal(a.game.result, b.game.result);
});

test('determinism: the same seed and bot give byte-identical JSON', () => {
  const a = JSON.stringify(runGame({ telemetry: 'full' }).tele.getRun());
  const b = JSON.stringify(runGame({ telemetry: 'full' }).tele.getRun());
  assert.equal(a, b);
});

test('a full 15-wave run reconciles with the sim statistics and wave log', () => {
  const { game, tele } = runGame({ telemetry: 'full' });
  const run = tele.getRun();
  assert.deepEqual(validateRun(run), []);
  const s = game.stats;
  assert.equal(run.totals.killed, s.kills);
  assert.equal(run.totals.leaked, s.leaks);
  assert.equal(run.totals.livesLost, s.livesLost);
  assert.equal(run.totals.spawned, s.enemiesSpawned);
  assert.deepEqual(run.totals.gold, { earnedKills: s.goldFromKills, clearBonus: s.goldFromBonus, spent: s.goldSpent, refunded: s.goldRefunded });
  assert.equal(run.waves.length, game.waveLog.length);
  game.waveLog.forEach((entry, i) => {
    const w = run.waves[i];
    assert.deepEqual([w.wave, w.killed, w.leaked, w.livesLost, w.gold.clearBonus], [entry.wave, entry.kills, entry.leaks, entry.livesLost, entry.clearBonus]);
    assert.equal(w.hpMult, r6(entry.hpMult));
    assert.equal(w.hpMult, r6(hpMultiplierForWave(w.wave)));
  });
  const enemyDamage = run.enemies.reduce((n, e) => n + e.damageTaken, 0);
  const towerDamage = run.towers.reduce((n, t) => n + t.damageDealt, 0);
  assert.ok(Math.abs(enemyDamage - (towerDamage + run.totals.damageBySource.debug + run.totals.damageBySource.other)) < 0.01);
  const alive = tele.counts().active;
  assert.equal(run.enemies.length, run.totals.killed + run.totals.leaked + alive);
  for (const t of game.towers) assert.equal(run.towers.find((r) => r.id === t.id).shots, t.shots);
  assert.equal(run.result.result, 'won');
});

test('the run is plain JSON: a round trip is lossless and mutating a returned run changes nothing', () => {
  const { tele } = runGame({ telemetry: 'full', totalWaves: 15, checkpoints: [] });
  const run = tele.getRun();
  assert.deepEqual(JSON.parse(JSON.stringify(run)), run);
  run.waves[0].byType.armoredGrunt.killed = -5;
  run.towers.length = 0;
  run.enemies.length = 0;
  run.config.sim.stepSeconds = 9;
  run.definitions.towers.lance.cost = 1;
  const again = tele.getRun();
  assert.notEqual(again.waves[0].byType.armoredGrunt.killed, -5);
  assert.ok(again.towers.length > 0 && again.enemies.length > 0);
  assert.equal(again.config.sim.stepSeconds, config.sim.stepSeconds);
  assert.equal(again.definitions.towers.lance.cost, TOWERS.lance.cost);
});
