// Shared test helpers (not a test file: the test glob only matches *.test.js).
import { createGame } from '../src/sim/game.js';
import { spawnEnemyNow } from '../src/sim/enemies.js';
import { placeTower } from '../src/sim/towers.js';
import { stepProjectiles } from '../src/sim/projectiles.js';
import { stepTowers } from '../src/sim/towers.js';

export const TILE = { col: 15, row: 2 }; // buildable tile next to the path

/** Fresh game with lots of gold and the auto-spawner off. */
export const rig = (opts = {}) => createGame({ seed: 1, debugSpawnEveryTicks: 0, startGold: 100000, ...opts });

/** Place a tower (throws if it fails). */
export function place(game, type, col = TILE.col, row = TILE.row) {
  const r = placeTower(game, type, col, row);
  if (!r.ok) throw new Error(`placeTower failed: ${r.reason}`);
  return r.tower;
}

/** Spawn an enemy and pin its cached position (tests that bypass movement). `offset` is relative to a tower. */
export function dummy(game, type, x, y, { distance = 0, hp } = {}) {
  const e = spawnEnemyNow(game, type);
  e.x = x; e.y = y; e.distance = distance; e.prevDistance = distance;
  if (hp !== undefined) { e.hp = hp; e.maxHp = hp; }
  return e;
}

/** One step of projectiles then towers, without moving enemies. */
export function manualTick(game) {
  game.tick++;
  stepProjectiles(game);
  stepTowers(game);
}

/** Collect every event of the given types into an array of [type, payload]. */
export function record(game, ...types) {
  const log = [];
  for (const t of types) game.events.on(t, (p) => log.push([t, p]));
  return log;
}
