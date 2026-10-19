// Pure formatting helpers for the end screen.
import { config } from '../data/config.js';
import { TOTAL_WAVES } from '../data/waves.js';
import { lengthLabel } from './waveSummary.js';
import { MODES, RANDOM_CONTROL } from '../data/menuText.js';
import { ENEMY_ORDER } from '../data/enemies.js';
import { tiltFromScores } from '../sim/directorMath.js';

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

const SHORT_NAMES = Object.freeze({ armoredGrunt: 'grunt', swarmling: 'swarm', fastRunner: 'runner', regenerator: 'regen', shieldedBruiser: 'bruiser' }); // the debug panel is narrow

/** @param {string} mode game mode id @returns {string} display label (Static when unknown) */
export function modeLabel(mode) {
  if (mode === 'random') return RANDOM_CONTROL.label;
  return MODES.find((m) => m.id === mode)?.label ?? 'Static';
}

/**
 * Debug panel line about the Director.
 * @param {{mode: string, director: {scores: Record<string, number>}|null, directorCfg?: object}} game
 * @returns {string}
 */
export function formatDirectorLine(game) {
  if (!game.director) return 'director: off (static mode)';
  const tilt = tiltFromScores(game.director.scores, game.directorCfg ?? config.director);
  const parts = ENEMY_ORDER.map((t) => `${SHORT_NAMES[t]} ${game.director.scores[t].toFixed(2)}/${tilt[t].toFixed(2)}`);
  return `director: mode ${game.director.mode}, score/tilt: ${parts.join(' ')}`;
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
    { label: 'Mode', value: `${modeLabel(game.mode)} · ${lengthLabel(game.totalWaves ?? TOTAL_WAVES)}` },
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
