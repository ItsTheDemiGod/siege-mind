// Pure formatting helpers for the end screen.
import { config } from '../data/config.js';
import { TOTAL_WAVES } from '../data/waves.js';
import { lengthLabel } from './waveSummary.js';

/**
 * @param {number} ticks @param {number} stepSeconds
 * @returns {string} 'm:ss' (seconds rounded down)
 */
export function formatDuration(ticks, stepSeconds) {
  const total = Math.floor(ticks * stepSeconds + 1e-9);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Rows for the end-screen table.
 * @param {{result: string|null, lives: number, tick: number, stats: object}} game
 * @returns {{label: string, value: string}[]}
 */
export function endScreenRows(game) {
  const s = game.stats;
  return [
    { label: 'Result', value: game.result === 'won' ? 'Victory' : 'Defeat' },
    { label: 'Mode', value: `Static · ${lengthLabel(game.totalWaves ?? TOTAL_WAVES)}` },
    { label: 'Seed', value: String(game.seed) },
    { label: 'Waves cleared', value: `${s.wavesCleared} of ${game.totalWaves ?? TOTAL_WAVES}` },
    { label: 'Lives left', value: String(game.lives) },
    { label: 'Enemies defeated', value: String(s.kills) },
    { label: 'Enemies leaked', value: String(s.leaks) },
    { label: 'Gold earned', value: String(s.goldFromKills + s.goldFromBonus) },
    { label: 'Towers built', value: String(s.towersBuilt) },
    { label: 'Time', value: formatDuration(game.tick, config.sim.stepSeconds) },
  ];
}
