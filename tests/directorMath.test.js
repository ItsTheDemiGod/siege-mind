import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { WAVE_TEMPLATES, isTypeUnlocked } from '../src/data/waves.js';
import { createRng } from '../src/sim/rng.js';
import {
  validateDirectorConfig, intPow, rewardOf, computeObservation, updateScores, tiltFromScores, sharesFor, randomTilt, l1Distance,
} from '../src/sim/directorMath.js';

const cfg = config.director;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const zeros = () => Object.fromEntries(ENEMY_ORDER.map((t) => [t, { units: 0, leaked: 0, progressSum: 0 }]));
const flat = (v) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, v]));

test('intPow multiplies repeatedly', () => {
  assert.equal(intPow(3, 0), 1);
  assert.equal(intPow(3, 1), 3);
  assert.equal(intPow(2, 10), 1024);
  assert.equal(intPow(0.5, 3), 0.125);
  assert.equal(intPow(0, 2), 0);
});

test('rewardOf: zero progress, full progress, every enemy, both exponents, invalid input', () => {
  for (const type of ENEMY_ORDER) {
    const d = ENEMIES[type];
    const base = { leakDamage: d.leakDamage, threatCost: d.threatCost };
    assert.equal(rewardOf({ ...base, meanProgress: 0, exponent: 2 }), 0);
    near(rewardOf({ ...base, meanProgress: 1, exponent: 2 }), d.leakDamage / d.threatCost);
    near(rewardOf({ ...base, meanProgress: 0.5, exponent: 1 }), (d.leakDamage * 0.5) / d.threatCost);
    near(rewardOf({ ...base, meanProgress: 0.5, exponent: 2 }), (d.leakDamage * 0.25) / d.threatCost);
  }
  const ok = { leakDamage: 1, meanProgress: 0.5, threatCost: 10, exponent: 2 };
  assert.throws(() => rewardOf({ ...ok, leakDamage: NaN }), TypeError);
  assert.throws(() => rewardOf({ ...ok, meanProgress: Infinity }), TypeError);
  assert.throws(() => rewardOf({ ...ok, meanProgress: 1.01 }), RangeError);
  assert.throws(() => rewardOf({ ...ok, meanProgress: -0.1 }), RangeError);
  assert.throws(() => rewardOf({ ...ok, threatCost: 0 }), RangeError);
  assert.throws(() => rewardOf({ ...ok, threatCost: -3 }), RangeError);
});

test('computeObservation: hand-computed example with all five types', () => {
  const s = zeros();
  s.armoredGrunt = { units: 10, leaked: 0, progressSum: 5 };
  s.swarmling = { units: 8, leaked: 0, progressSum: 2 };
  s.fastRunner = { units: 2, leaked: 1, progressSum: 1.5 };
  s.regenerator = { units: 1, leaked: 1, progressSum: 1 };
  s.shieldedBruiser = { units: 1, leaked: 0, progressSum: 0.5 };
  const o = computeObservation(s, ENEMIES, cfg);
  const spent = { armoredGrunt: 100, swarmling: 24, fastRunner: 16, regenerator: 16, shieldedBruiser: 24 };
  const total = 180;
  const reward = {
    armoredGrunt: (1 * 0.25) / 10, swarmling: (1 * 0.0625) / 3, fastRunner: (1 * 0.5625) / 8, regenerator: (2 * 1) / 16, shieldedBruiser: (3 * 0.25) / 24,
  };
  let w = 0;
  let sp = 0;
  for (const t of ENEMY_ORDER) { w += spent[t] * reward[t]; sp += spent[t]; }
  near(o.average, w / sp);
  for (const t of ENEMY_ORDER) {
    near(o.types[t].threatSpent, spent[t]);
    near(o.types[t].threatShare, spent[t] / total);
    near(o.types[t].reward, reward[t]);
    assert.equal(o.types[t].updated, true);
    near(o.types[t].advantage, Math.min(cfg.advClipHigh, Math.max(-1, (reward[t] - o.average) / o.average)));
  }
  near(o.types.fastRunner.meanProgress, 0.75);
  assert.equal(o.types.fastRunner.leaked, 1);
});

test('computeObservation: a type below minThreatShare is not updated and stays out of the average', () => {
  const s = zeros();
  s.armoredGrunt = { units: 40, leaked: 0, progressSum: 20 }; // 400 threat
  s.swarmling = { units: 8, leaked: 8, progressSum: 8 }; // 24 threat = 5.7% -> updated
  s.fastRunner = { units: 1, leaked: 1, progressSum: 1 }; // 8 threat = 1.9% -> below
  const o = computeObservation(s, ENEMIES, cfg);
  assert.equal(o.types.fastRunner.updated, false);
  assert.equal(o.types.fastRunner.advantage, 0);
  const ra = (1 * 0.25) / 10;
  const rs = 1 / 3;
  near(o.average, (400 * ra + 24 * rs) / 424);
  assert.equal(o.types.swarmling.updated, true);
});

test('computeObservation: a single type gives advantage 0; zero average gives advantage 0; units 0', () => {
  const one = zeros();
  one.armoredGrunt = { units: 5, leaked: 1, progressSum: 3 };
  const o1 = computeObservation(one, ENEMIES, cfg);
  assert.equal(o1.types.armoredGrunt.advantage, 0);
  near(o1.average, o1.types.armoredGrunt.reward);
  const none = zeros();
  none.armoredGrunt = { units: 5, leaked: 0, progressSum: 0 };
  none.swarmling = { units: 5, leaked: 0, progressSum: 0 };
  const o0 = computeObservation(none, ENEMIES, cfg);
  assert.equal(o0.average, 0);
  assert.ok(ENEMY_ORDER.every((t) => o0.types[t].advantage === 0));
  const empty = computeObservation(zeros(), ENEMIES, cfg);
  assert.equal(empty.average, 0);
  assert.ok(ENEMY_ORDER.every((t) => empty.types[t].units === 0 && empty.types[t].updated === false && empty.types[t].reward === 0));
});

test('computeObservation clamps the advantage to [-1, advClipHigh]', () => {
  const s = zeros();
  s.armoredGrunt = { units: 100, leaked: 0, progressSum: 0 }; // reward 0, 1000 threat
  s.swarmling = { units: 40, leaked: 40, progressSum: 40 }; // reward 1/3, 120 threat -> far above the average
  const o = computeObservation(s, ENEMIES, cfg);
  assert.equal(o.types.armoredGrunt.advantage, -1);
  assert.ok(o.types.swarmling.advantage <= cfg.advClipHigh);
  assert.equal(o.types.swarmling.advantage, cfg.advClipHigh);
});

test('updateScores: EWMA for updated types, decay for the rest, input untouched', () => {
  const scores = { armoredGrunt: 0.4, swarmling: -0.2, fastRunner: 1, regenerator: 0, shieldedBruiser: 0.5 };
  const copy = { ...scores };
  const obs = { types: Object.fromEntries(ENEMY_ORDER.map((t) => [t, { advantage: 0.8, updated: t === 'armoredGrunt' || t === 'swarmling' }])) };
  const next = updateScores(scores, obs, cfg);
  near(next.armoredGrunt, (1 - cfg.alpha) * 0.4 + cfg.alpha * 0.8);
  near(next.swarmling, (1 - cfg.alpha) * -0.2 + cfg.alpha * 0.8);
  near(next.fastRunner, cfg.decay * 1);
  near(next.regenerator, 0);
  near(next.shieldedBruiser, cfg.decay * 0.5);
  assert.deepEqual(scores, copy);
  assert.notEqual(next, scores);
});

test('tiltFromScores clamps at both ends and maps 0 to 1', () => {
  const t = tiltFromScores({ armoredGrunt: 0, swarmling: 100, fastRunner: -100, regenerator: 0.5, shieldedBruiser: -0.5 }, cfg);
  assert.equal(t.armoredGrunt, 1);
  assert.equal(t.swarmling, cfg.tiltMax);
  assert.equal(t.fastRunner, 1 / cfg.tiltMax);
  near(t.regenerator, 1 + cfg.beta * 0.5);
  near(t.shieldedBruiser, 1 - cfg.beta * 0.5);
});

test('sharesFor: sums to 1, locked types stay 0, absent unlocked types get the floor, tilt 1 returns the template', () => {
  for (const wave of [5, 7, 9, 12, 25]) {
    const tpl = WAVE_TEMPLATES[wave - 1].shares;
    const isUnlocked = (t, w) => isTypeUnlocked(t, w);
    const same = sharesFor({ templateShares: tpl, tilt: flat(1), wave, isUnlocked, cfg });
    for (const t of ENEMY_ORDER) {
      const floor = tpl[t] > 0 ? 0 : (isUnlocked(t, wave) ? cfg.absentFloorShare : 0);
      const base = tpl[t] > 0 ? tpl[t] : floor;
      assert.ok(base >= 0);
    }
    const tilted = sharesFor({ templateShares: tpl, tilt: { ...flat(1), swarmling: 2.5, armoredGrunt: 0.4 }, wave, isUnlocked, cfg });
    near(ENEMY_ORDER.reduce((n, t) => n + tilted[t], 0), 1);
    near(ENEMY_ORDER.reduce((n, t) => n + same[t], 0), 1);
    for (const t of ENEMY_ORDER) if (!isUnlocked(t, wave) && !(tpl[t] > 0)) assert.equal(tilted[t], 0, `${t} locked at ${wave}`);
  }
  // wave 5: bruiser (intro 8) is locked and not in the template; regenerator (intro 6) is locked too
  const w5 = sharesFor({ templateShares: WAVE_TEMPLATES[4].shares, tilt: flat(1), wave: 5, isUnlocked: isTypeUnlocked, cfg });
  assert.equal(w5.shieldedBruiser, 0);
  assert.equal(w5.regenerator, 0);
  // wave 7: regenerator is in the template (0.15); bruiser (intro 8) locked
  // wave 9: everything unlocked, nothing absent
  // wave 20-style absent type: fixed wave 10 template has zero swarmling although unlocked
  const w10 = sharesFor({ templateShares: WAVE_TEMPLATES[9].shares, tilt: flat(1), wave: 10, isUnlocked: isTypeUnlocked, cfg });
  assert.ok(w10.swarmling > 0 && w10.fastRunner > 0, 'unlocked absent types get the floor');
  const base = { armoredGrunt: 0.5, swarmling: cfg.absentFloorShare, fastRunner: cfg.absentFloorShare, regenerator: 0.15, shieldedBruiser: 0.35 };
  const total = ENEMY_ORDER.reduce((n, t) => n + base[t], 0);
  near(w10.swarmling, cfg.absentFloorShare / total);
  // identity: a tilt of 1 on a template without absent unlocked types equals the template
  const w12 = WAVE_TEMPLATES[11].shares;
  const same12 = sharesFor({ templateShares: w12, tilt: flat(1), wave: 12, isUnlocked: isTypeUnlocked, cfg });
  for (const t of ENEMY_ORDER) near(same12[t], w12[t]);
});

test('sharesFor falls back to the template when the weighted sum is zero', () => {
  const tpl = { armoredGrunt: 0, swarmling: 0, fastRunner: 0, regenerator: 0, shieldedBruiser: 0 };
  assert.deepEqual(sharesFor({ templateShares: tpl, tilt: flat(1), wave: 1, isUnlocked: () => false, cfg }), tpl);
});

test('randomTilt: range, determinism, label independence and ENEMY_ORDER consumption', () => {
  const rng = () => createRng(7).fork('director-wave-9');
  const a = randomTilt(rng(), cfg);
  assert.deepEqual(a, randomTilt(rng(), cfg));
  for (const t of ENEMY_ORDER) assert.ok(a[t] >= 1 / cfg.tiltMax && a[t] <= cfg.tiltMax);
  assert.notDeepEqual(a, randomTilt(createRng(7).fork('director-wave-10'), cfg));
  assert.notDeepEqual(a, randomTilt(createRng(8).fork('director-wave-9'), cfg));
  const probe = rng();
  const draws = ENEMY_ORDER.map(() => probe.next());
  const lo = 1 / cfg.tiltMax;
  ENEMY_ORDER.forEach((t, i) => near(a[t], lo + (cfg.tiltMax - lo) * draws[i]));
});

test('l1Distance', () => {
  assert.equal(l1Distance(flat(0.2), flat(0.2)), 0);
  near(l1Distance({ ...flat(0), armoredGrunt: 1 }, { ...flat(0), swarmling: 1 }), 2);
});

test('validateDirectorConfig accepts the default and rejects each bad key', () => {
  assert.equal(validateDirectorConfig(cfg), true);
  const bad = {
    firstAdaptiveWave: [0, 1.5, -1], rewardExponent: [0, 5, 1.5], alpha: [0, 1.1, -0.1, NaN], decay: [-0.1, 1.1], minThreatShare: [-0.1, 0.6],
    advClipHigh: [0, -1], beta: [-0.1], tiltMax: [0.5, NaN], absentFloorShare: [-0.1, 0.3], historyLimit: [0, 2.5],
  };
  for (const [key, values] of Object.entries(bad)) {
    for (const v of values) assert.throws(() => validateDirectorConfig({ ...cfg, [key]: v }), (e) => e instanceof RangeError && e.message.includes(key), `${key}=${v}`);
  }
  assert.equal(validateDirectorConfig({ ...cfg, alpha: 1, decay: 0, beta: 0, tiltMax: 1 }), true);
});

test('everything is deterministic', () => {
  const s = zeros();
  s.armoredGrunt = { units: 10, leaked: 0, progressSum: 5 };
  s.fastRunner = { units: 4, leaked: 1, progressSum: 2.5 };
  const a = computeObservation(s, ENEMIES, cfg);
  assert.deepEqual(a, computeObservation(s, ENEMIES, cfg));
  assert.deepEqual(updateScores(flat(0), a, cfg), updateScores(flat(0), a, cfg));
});
