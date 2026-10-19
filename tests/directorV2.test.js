import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { STATIC_WAVES, STATIC_THREAT, WAVE_TEMPLATES, isAdaptiveEligible } from '../src/data/waves.js';
import { createGame, snapshotGame } from '../src/sim/game.js';
import { EVENT_TYPES, createEventBus } from '../src/sim/events.js';
import { planForV2, DECISION_KEYS_V2, explainDecisionV2, createDirectorV2State, wireDirectorV2 } from '../src/sim/directorV2.js';
import { tiltFromScores } from '../src/sim/directorMath.js';
import { planWaveWithDecision } from '../src/sim/waves.js';

const cfg = config.directorV2;
const tolFor = (target) => Math.max(config.waves.budgetTolerancePct * target, config.waves.budgetToleranceMin);
const make = (over = {}) => createGame({ seed: 1, debugSpawnEveryTicks: 0, totalWaves: 15, mode: 'adaptive2', ...over });
const scores = (o) => ({ armoredGrunt: 0, swarmling: 0, fastRunner: 0, regenerator: 0, shieldedBruiser: 0, ...o });

test('cold start equals the static plan for EVERY eligible wave, with reason cold-start', () => {
  const g = make();
  for (let w = 1; w <= 30; w++) {
    const { plan, decision } = planForV2(g, w);
    assert.deepEqual(plan, STATIC_WAVES[w - 1], `wave ${w}`);
    if (isAdaptiveEligible(w, cfg)) assert.equal(decision.reason, 'cold-start', `wave ${w}`);
  }
});

test('non-eligible waves return the static plan with the right reason, even with strong scores', () => {
  const g = make();
  g.director.scores = scores({ armoredGrunt: -0.9, shieldedBruiser: 0.9 });
  const expected = { 1: 'static-early', 2: 'static-early', 3: 'static-early', 4: 'static-early', 6: 'static-intro', 8: 'static-intro', 10: 'static-fixed', 20: 'static-fixed', 30: 'static-fixed' };
  for (const [w, reason] of Object.entries(expected)) {
    const { plan, decision } = planForV2(g, Number(w));
    assert.deepEqual(plan, STATIC_WAVES[w - 1]);
    assert.equal(decision.reason, reason);
    assert.equal(decision.eligible, false);
    assert.deepEqual(decision.tilt, Object.fromEntries(ENEMY_ORDER.map((t) => [t, 1])));
    assert.equal(decision.lines.length, 1);
  }
});

test('injected scores raise the favoured share, lower the other, and keep the threat within the data tolerance', () => {
  const g = make();
  g.director.scores = scores({ armoredGrunt: -0.8, shieldedBruiser: 0.8 });
  for (const wave of [9, 11, 12, 13, 14, 15]) {
    const { decision } = planForV2(g, wave);
    assert.equal(decision.reason, 'adapted', `wave ${wave}`);
    assert.deepEqual(decision.tilt, tiltFromScores(g.director.scores, cfg));
    assert.ok(decision.finalShares.shieldedBruiser > decision.templateShares.shieldedBruiser, `wave ${wave} bruiser`);
    if (decision.templateShares.armoredGrunt > 0) assert.ok(decision.finalShares.armoredGrunt < decision.templateShares.armoredGrunt, `wave ${wave} grunt`);
    assert.ok(Math.abs(decision.threatRealized - STATIC_THREAT[wave - 1]) <= tolFor(STATIC_THREAT[wave - 1]), `wave ${wave} threat`);
    assert.equal(decision.threatTarget, STATIC_THREAT[wave - 1]);
  }
});

test('planForV2 is pure: three calls deep-equal and the game snapshot is unchanged', () => {
  const g = make();
  g.director.scores = scores({ swarmling: 0.5, fastRunner: -0.4 });
  const before = JSON.stringify(snapshotGame(g));
  const a = planForV2(g, 12);
  assert.deepEqual(planForV2(g, 12), a);
  assert.deepEqual(planForV2(g, 12), a);
  assert.equal(JSON.stringify(snapshotGame(g)), before);
  const states = JSON.stringify(g.rngs.main.getState());
  planForV2(g, 12);
  assert.equal(JSON.stringify(g.rngs.main.getState()), states, 'no rng consumed');
});

test('decision keys, version, mode, arm, and a JSON round trip of the state and the decision', () => {
  const g = make();
  g.director.scores = scores({ regenerator: 0.6 });
  const { decision } = planForV2(g, 9);
  assert.deepEqual(Object.keys(decision).sort(), [...DECISION_KEYS_V2].sort());
  assert.deepEqual([decision.version, decision.mode, decision.arm], [2, 'adaptive2', 'adaptive2']);
  assert.deepEqual(JSON.parse(JSON.stringify(decision)), decision);
  assert.deepEqual(JSON.parse(JSON.stringify(g.director)), g.director);
  assert.deepEqual(Object.keys(decision.observed.armoredGrunt).sort(), ['advantage', 'leaked', 'meanProgress', 'norm', 'reward', 'shrunk', 'threatShare', 'threatSpent', 'units', 'updated']);
});

test('explain lines: every reason, the adapted template, and the slight-adaptation line', () => {
  const g = make();
  assert.match(planForV2(g, 2).decision.lines[0], /too early/);
  assert.match(planForV2(g, 6).decision.lines[0], /introduces a new enemy type/);
  assert.match(planForV2(g, 10).decision.lines[0], /fixed set piece/);
  assert.match(planForV2(g, 9).decision.lines[0], /No evidence yet/);
  g.director.scores = scores({ shieldedBruiser: 0.8, armoredGrunt: -0.5, swarmling: 0.4, fastRunner: -0.3 });
  g.director.history.push({ wave: 8, average: 1.2, types: Object.fromEntries(ENEMY_ORDER.map((t) => [t, { units: 4, leaked: 1, meanProgress: 0.5, threatSpent: 10, threatShare: 0.2, reward: 0.1, norm: 1.5, advantage: 0.25, shrunk: 0.1, updated: true }])) });
  const lines = planForV2(g, 9).decision.lines;
  assert.equal(lines.length, 3);
  for (const l of lines) assert.match(l, /^[A-Z][A-Za-z ]+: weight x\d\.\d\d, earned \d\.\dx the expected reward for its type and wave \(1 of 4 leaked\)$/);
  assert.ok(lines[0].startsWith(ENEMIES.shieldedBruiser.name), 'largest tilt first');
  g.director.scores = scores({ armoredGrunt: 0.04 });
  assert.match(planForV2(g, 9).decision.lines[0], /adapted only slightly/);
  assert.deepEqual(explainDecisionV2({ reason: 'adapted', wave: 9, tilt: Object.fromEntries(ENEMY_ORDER.map((t) => [t, 1.5])), observed: Object.fromEntries(ENEMY_ORDER.map((t) => [t, { units: 1, leaked: 0, norm: 0, advantage: 1 }])) }, 0).length, 3);
});

test('observations are attributed to the enemy SPAWN wave and wave-0 spawns are ignored', () => {
  const bus = createEventBus(); // a bare bus: the full game also wires economy, stats and waves, which need complete payloads
  const game = { events: bus, waves: { phase: 'prep', current: 0 }, director: createDirectorV2State() };
  wireDirectorV2(game);
  const d = game.director;
  bus.emit(EVENT_TYPES.ENEMY_SPAWNED, { id: 99, type: 'armoredGrunt', wave: 0 }); // a debug spawn before any wave
  bus.emit(EVENT_TYPES.ENEMY_KILLED, { id: 99, type: 'armoredGrunt', progress: 0.3 });
  assert.deepEqual([Object.keys(d.acc).length, d.ignoredEvents], [0, 1]);
  game.waves.phase = 'running';
  game.waves.current = 5;
  bus.emit(EVENT_TYPES.ENEMY_SPAWNED, { id: 1, type: 'armoredGrunt', wave: 5 });
  bus.emit(EVENT_TYPES.ENEMY_SPAWNED, { id: 2, type: 'armoredGrunt', wave: 5 });
  bus.emit(EVENT_TYPES.ENEMY_SPAWNED, { id: 3, type: 'regenerator', wave: 5 }); // a second type so that the advantages are not all 0
  game.waves.current = 6; // wave 5 is over, its stragglers still count for wave 5
  bus.emit(EVENT_TYPES.ENEMY_KILLED, { id: 1, type: 'armoredGrunt', progress: 0.4 });
  bus.emit(EVENT_TYPES.ENEMY_LEAKED, { id: 2, type: 'armoredGrunt' });
  bus.emit(EVENT_TYPES.ENEMY_KILLED, { id: 3, type: 'regenerator', progress: 0.9 });
  assert.deepEqual(d.acc[5].armoredGrunt, { units: 2, leaked: 1, progressSum: 1.4 });
  bus.emit(EVENT_TYPES.WAVE_ENDED, { wave: 5 });
  assert.equal(d.history.length, 1);
  assert.equal(d.history[0].wave, 5);
  assert.equal(d.lastObservedWave, 5);
  assert.equal(d.acc[5], undefined);
  assert.ok(d.history[0].types.armoredGrunt.norm > 0);
  // scores are updated on every finished wave, including one with nothing spawned (everything decays toward 0)
  const before = JSON.stringify(d.scores);
  bus.emit(EVENT_TYPES.WAVE_ENDED, { wave: 6 });
  assert.equal(d.history.length, 2);
  assert.notEqual(JSON.stringify(d.scores), before);
});

test('the history is capped at historyLimit', () => {
  const bus = createEventBus();
  const game = { events: bus, waves: { phase: 'prep', current: 0 }, director: createDirectorV2State(), directorV2Cfg: { ...cfg, historyLimit: 3 } };
  wireDirectorV2(game);
  for (let w = 1; w <= 6; w++) bus.emit(EVENT_TYPES.WAVE_ENDED, { wave: w });
  assert.deepEqual(game.director.history.map((h) => h.wave), [4, 5, 6]);
});

test('the game wiring dispatches to v2 and the preview equals the plan', () => {
  const g = make();
  g.director.scores = scores({ regenerator: 0.7, armoredGrunt: -0.6 });
  g.waves.nextWave = 9;
  const { plan, decision } = planWaveWithDecision(g, 9);
  assert.equal(decision.mode, 'adaptive2');
  assert.equal(decision.reason, 'adapted');
  assert.deepEqual(decision, planForV2(g, 9).decision);
  assert.equal(plan.wave, 9);
  assert.equal(WAVE_TEMPLATES[8].fixed, false);
});
