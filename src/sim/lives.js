// Lives (pure): leaks cost lives, lives never go below 0, and reaching 0 ends the game.
import { EVENT_TYPES } from './events.js';
import { endGame } from './waveRunner.js';

/**
 * Subscribe lives handling to the game's event bus.
 * @param {object} game
 * @returns {() => void} unsubscribe
 */
export function wireLives(game) {
  return game.events.on(EVENT_TYPES.ENEMY_LEAKED, (ev) => {
    const applied = Math.min(game.lives, ev.leakDamage);
    if (applied <= 0) return;
    game.lives -= applied;
    game.events.emit(EVENT_TYPES.LIVES_CHANGED, { lives: game.lives, delta: -applied, tick: game.tick });
    if (game.lives === 0) endGame(game, 'lost');
  });
}
