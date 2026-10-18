import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, snapshotGame } from '../src/sim/game.js';
import { nukeAll, spawnEnemyNow } from '../src/sim/enemies.js';
import { placeTower, upgradeTower, sellTower } from '../src/sim/towers.js';
import {
  startNextWave, canStartWave, enemiesRemaining, getWaveCountdownSeconds, isGameOver, endGame,
} from '../src/sim/waveRunner.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { ENEMIES } from '../src/data/enemies.js';
import { BUDGETS, STATIC_THREAT, STATIC_WAVES, TOTAL_WAVES } from '../src/data/waves.js';
import { config } from '../src/data/config.js';
import { record } from './helpers.js';

const E = EVENT_TYPES;
const make = (opts = {}) => createGame({ seed: 1, debugSpawnEveryTicks: 0, ...opts });
const INTERMISSION_TICKS = Math.round(config.waves.intermissionSeconds / config.sim.stepSeconds);

/** Step while killing everything that spawns, until the wave is no longer running. */
function clearWave(game, limit = 200000) {
  for (let i = 0; i < limit && game.waves.phase === 'running'; i++) {
    stepGame(game);
    nukeAll(game);
  }
}

test('initial state is prep with nextWave 1 and no enemies', () => {
  const g = make();
  assert.equal(g.waves.phase, 'prep');
  assert.deepEqual([g.waves.nextWave, g.waves.current, g.enemies.length, g.spawnQueue.length], [1, 0, 0, 0]);
  assert.deepEqual([g.over, g.result, isGameOver(g)], [false, null, false]);
  assert.deepEqual(canStartWave(g), { ok: true });
  for (let i = 0; i < 600; i++) stepGame(g);
  assert.equal(g.waves.phase, 'prep'); // autoStartFirst is false
  assert.equal(g.enemies.length, 0);
});

test('startNextWave emits WAVE_STARTED with the plan details; the first spawn is on the next tick', () => {
  const g = make();
  const started = record(g, E.WAVE_STARTED);
  const spawned = record(g, E.ENEMY_SPAWNED);
  const r = startNextWave(g);
  assert.deepEqual(r, { ok: true, wave: 1 });
  const p = started[0][1];
  const plan = STATIC_WAVES[0];
  assert.deepEqual([p.wave, p.total, p.name, p.fixed, p.mode, p.budget, p.threat, p.tick], [1, TOTAL_WAVES, null, false, 'static', BUDGETS[0], STATIC_THREAT[0], 0]);
  assert.deepEqual(p.picks, { armoredGrunt: plan.groups[0].picks });
  assert.deepEqual(p.composition, { armoredGrunt: plan.groups[0].picks });
  assert.equal(g.waves.phase, 'running');
  assert.equal(spawned.length, 0);
  stepGame(g);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0][1].tick, 1);
  assert.deepEqual(startNextWave(g), { ok: false, reason: 'wave_in_progress' });
});

test('the whole wave spawns exactly the planned enemies (counts by type)', () => {
  for (const wave of [5, 8, 12]) {
    const g = make({ startWave: wave });
    const counts = {};
    g.events.on(E.ENEMY_SPAWNED, (ev) => { counts[ev.type] = (counts[ev.type] ?? 0) + 1; });
    const started = record(g, E.WAVE_STARTED);
    startNextWave(g);
    clearWave(g);
    const expected = {};
    for (const grp of STATIC_WAVES[wave - 1].groups) expected[grp.type] = grp.picks * ENEMIES[grp.type].packSize;
    assert.deepEqual(counts, expected, `wave ${wave}`);
    assert.deepEqual(started[0][1].composition, expected);
    assert.equal(g.waves.phase, 'intermission');
  }
});

test('WAVE_ENDED is emitted once with the wave statistics; the clear bonus is credited once', () => {
  const g = make({ startWave: 3 });
  const ended = record(g, E.WAVE_ENDED);
  const gold = record(g, E.GOLD_CHANGED);
  startNextWave(g);
  clearWave(g);
  assert.equal(ended.length, 1);
  const p = ended[0][1];
  const expectedUnits = STATIC_WAVES[2].groups.reduce((n, grp) => n + grp.picks * ENEMIES[grp.type].packSize, 0);
  assert.deepEqual([p.wave, p.kills, p.leaks, p.livesLost, p.lives], [3, expectedUnits, 0, 0, 20]);
  const bonus = config.economy.waveClearBonusBase + config.economy.waveClearBonusPerWave * 3;
  assert.equal(p.clearBonus, bonus);
  assert.equal(gold.filter(([, x]) => x.reason === 'wave_clear').length, 1);
  assert.equal(gold.find(([, x]) => x.reason === 'wave_clear')[1].delta, bonus);
  for (let i = 0; i < 100; i++) stepGame(g);
  assert.equal(ended.length, 1);
});

test('the intermission lasts exactly intermissionSeconds and the next wave then starts automatically', () => {
  const g = make();
  const ended = record(g, E.WAVE_ENDED);
  const started = record(g, E.WAVE_STARTED);
  startNextWave(g);
  clearWave(g);
  assert.equal(g.waves.phase, 'intermission');
  assert.equal(g.waves.countdownTicks, INTERMISSION_TICKS);
  assert.equal(getWaveCountdownSeconds(g), config.waves.intermissionSeconds);
  for (let i = 0; i < INTERMISSION_TICKS + 5; i++) stepGame(g);
  assert.equal(started.length, 2);
  assert.equal(started[1][1].wave, 2);
  assert.equal(started[1][1].tick - ended[0][1].tick, INTERMISSION_TICKS);
  assert.equal(g.waves.phase, 'running');
});

test('with autoStartNext off the intermission waits', () => {
  const g = make({ wavesConfig: { autoStartNext: false } });
  const started = record(g, E.WAVE_STARTED);
  startNextWave(g);
  clearWave(g);
  for (let i = 0; i < INTERMISSION_TICKS * 3; i++) stepGame(g);
  assert.equal(started.length, 1);
  assert.equal(g.waves.phase, 'intermission');
  assert.equal(g.waves.countdownTicks, 0);
});

test('starting early cancels the countdown and pays no bonus', () => {
  const g = make();
  startNextWave(g);
  clearWave(g);
  for (let i = 0; i < 100; i++) stepGame(g);
  const goldBefore = g.gold;
  assert.equal(getWaveCountdownSeconds(g) < config.waves.intermissionSeconds, true);
  const r = startNextWave(g);
  assert.deepEqual(r, { ok: true, wave: 2 });
  assert.equal(g.gold, goldBefore);
  assert.equal(g.waves.phase, 'running');
  assert.equal(g.waves.countdownTicks, 0);
  assert.equal(getWaveCountdownSeconds(g), 0);
});

test('winning: clearing wave 30 ends the game with result won', () => {
  const g = make({ startWave: 30 });
  const over = record(g, E.GAME_OVER);
  startNextWave(g);
  clearWave(g);
  assert.equal(over.length, 1);
  assert.equal(over[0][1].result, 'won');
  assert.equal(over[0][1].wave, 30);
  assert.equal(over[0][1].stats.wavesCleared, 1);
  assert.equal(g.waves.phase, 'won');
  assert.equal(g.result, 'won');
  assert.deepEqual(startNextWave(g), { ok: false, reason: 'game_over' });
});

test('losing: phase lost, one GAME_OVER, and the world freezes', () => {
  const g = make({ startLives: 3 });
  const over = record(g, E.GAME_OVER);
  startNextWave(g);
  for (let i = 0; i < 200000 && !g.over; i++) stepGame(g);
  assert.equal(g.waves.phase, 'lost');
  assert.equal(g.result, 'lost');
  assert.equal(over.length, 1);
  for (const e of g.enemies) assert.equal(e.prevDistance, e.distance); // interpolation frozen
  const before = JSON.stringify(snapshotGame(g));
  const goldBefore = g.gold;
  for (let i = 0; i < 300; i++) stepGame(g);
  assert.equal(JSON.stringify(snapshotGame(g)), before);
  assert.equal(g.gold, goldBefore);
  endGame(g, 'won'); // idempotent
  assert.equal(over.length, 1);
  assert.equal(g.result, 'lost');
});

test('after game over every command returns game_over with no state change', () => {
  const g = make({ startGold: 5000 });
  const t = placeTower(g, 'lance', 15, 2).tower;
  endGame(g, 'lost');
  const before = JSON.stringify(snapshotGame(g));
  assert.deepEqual(placeTower(g, 'lance', 14, 2), { ok: false, reason: 'game_over' });
  assert.deepEqual(upgradeTower(g, t.id), { ok: false, reason: 'game_over' });
  assert.deepEqual(sellTower(g, t.id), { ok: false, refund: 0, reason: 'game_over' });
  assert.deepEqual(startNextWave(g), { ok: false, reason: 'game_over' });
  assert.equal(JSON.stringify(snapshotGame(g)), before);
});

test('freezeInterpolation also settles projectiles', () => {
  const g = make({ startGold: 5000 });
  const t = placeTower(g, 'lance', 1, 0).tower; // next to the spawn point
  spawnEnemyNow(g, 'armoredGrunt');
  for (let i = 0; i < 400 && g.projectiles.length === 0; i++) stepGame(g);
  assert.ok(g.projectiles.length > 0);
  assert.ok(t.shots > 0);
  endGame(g, 'won');
  for (const p of g.projectiles) assert.deepEqual([p.prevX, p.prevY], [p.x, p.y]);
});

test('getWaveCountdownSeconds and enemiesRemaining', () => {
  const g = make();
  assert.equal(enemiesRemaining(g), 0);
  assert.equal(getWaveCountdownSeconds(g), 0);
  startNextWave(g);
  assert.equal(enemiesRemaining(g), STATIC_WAVES[0].groups[0].picks);
  stepGame(g);
  assert.equal(enemiesRemaining(g), STATIC_WAVES[0].groups[0].picks); // one alive, the rest queued
});

test('modes and startWave are validated', () => {
  assert.throws(() => make({ mode: 'adaptive' }), /Phase 6/);
  assert.throws(() => make({ mode: 'chaos' }), RangeError);
  const g = make({ startWave: 12 });
  assert.deepEqual([g.waves.nextWave, g.waves.current, g.stats.wavesCleared], [12, 11, 0]);
  for (const bad of [0, 31, 2.5, '5']) assert.throws(() => make({ startWave: bad }), RangeError);
  const first = startNextWave(g);
  assert.equal(first.wave, 12);
});

test('no more waves after 30', () => {
  const g = make({ startWave: 30 });
  g.waves.nextWave = 31;
  assert.deepEqual(canStartWave(g), { ok: false, reason: 'no_more_waves' });
});
