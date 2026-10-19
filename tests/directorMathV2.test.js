import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { BASELINE_REWARD, BASELINE_FALLBACK } from '../src/data/directorBaseline.js';
import { baselineValue, shrinkFactor, computeObservationV2, forUpdate, validateDirectorV2Config, validateCounterConfig } from '../src/sim/directorMathV2.js';

const cfg = config.directorV2;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const zero = () => Object.fromEntries(ENEMY_ORDER.map((t) => [t, { units: 0, leaked: 0, progressSum: 0 }]));

test('baselineValue: table hit, null falls back, floor applied, waves above 15 use wave 15, unknown type throws', () => {
  assert.equal(baselineValue('armoredGrunt', 5, cfg), BASELINE_REWARD.armoredGrunt[4]);
  assert.equal(BASELINE_REWARD.swarmling[0], null);
  assert.equal(baselineValue('swarmling', 1, cfg), BASELINE_FALLBACK.swarmling);
  assert.equal(baselineValue('shieldedBruiser', 3, cfg), BASELINE_FALLBACK.shieldedBruiser);
  const raw15 = BASELINE_REWARD.armoredGrunt[14];
  assert.equal(baselineValue('armoredGrunt', 15, cfg), raw15);
  assert.equal(baselineValue('armoredGrunt', 22, cfg), raw15);
  assert.equal(baselineValue('armoredGrunt', 30, cfg), raw15);
  // a floor of 1 x fallback lifts any entry below the fallback up to it, and leaves higher entries alone
  assert.equal(baselineValue('armoredGrunt', 15, { baselineFloorFraction: 1 }), BASELINE_FALLBACK.armoredGrunt);
  assert.equal(baselineValue('armoredGrunt', 1, { baselineFloorFraction: 1 }), BASELINE_REWARD.armoredGrunt[0]);
  for (const t of ENEMY_ORDER) for (let w = 1; w <= 30; w++) assert.ok(baselineValue(t, w, cfg) >= cfg.baselineFloorFraction * BASELINE_FALLBACK[t]);
  assert.throws(() => baselineValue('dragon', 5, cfg), RangeError);
  assert.throws(() => baselineValue('armoredGrunt', 0, cfg), RangeError);
  assert.throws(() => baselineValue('armoredGrunt', 1.5, cfg), RangeError);
});

test('shrinkFactor: 0 for no units, 1 when k is 0, monotone in units, units / (units + k)', () => {
  assert.equal(shrinkFactor(0, 4), 0);
  assert.equal(shrinkFactor(0, 0), 0);
  assert.equal(shrinkFactor(7, 0), 1);
  near(shrinkFactor(2, 4), 1 / 3);
  let prev = 0;
  for (let u = 1; u <= 50; u++) { const f = shrinkFactor(u, 4); assert.ok(f > prev && f < 1); prev = f; }
});

test('computeObservationV2: hand-computed norm, average, advantage and shrunk advantage (2 units with k = 4 count one third)', () => {
  const stats = zero();
  stats.armoredGrunt = { units: 10, leaked: 0, progressSum: 5 }; // mean progress 0.5, threat 100
  stats.regenerator = { units: 2, leaked: 1, progressSum: 2 }; // mean progress 1, threat 32
  stats.fastRunner = { units: 1, leaked: 0, progressSum: 1 }; // threat 8 of 140 = 5.7%: updated
  stats.swarmling = { units: 1, leaked: 0, progressSum: 1 }; // threat 3 of 143 = 2.1%: below minThreatShare, not updated
  const wave = 5;
  const obs = computeObservationV2(stats, ENEMIES, cfg, wave);
  const reward = (t, p) => (ENEMIES[t].leakDamage * p * p) / ENEMIES[t].threatCost;
  const norm = { armoredGrunt: reward('armoredGrunt', 0.5) / baselineValue('armoredGrunt', wave, cfg), regenerator: reward('regenerator', 1) / baselineValue('regenerator', wave, cfg), fastRunner: reward('fastRunner', 1) / baselineValue('fastRunner', wave, cfg) };
  const spent = { armoredGrunt: 100, regenerator: 32, fastRunner: 8 };
  const avg = (spent.armoredGrunt * norm.armoredGrunt + spent.regenerator * norm.regenerator + spent.fastRunner * norm.fastRunner) / 140;
  near(obs.average, avg);
  for (const t of ['armoredGrunt', 'regenerator', 'fastRunner']) {
    near(obs.types[t].norm, norm[t]);
    const adv = Math.min(cfg.advClipHigh, Math.max(-1, (norm[t] - avg) / avg));
    near(obs.types[t].advantage, adv);
    near(obs.types[t].shrunk, adv * (obs.types[t].units / (obs.types[t].units + cfg.shrinkK)));
    assert.equal(obs.types[t].updated, true);
  }
  near(obs.types.regenerator.shrunk, obs.types.regenerator.advantage / 3);
  assert.equal(obs.types.swarmling.updated, false);
  assert.deepEqual([obs.types.swarmling.advantage, obs.types.swarmling.shrunk], [0, 0]);
  assert.equal(obs.types.swarmling.norm > 0, true, 'the norm of a non-updated type is still reported');
  const u = forUpdate(obs);
  near(u.types.regenerator.advantage, obs.types.regenerator.shrunk);
  assert.equal(u.types.swarmling.updated, false);
});

test('computeObservationV2: nothing spawned gives zeros and average 0', () => {
  const obs = computeObservationV2(zero(), ENEMIES, cfg, 7);
  assert.equal(obs.average, 0);
  for (const t of ENEMY_ORDER) assert.deepEqual([obs.types[t].norm, obs.types[t].advantage, obs.types[t].shrunk, obs.types[t].updated], [0, 0, 0, false]);
});

test('computeObservationV2 clamps the advantage to [-1, advClipHigh]', () => {
  const stats = zero();
  stats.armoredGrunt = { units: 10, leaked: 10, progressSum: 10 }; // everything leaked: a huge normalized reward
  stats.regenerator = { units: 6, leaked: 0, progressSum: 0.06 }; // died at the spawn
  const obs = computeObservationV2(stats, ENEMIES, cfg, 12);
  assert.ok(obs.types.armoredGrunt.advantage <= cfg.advClipHigh && obs.types.armoredGrunt.advantage > 0);
  assert.ok(obs.types.regenerator.advantage >= -1 && obs.types.regenerator.advantage < 0);
});

test('every directorV2 and counter config key is validated', () => {
  assert.equal(validateDirectorV2Config(cfg), true);
  assert.deepEqual(Object.keys(cfg).sort(), ['absentFloorShare', 'advClipHigh', 'alpha', 'baselineFloorFraction', 'baselineWindow', 'beta', 'decay', 'firstAdaptiveWave', 'historyLimit', 'minThreatShare', 'rewardExponent', 'shrinkK', 'tiltMax']);
  const bad = {
    firstAdaptiveWave: [0, 1.5, '5'], rewardExponent: [0, 5, 2.5], alpha: [0, 1.01, NaN], decay: [-0.1, 1.1], minThreatShare: [-0.1, 0.51], advClipHigh: [0, -1],
    beta: [-0.1, NaN], tiltMax: [0.9, NaN], absentFloorShare: [-0.01, 0.21], historyLimit: [0, 1.5], shrinkK: [-1, NaN], baselineWindow: [-1, 1.5], baselineFloorFraction: [0, 1.1],
  };
  for (const [key, values] of Object.entries(bad)) for (const v of values) assert.throws(() => validateDirectorV2Config({ ...cfg, [key]: v }), new RegExp(key), `${key}=${String(v)}`);
  for (const [key, v] of [['shrinkK', 0], ['alpha', 1], ['baselineFloorFraction', 1], ['baselineWindow', 0], ['beta', 0], ['decay', 0]]) assert.equal(validateDirectorV2Config({ ...cfg, [key]: v }), true);

  const c = config.counter;
  assert.equal(validateCounterConfig(c), true);
  assert.deepEqual(Object.keys(c).sort(), ['absentFloorShare', 'firstAdaptiveWave', 'gain', 'levelWeight', 'tiltMax']);
  const badC = { firstAdaptiveWave: [0, 2.5], gain: [-1, NaN], tiltMax: [0.5], absentFloorShare: [-0.1, 0.3], levelWeight: [-0.5, NaN] };
  for (const [key, values] of Object.entries(badC)) for (const v of values) assert.throws(() => validateCounterConfig({ ...c, [key]: v }), new RegExp(key), `${key}=${String(v)}`);
  assert.ok(Object.isFrozen(cfg) && Object.isFrozen(c));
});
