// Enemy lifecycle (pure): spawn queue, movement along the path, leaks, order-preserving compaction, spatial queries.
import { config } from '../data/config.js';
import { ENEMIES } from '../data/enemies.js';
import { EVENT_TYPES } from './events.js';
import { applyDamage, flushDot } from './damage.js';
import { updateStatuses, effectiveSpeed } from './statuses.js';

const scratch = { x: 0, y: 0, angle: 0 }; // reused by queries; sim is single-threaded

function def(typeId) {
  const d = ENEMIES[typeId];
  if (!d) throw new Error(`Unknown enemy type: ${String(typeId)}`);
  return d;
}

/**
 * Create an enemy at the spawn point right now. Returns null (spawning nothing) at the enemy cap.
 * @param {object} game @param {string} typeId
 * @returns {object|null}
 */
export function spawnEnemyNow(game, typeId) {
  const d = def(typeId);
  if (game.enemies.length >= config.combat.maxEnemies) return null;
  const lane = game.rngs.lane.range(-1, 1) * (config.enemies.laneMax - d.radius * 0.3);
  const enemy = {
    id: game.nextEnemyId++, type: typeId, hp: d.hp, maxHp: d.hp, shield: d.shield, maxShield: d.shield,
    distance: 0, prevDistance: 0, lane, spawnTick: game.tick, lastHitTick: -1, alive: true,
    slowFactor: 1, slowRemaining: 0, poisonStacks: 0, poisonDps: 0, poisonRemaining: 0, poisonSource: 'debug', dotAcc: 0,
  };
  game.enemies.push(enemy);
  const p = game.map.path.sampleAt(0, lane, scratch);
  game.events.emit(EVENT_TYPES.ENEMY_SPAWNED, { id: enemy.id, type: typeId, tick: game.tick, x: p.x, y: p.y });
  return enemy;
}

/**
 * Queue an enemy (or its whole pack) for spawning. delayTicks 0 means "on the next step", so pack spacing is exact
 * whether this is called between steps (debug tools) or from inside a step (auto spawner).
 * @param {object} game @param {string} typeId
 * @param {{delayTicks?: number, pack?: boolean}} [options]
 * @returns {void}
 */
export function queueEnemy(game, typeId, { delayTicks = 0, pack = true } = {}) {
  const d = def(typeId);
  const n = pack && d.packSize > 1 ? d.packSize : 1;
  for (let i = 0; i < n; i++) game.spawnQueue.push({ atTick: game.tick + 1 + delayTicks + i * d.packIntervalTicks, type: typeId });
}

/**
 * Advance every enemy one fixed step: queue, statuses + movement + leaks, then stable compaction.
 * @param {object} game
 * @returns {void}
 */
export function stepEnemies(game) {
  const { stepSeconds } = config.sim;
  const total = game.map.path.totalLength;

  // (1) spawn due queue entries, keeping the order of the rest
  const q = game.spawnQueue;
  let w = 0;
  for (let i = 0; i < q.length; i++) {
    if (q[i].atTick <= game.tick) spawnEnemyNow(game, q[i].type);
    else q[w++] = q[i];
  }
  q.length = w;

  // (2) statuses and movement
  const list = game.enemies;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e.alive) continue;
    updateStatuses(game, e, stepSeconds);
    if (!e.alive) continue;
    e.prevDistance = e.distance;
    e.distance += effectiveSpeed(ENEMIES[e.type], e) * stepSeconds;
    if (e.distance >= total) {
      e.distance = total;
      e.alive = false;
      flushDot(game, e);
      const p = game.map.path.sampleAt(total, e.lane, scratch);
      game.events.emit(EVENT_TYPES.ENEMY_LEAKED, { id: e.id, type: e.type, leakDamage: ENEMIES[e.type].leakDamage, tick: game.tick, x: p.x, y: p.y });
    }
  }

  // (3) stable compaction: draw order must not change when enemies die
  let k = 0;
  for (let i = 0; i < list.length; i++) if (list[i].alive) list[k++] = list[i];
  list.length = k;
}

/**
 * Interpolated pose for rendering.
 * @param {object} game @param {object} enemy @param {number} alpha - 0..1 between the last two steps
 * @param {{x: number, y: number, angle: number}} out
 * @returns {{x: number, y: number, angle: number}}
 */
export function enemyPose(game, enemy, alpha, out) {
  return game.map.path.sampleAt(enemy.prevDistance + (enemy.distance - enemy.prevDistance) * alpha, enemy.lane, out);
}

/** @param {object} game @param {object} enemy @param {{x: number, y: number, angle: number}} out @returns {object} current (non-interpolated) pose */
export function enemyPosition(game, enemy, out) {
  return game.map.path.sampleAt(enemy.distance, enemy.lane, out);
}

/**
 * Nearest alive enemy whose body (radius + pad) contains the point.
 * @param {object} game @param {number} x @param {number} y @param {number} [pad]
 * @returns {object|null}
 */
export function findEnemyAt(game, x, y, pad = 8) {
  let best = null;
  let bestD = Infinity;
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const p = enemyPosition(game, e, scratch);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= ENEMIES[e.type].radius + pad && d < bestD) { best = e; bestD = d; }
  }
  return best;
}

/**
 * Visit every alive enemy whose center is within `radius` of the point (no array allocation).
 * @param {object} game @param {number} x @param {number} y @param {number} radius
 * @param {(enemy: object) => void} callback
 * @returns {void}
 */
export function forEachEnemyInRadius(game, x, y, radius, callback) {
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const p = enemyPosition(game, e, scratch);
    if (Math.hypot(p.x - x, p.y - y) <= radius) callback(e);
  }
}

/**
 * Kill everything through the normal damage path (debug nuke).
 * @param {object} game
 * @returns {void}
 */
export function nukeAll(game) {
  for (const e of game.enemies.slice()) applyDamage(game, e, { amount: 1e9, kind: 'direct', armorPierce: true, shieldMult: 1, source: 'debug' });
}
