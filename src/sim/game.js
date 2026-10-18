// Top-level game state and the fixed-step update.
import { config } from '../data/config.js';
import { DEFAULT_MAP } from '../data/map.js';
import { createRng } from './rng.js';
import { createEventBus, EVENT_TYPES } from './events.js';
import { createMap } from './map.js';

/**
 * Create a new game (plain-object state).
 * @param {{seed: number|string, mapDef?: object, events?: object, debugSpawnEveryTicks?: number}} options
 * @returns {object} game state
 */
export function createGame({ seed, mapDef = DEFAULT_MAP, events, debugSpawnEveryTicks = config.debug.walkerSpawnEveryTicks }) {
  return {
    seed,
    rng: createRng(seed),
    events: events ?? createEventBus(),
    map: createMap(mapDef),
    tick: 0,
    time: 0,
    debugSpawnEveryTicks, // TEMPORARY (Phase 1A), stress-test knob for the debug walkers
    walkers: [], // TEMPORARY (Phase 1A), see stepGame
    nextWalkerId: 1,
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
  const { stepSeconds } = config.sim;
  game.tick++;
  game.time = game.tick * stepSeconds;

  // TEMPORARY (Phase 1A): proves loop, interpolation, path and RNG; replaced by the real enemy system in Phase 2
  const dbg = config.debug;
  if (game.tick % game.debugSpawnEveryTicks === 0) {
    game.walkers.push({
      id: game.nextWalkerId++,
      distance: 0,
      prevDistance: 0,
      speed: dbg.walkerBaseSpeed * (1 + game.rng.range(-dbg.walkerSpeedJitter, dbg.walkerSpeedJitter)),
    });
  }
  const { walkers } = game;
  for (let i = walkers.length - 1; i >= 0; i--) {
    const w = walkers[i];
    w.prevDistance = w.distance;
    w.distance += w.speed * stepSeconds;
    if (w.distance >= game.map.path.totalLength) {
      walkers[i] = walkers[walkers.length - 1];
      walkers.pop();
    }
  }
}

/**
 * JSON-serializable summary of the state, for tests and logging.
 * @param {object} game
 * @returns {{seed: number|string, tick: number, rngState: number, walkers: object[]}}
 */
export function snapshotGame(game) {
  return {
    seed: game.seed,
    tick: game.tick,
    rngState: game.rng.getState(),
    walkers: game.walkers.map(({ id, distance, prevDistance, speed }) => ({ id, distance, prevDistance, speed })),
  };
}
