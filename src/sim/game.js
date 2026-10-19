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

/**
 * Create a new game (plain-object state).
 * @param {{seed: number|string, mapDef?: object, events?: object, debugSpawnEveryTicks?: number, startGold?: number, startLives?: number,
 *   mode?: 'static', startWave?: number, wavesConfig?: object, totalWaves?: 15|30}} options - startWave is for the debug URL; wavesConfig overrides config.waves (tests)
 * @returns {object} game state
 */
export function createGame({
  seed, mapDef = DEFAULT_MAP, events, debugSpawnEveryTicks = config.debug.autoSpawnEveryTicks, startGold = config.game.startGold,
  startLives = config.game.startLives, mode = config.game.mode, startWave, wavesConfig = {}, totalWaves = config.game.totalWaves,
}) {
  if (!Number.isInteger(totalWaves) || !config.game.allowedTotals.includes(totalWaves)) {
    throw new RangeError(`totalWaves must be one of ${config.game.allowedTotals.join(', ')}, got ${String(totalWaves)}`);
  }
  if (mode === 'adaptive') throw new Error('Adaptive mode is implemented in Phase 6');
  if (mode !== 'static') throw new RangeError(`unknown game mode: ${String(mode)}`);
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
