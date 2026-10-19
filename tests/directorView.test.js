import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { createGame } from '../src/sim/game.js';
import { planWaveWithDecision } from '../src/sim/waves.js';
import { tiltFromScores } from '../src/sim/directorMath.js';
import { tiltBarFraction, directionOf, directionByType, chartTilt, buildDirectorView } from '../src/ui/directorView.js';

const cfg = config.director;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const flat = (v) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, v]));

test('tiltBarFraction: 0 at 1, +/-1 at the ends, symmetric, clamped, validated', () => {
  const m = cfg.tiltMax;
  assert.equal(tiltBarFraction(1, m), 0);
  near(tiltBarFraction(m, m), 1);
  near(tiltBarFraction(1 / m, m), -1);
  for (const t of [1.2, 1.5, 2, 2.9]) near(tiltBarFraction(t, m), -tiltBarFraction(1 / t, m));
  assert.equal(tiltBarFraction(100, m), 1);
  assert.equal(tiltBarFraction(0.001, m), -1);
  near(tiltBarFraction(2, 3), 0.5);
  for (const bad of [0, -1, NaN, Infinity, '1']) assert.throws(() => tiltBarFraction(bad, m), RangeError);
  for (const bad of [1, 0.5, NaN]) assert.throws(() => tiltBarFraction(1.2, bad), RangeError);
});

test('directionOf boundaries use the configured ratio', () => {
  const r = config.report.directionRatio;
  assert.equal(directionOf(r), 'up');
  assert.equal(directionOf(r - 0.001), 'flat');
  assert.equal(directionOf(1), 'flat');
  assert.equal(directionOf(1 / r), 'down');
  assert.equal(directionOf(1 / r + 0.001), 'flat');
  assert.equal(directionOf(1.5, 2), 'flat');
  assert.equal(directionOf(0.4, 2), 'down');
});

test('directionByType shows marks only for adapted waves', () => {
  const tilt = { armoredGrunt: 0.5, swarmling: 1.3, fastRunner: 1, regenerator: 1.05, shieldedBruiser: 0.9 };
  assert.deepEqual(directionByType({ reason: 'adapted', tilt }), { armoredGrunt: 'down', swarmling: 'up', fastRunner: 'flat', regenerator: 'flat', shieldedBruiser: 'down' });
  for (const reason of ['cold-start', 'random', 'static-early', 'static-intro', 'static-fixed']) assert.deepEqual(directionByType({ reason, tilt }), flat('flat'), reason);
  assert.deepEqual(directionByType(null), flat('flat'));
});

test('chartTilt plots held weights for adaptive and the applied tilt for random', () => {
  const scores = { armoredGrunt: -0.5, swarmling: 0.5, fastRunner: 0, regenerator: 10, shieldedBruiser: -10 };
  const expected = { armoredGrunt: 1 - cfg.beta * 0.5, swarmling: 1 + cfg.beta * 0.5, fastRunner: 1, regenerator: cfg.tiltMax, shieldedBruiser: 1 / cfg.tiltMax };
  const adaptive = chartTilt({ mode: 'adaptive', scores, tilt: flat(1) });
  for (const t of ENEMY_ORDER) near(adaptive[t], expected[t]);
  assert.deepEqual(adaptive, tiltFromScores(scores, cfg));
  const random = { armoredGrunt: 2.1, swarmling: 0.4, fastRunner: 1, regenerator: 1.7, shieldedBruiser: 0.9 };
  assert.deepEqual(chartTilt({ mode: 'random', scores, tilt: random }), random);
  assert.notEqual(chartTilt({ mode: 'random', scores, tilt: random }), random);
});

function realDecision(wave, scores) {
  const game = createGame({ seed: 1, mode: 'adaptive', totalWaves: 15 });
  if (scores) game.director.scores = scores;
  return planWaveWithDecision(game, wave).decision;
}

test('buildDirectorView on a real adapted decision', () => {
  const d = realDecision(12, { armoredGrunt: -0.6, swarmling: 0.9, fastRunner: 0, regenerator: 0.2, shieldedBruiser: -0.2 });
  const v = buildDirectorView(d, { tiltMax: cfg.tiltMax });
  assert.equal(v.title, 'Director');
  assert.equal(v.reason, 'adapted');
  assert.equal(v.wave, 12);
  assert.deepEqual(v.rows.map((r) => r.type), [...ENEMY_ORDER]);
  near(v.rows.reduce((n, r) => n + r.finalShare, 0), 1);
  near(v.rows.reduce((n, r) => n + r.templateShare, 0), 1);
  for (const r of v.rows) {
    assert.equal(r.label, ENEMIES[r.type].name);
    near(r.shareDelta, r.finalShare - r.templateShare);
    assert.equal(r.units, 0); // nothing observed yet
    assert.ok(r.barFraction >= -1 && r.barFraction <= 1);
  }
  assert.equal(v.rows.find((r) => r.type === 'swarmling').direction, 'up');
  assert.equal(v.rows.find((r) => r.type === 'armoredGrunt').direction, 'down');
  assert.deepEqual(v.lines, d.lines);
  assert.notEqual(v.lines, d.lines);
});

test('buildDirectorView for random, cold start, null and static', () => {
  const rnd = realDecision(12);
  assert.equal(buildDirectorView(rnd, { tiltMax: cfg.tiltMax }).reason, 'cold-start');
  const game = createGame({ seed: 1, mode: 'random', totalWaves: 15 });
  const rv = buildDirectorView(planWaveWithDecision(game, 12).decision, { tiltMax: cfg.tiltMax });
  assert.equal(rv.title, 'Random control');
  assert.ok(rv.rows.every((r) => r.direction === 'flat'));
  const staticWave = buildDirectorView(realDecision(10), { tiltMax: cfg.tiltMax });
  assert.equal(staticWave.reason, 'static-fixed');
  assert.ok(staticWave.rows.every((r) => r.tilt === 1 && r.barFraction === 0));
  for (const none of [null, undefined, { mode: 'static' }]) assert.deepEqual(buildDirectorView(none, { tiltMax: 3 }), { mode: 'static', title: null, rows: [], lines: [] });
});
