import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { TOWERS } from '../src/data/towers.js';
import { STATIC_WAVES, STATIC_THREAT, isAdaptiveEligible } from '../src/data/waves.js';
import { createGame, snapshotGame } from '../src/sim/game.js';
import { planForCounter, loadoutPressure, DECISION_KEYS_COUNTER } from '../src/sim/directorCounter.js';
import { planWaveWithDecision } from '../src/sim/waves.js';

const cfg = config.counter;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const tolFor = (target) => Math.max(config.waves.budgetTolerancePct * target, config.waves.budgetToleranceMin);
const make = (over = {}) => createGame({ seed: 1, debugSpawnEveryTicks: 0, totalWaves: 15, mode: 'counter', ...over });
const loadout = [{ type: 'lance', level: 0 }, { type: 'lance', level: 2 }, { type: 'mortar', level: 0 }, { type: 'sniper', level: 0 }];

test('pressure for a known loadout is hand-computed (2 lance, one at level 2, 1 mortar, 1 sniper)', () => {
  const g = make();
  g.towers = loadout.map((t) => ({ ...t }));
  const { pressure, loadout: lo } = loadoutPressure(g, cfg);
  // weights: 1, 1 + 0.5 * 2 = 2, 1, 1; total 5
  near(pressure.swarmling, (1 + 2 + 1 - 1) / 5); // weak: lance x2 and sniper; strong: mortar
  near(pressure.armoredGrunt, -3 / 5); // strong: both lances
  near(pressure.fastRunner, 2 / 5); // weak: mortar and sniper
  near(pressure.regenerator, 0);
  near(pressure.shieldedBruiser, -1 / 5);
  assert.deepEqual(lo, { towers: 4, byType: { lance: { count: 2, weight: 3 }, mortar: { count: 1, weight: 1 }, frost: { count: 0, weight: 0 }, poison: { count: 0, weight: 0 }, sniper: { count: 1, weight: 1 } } });
  for (const t of ENEMY_ORDER) assert.equal(typeof pressure[t], 'number');
  assert.ok(TOWERS.lance.weakVs.includes('swarmling'));
});

test('tilts follow clamp(1 + gain * pressure, 1 / tiltMax, tiltMax) and shares move the right way within the threat tolerance', () => {
  const g = make();
  g.towers = loadout.map((t) => ({ ...t }));
  const { decision } = planForCounter(g, 9);
  assert.equal(decision.reason, 'adapted');
  near(decision.tilt.swarmling, 1 + 1.5 * 0.6);
  near(decision.tilt.armoredGrunt, 1 / 3); // 1 - 0.9 = 0.1 is clamped up to 1 / tiltMax
  near(decision.tilt.fastRunner, 1 + 1.5 * 0.4);
  assert.equal(decision.tilt.regenerator, 1);
  near(decision.tilt.shieldedBruiser, 1 - 1.5 * 0.2);
  assert.ok(decision.finalShares.swarmling > decision.templateShares.swarmling);
  assert.ok(decision.finalShares.armoredGrunt < decision.templateShares.armoredGrunt);
  for (const w of [9, 11, 12, 13, 14, 15]) {
    const d = planForCounter(g, w).decision;
    assert.ok(Math.abs(d.threatRealized - STATIC_THREAT[w - 1]) <= tolFor(STATIC_THREAT[w - 1]), `wave ${w}`);
  }
  const huge = make({ counterConfig: { gain: 100 } });
  huge.towers = loadout.map((t) => ({ ...t }));
  const t = planForCounter(huge, 9).decision.tilt;
  assert.ok(ENEMY_ORDER.every((e) => t[e] >= 1 / 3 - 1e-12 && t[e] <= 3 + 1e-12));
});

test('no towers: all pressures and tilts are 0 / 1 and every eligible wave is the static plan (cold start)', () => {
  const g = make();
  const { pressure } = loadoutPressure(g, cfg);
  assert.ok(ENEMY_ORDER.every((t) => pressure[t] === 0));
  for (let w = 1; w <= 30; w++) {
    const { plan, decision } = planForCounter(g, w);
    assert.deepEqual(plan, STATIC_WAVES[w - 1], `wave ${w}`);
    assert.ok(ENEMY_ORDER.every((t) => decision.tilt[t] === 1));
    if (isAdaptiveEligible(w, cfg)) assert.equal(decision.reason, 'cold-start');
  }
});

test('a loadout with gain 0 (every tilt exactly 1) is also a cold start', () => {
  const g = make({ counterConfig: { gain: 0 } });
  g.towers = loadout.map((t) => ({ ...t }));
  const { plan, decision } = planForCounter(g, 9);
  assert.equal(decision.reason, 'cold-start');
  assert.deepEqual(plan, STATIC_WAVES[8]);
});

test('non-eligible waves are the static plan with the right reason even with a loadout', () => {
  const g = make();
  g.towers = loadout.map((t) => ({ ...t }));
  const expected = { 1: 'static-early', 4: 'static-early', 6: 'static-intro', 8: 'static-intro', 10: 'static-fixed', 20: 'static-fixed', 30: 'static-fixed' };
  for (const [w, reason] of Object.entries(expected)) {
    const { plan, decision } = planForCounter(g, Number(w));
    assert.deepEqual(plan, STATIC_WAVES[w - 1]);
    assert.equal(decision.reason, reason);
    assert.ok(ENEMY_ORDER.every((t) => decision.tilt[t] === 1));
  }
});

test('planForCounter is pure, has the documented keys, and survives a JSON round trip', () => {
  const g = make();
  g.towers = loadout.map((t) => ({ ...t }));
  const before = JSON.stringify(snapshotGame(g));
  const a = planForCounter(g, 12);
  assert.deepEqual(planForCounter(g, 12), a);
  assert.deepEqual(planForCounter(g, 12), a);
  assert.equal(JSON.stringify(snapshotGame(g)), before);
  assert.deepEqual(Object.keys(a.decision).sort(), [...DECISION_KEYS_COUNTER].sort());
  assert.deepEqual([a.decision.version, a.decision.mode, a.decision.arm, a.decision.basedOnWave], [2, 'counter', 'counter', 0]);
  assert.ok(ENEMY_ORDER.every((t) => a.decision.scores[t] === 0 && a.decision.observed[t].units === 0));
  assert.deepEqual(JSON.parse(JSON.stringify(a.decision)), a.decision);
  assert.deepEqual(JSON.parse(JSON.stringify(g.director)), g.director);
  assert.equal(planWaveWithDecision(g, 12).decision.mode, 'counter');
});

test('explain lines: static reasons reuse v1 wording, adapted lines state weak or strong with the signed pressure', () => {
  const g = make();
  assert.match(planForCounter(g, 3).decision.lines[0], /too early/);
  assert.match(planForCounter(g, 9).decision.lines[0], /No evidence yet/);
  g.towers = loadout.map((t) => ({ ...t }));
  const lines = planForCounter(g, 9).decision.lines;
  assert.equal(lines.length, 3);
  for (const l of lines) assert.match(l, /^[A-Z][A-Za-z ]+: weight x\d\.\d\d, your towers are (weak|strong) against it \(pressure [+-]\d\.\d\d\)$/);
  assert.match(lines[0], /Swarmling.*weak.*\+0\.60/); // the largest tilt first (x1.90)
  assert.match(lines[1], /Armored Grunt.*strong.*-0\.60/); // x0.33
  g.counterCfg = { ...cfg, gain: 0.05 };
  assert.match(planForCounter(g, 9).decision.lines[0], /adapted only slightly/);
});

test('the plan follows the loadout as it changes (nothing is remembered)', () => {
  const g = make();
  g.towers = [{ type: 'mortar', level: 0 }];
  const a = planForCounter(g, 9).decision.tilt;
  g.towers = [{ type: 'lance', level: 0 }];
  const b = planForCounter(g, 9).decision.tilt;
  assert.ok(a.fastRunner > 1 && b.fastRunner === 1);
  assert.ok(b.swarmling > 1 && a.swarmling < 1);
});
