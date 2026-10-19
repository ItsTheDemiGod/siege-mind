import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { createGame, stepGame, snapshotGame, startGame } from '../src/sim/game.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { attachTelemetry } from '../src/sim/telemetry.js';
import { validateRun } from '../src/sim/telemetrySchema.js';
import { roundTree } from '../src/sim/telemetryRecords.js';
import { getBot } from '../experiments/bots.js';

const ACT_EVERY_TICKS = 120;

function run({ mode, telemetry, checkpoints = [] }) {
  const game = createGame({ seed: 1, debugSpawnEveryTicks: 0, totalWaves: 15, mode });
  const tele = telemetry ? attachTelemetry(game, { detail: telemetry }) : null;
  const directors = [];
  game.events.on(EVENT_TYPES.WAVE_STARTED, (ev) => directors.push(ev.director));
  startGame(game);
  const bot = getBot('balanced');
  const snaps = [];
  while (!game.over && game.tick < 600000) {
    const phase = game.waves.phase;
    if (phase === 'prep' || phase === 'intermission' || game.tick % ACT_EVERY_TICKS === 0) bot.act(game);
    stepGame(game);
    if (checkpoints.includes(game.tick)) snaps.push(snapshotGame(game));
  }
  snaps.push(snapshotGame(game));
  return { game, tele, directors, snaps };
}

const adaptive = run({ mode: 'adaptive', telemetry: 'full' });
const adaptiveRun = adaptive.tele.getRun();
const clone = () => JSON.parse(JSON.stringify(adaptiveRun));
const broken = (mutate) => { const r = clone(); mutate(r); return validateRun(r); };
const has = (problems, re) => assert.ok(problems.some((p) => re.test(p)), problems.join(' | '));

test('a 15-wave adaptive run with full telemetry is valid and stores the rounded decision of every wave', () => {
  assert.deepEqual(validateRun(adaptiveRun), []);
  assert.equal(adaptiveRun.meta.mode, 'adaptive');
  assert.equal(adaptiveRun.waves.length, adaptive.directors.length);
  adaptive.directors.forEach((d, i) => {
    assert.deepEqual(adaptiveRun.waves[i].director, roundTree(JSON.parse(JSON.stringify(d))), `wave ${i + 1}`);
    assert.equal(adaptiveRun.waves[i].director.wave, i + 1);
  });
});

test('a random run is valid too and static runs keep director null', () => {
  const random = run({ mode: 'random', telemetry: 'summary' });
  const r = random.tele.getRun();
  assert.deepEqual(validateRun(r), []);
  assert.ok(r.waves.every((w) => w.director.mode === 'random'));
  const s = run({ mode: 'static', telemetry: 'summary' }).tele.getRun();
  assert.deepEqual(validateRun(s), []);
  assert.ok(s.waves.every((w) => w.director === null));
});

test('telemetry stays observation-only in adaptive mode: identical snapshots with and without it', () => {
  const checkpoints = [1000, 15000, 30000, 45000, 60000];
  const without = run({ mode: 'adaptive', telemetry: false, checkpoints });
  const withIt = run({ mode: 'adaptive', telemetry: 'full', checkpoints });
  assert.equal(without.snaps.length, checkpoints.length + 1);
  without.snaps.forEach((s, i) => assert.deepEqual(withIt.snaps[i], s, `snapshot ${i}`));
});

test('attachDirector still works on an adaptive run (explicit API)', () => {
  const g = createGame({ seed: 2, debugSpawnEveryTicks: 0, mode: 'adaptive', startWave: 5 });
  const tele = attachTelemetry(g);
  const bot = getBot('balanced');
  bot.act(g);
  for (let i = 0; i < 10 && g.waves.phase !== 'running'; i++) { bot.act(g); stepGame(g); }
  assert.ok(g.waves.phase === 'running');
  tele.attachDirector(5, { note: 'explicit', x: 1.23456789 });
  assert.deepEqual(tele.getRun().waves[0].director, { note: 'explicit', x: 1.234568 });
});

test('validateRun: a static run must not have a director record', () => {
  const r = clone();
  r.meta.mode = 'static';
  has(validateRun(r), /a static run must not have a director record/);
});
test('validateRun: a Director run needs a record in every wave', () => has(broken((r) => { r.waves[2].director = null; }), /wave 3: missing director record/));
test('validateRun: the director record must be for the same wave', () => has(broken((r) => { r.waves[1].director.wave = 9; }), /wave 2: director record is for wave 9/));
test('validateRun: the director mode must equal the run mode', () => has(broken((r) => { r.waves[0].director.mode = 'random'; }), /director mode random differs from run mode adaptive/));
test('validateRun: the director reason must be known', () => has(broken((r) => { r.waves[0].director.reason = 'whim'; }), /unknown director reason whim/));
test('validateRun: tilt needs a positive number for every type', () => {
  has(broken((r) => { r.waves[5].director.tilt.swarmling = 0; }), /wave 6: director tilt needs a finite positive number/);
  has(broken((r) => { delete r.waves[5].director.tilt.fastRunner; }), /director tilt needs/);
});
test('validateRun: finalShares needs a non-negative number for every type', () => {
  has(broken((r) => { r.waves[5].director.finalShares.regenerator = -0.1; }), /director finalShares needs a finite non-negative number/);
  has(broken((r) => { delete r.waves[5].director.finalShares[ENEMY_ORDER[0]]; }), /director finalShares needs/);
});
