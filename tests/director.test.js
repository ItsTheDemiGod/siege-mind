import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { STATIC_WAVES, STATIC_THREAT, WAVE_TEMPLATES, isAdaptiveEligible, planThreat } from '../src/data/waves.js';
import { createGame, stepGame, snapshotGame } from '../src/sim/game.js';
import { spawnEnemyNow } from '../src/sim/enemies.js';
import { applyDamage } from '../src/sim/damage.js';
import { startNextWave } from '../src/sim/waveRunner.js';
import { planFor, explainDecision, DECISION_KEYS, createDirectorState } from '../src/sim/director.js';
import { computeObservation, updateScores, l1Distance } from '../src/sim/directorMath.js';

const cfg = config.director;
const tolFor = (target) => Math.max(config.waves.budgetTolerancePct * target, config.waves.budgetToleranceMin);
const mk = (mode, opts = {}) => createGame({ seed: 3, debugSpawnEveryTicks: 0, startGold: 100000, mode, ...opts });
const kill = (game, e, distance) => { e.distance = distance; e.prevDistance = distance; return applyDamage(game, e, { amount: 1e9, kind: 'direct', armorPierce: true, source: 'lance', towerId: -1 }); };
const eligibleWaves = Array.from({ length: 30 }, (_, i) => i + 1).filter((w) => isAdaptiveEligible(w, cfg));
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

/** Open wave `startWave` with its queue emptied. */
function openWave(mode = 'adaptive', startWave = 5) {
  const game = mk(mode, { startWave });
  startNextWave(game);
  game.spawnQueue.length = 0;
  return game;
}

test('observations are credited to the SPAWN wave, even when the enemy dies after the next wave started', () => {
  const game = openWave();
  const a = spawnEnemyNow(game, 'armoredGrunt');
  game.waves.phase = 'intermission'; // pretend wave 5 is over so wave 6 can start (the enemy is still alive)
  startNextWave(game);
  game.spawnQueue.length = 0;
  const half = game.map.path.totalLength / 2;
  kill(game, a, half);
  const d = game.director;
  assert.equal(d.acc[5].armoredGrunt.units, 1);
  near(d.acc[5].armoredGrunt.progressSum, game.map.path.progressAt(half));
  assert.equal(d.acc[6], undefined);
  assert.deepEqual(d.enemyWave, {});
});

test('debug spawns between waves are ignored and later events about unknown ids are counted', () => {
  const game = mk('adaptive', { startWave: 5 });
  const e = spawnEnemyNow(game, 'swarmling'); // phase prep: not observed
  assert.deepEqual(game.director.acc, {});
  assert.deepEqual(game.director.enemyWave, {});
  kill(game, e, 100);
  assert.equal(game.director.ignoredEvents, 1);
  assert.deepEqual(game.director.acc, {});
});

/** Wave 5 with a killed grunt, a killed swarmling pack member and a leaked runner; returns the game after WAVE_ENDED. */
function scriptedWave(mode = 'adaptive') {
  const game = openWave(mode);
  const total = game.map.path.totalLength;
  const g = spawnEnemyNow(game, 'armoredGrunt');
  const s1 = spawnEnemyNow(game, 'swarmling');
  const s2 = spawnEnemyNow(game, 'swarmling');
  const r = spawnEnemyNow(game, 'fastRunner');
  kill(game, g, total * 0.5);
  kill(game, s1, total * 0.25);
  kill(game, s2, total * 0.75);
  r.distance = total - 0.01;
  r.prevDistance = r.distance;
  stepGame(game); // the runner leaks, nothing is left: the wave ends in this step
  return { game, total };
}

test('a scripted wave produces the hand-computed history entry', () => {
  const { game, total } = scriptedWave();
  const d = game.director;
  assert.equal(d.history.length, 1);
  const h = d.history[0];
  assert.equal(h.wave, 5);
  assert.equal(d.lastObservedWave, 5);
  assert.deepEqual(d.acc, {});
  const stats = Object.fromEntries(ENEMY_ORDER.map((t) => [t, { units: 0, leaked: 0, progressSum: 0 }]));
  stats.armoredGrunt = { units: 1, leaked: 0, progressSum: game.map.path.progressAt(total * 0.5) };
  stats.swarmling = { units: 2, leaked: 0, progressSum: game.map.path.progressAt(total * 0.25) + game.map.path.progressAt(total * 0.75) };
  stats.fastRunner = { units: 1, leaked: 1, progressSum: 1 };
  const expected = computeObservation(stats, ENEMIES, cfg);
  near(h.average, expected.average);
  for (const t of ENEMY_ORDER) {
    near(h.types[t].reward, expected.types[t].reward);
    near(h.types[t].advantage, expected.types[t].advantage);
    assert.equal(h.types[t].units, stats[t].units);
  }
  assert.equal(h.types.fastRunner.leaked, 1);
  assert.equal(h.types.fastRunner.meanProgress, 1);
  const scores = updateScores(Object.fromEntries(ENEMY_ORDER.map((t) => [t, 0])), expected, cfg);
  for (const t of ENEMY_ORDER) near(d.scores[t], scores[t]);
});

test('scores update for observed types and decay for the rest in the next wave', () => {
  const { game } = scriptedWave();
  const before = { ...game.director.scores };
  assert.notEqual(before.fastRunner, 0);
  game.waves.phase = 'intermission';
  startNextWave(game);
  game.spawnQueue.length = 0;
  const g = spawnEnemyNow(game, 'armoredGrunt');
  kill(game, g, game.map.path.totalLength * 0.4);
  stepGame(game); // wave 6 ends with only grunts observed
  const after = game.director.scores;
  assert.equal(game.director.history.length, 2);
  near(after.fastRunner, cfg.decay * before.fastRunner);
  near(after.swarmling, cfg.decay * before.swarmling);
  near(after.regenerator, 0);
  assert.equal(game.director.lastObservedWave, 6);
});

test('history is trimmed to historyLimit', () => {
  const game = mk('adaptive', { directorConfig: { historyLimit: 2 }, startWave: 5 });
  for (let i = 0; i < 4; i++) {
    startNextWave(game);
    game.spawnQueue.length = 0;
    stepGame(game);
    game.waves.phase = 'intermission';
  }
  assert.equal(game.director.history.length, 2);
  assert.deepEqual(game.director.history.map((h) => h.wave), [7, 8]);
});

test('planFor is pure: repeated calls are deep-equal and the game snapshot is unchanged', () => {
  const { game } = scriptedWave();
  const before = JSON.stringify(snapshotGame(game));
  const a = planFor(game, 12);
  const b = planFor(game, 12);
  const c = planFor(game, 12);
  assert.deepEqual(a, b);
  assert.deepEqual(b, c);
  assert.equal(JSON.stringify(snapshotGame(game)), before);
  const rnd = mk('random');
  const r0 = JSON.stringify(rnd.rngs.main.getState());
  planFor(rnd, 12);
  assert.equal(JSON.stringify(rnd.rngs.main.getState()), r0);
});

test('cold start: the adaptive plan equals the golden static plan for every eligible wave', () => {
  const game = mk('adaptive');
  assert.equal(eligibleWaves.length, 21);
  for (const w of eligibleWaves) {
    const { plan, decision } = planFor(game, w);
    assert.equal(plan, STATIC_WAVES[w - 1], `wave ${w}`);
    assert.equal(decision.reason, 'cold-start');
    assert.equal(decision.eligible, true);
    assert.deepEqual(decision.finalShares, WAVE_TEMPLATES[w - 1].shares);
    assert.equal(decision.threatRealized, STATIC_THREAT[w - 1]);
  }
});

test('non-eligible waves return exactly the static plan with the right reason in every mode', () => {
  const reasons = { 1: 'static-early', 2: 'static-early', 3: 'static-early', 4: 'static-early', 6: 'static-intro', 8: 'static-intro', 10: 'static-fixed', 20: 'static-fixed', 30: 'static-fixed' };
  for (const mode of ['adaptive', 'random']) {
    const game = mk(mode);
    game.director.scores = { armoredGrunt: -1, swarmling: 2, fastRunner: 1, regenerator: -0.5, shieldedBruiser: 0.7 };
    for (const [w, reason] of Object.entries(reasons)) {
      const { plan, decision } = planFor(game, Number(w));
      assert.equal(plan, STATIC_WAVES[w - 1], `${mode} wave ${w}`);
      assert.equal(decision.reason, reason);
      assert.equal(decision.eligible, false);
      assert.ok(Object.values(decision.tilt).every((t) => t === 1));
      assert.deepEqual(decision.finalShares, WAVE_TEMPLATES[w - 1].shares);
    }
  }
});

test('injected scores move the shares toward the best type and away from the worst, within the threat tolerance', () => {
  const game = mk('adaptive');
  game.director.scores = { armoredGrunt: -0.6, swarmling: 0.9, fastRunner: 0, regenerator: 0.2, shieldedBruiser: -0.2 };
  for (const w of eligibleWaves) {
    const { plan, decision } = planFor(game, w);
    const tpl = WAVE_TEMPLATES[w - 1].shares;
    assert.equal(decision.reason, 'adapted');
    assert.ok(decision.finalShares.swarmling > tpl.swarmling, `wave ${w}: best share rises`);
    assert.ok(decision.finalShares.armoredGrunt < tpl.armoredGrunt, `wave ${w}: worst share falls`);
    assert.ok(Math.abs(planThreat(plan.groups) - STATIC_THREAT[w - 1]) <= tolFor(STATIC_THREAT[w - 1]), `wave ${w} threat`);
    assert.equal(decision.threatRealized, planThreat(plan.groups));
    near(ENEMY_ORDER.reduce((n, t) => n + decision.finalShares[t], 0), 1);
  }
});

test('random mode: deterministic per seed and wave, independent of the main rng, different across seeds and waves, ignores scores', () => {
  const a = mk('random');
  const b = mk('random');
  for (let i = 0; i < 500; i++) b.rngs.main.next(); // consuming the main stream must not matter
  assert.deepEqual(planFor(a, 12), planFor(b, 12));
  assert.notDeepEqual(planFor(a, 12).decision.tilt, planFor(a, 13).decision.tilt);
  assert.notDeepEqual(planFor(a, 12).decision.tilt, planFor(mk('random', { seed: 99 }), 12).decision.tilt);
  const before = planFor(a, 12);
  a.director.scores = { armoredGrunt: 2, swarmling: -1, fastRunner: 1, regenerator: -1, shieldedBruiser: 0.5 };
  const after = planFor(a, 12);
  assert.deepEqual(after.decision.tilt, before.decision.tilt);
  assert.deepEqual(after.plan, before.plan);
  assert.equal(after.decision.reason, 'random');
  assert.ok(l1Distance(after.decision.finalShares, WAVE_TEMPLATES[11].shares) > 0);
});

test('random mode records observations like adaptive does', () => {
  const adaptive = scriptedWave('adaptive').game;
  const random = scriptedWave('random').game;
  assert.deepEqual(random.director.scores, adaptive.director.scores);
  assert.deepEqual(random.director.history, adaptive.director.history);
});

test('explainDecision has a line for every reason', () => {
  const game = mk('adaptive');
  for (const [w, reason] of [[1, 'static-early'], [6, 'static-intro'], [10, 'static-fixed'], [12, 'cold-start']]) {
    const { decision } = planFor(game, w);
    assert.equal(decision.reason, reason);
    assert.equal(decision.lines.length, 1);
    assert.ok(decision.lines[0].length > 10);
  }
  assert.match(planFor(mk('random'), 12).decision.lines[0], /Random control/);
  const { game: played } = scriptedWave();
  played.director.scores = { armoredGrunt: -0.5, swarmling: 0.4, fastRunner: 1.2, regenerator: 0.05, shieldedBruiser: 0 };
  const { decision } = planFor(played, 12);
  assert.equal(decision.reason, 'adapted');
  assert.ok(decision.lines.length >= 1 && decision.lines.length <= 3);
  assert.match(decision.lines[0], /^Fast Runner: weight x2\.20, earned \d+\.\dx the wave-average reward last wave \(1 of 1 leaked\)$/);
  const small = { ...decision, tilt: Object.fromEntries(ENEMY_ORDER.map((t) => [t, 1.05])) };
  assert.match(explainDecision(small)[0], /slightly/);
});

test('the decision has exactly the documented keys and survives a JSON round trip, as does the director state', () => {
  const { game } = scriptedWave();
  game.director.scores.swarmling = 0.5;
  const { decision } = planFor(game, 12);
  assert.deepEqual(Object.keys(decision), [...DECISION_KEYS]);
  assert.deepEqual(JSON.parse(JSON.stringify(decision)), decision);
  assert.deepEqual(JSON.parse(JSON.stringify(game.director)), game.director);
  assert.deepEqual(createDirectorState('random'), JSON.parse(JSON.stringify(createDirectorState('random'))));
  assert.deepEqual(decision.observed.fastRunner.leaked, 1);
  assert.equal(decision.basedOnWave, 5);
});
