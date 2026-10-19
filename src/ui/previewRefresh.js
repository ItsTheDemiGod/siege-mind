// Pure helpers for the incoming-wave preview. The counter arm plans from the tower loadout, so its preview must refresh when the loadout changes.
import { EVENT_TYPES } from '../sim/events.js';

/** @param {string} mode game mode @returns {string[]} the extra event types that change what the preview shows */
export const loadoutEvents = (mode) => (mode === 'counter' ? [EVENT_TYPES.TOWER_PLACED, EVENT_TYPES.TOWER_SOLD, EVENT_TYPES.TOWER_UPGRADED] : []);

/**
 * De-duplication key of the preview: wave and phase, plus the loadout in counter mode.
 * @param {{mode: string, towers: {type: string, level: number}[], waves: {phase: string}}} game @param {{wave: number}|null} preview
 * @returns {string}
 */
export function previewKey(game, preview) {
  if (!preview) return 'none';
  const base = `${preview.wave}|${game.waves.phase}`;
  return game.mode === 'counter' ? `${base}|${game.towers.map((t) => `${t.type}${t.level}`).sort().join(',')}` : base;
}
