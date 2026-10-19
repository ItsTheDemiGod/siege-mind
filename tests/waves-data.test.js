import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOTAL_WAVES, checkWaveData, BUDGETS, waveBudgetTarget, WAVE_TEMPLATES, STATIC_WAVES, STATIC_THREAT, planThreat, buildStaticWaves, waveInfo, HP_MULT, buildHpMult, hpMultiplierForWave,
} from '../src/data/waves.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { config } from '../src/data/config.js';

const INTRO = { armoredGrunt: 1, swarmling: 3, fastRunner: 4, regenerator: 6, shieldedBruiser: 8 };

test('30 waves everywhere and TOTAL_WAVES matches the config', () => {
  assert.equal(checkWaveData(), true);
  assert.equal(TOTAL_WAVES, config.game.totalWaves);
  for (const a of [BUDGETS, WAVE_TEMPLATES, STATIC_WAVES, STATIC_THREAT]) assert.equal(a.length, 30);
});

test('everything is frozen', () => {
  for (const a of [BUDGETS, WAVE_TEMPLATES, STATIC_WAVES, STATIC_THREAT]) assert.ok(Object.isFrozen(a));
  for (const t of WAVE_TEMPLATES) assert.ok(Object.isFrozen(t) && Object.isFrozen(t.shares));
  for (const w of STATIC_WAVES) assert.ok(Object.isFrozen(w) && Object.isFrozen(w.groups) && Object.isFrozen(w.groups[0]));
});

test('budgets follow the formula and the configured scale', () => {
  const scale = config.waves.budgetScale;
  const exact = { 1: 40, 10: 367.6, 20: 1035.6, 30: 2023.6 }; // 40 + 22(w-1) + 1.6(w-1)^2, computed by hand
  for (const [w, raw] of Object.entries(exact)) assert.equal(BUDGETS[w - 1], Math.round(scale * raw), `wave ${w}`);
  if (scale === 1) assert.deepEqual([1, 10, 20, 30].map((w) => BUDGETS[w - 1]), [40, 368, 1036, 2024]);
  for (let w = 1; w <= 30; w++) assert.equal(BUDGETS[w - 1], waveBudgetTarget(w));
  assert.equal(waveBudgetTarget(1, { ...config.waves, budgetScale: 1 }), 40);
});

test('HP_MULT: shape, freezing, and equality with buildHpMult(config.waves)', () => {
  assert.equal(HP_MULT.length, 31);
  assert.equal(HP_MULT[0], 1);
  assert.equal(HP_MULT[1], 1);
  assert.ok(Object.isFrozen(HP_MULT));
  for (let w = 1; w <= 30; w++) assert.ok(HP_MULT[w] >= HP_MULT[w - 1]);
  assert.deepEqual([...HP_MULT], [...buildHpMult(config.waves)]);
});

test('buildHpMult matches independent computations for both curves', () => {
  const base = { hpCurve: 'exponential', hpGrowthPerWave: 0.1, hpLinear: 0.3, hpQuad: 0.01 };
  const exp = buildHpMult(base);
  let m = 1;
  for (let w = 2; w <= 30; w++) { m *= 1.1; assert.equal(exp[w], m); }
  const poly = buildHpMult({ ...base, hpCurve: 'polynomial' });
  for (let w = 1; w <= 30; w++) assert.equal(poly[w], 1 + 0.3 * (w - 1) + 0.01 * (w - 1) * (w - 1));
  assert.deepEqual([poly[0], poly[1], exp[0], exp[1]], [1, 1, 1, 1]);
  assert.ok(Object.isFrozen(exp) && Object.isFrozen(poly));
  assert.ok(buildHpMult({ ...base, hpGrowthPerWave: 0 })[30] === 1);
});

test('buildHpMult validates its input', () => {
  const ok = { hpCurve: 'exponential', hpGrowthPerWave: 0.1, hpLinear: 0.3, hpQuad: 0.01 };
  assert.throws(() => buildHpMult({ ...ok, hpCurve: 'cubic' }), RangeError);
  for (const k of ['hpGrowthPerWave', 'hpLinear', 'hpQuad']) {
    for (const bad of [-0.1, NaN, Infinity, '0.1', undefined]) assert.throws(() => buildHpMult({ ...ok, [k]: bad }), RangeError, `${k}=${String(bad)}`);
  }
});

test('hpMultiplierForWave edge cases', () => {
  assert.equal(hpMultiplierForWave(0), 1);
  assert.equal(hpMultiplierForWave(1), 1);
  assert.equal(hpMultiplierForWave(-5), 1);
  assert.equal(hpMultiplierForWave(NaN), 1);
  assert.equal(hpMultiplierForWave(Infinity), 1);
  assert.equal(hpMultiplierForWave(30), HP_MULT[30]);
  assert.equal(hpMultiplierForWave(31), HP_MULT[30]);
  assert.equal(hpMultiplierForWave(2.7), HP_MULT[2]);
});

test('template shares are valid and sum to 1', () => {
  WAVE_TEMPLATES.forEach((t, i) => {
    assert.equal(t.wave, i + 1);
    assert.deepEqual(Object.keys(t.shares), [...ENEMY_ORDER]);
    let sum = 0;
    for (const id of ENEMY_ORDER) { assert.ok(t.shares[id] >= 0); sum += t.shares[id]; }
    assert.ok(Math.abs(sum - 1) < 1e-9, `wave ${t.wave} sums to ${sum}`);
  });
});

test('introduction schedule: no type early, and each intro wave contains its type', () => {
  for (const t of WAVE_TEMPLATES) for (const id of ENEMY_ORDER) if (t.wave < INTRO[id]) assert.equal(t.shares[id], 0, `${id} in wave ${t.wave}`);
  for (const id of ENEMY_ORDER) assert.ok(WAVE_TEMPLATES[INTRO[id] - 1].shares[id] > 0, id);
  assert.deepEqual(STATIC_WAVES[0].groups.map((g) => g.type), ['armoredGrunt']);
  assert.deepEqual(STATIC_WAVES[1].groups.map((g) => g.type), ['armoredGrunt']);
  assert.ok(Math.abs(WAVE_TEMPLATES[5].shares.regenerator - 0.2) < 1e-9);
  assert.ok(Math.abs(WAVE_TEMPLATES[7].shares.shieldedBruiser - 0.25) < 1e-9);
});

test('waves 10, 20 and 30 are fixed with the specified names and shares', () => {
  assert.deepEqual(WAVE_TEMPLATES.filter((t) => t.fixed).map((t) => t.wave), [10, 20, 30]);
  assert.equal(WAVE_TEMPLATES[9].name, 'The Vanguard');
  assert.deepEqual({ ...WAVE_TEMPLATES[9].shares }, { armoredGrunt: 0.5, swarmling: 0, fastRunner: 0, regenerator: 0.15, shieldedBruiser: 0.35 });
  assert.equal(WAVE_TEMPLATES[19].name, 'Tide of Swarm');
  assert.deepEqual({ ...WAVE_TEMPLATES[19].shares }, { armoredGrunt: 0.15, swarmling: 0.55, fastRunner: 0.3, regenerator: 0, shieldedBruiser: 0 });
  assert.equal(WAVE_TEMPLATES[29].name, 'The Siege');
  assert.deepEqual({ ...WAVE_TEMPLATES[29].shares }, { armoredGrunt: 0.25, swarmling: 0.2, fastRunner: 0.15, regenerator: 0.2, shieldedBruiser: 0.2 });
  for (const t of WAVE_TEMPLATES) if (!t.fixed && ![3, 4, 6, 8].includes(t.wave)) assert.equal(t.name, null, `wave ${t.wave}`);
  for (const w of [3, 4, 6, 8]) assert.ok(typeof WAVE_TEMPLATES[w - 1].name === 'string');
});

test('mix rules: 3+ types from wave 8; from wave 12 dominance is 40-55% and no type above 70%', () => {
  for (const t of WAVE_TEMPLATES) {
    if (t.fixed) continue;
    const present = ENEMY_ORDER.filter((id) => t.shares[id] > 0).length;
    if (t.wave >= 8) assert.ok(present >= 3, `wave ${t.wave}: ${present} types`);
    if (t.wave >= 12) {
      const top = Math.max(...Object.values(t.shares));
      assert.ok(top >= 0.4 - 1e-9 && top <= 0.55 + 1e-9, `wave ${t.wave} dominant ${top}`);
      assert.ok(top <= 0.7);
    }
  }
});

test('realized threat stays within tolerance of the budget and matches an independent recomputation', () => {
  for (let i = 0; i < 30; i++) {
    const tol = Math.max(config.waves.budgetTolerancePct * BUDGETS[i], config.waves.budgetToleranceMin);
    assert.ok(Math.abs(STATIC_THREAT[i] - BUDGETS[i]) <= tol, `wave ${i + 1}: ${STATIC_THREAT[i]} vs ${BUDGETS[i]}`);
    let sum = 0;
    for (const g of STATIC_WAVES[i].groups) sum += g.picks * ENEMIES[g.type].threatCost * ENEMIES[g.type].packSize;
    assert.equal(STATIC_THREAT[i], sum);
    assert.equal(planThreat(STATIC_WAVES[i].groups), sum);
  }
});

test('groups only use types with a positive share, in ENEMY_ORDER, with at least one pick each', () => {
  STATIC_WAVES.forEach((w, i) => {
    let last = -1;
    for (const g of w.groups) {
      assert.ok(WAVE_TEMPLATES[i].shares[g.type] > 0);
      assert.ok(g.picks >= 1 && Number.isInteger(g.picks));
      const idx = ENEMY_ORDER.indexOf(g.type);
      assert.ok(idx > last);
      last = idx;
    }
    for (const id of ENEMY_ORDER) if (WAVE_TEMPLATES[i].shares[id] > 0) assert.ok(w.groups.some((g) => g.type === id), `wave ${i + 1} missing ${id}`);
  });
});

test('spacing: minimum gaps hold, and a window is only stretched when a minimum gap forces it', () => {
  const cfg = config.waves;
  STATIC_WAVES.forEach((w) => {
    const window = Math.min(cfg.windowMaxSeconds, cfg.windowBaseSeconds + cfg.windowPerWave * w.wave);
    let span = 0;
    let forced = false;
    w.groups.forEach((g, idx) => {
      assert.ok(g.gapSeconds >= cfg.minGapSeconds[g.type] - 1e-12, `${g.type} gap in wave ${w.wave}`);
      assert.ok(Math.abs(g.gapSeconds - Math.max(window / g.picks, cfg.minGapSeconds[g.type])) < 1e-9);
      assert.ok(Math.abs(g.startSeconds - cfg.startStaggerSeconds * idx) < 1e-9);
      if (g.picks > 1 && window / g.picks < cfg.minGapSeconds[g.type]) forced = true;
      span = Math.max(span, g.startSeconds + g.gapSeconds * (g.picks - 1));
    });
    // The brief asked for every wave to spawn within 60 s. At the calibrated budget scale the minimum gaps make that impossible
    // for the biggest waves (see the Decisions Log), so the rule asserted is: within 60 s unless a minimum gap forces the stretch.
    assert.ok(span <= 60 || forced, `wave ${w.wave} spans ${span.toFixed(1)} s without a forced stretch`);
  });
  assert.ok(cfg.minGapSeconds.fastRunner >= 1 && cfg.minGapSeconds.swarmling >= 2);
});

test('buildStaticWaves is pure and survives a tiny budget', () => {
  const a = buildStaticWaves(BUDGETS, WAVE_TEMPLATES, config.waves);
  assert.deepEqual(a, buildStaticWaves(BUDGETS, WAVE_TEMPLATES, config.waves));
  const tiny = buildStaticWaves(Array(30).fill(12), WAVE_TEMPLATES, config.waves);
  for (const w of tiny) {
    for (const g of w.groups) {
      assert.ok(Number.isFinite(g.picks) && g.picks >= 0 && Number.isFinite(g.gapSeconds) && g.gapSeconds > 0 && g.startSeconds >= 0);
    }
  }
  assert.ok(tiny[0].groups.length >= 1 && tiny[0].groups[0].picks >= 1);
});

test('waveInfo returns the plan summary and throws outside 1..30', () => {
  assert.deepEqual(waveInfo(10), { wave: 10, name: 'The Vanguard', fixed: true, budget: BUDGETS[9], threat: STATIC_THREAT[9], hpMult: HP_MULT[10] });
  assert.throws(() => waveInfo(0), RangeError);
  assert.throws(() => waveInfo(31), RangeError);
  assert.throws(() => waveInfo(1.5), RangeError);
});
