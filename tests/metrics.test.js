import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { metricsFromRun, tiltAlignedOf, tiltAtWave, METRIC_COLUMNS } from '../experiments/metrics.js';
import { PROTOCOL } from '../experiments/protocol.js';
import { LEGACY_FOCUS_PREDICTIONS } from '../experiments/legacyPredictions.js'; // tiltAlignedOf tests use the archived focus styles (approved reversal A2)
import { playGame } from '../experiments/playthrough.js';
import { getBot } from '../experiments/bots.js';

const cost = { armoredGrunt: 10, swarmling: 3, fastRunner: 8, regenerator: 16, shieldedBruiser: 24 };
const defs = Object.fromEntries(ENEMY_ORDER.map((t) => [t, { threatCost: cost[t] }]));
const bt = (o = {}) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, { spawned: 0, killed: 0, leaked: 0, progressSum: 0, ...(o[t] ?? {}) }]));
const shares = (o) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, o[t] ?? 0]));
const zero = shares({});

function miniRun(mode = 'adaptive') {
  const d = (wave, extra) => ({ wave, mode, scores: zero, tilt: shares({ armoredGrunt: 1, swarmling: 1, fastRunner: 1, regenerator: 1, shieldedBruiser: 1 }), templateShares: shares({ armoredGrunt: 0.5, swarmling: 0.5 }), finalShares: shares({ armoredGrunt: 0.5, swarmling: 0.5 }), ...extra });
  const scores = { armoredGrunt: -0.5, swarmling: 0.5, fastRunner: 0, regenerator: 5, shieldedBruiser: -5 };
  const withDir = mode !== 'static';
  return {
    meta: { mode, totalWaves: 15, startLives: 20 },
    result: { result: 'lost', wave: 3, lives: 0, seconds: 600 },
    definitions: { enemies: defs },
    totals: { leaked: 5, towersBuilt: 7, upgrades: 2, damageBySource: { lance: 100, mortar: 300, frost: 0, poison: 100, sniper: 0, debug: 0, other: 0 } },
    waves: [
      { wave: 1, complete: true, livesLost: 0, byType: bt({ armoredGrunt: { spawned: 4, killed: 4, progressSum: 1.6 } }), director: withDir ? d(1, { eligible: false, reason: 'static-early' }) : null },
      { wave: 2, complete: true, livesLost: 2, byType: bt({ armoredGrunt: { spawned: 6, killed: 5, leaked: 1, progressSum: 4 }, swarmling: { spawned: 8, killed: 8, progressSum: 2 } }), director: withDir ? d(2, { eligible: true, reason: 'cold-start' }) : null },
      {
        wave: 3, complete: false, livesLost: 18,
        byType: bt({ regenerator: { spawned: 3, killed: 1, leaked: 2, progressSum: 3 }, shieldedBruiser: { spawned: 2, killed: 0, leaked: 2, progressSum: 2 } }),
        director: withDir ? d(3, { eligible: true, reason: mode === 'adaptive' ? 'adapted' : 'random', scores, tilt: shares({ armoredGrunt: 0.4, swarmling: 2.5, fastRunner: 1, regenerator: 1.2, shieldedBruiser: 0.9 }), finalShares: shares({ armoredGrunt: 0.3, swarmling: 0.7 }) }) : null,
      },
    ],
  };
}

test('hand-built adaptive run: every field has its hand-computed value', () => {
  const m = metricsFromRun(miniRun());
  const expected = {
    result: 'lost', won: 0, finalWave: 3, completedWaves: 2, livesLeft: 0, livesLost: 20, minutes: 10, spawnedThreat: 220, leakedUnits: 5, leakedThreat: 90,
    leakFraction: 0.409091, penetration: 0.718182, towersBuilt: 7, upgrades: 2,
    dmgShare_lance: 0.2, dmgShare_mortar: 0.6, dmgShare_frost: 0, dmgShare_poison: 0.2, dmgShare_sniper: 0,
    eligibleWaves: 2, adaptedWaves: 1, meanShiftFrac: 0.1,
    // approved reversal (Phase 8B, amendment A1): the final tilt is the applied tilt of the last ELIGIBLE record, not the held weights
    tilt_armoredGrunt: 0.4, tilt_swarmling: 2.5, tilt_fastRunner: 1, tilt_regenerator: 1.2, tilt_shieldedBruiser: 0.9, tiltObserved: 1,
  };
  for (const [k, v] of Object.entries(expected)) assert.equal(m[k], v, k);
  assert.deepEqual(m.livesLostByWave, [0, 2, 18, ...Array(12).fill(null)]);
  assert.equal(m.livesLostByWave.length, 15);
});

test('static runs have tilt 1, no adapted waves and no shift; random runs take the applied tilt of the last record', () => {
  const s = metricsFromRun(miniRun('static'));
  for (const t of ENEMY_ORDER) assert.equal(s[`tilt_${t}`], 1);
  assert.equal(s.tiltObserved, 0);
  assert.deepEqual([s.eligibleWaves, s.adaptedWaves, s.meanShiftFrac], [0, 0, 0]);
  const r = metricsFromRun(miniRun('random'));
  assert.deepEqual([r.tilt_armoredGrunt, r.tilt_swarmling, r.tilt_fastRunner, r.tilt_regenerator, r.tilt_shieldedBruiser], [0.4, 2.5, 1, 1.2, 0.9]);
  assert.equal(r.tiltObserved, 1);
  assert.equal(r.adaptedWaves, 0);
  assert.equal(r.eligibleWaves, 2);
});

test('A1: the last ELIGIBLE record is used even when later records are not eligible (both modes)', () => {
  for (const mode of ['adaptive', 'random']) {
    const run = miniRun(mode);
    run.waves[1].director.tilt = shares({ armoredGrunt: 0.7, swarmling: 1.9, fastRunner: 1.3, regenerator: 1, shieldedBruiser: 1 });
    run.waves[2].director.eligible = false;
    run.waves[2].director.reason = 'static-fixed';
    run.waves[2].director.tilt = shares({ armoredGrunt: 1, swarmling: 1, fastRunner: 1, regenerator: 1, shieldedBruiser: 1 });
    const m = metricsFromRun(run);
    assert.deepEqual([m.tilt_armoredGrunt, m.tilt_swarmling, m.tilt_fastRunner, m.tiltObserved], [0.7, 1.9, 1.3, 1], mode);
  }
});

test('A1: adaptive tilts are the applied tilt of the record, not tiltFromScores of its scores', () => {
  const run = miniRun('adaptive');
  run.waves[2].director.scores = shares({ armoredGrunt: 4, swarmling: -4 }); // would give 3 and 1/3 under the Phase 8A definition
  const m = metricsFromRun(run);
  assert.deepEqual([m.tilt_armoredGrunt, m.tilt_swarmling], [0.4, 2.5]);
});

test('A1: a game with no eligible record, and static games, have tiltObserved 0, tilts 1 and no alignment', () => {
  const none = miniRun('adaptive');
  for (const w of none.waves) w.director.eligible = false;
  const m = metricsFromRun(none);
  assert.equal(m.tiltObserved, 0);
  for (const t of ENEMY_ORDER) assert.equal(m[`tilt_${t}`], 1);
  assert.equal(tiltAlignedOf('lanceHeavy', { ...m, tilt_swarmling: 5 }, LEGACY_FOCUS_PREDICTIONS, PROTOCOL.stats.alignmentThreshold), null, 'tiltObserved 0 gives null even with a high tilt');
  const s = metricsFromRun(miniRun('static'));
  assert.equal(s.tiltObserved, 0);
  assert.equal(tiltAlignedOf('mortarHeavy', s, LEGACY_FOCUS_PREDICTIONS, PROTOCOL.stats.alignmentThreshold), null);
  assert.equal(tiltAlignedOf('mortarHeavy', { ...metricsFromRun(miniRun('adaptive')), tilt_fastRunner: 1.2 }, LEGACY_FOCUS_PREDICTIONS, PROTOCOL.stats.alignmentThreshold), 1);
});

test('a won game with no damage or threat does not divide by zero', () => {
  const run = miniRun('static');
  run.result = { result: 'won', wave: 15, lives: 20, seconds: 60 };
  run.waves = [{ wave: 1, complete: true, livesLost: 0, byType: bt(), director: null }];
  run.totals = { ...run.totals, leaked: 0, damageBySource: Object.fromEntries(['lance', 'mortar', 'frost', 'poison', 'sniper', 'debug', 'other'].map((k) => [k, 0])) };
  const m = metricsFromRun(run);
  assert.deepEqual([m.won, m.livesLost, m.leakFraction, m.penetration, m.dmgShare_lance], [1, 0, 0, 0, 0]);
});

test('tiltAlignedOf truth table', () => {
  const row = (o) => ({ tilt_swarmling: 1, tilt_fastRunner: 1, tilt_shieldedBruiser: 1, ...o });
  const p = LEGACY_FOCUS_PREDICTIONS;
  const th = PROTOCOL.stats.alignmentThreshold;
  assert.equal(tiltAlignedOf('balancedR', row({}), p, th), null);
  assert.equal(tiltAlignedOf('lanceHeavy', row({ tilt_swarmling: 1.15 }), p, th), 1);
  assert.equal(tiltAlignedOf('lanceHeavy', row({ tilt_swarmling: 1.1499 }), p, th), 0);
  assert.equal(tiltAlignedOf('mortarHeavy', row({ tilt_fastRunner: 2 }), p, th), 1);
  assert.equal(tiltAlignedOf('poisonHeavy', row({ tilt_shieldedBruiser: 1.3 }), p, th), 1);
  assert.equal(tiltAlignedOf('poisonHeavy', row({ tilt_fastRunner: 0.5, tilt_shieldedBruiser: 1.0 }), p, th), 0);
  assert.equal(tiltAlignedOf('sniperHeavy', row({ tilt_swarmling: 0.4, tilt_fastRunner: 1.2 }), p, th), 1);
  assert.equal(tiltAlignedOf('sniperHeavy', row({}), p, th), 0);
});

const real = {};
for (const mode of PROTOCOL.modes) real[mode] = playGame({ seed: 1, totalWaves: 15, bot: getBot('balanced'), mode, telemetry: 'summary' });

test('a real run reconciles with the playthrough in every mode', () => {
  for (const mode of PROTOCOL.modes) {
    const r = real[mode];
    const m = metricsFromRun(r.run);
    assert.equal(m.livesLost, 20 - r.lives, mode);
    assert.equal(m.won, r.result === 'won' ? 1 : 0);
    assert.equal(m.finalWave, r.wave);
    assert.equal(m.leakedUnits, r.run.totals.leaked);
    assert.equal(m.leakedUnits, r.stats.leaks);
    assert.ok(Math.abs(m.dmgShare_lance + m.dmgShare_mortar + m.dmgShare_frost + m.dmgShare_poison + m.dmgShare_sniper - 1) < 1e-5);
    for (const k of ['penetration', 'leakFraction']) assert.ok(m[k] >= 0 && m[k] <= 1, k);
    assert.equal(m.livesLostByWave.filter((x) => x !== null).reduce((a, b) => a + b, 0), m.livesLost);
    assert.equal(m.minutes, Math.round(r.minutes * 1e6) / 1e6);
    assert.deepEqual(metricsFromRun(r.run), m);
  }
  assert.equal(metricsFromRun(real.static.run).tilt_swarmling, 1);
  assert.equal(metricsFromRun(real.static.run).tiltObserved, 0);
  for (const mode of ['adaptive', 'random']) {
    const last = [...real[mode].run.waves].reverse().find((w) => w.director.eligible);
    const m = metricsFromRun(real[mode].run);
    assert.equal(m.tiltObserved, 1, mode);
    for (const t of ENEMY_ORDER) assert.equal(m[`tilt_${t}`], Math.round(last.director.tilt[t] * 1e6) / 1e6, `${mode} ${t}`);
  }
  assert.ok(metricsFromRun(real.adaptive.run).adaptedWaves >= 1);
  assert.ok(metricsFromRun(real.adaptive.run).meanShiftFrac > 0);
  assert.equal(metricsFromRun(real.static.run).livesLost, 12);
  assert.equal(metricsFromRun(real.adaptive.run).livesLost, 19);
  assert.equal(metricsFromRun(real.random.run).livesLost, 15);
});

test('every METRIC_COLUMNS entry is produced by the metrics plus the three experiment fields', () => {
  const m = { style: 'x', mode: 'y', seed: 1, tiltAligned: null, ...metricsFromRun(real.adaptive.run) };
  for (const c of METRIC_COLUMNS) assert.ok(c in m, c);
  assert.equal(new Set(METRIC_COLUMNS).size, METRIC_COLUMNS.length);
  assert.ok(!METRIC_COLUMNS.includes('livesLostByWave'));
});

test('9A-2a: tiltByWave holds the applied tilt of eligible records only, null elsewhere; tiltAtWave reads it', () => {
  const run = miniRun('adaptive'); // wave 1 not eligible, waves 2 (tilt all 1) and 3 (tilt 0.4 / 2.5 / 1 / 1.2 / 0.9) eligible
  const m = metricsFromRun(run);
  assert.equal(m.tiltByWave.length, 15);
  assert.equal(m.tiltByWave[0], null);
  assert.deepEqual(m.tiltByWave[1], { armoredGrunt: 1, swarmling: 1, fastRunner: 1, regenerator: 1, shieldedBruiser: 1 });
  assert.deepEqual(m.tiltByWave[2], { armoredGrunt: 0.4, swarmling: 2.5, fastRunner: 1, regenerator: 1.2, shieldedBruiser: 0.9 });
  assert.ok(m.tiltByWave.slice(3).every((x) => x === null));
  assert.deepEqual(tiltAtWave(m, 3), m.tiltByWave[2]);
  assert.equal(tiltAtWave(m, 1), null);
  assert.equal(tiltAtWave(m, 15), null);
  assert.equal(tiltAtWave({}, 3), null);
  // the last eligible record agrees with the tilt_* columns (amendment A1 is unchanged)
  const last = [...m.tiltByWave].reverse().find((x) => x);
  for (const t of ENEMY_ORDER) assert.equal(m[`tilt_${t}`], last[t]);
  // a later non-eligible record does not hide the earlier eligible tilt
  run.waves[2].director.eligible = false;
  const m2 = metricsFromRun(run);
  assert.equal(m2.tiltByWave[2], null);
  assert.deepEqual(m2.tiltByWave[1], m.tiltByWave[1]);
  assert.equal(m2.tilt_swarmling, 1);
  // static runs: all null
  assert.ok(metricsFromRun(miniRun('static')).tiltByWave.every((x) => x === null));
  assert.ok(!METRIC_COLUMNS.includes('tiltByWave'));
});

test('9A-2a: real runs of every mode produce well-formed rows that reconcile with tiltByWave', () => {
  for (const mode of ['static', 'adaptive', 'random', 'adaptive2', 'counter']) {
    const r = playGame({ seed: 1, bot: getBot('balanced'), mode, totalWaves: 15, telemetry: 'summary' });
    const m = metricsFromRun(r.run);
    assert.equal(m.tiltByWave.length, 15, mode);
    for (const [i, x] of m.tiltByWave.entries()) {
      if (x === null) continue;
      assert.deepEqual(Object.keys(x), [...ENEMY_ORDER], `${mode} wave ${i + 1}`);
      assert.ok(ENEMY_ORDER.every((t) => Number.isFinite(x[t]) && x[t] > 0));
    }
    const observed = m.tiltByWave.filter(Boolean);
    assert.equal(m.eligibleWaves, mode === 'static' ? 0 : observed.length, mode);
    if (mode === 'static') { assert.equal(m.tiltObserved, 0); continue; }
    assert.equal(m.tiltObserved, 1, mode);
    for (const t of ENEMY_ORDER) assert.equal(m[`tilt_${t}`], observed.at(-1)[t], `${mode} ${t}`);
    assert.ok(!/NaN|undefined/.test(JSON.stringify(m)));
  }
});
