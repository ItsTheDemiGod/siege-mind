// Top-level game state and the fixed-step update.
import { config } from '../data/config.js';
import { DEFAULT_MAP } from '../data/map.js';
import { ENEMY_ORDER } from '../data/enemies.js';
import { createRng } from './rng.js';
import { createEventBus, EVENT_TYPES } from './events.js';
import { createMap } from './map.js';
import { queueEnemy, stepEnemies } from './enemies.js';

/**
 * Create a new game (plain-object state).
 * @param {{seed: number|string, mapDef?: object, events?: object, debugSpawnEveryTicks?: number}} options
 * @returns {object} game state
 */
export function createGame({ seed, mapDef = DEFAULT_MAP, events, debugSpawnEveryTicks = config.debug.autoSpawnEveryTicks }) {
  const main = createRng(seed);
  return {
    seed,
    rng: main, // kept for compatibility; same object as rngs.main
    rngs: { main, lane: main.fork('lane'), debug: main.fork('debugSpawn') },
    events: events ?? createEventBus(),
    map: createMap(mapDef),
    tick: 0,
    time: 0,
    debugSpawnEveryTicks, // TEMPORARY (Phase 2): 0 = off
    enemies: [],
    spawnQueue: [],
    nextEnemyId: 1,
  };
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
  game.tick++;
  game.time = game.tick * config.sim.stepSeconds;

  // TEMPORARY (Phase 2): replaced by the wave runner in Phase 4
  if (game.debugSpawnEveryTicks > 0 && game.tick % game.debugSpawnEveryTicks === 0) {
    queueEnemy(game, game.rngs.debug.pick(ENEMY_ORDER));
  }

  stepEnemies(game);
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
    queue: game.spawnQueue.map((q) => ({ ...q })),
    enemies: game.enemies.map((e) => ({ ...e })),
  };
}
