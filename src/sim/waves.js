// Wave planning (pure, deterministic, no randomness): which enemies a wave spawns and when.
import { config } from '../data/config.js';
import { STATIC_WAVES, hpMultiplierForWave, planThreat } from '../data/waves.js';
import { ENEMIES, ENEMY_ORDER } from '../data/enemies.js';
import { planFor } from './director.js';

const toTicks = (seconds) => Math.round(seconds / config.sim.stepSeconds);

/**
 * Plan a wave and, in Director modes, the decision record that explains it. Pure: reads the game, writes nothing.
 * @param {{mode: string}} game @param {number} wave 1..30
 * @returns {{plan: {wave: number, name: string|null, fixed: boolean, groups: {type: string, picks: number, startTicks: number, gapTicks: number}[]}, decision: object|null}}
 */
export function planWaveWithDecision(game, wave) {
  const planned = game.mode === 'static' ? { plan: STATIC_WAVES[wave - 1], decision: null } : planFor(game, wave);
  const { plan } = planned;
  return {
    plan: {
      wave: plan.wave,
      name: plan.name,
      fixed: plan.fixed,
      groups: plan.groups.map((g) => ({ type: g.type, picks: g.picks, startTicks: toTicks(g.startSeconds), gapTicks: Math.max(1, toTicks(g.gapSeconds)) })),
    },
    decision: planned.decision,
  };
}

/**
 * Plan a wave for the game's mode (static script, Adaptive Director or random control).
 * @param {{mode: string}} game @param {number} wave 1..30
 * @returns {{wave: number, name: string|null, fixed: boolean, groups: {type: string, picks: number, startTicks: number, gapTicks: number}[]}}
 */
export function planWave(game, wave) {
  return planWaveWithDecision(game, wave).plan;
}

/**
 * What the next wave will contain (for the preview): null while a wave runs, after the game ends or when no waves are left.
 * @param {object} game
 * @returns {{wave: number, name: string|null, fixed: boolean, isFinal: boolean, hpMult: number, threat: number, items: {type: string, units: number, picks: number}[], director: {eligible: boolean, reason: string}|null}|null}
 */
export function getWavePreview(game) {
  if (game.over || game.waves.phase === 'running' || game.waves.nextWave > game.totalWaves) return null;
  const { plan, decision } = planWaveWithDecision(game, game.waves.nextWave);
  const items = ENEMY_ORDER
    .map((type) => {
      const g = plan.groups.find((x) => x.type === type);
      return g ? { type, units: g.picks * ENEMIES[type].packSize, picks: g.picks } : null;
    })
    .filter((x) => x && x.units > 0);
  return {
    wave: plan.wave, name: plan.name, fixed: plan.fixed, isFinal: plan.wave === game.totalWaves,
    hpMult: hpMultiplierForWave(plan.wave), threat: planThreat(plan.groups), items,
    director: decision ? { eligible: decision.eligible, reason: decision.reason } : null,
  };
}
