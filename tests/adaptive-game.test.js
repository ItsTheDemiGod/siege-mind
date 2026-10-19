import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies.js';
import { STATIC_WAVES, STATIC_THREAT, hpMultiplierForWave, isAdaptiveEligible } from '../src/data/waves.js';
import { createGame, stepGame, snapshotGame } from '../src/sim/game.js';
import { EVENT_TYPES } from '../src/sim/events.js';
import { getWavePreview } from '../src/sim/waves.js';
import { planFor } from '../src/sim/director.js';
import { l1Distance } from '../src/sim/directorMath.js';
import { getBot } from '../experiments/bots.js';

const ACT_EVERY_TICKS = 120;
const tolFor = (target) => Math.max(config.waves.budgetTolerancePct * target, config.waves.budgetToleranceMin);
const staticComposition = (wave) => Object.fromEntries(STATIC_WAVES[wave - 1].groups.map((g) => [g.type, g.picks * ENEMIES[g.type].packSize]));

/** Play a whole game with a bot, recording what the Director decided and what actually spawned. */
function play({ mode, botName = 'balanced', totalWaves = 15, checkpoints = [], seed = 1, maxTicks = 600000 }) {
  const game = createGame({ seed, debugSpawnEveryTicks: 0, totalWaves, mode });
  const bot = getBot(botName);
  const started = [];
  const spawned = {};
  let lastPreview = null;
  game.events.on(EVENT_TYPES.WAVE_STARTED, (ev) => {
    started.push({ ev, preview: lastPreview, planned: mode === 'static' ? null : planFor(game, ev.wave).decision });
  });
  game.events.on(EVENT_TYPES.ENEMY_SPAWNED, (ev) => {
    const w = (spawned[ev.wave] ??= {});
    w[ev.type] = (w[ev.type] ?? 0) + 1;
  });
  const snaps = [];
  while (!game.over && game.tick < maxTicks) {
    const phase = game.waves.phase;
    if (phase !== 'running') lastPreview = getWavePreview(game);
    if (phase === 'prep' || phase === 'intermission' || game.tick % ACT_EVERY_TICKS === 0) bot.act(game);
    stepGame(game);
    if (checkpoints.includes(game.tick)) snaps.push(snapshotGame(game));
  }
  snaps.push(snapshotGame(game));
  return { game, started, spawned, snaps };
}

test('createGame accepts adaptive and random, rejects anything else, and static has no director', () => {
  for (const mode of ['adaptive', 'random']) {
    const g = createGame({ seed: 1, mode });
    assert.equal(g.director.mode, mode);
    assert.equal(g.mode, mode);
  }
  assert.equal(createGame({ seed: 1, mode: 'static' }).director, null);
  assert.equal(createGame({ seed: 1 }).director, null);
  for (const bad of ['x', 'Adaptive', '', 5, null]) assert.throws(() => createGame({ seed: 1, mode: bad }), RangeError, String(bad));
  assert.throws(() => createGame({ seed: 1, mode: 'adaptive', directorConfig: { alpha: 0 } }), RangeError);
});

const checkpoints = [1000, 15000, 30000, 45000, 60000];
const adaptive = play({ mode: 'adaptive', checkpoints });

test('an adaptive 15-wave game is deterministic', () => {
  const again = play({ mode: 'adaptive', checkpoints });
  assert.equal(again.snaps.length, checkpoints.length + 1);
  again.snaps.forEach((s, i) => assert.deepEqual(s, adaptive.snaps[i], `snapshot ${i}`));
});

test('what spawns is what the plan, the decision and the preview said', () => {
  assert.equal(adaptive.started.length, 15);
  for (const { ev, preview, planned } of adaptive.started) {
    assert.deepEqual(ev.director, planned, `decision of wave ${ev.wave}`);
    assert.deepEqual(adaptive.spawned[ev.wave], Object.fromEntries(Object.entries(ev.composition).filter(([, n]) => n > 0)), `spawned in wave ${ev.wave}`);
    assert.equal(preview.wave, ev.wave);
    assert.deepEqual(Object.fromEntries(preview.items.map((i) => [i.type, i.units])), Object.fromEntries(Object.entries(ev.composition).filter(([, n]) => n > 0)), `preview of wave ${ev.wave}`);
    assert.equal(preview.director.reason, ev.director.reason);
    assert.equal(preview.threat, ev.threat);
  }
});

test('fairness: same hp multiplier, names and fixed flags as static, static composition on non-eligible waves, threat within tolerance', () => {
  let maxDev = 0;
  let maxShift = 0;
  for (const { ev } of adaptive.started) {
    const w = ev.wave;
    assert.equal(ev.hpMult, hpMultiplierForWave(w));
    assert.equal(ev.name, STATIC_WAVES[w - 1].name);
    assert.equal(ev.fixed, STATIC_WAVES[w - 1].fixed);
    if (!isAdaptiveEligible(w, config.director)) assert.deepEqual(ev.composition, staticComposition(w), `wave ${w} must equal static`);
    const dev = Math.abs(ev.threat - STATIC_THREAT[w - 1]);
    maxDev = Math.max(maxDev, dev / tolFor(STATIC_THREAT[w - 1]));
    assert.ok(dev <= tolFor(STATIC_THREAT[w - 1]), `wave ${w} threat ${ev.threat} vs ${STATIC_THREAT[w - 1]}`);
    if (ev.director.eligible) maxShift = Math.max(maxShift, l1Distance(ev.director.finalShares, ev.director.templateShares));
  }
  console.log(`adaptive 15-wave run: max threat deviation = ${maxDev.toFixed(3)} x tolerance, max share shift (L1) = ${maxShift.toFixed(3)}`);
  for (const w of [1, 2, 3, 4, 6, 8, 10]) assert.deepEqual(adaptive.started[w - 1].ev.composition, staticComposition(w));
  assert.ok(maxShift >= 0.05, `the Director never moved the shares (max L1 ${maxShift})`);
});

test('static mode regression: a static 15-wave balanced game is unchanged', () => {
  const s = play({ mode: 'static', checkpoints });
  assert.equal(s.game.result, 'won');
  assert.equal(s.game.lives, 8);
  assert.equal(s.game.tick, 67979); // Phase 5 result: 18.9 game minutes
  assert.equal(s.snaps.at(-1).director, null);
  for (const { ev } of s.started) {
    assert.equal(ev.director, null);
    assert.deepEqual(ev.composition, staticComposition(ev.wave));
  }
});

test('a mid-game adaptive snapshot survives a JSON round trip', () => {
  const snap = adaptive.snaps[2];
  assert.ok(snap.director && snap.director.history.length > 0);
  assert.deepEqual(JSON.parse(JSON.stringify(snap)), snap);
});

test('a whole adaptive wave runs without Math.random', () => {
  const orig = Math.random;
  Math.random = () => { throw new Error('Math.random called'); };
  try {
    const r = play({ mode: 'adaptive', totalWaves: 15, maxTicks: 20000 });
    assert.ok(r.started.length >= 4);
    const r2 = play({ mode: 'random', totalWaves: 15, maxTicks: 20000 });
    assert.ok(r2.started.length >= 4);
  } finally {
    Math.random = orig;
  }
});

test('the none bot still loses early in adaptive and random mode', () => {
  for (const mode of ['adaptive', 'random']) {
    const r = play({ mode, botName: 'none', totalWaves: 30 });
    assert.equal(r.game.result, 'lost', mode);
    assert.ok(r.game.waves.current <= 3, `${mode}: lost at wave ${r.game.waves.current}`);
  }
  assert.ok(ENEMY_ORDER.length === 5);
});
