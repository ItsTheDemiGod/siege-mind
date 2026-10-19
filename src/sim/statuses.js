// Status effects (pure): slow, poison (stacking DoT), regeneration suppression.
import { config } from '../data/config.js';
import { ENEMIES } from '../data/enemies.js';
import { applyDamage, flushDot } from './damage.js';

const isPos = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * Apply a slow or poison status. Dead enemies are ignored.
 * @param {object} game @param {object} enemy
 * @param {{type: 'slow', factor: number, duration: number}|{type: 'poison', dps: number, duration: number, source?: string, towerId?: number}} status
 * @returns {void}
 */
export function applyStatus(game, enemy, status) {
  if (!status || typeof status !== 'object') throw new TypeError('status must be an object');
  if (status.type === 'slow') {
    if (!isPos(status.factor) || status.factor > 1) throw new TypeError(`slow factor must be in (0,1], got ${String(status.factor)}`);
    if (!isPos(status.duration)) throw new TypeError(`duration must be a positive number, got ${String(status.duration)}`);
    if (!enemy.alive) return;
    const factor = Math.max(config.statuses.slowMinFactor, status.factor);
    enemy.slowFactor = enemy.slowRemaining > 0 ? Math.min(enemy.slowFactor, factor) : factor;
    enemy.slowRemaining = Math.max(enemy.slowRemaining, status.duration);
  } else if (status.type === 'poison') {
    if (!isPos(status.dps)) throw new TypeError(`poison dps must be a positive number, got ${String(status.dps)}`);
    if (!isPos(status.duration)) throw new TypeError(`duration must be a positive number, got ${String(status.duration)}`);
    if (!enemy.alive) return;
    enemy.poisonStacks = Math.min(config.statuses.poisonMaxStacks, enemy.poisonStacks + 1);
    enemy.poisonDps = Math.max(enemy.poisonDps, status.dps);
    enemy.poisonRemaining = Math.max(enemy.poisonRemaining, status.duration);
    enemy.poisonSource = status.source ?? 'debug';
    enemy.poisonTowerId = status.towerId ?? -1; // most recent applier gets the credit
  } else {
    throw new TypeError(`unknown status type: ${String(status.type)}`);
  }
}

/** @param {object} enemyDef @param {object} enemy @returns {number} current speed in world units per second */
export function effectiveSpeed(enemyDef, enemy) {
  return enemyDef.speed * enemy.slowFactor;
}

/** @param {object} enemy @returns {boolean} */
export function isPoisoned(enemy) {
  return enemy.poisonRemaining > 0 && enemy.poisonStacks > 0;
}

/**
 * Tick timers, apply poison DoT, regenerate, and flush aggregated DoT events.
 * @param {object} game @param {object} enemy @param {number} dt - seconds
 * @returns {void}
 */
export function updateStatuses(game, enemy, dt) {
  if (enemy.slowRemaining > 0) {
    enemy.slowRemaining -= dt;
    if (enemy.slowRemaining <= 0) { enemy.slowRemaining = 0; enemy.slowFactor = 1; }
  }
  const def = ENEMIES[enemy.type];
  const poisoned = isPoisoned(enemy);
  if (poisoned) {
    applyDamage(game, enemy, { amount: enemy.poisonStacks * enemy.poisonDps * dt, kind: 'dot', source: enemy.poisonSource, towerId: enemy.poisonTowerId });
    enemy.poisonRemaining -= dt;
    if (enemy.poisonRemaining <= 0) { enemy.poisonRemaining = 0; enemy.poisonStacks = 0; enemy.poisonDps = 0; }
  }
  if (!enemy.alive) return;
  if (def.regenFraction > 0 && !poisoned && enemy.hp < enemy.maxHp) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + def.hp * def.regenFraction * dt); // a fraction of BASE hp: healing must not grow with the wave multiplier
  }
  if (enemy.dotAcc > 0 && game.tick % config.combat.dotEventTicks === 0) flushDot(game, enemy);
}
