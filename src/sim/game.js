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

/**
 * Create a new game (plain-object state).
 * @param {{seed: number|string, mapDef?: object, events?: object, debugSpawnEveryTicks?: number, startGold?: number}} options
 * @returns {object} game state
 */
export function createGame({ seed, mapDef = DEFAULT_MAP, events, debugSpawnEveryTicks = config.debug.autoSpawnEveryTicks, startGold = config.game.startGold }) {
  const main = createRng(seed);
  const game = {
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
    enemyIndex: new Map(), // derived (id -> enemy), rebuilt after compaction; not serialized
    gold: startGold,
    towers: [],
    nextTowerId: 1,
    projectiles: [],
    nextProjectileId: 1,
    occupancy: [],
  };
  game.occupancy = new Array(game.map.cols * game.map.rows).fill(0);
  wireEconomy(game);
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
  game.tick++;
  game.time = game.tick * config.sim.stepSeconds;

  // TEMPORARY (Phase 2): replaced by the wave runner in Phase 4
  if (game.debugSpawnEveryTicks > 0 && game.tick % game.debugSpawnEveryTicks === 0) {
    queueEnemy(game, game.rngs.debug.pick(ENEMY_ORDER));
  }

  stepEnemies(game);
  stepProjectiles(game); // before towers: a projectile fired this tick starts moving next tick
  stepTowers(game);
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
    nextTowerId: game.nextTowerId,
    nextProjectileId: game.nextProjectileId,
    towers: game.towers.map((t) => ({ ...t })),
    projectiles: game.projectiles.map((p) => ({ ...p })),
    queue: game.spawnQueue.map((q) => ({ ...q })),
    enemies: game.enemies.map((e) => ({ ...e })),
  };
}
