// Wave planning (pure, deterministic, no randomness): which enemies a wave spawns and when.
import { config } from '../data/config.js';
import { STATIC_WAVES, hpMultiplierForWave, planThreat } from '../data/waves.js';
import { ENEMIES, ENEMY_ORDER } from '../data/enemies.js';

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

/**
 * What the next wave will contain (for the preview): null while a wave runs, after the game ends or when no waves are left.
 * @param {object} game
 * @returns {{wave: number, name: string|null, fixed: boolean, isFinal: boolean, hpMult: number, threat: number, items: {type: string, units: number, picks: number}[]}|null}
 */
export function getWavePreview(game) {
  if (game.over || game.waves.phase === 'running' || game.waves.nextWave > game.totalWaves) return null;
  const plan = planWave(game, game.waves.nextWave);
  const items = ENEMY_ORDER
    .map((type) => {
      const g = plan.groups.find((x) => x.type === type);
      return g ? { type, units: g.picks * ENEMIES[type].packSize, picks: g.picks } : null;
    })
    .filter((x) => x && x.units > 0);
  return {
    wave: plan.wave, name: plan.name, fixed: plan.fixed, isFinal: plan.wave === game.totalWaves,
    hpMult: hpMultiplierForWave(plan.wave), threat: planThreat(plan.groups), items,
  };
}
