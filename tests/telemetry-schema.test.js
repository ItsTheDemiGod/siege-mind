import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { TOWER_ORDER } from '../src/data/towers.js';
import {
  SCHEMA_VERSION, ENEMY_TYPE_IDS, TOWER_TYPE_IDS, SOURCE_IDS, sourceIndex, roundTo, emptySourceCounts, emptyTypeStats, emptyByType,
  emptyTowerActivity, finalizeTypeStats, ENEMY_CSV_COLUMNS, WAVE_CSV_COLUMNS, WAVE_TYPE_CSV_COLUMNS, TOWER_CSV_COLUMNS, validateRun,
} from '../src/sim/telemetrySchema.js';

const STEP = config.sim.stepSeconds;
const DIGITS = config.telemetry.floatDigits;

test('constants come from the data modules', () => {
  assert.equal(SCHEMA_VERSION, config.telemetry.schemaVersion);
  assert.deepEqual(ENEMY_TYPE_IDS, ENEMY_ORDER);
  assert.deepEqual(TOWER_TYPE_IDS, TOWER_ORDER);
  assert.equal(SOURCE_IDS.length, TOWER_ORDER.length + 2);
  assert.deepEqual([...SOURCE_IDS], [...TOWER_ORDER, 'debug', 'other']);
  assert.ok(Object.isFrozen(SOURCE_IDS));
});

test('sourceIndex maps tower ids to their slot, debug to its slot and anything else to other', () => {
  TOWER_ORDER.forEach((id, i) => assert.equal(sourceIndex(id), i));
  assert.equal(sourceIndex('debug'), TOWER_ORDER.length);
  for (const v of ['other', 'laser', '', undefined, null, 7]) assert.equal(sourceIndex(v), TOWER_ORDER.length + 1);
});

test('roundTo rounds, normalizes -0 and validates its input', () => {
  assert.equal(roundTo(1.23456789, 0), 1);
  assert.equal(roundTo(1.23456789, 2), 1.23);
  assert.equal(roundTo(1.23456789, DIGITS), 1.234568);
  assert.ok(Object.is(roundTo(-0, 2), 0));
  assert.ok(Object.is(roundTo(-0.0000001, 2), 0));
  assert.equal(roundTo(-2.5, 0), -2);
  for (const bad of [NaN, Infinity, -Infinity]) assert.throws(() => roundTo(bad, 2), TypeError);
  assert.throws(() => roundTo('1', 2), TypeError);
  for (const bad of [-1, 10, 1.5, NaN, undefined]) assert.throws(() => roundTo(1, bad), RangeError);
});

test('factories return fresh objects every call and never share nested objects', () => {
  const a = emptyTypeStats();
  const b = emptyTypeStats();
  assert.notEqual(a, b);
  assert.notEqual(a.damageBySource, b.damageBySource);
  assert.notEqual(a.damageBySource, a.killedBySource);
  a.damageBySource.lance = 5;
  assert.equal(b.damageBySource.lance, 0);
  assert.deepEqual(Object.keys(emptySourceCounts()), [...SOURCE_IDS]);
  assert.ok(Object.values(emptySourceCounts()).every((v) => v === 0));
  const x = emptyByType();
  const y = emptyByType();
  assert.deepEqual(Object.keys(x), [...ENEMY_ORDER]);
  assert.notEqual(x.swarmling, y.swarmling);
  assert.notEqual(x.swarmling, x.armoredGrunt);
  assert.deepEqual(Object.keys(emptyTowerActivity()), [...TOWER_ORDER]);
  assert.notEqual(emptyTowerActivity().lance, emptyTowerActivity().lance);
});

test('finalizeTypeStats: nothing spawned gives zeros, never NaN', () => {
  const f = finalizeTypeStats(emptyTypeStats(), STEP, DIGITS);
  assert.deepEqual([f.leakRate, f.meanProgress, f.meanTimeAliveSeconds], [0, 0, 0]);
});

test('finalizeTypeStats: only leaked, mixed and rounding', () => {
  const onlyLeaked = { ...emptyTypeStats(), spawned: 4, leaked: 4, progressSum: 4, timeAliveTicksSum: 240 };
  const l = finalizeTypeStats(onlyLeaked, STEP, DIGITS);
  assert.equal(l.leakRate, 1);
  assert.equal(l.meanProgress, 1);
  assert.equal(l.meanTimeAliveSeconds, roundTo((240 * STEP) / 4, DIGITS));

  const mixed = { ...emptyTypeStats(), spawned: 3, killed: 2, leaked: 1, progressSum: 0.5 + 0.25 + 1, timeAliveTicksSum: 100 };
  const m = finalizeTypeStats(mixed, STEP, DIGITS);
  assert.equal(m.leakRate, roundTo(1 / 3, DIGITS));
  assert.equal(m.meanProgress, roundTo(1.75 / 3, DIGITS));
  assert.equal(m.meanTimeAliveSeconds, roundTo((100 * STEP) / 3, DIGITS));
  mixed.damageBySource.lance = 1 / 3;
  assert.equal(finalizeTypeStats(mixed, STEP, DIGITS).damageBySource.lance, roundTo(1 / 3, DIGITS));
  assert.notEqual(finalizeTypeStats(mixed, STEP, DIGITS).damageBySource, mixed.damageBySource);
});

test('column lists are frozen, unique and have the expected shape', () => {
  const lists = { ENEMY_CSV_COLUMNS, WAVE_CSV_COLUMNS, WAVE_TYPE_CSV_COLUMNS, TOWER_CSV_COLUMNS };
  const lengths = { ENEMY_CSV_COLUMNS: 22, WAVE_CSV_COLUMNS: 31, WAVE_TYPE_CSV_COLUMNS: 23, TOWER_CSV_COLUMNS: 21 };
  for (const [name, list] of Object.entries(lists)) {
    assert.ok(Object.isFrozen(list), name);
    assert.equal(new Set(list).size, list.length, `${name} has duplicates`);
    assert.equal(list.length, lengths[name], name);
  }
  assert.equal(ENEMY_CSV_COLUMNS[0], 'id');
  assert.equal(WAVE_CSV_COLUMNS.at(-1), 'towers_sniper');
  for (const t of ENEMY_ORDER) assert.ok(TOWER_CSV_COLUMNS.includes(`dmg_vs_${t}`));
});

// ---------- validateRun ----------
function validRun() {
  const byType = () => {
    const b = emptyByType();
    b.armoredGrunt = { ...b.armoredGrunt, spawned: 3, killed: 2, leaked: 1, progressSum: 2.5 };
    return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, finalizeTypeStats(v, STEP, DIGITS)]));
  };
  const wave = (n) => ({ wave: n, name: null, fixed: false, complete: true, spawnedUnits: 3, killed: 2, leaked: 1, livesLost: 1, byType: byType() });
  const sources = emptySourceCounts();
  sources.lance = 10;
  return {
    schemaVersion: SCHEMA_VERSION, meta: { detail: 'full' }, config: {}, definitions: {}, result: {},
    totals: { spawned: 6, killed: 4, leaked: 2, livesLost: 3 },
    offWave: { byType: Object.fromEntries(Object.entries(emptyByType()).map(([k, v]) => [k, finalizeTypeStats(v, STEP, DIGITS)])), towerActivity: emptyTowerActivity(), livesLost: 1 },
    waves: [wave(1), wave(2)],
    towers: [{ id: 1, type: 'lance', sold: false, soldWave: null, refund: null, finalLevel: 0, upgrades: [], damageDealt: 10 }],
    enemies: [
      { id: 1, outcome: 'killed', progress: 0.5, damageTaken: 10, damageBySource: sources },
      { id: 2, outcome: 'leaked', progress: 1, damageTaken: 0, damageBySource: emptySourceCounts() },
    ],
  };
}
const broken = (mutate) => { const r = validRun(); mutate(r); return validateRun(r); };
const only = (problems, re) => { assert.equal(problems.length, 1, problems.join(' | ')); assert.match(problems[0], re); };

test('validateRun accepts a valid full run and a valid summary run', () => {
  assert.deepEqual(validateRun(validRun()), []);
  const summary = validRun();
  summary.meta.detail = 'summary';
  delete summary.enemies;
  assert.deepEqual(validateRun(summary), []);
});

test('validateRun: wrong schemaVersion', () => only(broken((r) => { r.schemaVersion = 99; }), /schemaVersion is 99/));
test('validateRun: missing top-level key', () => only(broken((r) => { delete r.offWave; }), /missing top-level key: offWave/));
test('validateRun: enemies are required in full detail', () => only(broken((r) => { delete r.enemies; }), /missing top-level key: enemies/));
test('validateRun: non-increasing wave numbers', () => only(broken((r) => { r.waves[1].wave = 1; }), /not strictly increasing at wave 1/));
test('validateRun: spawned does not sum to spawnedUnits', () => only(broken((r) => { r.waves[0].spawnedUnits = 4; }), /does not sum to spawnedUnits/));
test('validateRun: killed + leaked above spawned', () => {
  const p = broken((r) => { r.waves[0].byType.armoredGrunt.killed = 3; r.waves[0].killed = 3; r.totals.killed = 5; });
  assert.ok(p.some((s) => /armoredGrunt killed \+ leaked exceeds spawned/.test(s)), p.join('|'));
});
test('validateRun: complete wave must account for every unit', () => {
  const p = broken((r) => { r.waves[0].byType.armoredGrunt.leaked = 0; r.waves[0].leaked = 0; r.totals.leaked = 1; r.offWave.livesLost = 1; });
  assert.ok(p.some((s) => /not equal to spawned in a complete wave/.test(s)), p.join('|'));
});
test('validateRun: per-type killed does not sum to wave killed', () => {
  const p = broken((r) => { r.waves[0].killed = 5; });
  assert.ok(p.some((s) => /per-type killed does not sum to the wave killed/.test(s)), p.join('|'));
});
test('validateRun: per-type leaked does not sum to wave leaked', () => {
  const p = broken((r) => { r.waves[0].leaked = 5; });
  assert.ok(p.some((s) => /per-type leaked does not sum to the wave leaked/.test(s)), p.join('|'));
});
test('validateRun: negative or non-finite numbers', () => {
  assert.ok(broken((r) => { r.waves[0].livesLost = -1; }).some((s) => /waves\[0\]\.livesLost is not a finite number >= 0/.test(s)));
  assert.ok(broken((r) => { r.towers[0].damageDealt = NaN; }).some((s) => /towers\[0\]\.damageDealt is not a finite number/.test(s)));
});
test('validateRun: meanProgress outside [0,1]', () => {
  const p = broken((r) => { r.waves[0].byType.armoredGrunt.meanProgress = 1.5; });
  assert.ok(p.some((s) => /armoredGrunt meanProgress is outside \[0,1\]/.test(s)), p.join('|'));
});
test('validateRun: enemy progress outside [0,1]', () => only(broken((r) => { r.enemies[0].progress = 1.2; }), /enemy 1: progress is outside/));
test('validateRun: a leaked enemy must have progress 1', () => only(broken((r) => { r.enemies[1].progress = 0.9; }), /enemy 2: a leaked enemy must have progress 1/));
test('validateRun: duplicate enemy ids', () => only(broken((r) => { r.enemies[1].id = 1; }), /enemy id 1 is duplicated/));
test('validateRun: unknown outcome', () => only(broken((r) => { r.enemies[0].outcome = 'vanished'; }), /unknown outcome vanished/));
test('validateRun: damageTaken differs from damageBySource', () => only(broken((r) => { r.enemies[0].damageTaken = 11; }), /damageTaken differs from the sum of damageBySource/));
for (const key of ['spawned', 'killed', 'leaked', 'livesLost']) {
  test(`validateRun: totals.${key} differs from the sum`, () => {
    const p = broken((r) => { r.totals[key] += 1; });
    assert.ok(p.some((s) => s.startsWith(`totals.${key} `)), p.join('|'));
  });
}
test('validateRun: duplicate tower ids', () => {
  const p = broken((r) => { r.towers.push({ ...r.towers[0] }); });
  assert.ok(p.some((s) => /tower id 1 is duplicated/.test(s)), p.join('|'));
});
test('validateRun: a sold tower needs soldWave and a refund', () => only(broken((r) => { r.towers[0].sold = true; }), /tower 1: sold needs soldWave and refund >= 0/));
test('validateRun: finalLevel must match the upgrade list', () => only(broken((r) => { r.towers[0].finalLevel = 2; }), /finalLevel differs/));
test('validateRun rejects non-objects', () => assert.deepEqual(validateRun(null), ['run is not an object']));
