import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, snapshotGame } from '../src/sim/game.js';
import { nukeAll } from '../src/sim/enemies.js';
import { startNextWave, endGame } from '../src/sim/waveRunner.js';
import { getWavePreview } from '../src/sim/waves.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { STATIC_WAVES, hpMultiplierForWave, STATIC_THREAT } from '../src/data/waves.js';
import { config } from '../src/data/config.js';
import { record } from './helpers.js';

const E = EVENT_TYPES;
const make = (opts = {}) => createGame({ seed: 1, debugSpawnEveryTicks: 0, ...opts });

function clearWave(game, limit = 300000) {
  for (let i = 0; i < limit && game.waves.phase === 'running'; i++) { stepGame(game); nukeAll(game); }
}

test('totalWaves accepts 15 and 30, rejects everything else, defaults to 30', () => {
  assert.equal(make({ totalWaves: 15 }).totalWaves, 15);
  assert.equal(make({ totalWaves: 30 }).totalWaves, 30);
  assert.equal(make().totalWaves, config.game.totalWaves);
  for (const bad of [0, 20, 15.5, '15', NaN, null, 31, -15]) assert.throws(() => make({ totalWaves: bad }), RangeError, String(bad));
});

test('a 15-wave game is won exactly when wave 15 is cleared', () => {
  const g = make({ totalWaves: 15 });
  const started = record(g, E.WAVE_STARTED);
  const over = record(g, E.GAME_OVER);
  for (let w = 1; w <= 15; w++) {
    assert.equal(g.over, false, `still running before wave ${w}`);
    assert.equal(startNextWave(g).ok, true);
    clearWave(g);
    if (w < 15) {
      assert.equal(g.waves.phase, 'intermission');
    }
  }
  assert.equal(over.length, 1);
  assert.equal(over[0][1].result, 'won');
  assert.equal(g.waves.phase, 'won');
  assert.equal(g.stats.wavesCleared, 15);
  assert.ok(started.every(([, p]) => p.total === 15));
  assert.equal(started.length, 15);
  assert.deepEqual(startNextWave(g), { ok: false, reason: 'game_over' });
});

test('startWave beyond totalWaves throws; a 30-wave game is unchanged', () => {
  assert.throws(() => make({ totalWaves: 15, startWave: 16 }), RangeError);
  assert.doesNotThrow(() => make({ totalWaves: 15, startWave: 15 }));
  const g = make({ startWave: 30 });
  const over = record(g, E.GAME_OVER);
  startNextWave(g);
  clearWave(g);
  assert.equal(over[0][1].result, 'won');
  assert.equal(record(make(), E.WAVE_STARTED).length, 0);
});

test('waveLog has one complete entry per cleared wave with correct fields', () => {
  const g = make({ totalWaves: 15 });
  for (let w = 1; w <= 4; w++) { startNextWave(g); clearWave(g); while (g.waves.phase === 'intermission') { startNextWave(g); break; } if (g.waves.phase === 'running') clearWave(g); }
  assert.ok(g.waveLog.length >= 4);
  g.waveLog.forEach((e, i) => {
    const wave = i + 1;
    assert.equal(e.wave, wave);
    assert.equal(e.complete, true);
    assert.equal(e.name, STATIC_WAVES[i].name);
    assert.equal(e.fixed, STATIC_WAVES[i].fixed);
    assert.equal(e.clearBonus, config.economy.waveClearBonusBase + config.economy.waveClearBonusPerWave * wave);
    assert.equal(e.hpMult, hpMultiplierForWave(wave));
    assert.equal(e.threat, STATIC_THREAT[i]);
    assert.equal(e.leaks, 0);
    assert.equal(e.livesLost, 0);
    assert.equal(e.livesAfter, 20);
    assert.ok(e.kills > 0 && e.seconds > 0);
  });
});

test('defeat appends exactly one partial entry for the wave in progress; endGame twice adds nothing; victory adds no partial', () => {
  const g = make({ startLives: 3 });
  startNextWave(g);
  for (let i = 0; i < 200000 && !g.over; i++) stepGame(g);
  assert.equal(g.result, 'lost');
  assert.equal(g.waveLog.length, 1);
  const e = g.waveLog[0];
  assert.deepEqual([e.wave, e.complete, e.clearBonus, e.livesAfter], [1, false, 0, 0]);
  assert.equal(e.livesLost, 3);
  endGame(g, 'lost');
  endGame(g, 'won');
  assert.equal(g.waveLog.length, 1);

  const won = make({ totalWaves: 15, startWave: 15 });
  startNextWave(won);
  clearWave(won);
  assert.equal(won.result, 'won');
  assert.equal(won.waveLog.length, 1);
  assert.equal(won.waveLog[0].complete, true);
});

test('a loss during an intermission adds no partial entry', () => {
  const g = make();
  startNextWave(g);
  clearWave(g);
  assert.equal(g.waves.phase, 'intermission');
  const before = g.waveLog.length;
  endGame(g, 'lost');
  assert.equal(g.waveLog.length, before);
});

test('snapshot round trip with waveLog, totalWaves and maxLives; maxLives follows startLives', () => {
  const g = make({ totalWaves: 15, startLives: 7 });
  assert.equal(g.maxLives, 7);
  assert.equal(make().maxLives, config.game.startLives);
  startNextWave(g);
  clearWave(g);
  const snap = snapshotGame(g);
  assert.equal(snap.totalWaves, 15);
  assert.equal(snap.maxLives, 7);
  assert.equal(snap.waveLog.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(snap)), snap);
});

test('getWavePreview: phases, ordering, units and agreement with WAVE_STARTED', () => {
  const g = make({ totalWaves: 15 });
  let p = getWavePreview(g);
  assert.equal(p.wave, 1);
  assert.deepEqual(p.items.map((i) => i.type), ['armoredGrunt']);
  assert.equal(p.isFinal, false);
  const started = record(g, E.WAVE_STARTED);
  startNextWave(g);
  assert.equal(getWavePreview(g), null); // running
  assert.deepEqual(Object.fromEntries(p.items.map((i) => [i.type, i.units])), started[0][1].composition);
  clearWave(g);
  p = getWavePreview(g); // intermission: the next wave
  assert.equal(p.wave, 2);

  const mixed = make({ startWave: 8 });
  const m = getWavePreview(mixed);
  assert.equal(m.name, 'Iron Skin');
  const order = m.items.map((i) => ENEMY_ORDER.indexOf(i.type));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal(m.items.reduce((s, i) => s + i.units * ENEMIES[i.type].threatCost, 0), m.threat);
  for (const i of m.items) assert.equal(i.units, i.picks * ENEMIES[i.type].packSize);
  const ws = record(mixed, E.WAVE_STARTED);
  startNextWave(mixed);
  assert.deepEqual(Object.fromEntries(m.items.map((i) => [i.type, i.units])), ws[0][1].composition);
  assert.equal(m.hpMult, ws[0][1].hpMult);
});

const g0 = () => make({ totalWaves: 15 });

test('getWavePreview: isFinal on the last wave of a 15-wave game, null when over, and Director modes give a preview with the decision info', () => {
  const g = make({ totalWaves: 15, startWave: 15 });
  assert.equal(getWavePreview(g).isFinal, true);
  endGame(g, 'lost');
  assert.equal(getWavePreview(g), null);
  // approved reversal (Phase 6): adaptive no longer throws; the preview carries the Director info
  const adaptive = make({ mode: 'adaptive', totalWaves: 15 });
  assert.deepEqual(getWavePreview(adaptive).director, { eligible: false, reason: 'static-early' });
  assert.equal(getWavePreview(g0()).director, null);
});

test('no more waves after the total: preview is null', () => {
  const g = make({ totalWaves: 15 });
  g.waves.nextWave = 16;
  assert.equal(getWavePreview(g), null);
});
