import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { runCompare, formatCompare, evaluateHypotheses } from '../experiments/directorCompare.js';

const flat = (v = 1) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, v]));
/** Synthetic result row. lost = lives lost in the game; tilt overrides the final tilt of adaptive rows. */
function row(bot, mode, { seed = 1, lost = 5, wave = 15, tilt = {}, shift = 0.3 } = {}) {
  const adaptive = mode === 'adaptive';
  return {
    bot, mode, seed, result: wave === 15 && lost < config.game.startLives ? 'won' : 'lost', wave, lives: config.game.startLives - lost, minutes: 18,
    livesLostByWave: [lost], finalScores: adaptive ? flat(0) : null, finalTilt: adaptive ? { ...flat(1), ...tilt } : null, meanShift: adaptive ? shift : null,
  };
}
const verdict = (rows, id) => evaluateHypotheses(rows).find((h) => h.id === id);

test('H1: weak adaptive swarmling tilt above 1.15 passes, below fails, missing data is N/A', () => {
  assert.equal(verdict([row('weak', 'adaptive', { tilt: { swarmling: 1.3 } })], 'H1').pass, true);
  assert.equal(verdict([row('weak', 'adaptive', { tilt: { swarmling: 1.1 } })], 'H1').pass, false);
  assert.equal(verdict([row('weak', 'static')], 'H1').pass, null);
});

test('H2: monoMortar fastRunner tilt', () => {
  assert.equal(verdict([row('monoMortar', 'adaptive', { tilt: { fastRunner: 1.5 } })], 'H2').pass, true);
  assert.equal(verdict([row('monoMortar', 'adaptive', { tilt: { swarmling: 2 } })], 'H2').pass, false);
});

test('H3: monoSniper swarmling or fastRunner tilt', () => {
  assert.equal(verdict([row('monoSniper', 'adaptive', { tilt: { swarmling: 1.2 } })], 'H3').pass, true);
  assert.equal(verdict([row('monoSniper', 'adaptive', { tilt: { fastRunner: 1.2 } })], 'H3').pass, true);
  assert.equal(verdict([row('monoSniper', 'adaptive', { tilt: { shieldedBruiser: 2 } })], 'H3').pass, false);
});

test('H4: balanced shieldedBruiser or regenerator tilt', () => {
  assert.equal(verdict([row('balanced', 'adaptive', { tilt: { regenerator: 1.3 } })], 'H4').pass, true);
  assert.equal(verdict([row('balanced', 'adaptive', { tilt: { shieldedBruiser: 1.3 } })], 'H4').pass, true);
  assert.equal(verdict([row('balanced', 'adaptive', { tilt: { armoredGrunt: 2 } })], 'H4').pass, false);
});

test('tilts are averaged over seeds', () => {
  const rows = [row('weak', 'adaptive', { seed: 1, tilt: { swarmling: 1.4 } }), row('weak', 'adaptive', { seed: 2, tilt: { swarmling: 0.8 } })];
  assert.equal(verdict(rows, 'H1').pass, false); // mean 1.1
});

test('H5: harder than static on every bot', () => {
  const pass = [row('weak', 'static', { lost: 4, wave: 15 }), row('weak', 'adaptive', { lost: 8, wave: 14 }), row('balanced', 'static', { lost: 4 }), row('balanced', 'adaptive', { lost: 4 })];
  assert.equal(verdict(pass, 'H5').pass, true);
  const failLives = [row('weak', 'static', { lost: 8 }), row('weak', 'adaptive', { lost: 4 })];
  assert.equal(verdict(failLives, 'H5').pass, false);
  const failWave = [row('weak', 'static', { lost: 20, wave: 10 }), row('weak', 'adaptive', { lost: 20, wave: 12 })];
  assert.equal(verdict(failWave, 'H5').pass, false);
  assert.equal(verdict([row('weak', 'adaptive')], 'H5').pass, null);
});

test('H6: at least 3 of the 4 bots lose at least as many lives as under the random control', () => {
  const bots = ['weak', 'monoMortar', 'monoSniper', 'balanced'];
  const make = (worse) => bots.flatMap((b, i) => [row(b, 'adaptive', { lost: i < worse ? 9 : 3 }), row(b, 'random', { lost: 6 })]);
  assert.equal(verdict(make(3), 'H6').pass, true);
  assert.equal(verdict(make(4), 'H6').pass, true);
  assert.equal(verdict(make(2), 'H6').pass, false);
  assert.match(verdict(make(3), 'H6').detail, /^3 of 4/);
  assert.equal(verdict([row('weak', 'static')], 'H6').pass, null);
});

test('formatCompare has all tables, aligned columns and stable output', () => {
  const rows = [];
  for (const bot of ['weak', 'balanced']) for (const mode of ['static', 'adaptive', 'random']) for (const seed of [1, 2]) rows.push(row(bot, mode, { seed, lost: seed * 3, tilt: { swarmling: 1.25 } }));
  const text = formatCompare(rows);
  assert.equal(text, formatCompare(rows));
  for (const title of ['Mean over seeds per bot and mode', 'Adaptive: final tilt per enemy type (mean over seeds) and mean share shift', 'Director versus the controls (differences of the means)', 'Hypotheses (report only, never used to tune)']) {
    assert.ok(text.includes(title), title);
  }
  const lines = text.split('\n');
  const first = lines.indexOf('Mean over seeds per bot and mode');
  assert.equal(lines[first + 2].length, lines[first + 1].length);
  assert.equal(lines.slice(first + 3, first + 9).length, 6);
  assert.ok(lines.some((l) => /^balanced\s+adaptive\s+2\s+2\/2/.test(l)));
  assert.ok(lines.some((l) => l.startsWith('PASS  H1')));
});

test('runCompare on a tiny configuration returns well-formed rows', () => {
  const rows = runCompare({ bots: ['balanced'], modes: ['static', 'adaptive'], seeds: [1], waves: 15 });
  assert.equal(rows.length, 2);
  const [s, a] = rows;
  for (const r of rows) {
    assert.deepEqual(Object.keys(r), ['bot', 'mode', 'seed', 'result', 'wave', 'lives', 'minutes', 'livesLostByWave', 'finalScores', 'finalTilt', 'meanShift']);
    assert.equal(r.bot, 'balanced');
    assert.ok(['won', 'lost'].includes(r.result));
    assert.ok(Array.isArray(r.livesLostByWave) && r.livesLostByWave.length >= 1);
    assert.ok(Number.isFinite(r.minutes));
  }
  assert.equal(s.mode, 'static');
  assert.equal(s.finalTilt, null);
  assert.equal(s.meanShift, null);
  assert.equal(s.lives, 8); // Phase 5 value for balanced seed 1, 15 waves
  assert.deepEqual(Object.keys(a.finalTilt), [...ENEMY_ORDER]);
  assert.ok(a.meanShift > 0);
  assert.deepEqual(runCompare({ bots: ['balanced'], modes: ['adaptive'], seeds: [1], waves: 15 })[0], a);
});
