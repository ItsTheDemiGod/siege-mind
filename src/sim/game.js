// Top-level game state and the fixed-step update.
import { config } from '../data/config.js';
import { DEFAULT_MAP } from '../data/map.js';
import { ENEMY_ORDER } from '../data/enemies.js';
import { createRng } from './rng.js';
import { createEventBus, EVENT_TYPES } from './events.js';
import { createMap } from './map.js';
import { queueEnemy, stepEnemies } from './enemies.js';
import { stepProjectiles } from './projectiles.js';
import { stepTowers, getTowerById } from './towers.js';
import { wireEconomy } from './economy.js';
import { wireLives } from './lives.js';
import { createStats, wireStats } from './stats.js';
import { createWavesState, wireWaves, stepWaves, freezeInterpolation } from './waveRunner.js';
import { createDirectorState, wireDirector } from './director.js';
import { validateDirectorConfig } from './directorMath.js';
import { createDirectorV2State, wireDirectorV2 } from './directorV2.js';
import { createCounterState } from './directorCounter.js';
import { createPriorState, validatePriorConfig } from './directorPrior.js';
import { validateDirectorV2Config, validateCounterConfig } from './directorMathV2.js';

export const GAME_MODES = Object.freeze(['static', 'adaptive', 'random', 'adaptive2', 'counter', 'prior']);

/**
 * Create a new game (plain-object state).
 * @param {{seed: number|string, mapDef?: object, events?: object, debugSpawnEveryTicks?: number, startGold?: number, startLives?: number,
 *   mode?: 'static'|'adaptive'|'random'|'adaptive2'|'counter'|'prior', startWave?: number, wavesConfig?: object, totalWaves?: 15|30, directorConfig?: object, directorV2Config?: object, counterConfig?: object, priorConfig?: object}} options - startWave is for the debug URL;
 *   wavesConfig overrides config.waves and directorConfig / directorV2Config / counterConfig override config.director / config.directorV2 / config.counter (tests)
 * @returns {object} game state
 */
export function createGame({
  seed, mapDef = DEFAULT_MAP, events, debugSpawnEveryTicks = config.debug.autoSpawnEveryTicks, startGold = config.game.startGold,
  startLives = config.game.startLives, mode = config.game.mode, startWave, wavesConfig = {}, totalWaves = config.game.totalWaves, directorConfig, directorV2Config, counterConfig, priorConfig,
}) {
  if (!Number.isInteger(totalWaves) || !config.game.allowedTotals.includes(totalWaves)) {
    throw new RangeError(`totalWaves must be one of ${config.game.allowedTotals.join(', ')}, got ${String(totalWaves)}`);
  }
  if (!GAME_MODES.includes(mode)) throw new RangeError(`unknown game mode: ${String(mode)}`);
  const directorCfg = directorConfig === undefined ? undefined : { ...config.director, ...directorConfig };
  if (directorCfg) validateDirectorConfig(directorCfg);
  const directorV2Cfg = directorV2Config === undefined ? undefined : { ...config.directorV2, ...directorV2Config };
  if (directorV2Cfg) validateDirectorV2Config(directorV2Cfg);
  const counterCfg = counterConfig === undefined ? undefined : { ...config.counter, ...counterConfig };
  if (counterCfg) validateCounterConfig(counterCfg);
  const priorCfg = priorConfig === undefined ? undefined : { ...config.prior, ...priorConfig };
  if (priorCfg) validatePriorConfig(priorCfg);
  if (startWave !== undefined && (!Number.isInteger(startWave) || startWave < 1 || startWave > totalWaves)) {
    throw new RangeError(`startWave must be an integer 1..${totalWaves}, got ${String(startWave)}`);
  }
  const main = createRng(seed);
  const game = {
    seed,
    rng: main, // kept for compatibility; same object as rngs.main
    rngs: { main, lane: main.fork('lane'), debug: main.fork('debugSpawn') },
    events: events ?? createEventBus(),
    map: createMap(mapDef),
    tick: 0,
    time: 0,
    debugSpawnEveryTicks, // debug-only random spawner interval, 0 = off
    enemies: [],
    spawnQueue: [],
    nextEnemyId: 1,
    enemyIndex: new Map(), // derived (id -> enemy), rebuilt after compaction; not serialized
    gold: startGold,
    towers: [],
    nextTowerId: 1,
    projectiles: [],
    nextProjectileId: 1,
    occupancy: [],
    mode,
    directorCfg, // override for tests; undefined means config.director
    directorV2Cfg, // override for tests; undefined means config.directorV2
    counterCfg, // override for tests; undefined means config.counter
    priorCfg, // override for tests; undefined means config.prior
    director: mode === 'static' ? null : mode === 'adaptive2' ? createDirectorV2State() : mode === 'counter' ? createCounterState() : mode === 'prior' ? createPriorState() : createDirectorState(mode), // plain state; the Director's only memory
    wavesCfg: { ...config.waves, ...wavesConfig },
    lives: startLives,
    maxLives: startLives,
    totalWaves,
    waveLog: [], // UI summary log, one entry per cleared wave (plus a partial one on defeat); Phase 5 telemetry stays the research data source
    over: false,
    result: null,
    stats: createStats(),
    waves: createWavesState(),
  };
  game.occupancy = new Array(game.map.cols * game.map.rows).fill(0);
  if (startWave !== undefined) { game.waves.nextWave = startWave; game.waves.current = startWave - 1; }
  wireEconomy(game);
  wireStats(game); // stats and wave counters before lives: lives can end the game from inside the leak event
  wireWaves(game);
  wireLives(game);
  if (game.director && mode === 'adaptive2') wireDirectorV2(game);
  else if (game.director && mode !== 'counter' && mode !== 'prior') wireDirector(game); // the counter and prior arms learn nothing, so they need no event wiring
  // Per-tower statistics, driven by attribution on the events.
  game.events.on(EVENT_TYPES.ENEMY_DAMAGED, (ev) => { const t = getTowerById(game, ev.towerId); if (t) t.damageDealt += ev.amount; });
  game.events.on(EVENT_TYPES.ENEMY_KILLED, (ev) => { const t = getTowerById(game, ev.towerId); if (t) t.kills++; });
  return game;
}

/**
 * Announce the start of a run.
 * @param {object} game
 * @returns {void}
 */
export function startGame(game) {
  game.events.emit(EVENT_TYPES.GAME_STARTED, { seed: game.seed });
}

/**
 * Advance the game by exactly one fixed step.
 * @param {object} game
 * @returns {void}
 */
export function stepGame(game) {
  if (game.over) return; // the game has ended: nothing advances any more
  game.tick++;
  game.time = game.tick * config.sim.stepSeconds;

  // Debug-only random spawner (stays available behind ?debug=1); real enemies come from the wave runner
  if (game.debugSpawnEveryTicks > 0 && game.tick % game.debugSpawnEveryTicks === 0) {
    queueEnemy(game, game.rngs.debug.pick(ENEMY_ORDER));
  }

  stepEnemies(game);
  stepProjectiles(game); // before towers: a projectile fired this tick starts moving next tick
  stepTowers(game);
  stepWaves(game);
  if (game.over) freezeInterpolation(game); // the game ended during this step: settle everything that moved after the event
}

/**
 * JSON-serializable copy of the state, for tests and logging.
 * @param {object} game
 * @returns {object}
 */
export function snapshotGame(game) {
  return {
    seed: game.seed,
    tick: game.tick,
    rngStates: { main: game.rngs.main.getState(), lane: game.rngs.lane.getState(), debug: game.rngs.debug.getState() },
    nextEnemyId: game.nextEnemyId,
    gold: game.gold,
    lives: game.lives,
    maxLives: game.maxLives,
    totalWaves: game.totalWaves,
    waveLog: game.waveLog.map((e) => ({ ...e })),
    director: game.director ? JSON.parse(JSON.stringify(game.director)) : null,
    over: game.over,
    result: game.result,
    stats: { ...game.stats },
    waves: { ...game.waves, plan: game.waves.plan ? JSON.parse(JSON.stringify(game.waves.plan)) : null, waveStats: { ...game.waves.waveStats } },
    nextTowerId: game.nextTowerId,
    nextProjectileId: game.nextProjectileId,
    towers: game.towers.map((t) => ({ ...t })),
    projectiles: game.projectiles.map((p) => ({ ...p })),
    queue: game.spawnQueue.map((q) => ({ ...q })),
    enemies: game.enemies.map((e) => ({ ...e })),
  };
}
