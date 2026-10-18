// Wave planning (pure, deterministic, no randomness): which enemies a wave spawns and when.
import { config } from '../data/config.js';
import { STATIC_WAVES } from '../data/waves.js';

/**
 * Plan a wave for the game's mode. Only 'static' exists until Phase 6.
 * @param {{mode: string}} game @param {number} wave 1..30
 * @returns {{wave: number, name: string|null, fixed: boolean, groups: {type: string, picks: number, startTicks: number, gapTicks: number}[]}}
 */
export function planWave(game, wave) {
  if (game.mode !== 'static') throw new Error('Adaptive mode is implemented in Phase 6');
  const plan = STATIC_WAVES[wave - 1];
  const toTicks = (seconds) => Math.round(seconds / config.sim.stepSeconds);
  return {
    wave: plan.wave,
    name: plan.name,
    fixed: plan.fixed,
    groups: plan.groups.map((g) => ({ type: g.type, picks: g.picks, startTicks: toTicks(g.startSeconds), gapTicks: Math.max(1, toTicks(g.gapSeconds)) })),
  };
}
