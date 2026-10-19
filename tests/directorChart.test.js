import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { createGame } from '../src/sim/game.js';
import { planWaveWithDecision } from '../src/sim/waves.js';
import { tiltChartModel, MARKERS, DASHES, PATTERNS } from '../src/ui/directorChart.js';

const cfg = config.director;
const dims = { width: 680, height: 180, padLeft: 44, padRight: 12, padTop: 10, padBottom: 24, tiltMax: cfg.tiltMax, totalWaves: 15 };
const flat = (v) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, v]));

/** Decisions for waves 1..n of a real adaptive game with scores that grow over time. */
function entries(n = 15) {
  const game = createGame({ seed: 1, mode: 'adaptive', totalWaves: 15 });
  const out = [];
  for (let w = 1; w <= n; w++) {
    game.director.scores = { armoredGrunt: -0.05 * w, swarmling: 0.04 * w, fastRunner: 0, regenerator: 0.1 * w, shieldedBruiser: -0.08 * w };
    out.push(planWaveWithDecision(game, w).decision);
  }
  return out;
}

test('points stay inside the plot rectangle and 1.0 sits on the baseline', () => {
  const m = tiltChartModel(entries(), dims);
  assert.equal(m.plotLeft, 44);
  assert.equal(m.plotRight, 680 - 12);
  assert.equal(m.baselineY, (m.plotTop + m.plotBottom) / 2);
  for (const s of m.series) {
    assert.equal(s.points.length, 15);
    for (const p of s.points) {
      assert.ok(p.x >= m.plotLeft && p.x <= m.plotRight, `x ${p.x}`);
      assert.ok(p.y >= m.plotTop && p.y <= m.plotBottom, `y ${p.y}`);
    }
  }
  const grunt = m.series.find((s) => s.type === 'armoredGrunt').points;
  assert.ok(grunt.at(-1).y > m.baselineY, 'a falling weight plots below the baseline');
  const fast = m.series.find((s) => s.type === 'fastRunner').points;
  assert.ok(fast.every((p) => p.y === m.baselineY), 'a score of 0 plots on the baseline');
  assert.ok(m.series.find((s) => s.type === 'regenerator').points.at(-1).y < m.baselineY, 'a rising weight plots above the baseline');
});

test('x is monotonic in wave and ticks include the first and last wave', () => {
  const m = tiltChartModel(entries(), dims);
  const xs = m.series[0].points.map((p) => p.x);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1]);
  assert.equal(xs[0], m.plotLeft);
  assert.equal(xs.at(-1), m.plotRight);
  const waves = m.xTicks.map((t) => t.wave);
  assert.equal(waves[0], 1);
  assert.equal(waves.at(-1), 15);
  assert.ok(waves.length >= 5 && waves.length <= 7);
  assert.deepEqual(waves, [...waves].sort((a, b) => a - b));
  assert.deepEqual(m.xTicks.map((t) => t.label), waves.map(String));
  assert.deepEqual(m.yTicks.map((t) => t.label), ['×0.33', '×1.00', '×3.00']);
  assert.equal(m.yTicks[1].y, m.baselineY);
  assert.equal(m.yTicks[0].y, m.plotBottom);
  assert.equal(m.yTicks[2].y, m.plotTop);
});

test('paths: syntax, one point, no points', () => {
  const m = tiltChartModel(entries(), dims);
  for (const s of m.series) assert.match(s.path, /^M -?\d+\.\d\d -?\d+\.\d\d( L -?\d+\.\d\d -?\d+\.\d\d)*$/);
  assert.equal(m.series[0].path.split(' L ').length, 15);
  const one = tiltChartModel(entries(1), dims);
  for (const s of one.series) assert.match(s.path, /^M -?\d+\.\d\d -?\d+\.\d\d$/);
  const none = tiltChartModel([], dims);
  for (const s of none.series) assert.deepEqual([s.path, s.points], ['', []]);
});

test('eligible flags follow the decisions and random entries plot their applied tilt', () => {
  const m = tiltChartModel(entries(), dims);
  const flags = m.series[0].points.map((p) => p.eligible);
  assert.deepEqual(flags.slice(0, 5), [false, false, false, false, true]); // waves 1-4 static, wave 5 eligible
  assert.equal(flags[9], false); // wave 10 is a set piece
  const game = createGame({ seed: 1, mode: 'random', totalWaves: 15 });
  const d = planWaveWithDecision(game, 12).decision;
  const r = tiltChartModel([d], dims);
  for (const s of r.series) assert.equal(s.points[0].tilt, d.tilt[s.type]);
});

test('markers, dashes and patterns cover exactly the five ids and are pairwise distinct', () => {
  for (const table of [MARKERS, DASHES, PATTERNS]) {
    assert.deepEqual(Object.keys(table), [...ENEMY_ORDER]);
    assert.equal(new Set(Object.values(table)).size, 5);
    assert.ok(Object.isFrozen(table));
  }
});

test('the model is deterministic', () => {
  const e = entries();
  assert.deepEqual(tiltChartModel(e, dims), tiltChartModel(e, dims));
  assert.deepEqual(tiltChartModel(e, { ...dims, totalWaves: 30 }).xTicks.at(-1).wave, 30);
  assert.ok(flat(1));
});
