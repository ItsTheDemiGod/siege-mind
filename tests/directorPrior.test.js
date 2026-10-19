import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { STATIC_WAVES, STATIC_THREAT, WAVE_TEMPLATES, isAdaptiveEligible, isTypeUnlocked } from '../src/data/waves.js';
import { createGame, snapshotGame } from '../src/sim/game.js';
import { baselineValue } from '../src/sim/directorMathV2.js';
import { planForPrior, priorTilt, validatePriorConfig, DECISION_KEYS_PRIOR } from '../src/sim/directorPrior.js';

const cfg = config.prior;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const tolFor = (target) => Math.max(config.waves.budgetTolerancePct * target, config.waves.budgetToleranceMin);
const make = (over = {}) => createGame({ seed: 1, debugSpawnEveryTicks: 0, totalWaves: 15, mode: 'prior', ...over });
const shares = (o) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, o[t] ?? 0]));

test('priorTilt on a hand-computed two-type example, the template shares are the weights of the average', () => {
  const g = baselineValue('armoredGrunt', 9, cfg);
  const s = baselineValue('swarmling', 9, cfg);
  const avg = (3 * g + 1 * s) / 4; // shares 0.75 / 0.25
  const { tilt, advantage } = priorTilt(9, shares({ armoredGrunt: 0.75, swarmling: 0.25 }), cfg);
  near(advantage.armoredGrunt, (g - avg) / avg);
  near(advantage.swarmling, (s - avg) / avg);
  near(tilt.armoredGrunt, 1 + (g - avg) / avg);
  near(tilt.swarmling, 1 + (s - avg) / avg);
  for (const t of ['fastRunner', 'regenerator', 'shieldedBruiser']) assert.deepEqual([tilt[t], advantage[t]], [1, 0], 'types outside the template get tilt 1');
});

test('priorTilt: all five types, a single type (advantage 0), clamping at both ends, a zero-beta config', () => {
  const all = shares({ armoredGrunt: 0.2, swarmling: 0.2, fastRunner: 0.2, regenerator: 0.2, shieldedBruiser: 0.2 });
  const b = Object.fromEntries(ENEMY_ORDER.map((t) => [t, baselineValue(t, 12, cfg)]));
  const avg = ENEMY_ORDER.reduce((n, t) => n + 0.2 * b[t], 0);
  const r = priorTilt(12, all, cfg);
  for (const t of ENEMY_ORDER) near(r.tilt[t], Math.min(cfg.tiltMax, Math.max(1 / cfg.tiltMax, 1 + Math.min(cfg.advClipHigh, Math.max(-1, (b[t] - avg) / avg)))));
  const one = priorTilt(12, shares({ regenerator: 1 }), cfg);
  assert.deepEqual([one.tilt.regenerator, one.advantage.regenerator], [1, 0]);
  const wild = priorTilt(12, all, { ...cfg, beta: 100 });
  assert.ok(ENEMY_ORDER.every((t) => wild.tilt[t] === cfg.tiltMax || wild.tilt[t] === 1 / cfg.tiltMax || Math.abs(wild.tilt[t] - 1) < 1e-12));
  assert.ok(ENEMY_ORDER.some((t) => wild.tilt[t] === cfg.tiltMax) && ENEMY_ORDER.some((t) => wild.tilt[t] === 1 / cfg.tiltMax));
  assert.ok(ENEMY_ORDER.every((t) => priorTilt(12, all, { ...cfg, beta: 0 }).tilt[t] === 1));
  assert.ok(ENEMY_ORDER.every((t) => wild_advantage_ok(priorTilt(12, all, cfg).advantage[t])));
  assert.deepEqual(priorTilt(12, shares({}), cfg), { tilt: shares(Object.fromEntries(ENEMY_ORDER.map((t) => [t, 1]))), advantage: shares({}) });
});
const wild_advantage_ok = (a) => a >= -1 && a <= cfg.advClipHigh;

test('every config.prior key is validated', () => {
  assert.equal(validatePriorConfig(cfg), true);
  assert.deepEqual(Object.keys(cfg).sort(), ['absentFloorShare', 'advClipHigh', 'baselineFloorFraction', 'beta', 'firstAdaptiveWave', 'tiltMax']);
  const bad = { firstAdaptiveWave: [0, 1.5], beta: [-0.1, NaN], tiltMax: [0.9, NaN], advClipHigh: [0, -1], absentFloorShare: [-0.01, 0.21], baselineFloorFraction: [0, 1.1] };
  for (const [key, values] of Object.entries(bad)) for (const v of values) assert.throws(() => validatePriorConfig({ ...cfg, [key]: v }), new RegExp(key), `${key}=${String(v)}`);
  assert.throws(() => createGame({ seed: 1, mode: 'prior', priorConfig: { beta: -1 } }), RangeError);
  assert.ok(Object.isFrozen(cfg));
});

test('non-eligible waves are exactly the static plan with the right reason', () => {
  const g = make();
  const expected = { 1: 'static-early', 2: 'static-early', 3: 'static-early', 4: 'static-early', 6: 'static-intro', 8: 'static-intro', 10: 'static-fixed', 20: 'static-fixed', 30: 'static-fixed' };
  for (const [w, reason] of Object.entries(expected)) {
    const { plan, decision } = planForPrior(g, Number(w));
    assert.deepEqual(plan, STATIC_WAVES[w - 1], `wave ${w}`);
    assert.equal(decision.reason, reason);
    assert.equal(decision.eligible, false);
    assert.ok(ENEMY_ORDER.every((t) => decision.tilt[t] === 1 && decision.baselineAdvantage[t] === 0));
    assert.equal(decision.lines.length, 1);
  }
});

test('eligible waves 5..15: threat within the data tolerance, shares sum to 1, locked types stay 0, tilts follow priorTilt', () => {
  const g = make();
  for (let wave = 5; wave <= 15; wave++) {
    if (!isAdaptiveEligible(wave, cfg)) continue;
    const { decision } = planForPrior(g, wave);
    assert.equal(decision.reason, 'prior', `wave ${wave}`);
    assert.ok(Math.abs(decision.threatRealized - STATIC_THREAT[wave - 1]) <= tolFor(STATIC_THREAT[wave - 1]), `wave ${wave} threat`);
    near(ENEMY_ORDER.reduce((n, t) => n + decision.finalShares[t], 0), 1);
    for (const t of ENEMY_ORDER) if (!isTypeUnlocked(t, wave)) assert.equal(decision.finalShares[t], 0, `${t} locked at wave ${wave}`);
    assert.deepEqual(decision.tilt, priorTilt(wave, WAVE_TEMPLATES[wave - 1].shares, cfg).tilt);
    assert.equal(decision.threatTarget, STATIC_THREAT[wave - 1]);
  }
});

test('the decision never depends on the defense: different loadouts, seeds and director state give the identical decision', () => {
  const a = make({ seed: 1 });
  const b = make({ seed: 77 });
  b.towers = [{ type: 'sniper', level: 2 }, { type: 'frost', level: 0 }, { type: 'mortar', level: 1 }];
  b.lives = 3;
  for (const wave of [5, 7, 9, 11, 12, 13, 14, 15]) assert.deepEqual(planForPrior(a, wave), planForPrior(b, wave), `wave ${wave}`);
});

test('decision keys, explain lines, purity and a JSON round trip', () => {
  const g = make();
  const { decision } = planForPrior(g, 12);
  assert.deepEqual(Object.keys(decision).sort(), [...DECISION_KEYS_PRIOR].sort());
  assert.deepEqual([decision.version, decision.mode, decision.arm, decision.basedOnWave], [2, 'prior', 'prior', 0]);
  assert.ok(ENEMY_ORDER.every((t) => decision.scores[t] === 0 && decision.observed[t].units === 0));
  assert.ok(decision.lines.length >= 1 && decision.lines.length <= 3);
  for (const l of decision.lines) assert.match(l, /^[A-Z][A-Za-z ]+: weight x\d\.\d\d, a fixed weight from static baseline rewards \(enemy durability\), not learned from your defense$/);
  const largest = ENEMY_ORDER.reduce((m, t) => (Math.abs(decision.tilt[t] - 1) > Math.abs(decision.tilt[m] - 1) ? t : m), ENEMY_ORDER[0]);
  assert.ok(decision.lines[0].includes(`x${decision.tilt[largest].toFixed(2)}`), 'largest first');
  assert.match(planForPrior(g, 3).decision.lines[0], /too early/);
  assert.match(planForPrior(g, 6).decision.lines[0], /introduces a new enemy type/);
  assert.match(planForPrior(g, 10).decision.lines[0], /fixed set piece/);
  assert.match(planForPrior(make({ priorConfig: { beta: 0 } }), 12).decision.lines[0], /changed almost nothing/);
  const before = JSON.stringify(snapshotGame(g));
  const a = planForPrior(g, 12);
  assert.deepEqual(planForPrior(g, 12), a);
  assert.deepEqual(planForPrior(g, 12), a);
  assert.equal(JSON.stringify(snapshotGame(g)), before);
  assert.deepEqual(JSON.parse(JSON.stringify(a.decision)), a.decision);
  assert.deepEqual(JSON.parse(JSON.stringify(g.director)), g.director);
  assert.deepEqual(g.director, { mode: 'prior' });
});
