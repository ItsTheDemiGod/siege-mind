// Pure text helpers for tower tooltips and the tower panel.
import { TOWERS } from '../data/towers.js';
import { ENEMIES } from '../data/enemies.js';
import { config } from '../data/config.js';
import { getTowerStats } from '../sim/towers.js';

const fmt = (n) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1));

/** @param {string[]} ids enemy ids @returns {string} display names, or "none" */
export const enemyNames = (ids) => (ids.length ? ids.map((id) => ENEMIES[id].name).join(', ') : 'none');

/**
 * Formatted stats for a tower type at a level.
 * @param {string} typeId @param {number} level
 * @returns {{damage: string, range: string, shotsPerSecond: string, dps: string}}
 */
export function statRows(typeId, level) {
  const s = getTowerStats(typeId, level);
  const damage = s.poisonDps > 0 ? `${fmt(s.poisonDps)}/s poison` : s.kind === 'pulse' ? `${fmt(s.damage)} + slow ${Math.round((1 - s.slowFactor) * 100)}%` : fmt(s.damage);
  return {
    damage,
    range: fmt(s.range),
    shotsPerSecond: fmt(1 / (config.sim.stepSeconds * s.intervalTicks)),
    dps: fmt(s.dps),
  };
}

/** @param {string} typeId @returns {string} */
export function tooltipTitle(typeId) {
  return `${TOWERS[typeId].name} — ${TOWERS[typeId].cost} gold`;
}

/** @param {string} typeId @returns {string} multi-line plain text (rendered with white-space: pre-line) */
export function tooltipBody(typeId) {
  const d = TOWERS[typeId];
  const r = statRows(typeId, 0);
  return `${d.role}\nDamage ${r.damage} · Range ${r.range} · ${r.shotsPerSecond} shots/s\nStrong vs: ${enemyNames(d.strongVs)}\nWeak vs: ${enemyNames(d.weakVs)}`;
}

/** @param {string} reason build/upgrade failure reason @returns {string} plain-language message */
export function reasonText(reason) {
  switch (reason) {
    case 'insufficient_gold': return 'Not enough gold';
    case 'occupied': return 'Tile occupied';
    case 'tower_limit': return 'Tower limit reached';
    case 'max_level': return 'Already at max level';
    case 'not_buildable':
    case 'out_of_bounds':
    case 'unknown_type':
    default: return "Can't build there";
  }
}
