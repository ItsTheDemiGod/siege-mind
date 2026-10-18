// Gold economy core (pure). Lives, waves and win/lose arrive in Phase 4.
import { EVENT_TYPES } from './events.js';

function checkAmount(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    throw new TypeError(`gold amount must be a finite number >= 0, got ${String(amount)}`);
  }
}

function change(game, delta, reason) {
  game.gold += delta;
  game.events.emit(EVENT_TYPES.GOLD_CHANGED, { gold: game.gold, delta, reason, tick: game.tick });
}

/**
 * Add gold.
 * @param {object} game @param {number} amount @param {string} reason
 * @returns {void}
 */
export function earnGold(game, amount, reason) {
  checkAmount(amount);
  if (amount === 0) return;
  change(game, amount, reason);
}

/**
 * Spend gold if affordable; changes nothing otherwise.
 * @param {object} game @param {number} amount @param {string} reason
 * @returns {boolean} true on success
 */
export function spendGold(game, amount, reason) {
  checkAmount(amount);
  if (amount > game.gold) return false;
  if (amount > 0) change(game, -amount, reason);
  return true;
}

/** @param {object} game @param {number} amount @returns {boolean} */
export function canAfford(game, amount) {
  checkAmount(amount);
  return amount <= game.gold;
}

/**
 * Subscribe the economy to the game's event bus (kills pay their reward).
 * @param {object} game
 * @returns {() => void} unsubscribe
 */
export function wireEconomy(game) {
  return game.events.on(EVENT_TYPES.ENEMY_KILLED, (ev) => earnGold(game, ev.reward, 'kill'));
}
