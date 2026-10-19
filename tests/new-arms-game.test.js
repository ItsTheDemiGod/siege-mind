// Whole-game tests of the two research arms ('adaptive2' and 'counter'): determinism, fairness invariants, static waves where required.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMIES } from '../src/data/enemies.js';
import { STATIC_WAVES, STATIC_THREAT, hpMultiplierForWave } from '../src/data/waves.js';
import { createGame, stepGame, snapshotGame, GAME_MODES } from '../src/sim/game.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { getWavePreview, planWaveWithDecision } from '../src/sim/waves.js';
import { attachTelemetry } from '../src/sim/telemetry.js';
import { validateRun } from '../src/sim/telemetryValidate.js';
import { getBot } from '../experiments/bots.js';
import { playGame } from '../experiments/playthrough.js';
import { createStyleBot } from '../experiments/styleBots.js';

const ARMS = ['adaptive2', 'counter'];
const ACT_EVERY_TICKS = 120;
const tolFor = (target) => Math.max(config.waves.budgetTolerancePct * target, config.waves.budgetToleranceMin);
const compOf = (groups) => Object.fromEntries(groups.map((g) => [g.type, g.picks * ENEMIES[g.type].packSize]));

/** Play a whole game with a bot, recording starts, spawned units and the preview of each started wave. */
function play({ mode, botName = 'balanced', seed = 1, checkpoints = [], telemetry = false, maxTicks = 600000, totalWaves = 15 }) {
  const game = createGame({ seed, debugSpawnEveryTicks: 0, totalWaves, mode });
  if (telemetry) attachTelemetry(game, { detail: 'summary' });
  const bot = getBot(botName);
  const started = [];
  const spawned = {};
  game.events.on(EVENT_TYPES.WAVE_STARTED, (ev) => {
    // The balanced bot starts waves from inside its own act call, so a preview taken before the bot acted could be stale for the counter arm. Instead the
    // preview is recomputed at the start event from a copy of the game that is back in the intermission: same towers, same director state, no building in between.
    const before = getWavePreview({ ...game, waves: { ...game.waves, phase: 'intermission', nextWave: ev.wave } });
    started.push({ ev, preview: before, planned: planWaveWithDecision(game, ev.wave), previewComp: compOf(before.items.map((i) => ({ type: i.type, picks: i.picks }))) });
  });
  game.events.on(EVENT_TYPES.ENEMY_SPAWNED, (ev) => { const w = (spawned[ev.wave] ??= {}); w[ev.type] = (w[ev.type] ?? 0) + 1; });
  const snaps = [];
  while (!game.over && game.tick < maxTicks) {
    const phase = game.waves.phase;
    if (phase === 'prep' || phase === 'intermission' || game.tick % ACT_EVERY_TICKS === 0) bot.act(game);
    stepGame(game);
    if (checkpoints.includes(game.tick)) snaps.push(snapshotGame(game));
  }
  snaps.push(snapshotGame(game));
  return { game, started, spawned, snaps };
}

test('createGame accepts the two new modes, rejects anything else; the mode list is the five modes', () => {
  assert.deepEqual([...GAME_MODES], ['static', 'adaptive', 'random', 'adaptive2', 'counter']);
  for (const mode of ARMS) {
    const g = createGame({ seed: 1, mode });
    assert.equal(g.mode, mode);
    assert.equal(g.director.mode, mode);
  }
  for (const bad of ['x', 'Adaptive2', 'counter ', '', 5, null]) assert.throws(() => createGame({ seed: 1, mode: bad }), RangeError, String(bad));
  assert.throws(() => createGame({ seed: 1, mode: 'adaptive2', directorV2Config: { shrinkK: -1 } }), RangeError);
  assert.throws(() => createGame({ seed: 1, mode: 'counter', counterConfig: { gain: -1 } }), RangeError);
});

let maxDev = 0;
for (const mode of ARMS) {
  const checkpoints = [1000, 15000, 30000, 45000, 60000];
  const run = play({ mode, checkpoints });

  test(`${mode}: a full balanced-bot 15-wave game is deterministic (snapshots at 5 checkpoints)`, () => {
    const again = play({ mode, checkpoints });
    assert.equal(again.snaps.length, checkpoints.length + 1);
    again.snaps.forEach((s, i) => assert.deepEqual(s, run.snaps[i], `snapshot ${i}`));
    assert.equal(run.started.length, 15);
    assert.equal(run.game.over, true);
  });

  test(`${mode}: waves 1-4, 6, 8 and 10 are identical to static; the spawned units equal the plan; hpMult equals the static value`, () => {
    for (const { ev } of run.started) {
      assert.equal(ev.hpMult, hpMultiplierForWave(ev.wave), `wave ${ev.wave} hpMult`);
      assert.equal(ev.mode, mode);
    }
    for (const w of [1, 2, 3, 4, 6, 8, 10]) {
      const s = run.started[w - 1];
      assert.deepEqual(compOf(STATIC_WAVES[w - 1].groups), run.spawned[w], `wave ${w} spawned`);
      assert.equal(s.ev.director.eligible, false, `wave ${w}`);
      assert.equal(s.ev.threat, STATIC_THREAT[w - 1]);
    }
    for (const s of run.started) assert.deepEqual(s.ev.director, s.planned.decision, `wave ${s.ev.wave}: the started decision equals the planner's`);
    for (const { ev } of run.started) assert.deepEqual(run.spawned[ev.wave], compOf(planGroupsOf(run, ev.wave)), `wave ${ev.wave} spawned equals the plan`);
  });

  test(`${mode}: the realized threat of every wave is within the data tolerance of STATIC_THREAT`, () => {
    for (const { ev } of run.started) {
      const target = STATIC_THREAT[ev.wave - 1];
      const dev = Math.abs(ev.threat - target) / tolFor(target);
      maxDev = Math.max(maxDev, dev);
      assert.ok(Math.abs(ev.threat - target) <= tolFor(target), `wave ${ev.wave}`);
      assert.equal(ev.director.threatTarget, target);
    }
  });

  test(`${mode}: the wave preview (taken with no building in between) equals the composition that spawned`, () => {
    let checked = 0;
    for (const s of run.started) {
      checked++;
      assert.deepEqual(s.previewComp, run.spawned[s.ev.wave], `wave ${s.ev.wave}`);
      assert.deepEqual(s.preview.director, { eligible: s.ev.director.eligible, reason: s.ev.director.reason });
    }
    assert.equal(checked, 15);
  });

  test(`${mode}: the none bot still loses at wave <= 3`, () => {
    const r = play({ mode, botName: 'none' });
    assert.equal(r.game.result, 'lost');
    assert.ok(r.game.waves.current <= 3, `lost at wave ${r.game.waves.current}`);
  });

  test(`${mode}: independent of telemetry (identical snapshots with and without a collector)`, () => {
    const withT = play({ mode, checkpoints, telemetry: true });
    withT.snaps.forEach((s, i) => assert.deepEqual(s, run.snaps[i], `snapshot ${i}`));
  });

  test(`${mode}: no Math.random during a whole game prefix`, () => {
    const original = Math.random;
    Math.random = () => { throw new Error('Math.random was called in the sim'); };
    try { play({ mode, maxTicks: 12000 }); } finally { Math.random = original; }
  });

  test(`${mode}: validateRun accepts a summary telemetry run and rejects a wrong director.mode`, () => {
    const r = playGame({ seed: 1, bot: getBot('balanced'), mode, totalWaves: 15, telemetry: 'summary' });
    assert.deepEqual(validateRun(r.run), []);
    assert.equal(r.run.meta.mode, mode);
    const broken = JSON.parse(JSON.stringify(r.run));
    broken.waves[8].director.mode = 'adaptive';
    assert.ok(validateRun(broken).some((p) => /director mode adaptive differs from run mode/.test(p)));
    const noRecord = JSON.parse(JSON.stringify(r.run));
    noRecord.waves[3].director = null;
    assert.ok(validateRun(noRecord).some((p) => /missing director record/.test(p)));
  });

  test(`${mode}: the units that end before wave 5 are identical to static (seeds 1001-1005, two styles)`, () => {
    for (const style of ['balancedR', 'noLance']) {
      for (let seed = 1001; seed <= 1005; seed++) {
        const end = (m) => playGame({ seed, bot: createStyleBot(style), mode: m, totalWaves: 15 }).wave;
        assert.equal(end(mode) < 5, end('static') < 5, `${style}/${seed}`);
      }
    }
  });
}

/** The plan groups at start, taken from the recorded planner output. */
function planGroupsOf(run, wave) {
  return run.started[wave - 1].planned.plan.groups;
}

test('report the maximum threat deviation of the new arms', () => {
  console.log(`new arms 15-wave runs: max threat deviation = ${maxDev.toFixed(3)} x tolerance`);
  assert.ok(maxDev <= 1);
});
