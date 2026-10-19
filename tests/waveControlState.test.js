import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeWaveControl } from '../src/ui/waveControlState.js';
import { config } from '../src/data/config.js';

const d = (o = {}) => ({ enemiesRemaining: 0, countdownSeconds: 0, totalWaves: 30, nextWaveName: null, hpMultNext: 1, ...o });

test('prep: ready title, hint and start button', () => {
  const r = describeWaveControl({ phase: 'prep', nextWave: 1, current: 0 }, d());
  assert.deepEqual(r, { mode: 'prep', title: 'Wave 1 ready', subtitle: 'Place towers, then start (Enter)', buttonLabel: 'Start Wave 1', canStart: true, progress: null });
});

test('running: progress text with singular and plural, no button', () => {
  const run = (n) => describeWaveControl({ phase: 'running', nextWave: 6, current: 5 }, d({ enemiesRemaining: n }));
  assert.equal(run(12).subtitle, '12 enemies left');
  assert.equal(run(1).subtitle, '1 enemy left');
  assert.equal(run(0).subtitle, '0 enemies left');
  const r = run(3);
  assert.deepEqual([r.mode, r.title, r.buttonLabel, r.canStart, r.progress], ['running', 'Wave 5 in progress', '', false, null]);
});

test('intermission: next wave, optional name, ceil countdown, progress fraction', () => {
  const total = config.waves.intermissionSeconds;
  const secs = total - 4.8; // 4.8 s elapsed of the countdown
  const a = describeWaveControl({ phase: 'intermission', nextWave: 4, current: 3 }, d({ countdownSeconds: secs, hpMultNext: 1.84 }));
  assert.deepEqual([a.mode, a.title, a.subtitle, a.buttonLabel, a.canStart], ['intermission', 'Next: Wave 4', `Starting in ${Math.ceil(secs)}s`, 'Start now', true]);
  assert.ok(Math.abs(a.progress - (1 - secs / total)) < 1e-12);
  const named = describeWaveControl({ phase: 'intermission', nextWave: 8, current: 7 }, d({ countdownSeconds: total, nextWaveName: 'Iron Skin' }));
  assert.equal(named.title, 'Next: Wave 8 — Iron Skin');
  assert.equal(named.progress, 0);
  assert.equal(describeWaveControl({ phase: 'intermission', nextWave: 2, current: 1 }, d({ countdownSeconds: 0 })).progress, 1);
  assert.equal(describeWaveControl({ phase: 'intermission', nextWave: 2, current: 1 }, d({ countdownSeconds: 0.01 })).subtitle, 'Starting in 1s');
});

test('over: empty fields', () => {
  for (const phase of ['won', 'lost']) {
    assert.deepEqual(describeWaveControl({ phase, nextWave: 31, current: 30 }, d()), { mode: 'over', title: '', subtitle: '', buttonLabel: '', canStart: false, progress: null });
  }
});

test('the HP multiplier shows one decimal in prep and intermission', () => {
  // approved reversal (Phase 7): the HP multiplier lives in the preview chips, not in the wave control
  assert.equal(describeWaveControl({ phase: 'prep', nextWave: 9, current: 8 }, d({ hpMultNext: 2.345 })).subtitle, 'Place towers, then start (Enter)');
  assert.equal(describeWaveControl({ phase: 'intermission', nextWave: 9, current: 8 }, d({ countdownSeconds: 5, hpMultNext: 7.04 })).subtitle, 'Starting in 5s');
  assert.ok(!describeWaveControl({ phase: 'running', nextWave: 9, current: 8 }, d({ hpMultNext: 3 })).subtitle.includes('HP'));
});
