import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import {
  WAVE_TEMPLATES, STATIC_WAVES, STATIC_THREAT, BUDGETS, buildStaticWaves, planThreat, INTRO_WAVES, isTypeUnlocked, isIntroWave, isAdaptiveEligible,
} from '../src/data/waves.js';
import { composeGroups, planWithShares } from '../src/data/waveCompose.js';

const cfg = config.waves;
const tolFor = (target) => Math.max(cfg.budgetTolerancePct * target, cfg.budgetToleranceMin);
const eligible = Array.from({ length: 30 }, (_, i) => i + 1).filter((w) => isAdaptiveEligible(w, config.director ?? { firstAdaptiveWave: 5 }));

/** Small deterministic generator (mulberry32) so the test needs no shared rng. */
function gen(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function vector(wave, rand) {
  const base = WAVE_TEMPLATES[wave - 1].shares;
  const raw = {};
  let sum = 0;
  for (const type of ENEMY_ORDER) {
    raw[type] = base[type] > 0 ? base[type] * (1 / 3 + (3 - 1 / 3) * rand()) : 0;
    sum += raw[type];
  }
  return Object.fromEntries(ENEMY_ORDER.map((type) => [type, raw[type] / sum]));
}

test('the static builder through the shared composer reproduces the plans (golden test covers the exact files)', () => {
  const rebuilt = buildStaticWaves(BUDGETS, WAVE_TEMPLATES, cfg);
  assert.deepEqual(JSON.parse(JSON.stringify(rebuilt)), JSON.parse(JSON.stringify(STATIC_WAVES)));
});

test('fit leaves plans that are already within tolerance untouched', () => {
  for (const t of WAVE_TEMPLATES) {
    const target = STATIC_THREAT[t.wave - 1];
    const plain = composeGroups({ wave: t.wave, shares: t.shares, targetThreat: target, cfg, fit: false });
    const fitted = composeGroups({ wave: t.wave, shares: t.shares, targetThreat: target, cfg, fit: true });
    assert.deepEqual(fitted, plain, `wave ${t.wave}`);
  }
});

test('fit brings the realized threat within tolerance for 200 share vectors per eligible wave', () => {
  assert.ok(eligible.length >= 20);
  let maxDeviation = 0;
  let violations = 0;
  for (const wave of eligible) {
    const rand = gen(wave * 7919);
    const target = STATIC_THREAT[wave - 1];
    for (let i = 0; i < 200; i++) {
      const shares = vector(wave, rand);
      const groups = composeGroups({ wave, shares, targetThreat: target, cfg, fit: true });
      const dev = Math.abs(planThreat(groups) - target);
      maxDeviation = Math.max(maxDeviation, dev / tolFor(target));
      if (dev > tolFor(target)) violations++;
      for (const g of groups) {
        assert.ok(Number.isInteger(g.picks) && g.picks >= 1, `wave ${wave}: picks ${g.picks}`);
        assert.ok(shares[g.type] > 0, 'a type with no share must not appear');
        assert.ok(g.gapSeconds >= cfg.minGapSeconds[g.type]);
      }
    }
  }
  console.log(`fit battery: ${eligible.length} waves x 200 vectors, max deviation = ${maxDeviation.toFixed(3)} x tolerance`);
  assert.equal(violations, 0);
});

test('no type appears before its intro wave, and INTRO_WAVES is the first wave with a positive template share', () => {
  for (const type of ENEMY_ORDER) {
    const first = WAVE_TEMPLATES.find((t) => t.shares[type] > 0).wave;
    assert.equal(INTRO_WAVES[type], first, type);
  }
  for (const plan of STATIC_WAVES) for (const g of plan.groups) assert.ok(isTypeUnlocked(g.type, plan.wave), `${g.type} in wave ${plan.wave}`);
});

test('tiny budgets never produce NaN or negative picks', () => {
  for (const target of [0, 1, 5, 12, 20, 40]) {
    for (const fit of [false, true]) {
      const groups = composeGroups({ wave: 5, shares: WAVE_TEMPLATES[4].shares, targetThreat: target, cfg, fit });
      for (const g of groups) {
        assert.ok(Number.isInteger(g.picks) && g.picks >= 0, `target ${target}`);
        assert.ok(Number.isFinite(g.gapSeconds) && Number.isFinite(g.startSeconds));
      }
    }
  }
});

test('the composer is pure and its outputs are frozen', () => {
  const shares = WAVE_TEMPLATES[6].shares;
  const args = { wave: 7, shares, targetThreat: 236, cfg, fit: true };
  const a = composeGroups(args);
  const b = composeGroups(args);
  assert.deepEqual(a, b);
  assert.ok(a.every((g) => Object.isFrozen(g)));
  const plan = planWithShares({ wave: 7, name: null, fixed: false, ...args });
  assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.groups));
  assert.deepEqual(plan, planWithShares({ wave: 7, name: null, fixed: false, ...args }));
  assert.deepEqual(shares, WAVE_TEMPLATES[6].shares);
});

test('groups keep the timing rules: stagger by group index, window stretches to the minimum gap', () => {
  const plan = composeGroups({ wave: 24, shares: WAVE_TEMPLATES[23].shares, targetThreat: STATIC_THREAT[23], cfg });
  plan.forEach((g, i) => {
    assert.equal(g.startSeconds, cfg.startStaggerSeconds * i);
    const window = Math.min(cfg.windowMaxSeconds, cfg.windowBaseSeconds + cfg.windowPerWave * 24);
    assert.equal(g.gapSeconds, Math.max(window / g.picks, cfg.minGapSeconds[g.type]));
  });
});

test('isIntroWave, isTypeUnlocked and isAdaptiveEligible truth tables for waves 1..30', () => {
  const dir = { firstAdaptiveWave: 5 };
  for (let w = 1; w <= 30; w++) {
    assert.equal(isIntroWave(w), [3, 4, 6, 8].includes(w), `intro ${w}`);
    const fixed = [10, 20, 30].includes(w);
    assert.equal(isAdaptiveEligible(w, dir), !fixed && ![3, 4, 6, 8].includes(w) && w >= 5, `eligible ${w}`);
    for (const type of ENEMY_ORDER) assert.equal(isTypeUnlocked(type, w), w >= INTRO_WAVES[type]);
  }
  assert.equal(isAdaptiveEligible(0, dir), false);
  assert.equal(isAdaptiveEligible(31, dir), false);
  assert.equal(isAdaptiveEligible(5.5, dir), false);
  assert.equal(isAdaptiveEligible(5, { firstAdaptiveWave: 7 }), false);
  assert.equal(isAdaptiveEligible(7, { firstAdaptiveWave: 7 }), true);
  assert.ok(ENEMIES.armoredGrunt);
});
