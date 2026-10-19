import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { BASELINE_REWARD, BASELINE_FALLBACK, BASELINE_META } from '../src/data/directorBaseline.js';
import { buildBaseline, baselineModuleSource } from '../experiments/makeBaseline.js';
import { TRAIN_SEEDS } from '../experiments/splits.js';

const k = config.director.rewardExponent;
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const o = (seed, style, wave, type, units, progressSum) => ({ seed, style, wave, type, units, killed: units, leaked: 0, progressSum, threatCost: ENEMIES[type].threatCost, leakDamage: ENEMIES[type].leakDamage });
const rw = (type, units, progressSum) => ENEMIES[type].leakDamage * (progressSum / units) ** k / ENEMIES[type].threatCost;
const P = { window: 1, minThreatShare: 0.05, minWave: 5, waves: 15 };

const obs = [
  o(1, 'a', 5, 'armoredGrunt', 10, 5), o(1, 'a', 5, 'swarmling', 8, 2), o(1, 'a', 5, 'fastRunner', 1, 1), // wave 5: fast runner has 8 of 132 threat (6.06%)
  o(1, 'a', 6, 'armoredGrunt', 10, 9), o(1, 'a', 6, 'regenerator', 0, 0), // empty cell ignored
];
const grunt5 = rw('armoredGrunt', 10, 5);
const grunt6 = rw('armoredGrunt', 10, 9);

test('buildBaseline: window 0 and 1, pooling by threat, missing cells are null', () => {
  const w0 = buildBaseline(obs, { ...P, window: 0 });
  near(w0.reward.armoredGrunt[4], grunt5);
  near(w0.reward.armoredGrunt[5], grunt6);
  assert.equal(w0.reward.armoredGrunt[3], null);
  assert.equal(w0.reward.armoredGrunt.length, 15);
  const w1 = buildBaseline(obs, P);
  near(w1.reward.armoredGrunt[4], (grunt5 + grunt6) / 2); // equal threat weights (100 each)
  near(w1.reward.armoredGrunt[3], grunt5); // wave 4 sees waves 3-5
  near(w1.reward.armoredGrunt[6], grunt6); // wave 7 sees waves 6-8
  assert.equal(w1.reward.armoredGrunt[7], null);
  assert.equal(w1.reward.regenerator.every((x) => x === null), true);
  near(w1.reward.swarmling[4], rw('swarmling', 8, 2));
  assert.equal(w1.cells, 5 - 1);
});

test('buildBaseline: the threat-share filter and the fallback', () => {
  assert.notEqual(buildBaseline(obs, P).reward.fastRunner[4], null);
  const strict = buildBaseline(obs, { ...P, minThreatShare: 0.07 });
  assert.equal(strict.reward.fastRunner.every((x) => x === null), true);
  assert.equal(strict.fallback.fastRunner, null);
  assert.equal(strict.cells, 3);
  const b = buildBaseline(obs, P);
  near(b.fallback.armoredGrunt, (grunt5 + grunt6) / 2);
  near(b.fallback.swarmling, rw('swarmling', 8, 2));
  assert.equal(b.fallback.shieldedBruiser, null);
  const late = buildBaseline(obs, { ...P, minWave: 6 });
  near(late.fallback.armoredGrunt, grunt6);
  assert.equal(late.fallback.swarmling, null);
});

test('buildBaseline: unequal threat weights, groups are per (seed, style, wave), determinism, no mutation', () => {
  const more = [o(1, 'a', 5, 'armoredGrunt', 10, 5), o(2, 'b', 5, 'armoredGrunt', 30, 30)]; // threat 100 and 300 in different groups
  const b = buildBaseline(more, { ...P, window: 0 });
  near(b.reward.armoredGrunt[4], (100 * rw('armoredGrunt', 10, 5) + 300 * rw('armoredGrunt', 30, 30)) / 400);
  const copy = JSON.stringify(obs);
  assert.deepEqual(buildBaseline(obs, P), buildBaseline(obs, P));
  assert.equal(JSON.stringify(obs), copy);
});

test('the committed baseline file: frozen, five types, 15 entries, finite positive, null only while a type is locked', () => {
  assert.ok(Object.isFrozen(BASELINE_REWARD) && Object.isFrozen(BASELINE_FALLBACK) && Object.isFrozen(BASELINE_META));
  assert.deepEqual(Object.keys(BASELINE_REWARD), [...ENEMY_ORDER]);
  assert.deepEqual(Object.keys(BASELINE_FALLBACK), [...ENEMY_ORDER]);
  const lockedUntil = { armoredGrunt: 0, swarmling: 2, fastRunner: 3, regenerator: 5, shieldedBruiser: 7 };
  for (const t of ENEMY_ORDER) {
    assert.ok(Object.isFrozen(BASELINE_REWARD[t]));
    assert.equal(BASELINE_REWARD[t].length, 15);
    BASELINE_REWARD[t].forEach((v, i) => {
      if (v === null) assert.ok(i + 1 <= lockedUntil[t], `${t} wave ${i + 1} is null but the type is unlocked`);
      else assert.ok(Number.isFinite(v) && v > 0, `${t} wave ${i + 1}`);
    });
    assert.ok(Number.isFinite(BASELINE_FALLBACK[t]) && BASELINE_FALLBACK[t] > 0, t);
  }
  assert.equal(BASELINE_REWARD.armoredGrunt.includes(null), false);
  assert.deepEqual([...BASELINE_META.seeds], [...TRAIN_SEEDS]);
});

test('the module source is deterministic and contains the header facts', () => {
  const b = buildBaseline(obs, P);
  const meta = { seeds: [1001], styles: ['a'], knobs: { tilePool: 1 }, waves: 15, window: 1, minThreatShare: 0.05, minWave: 5, qualifyingCells: b.cells, protocolHash: 'abc' };
  const src = baselineModuleSource(b, meta);
  assert.equal(src, baselineModuleSource(b, meta));
  for (const w of ['npm run baseline', 'STATIC games only', 'BASELINE_REWARD', 'BASELINE_FALLBACK', 'BASELINE_META', 'abc']) assert.ok(src.includes(w), w);
});
