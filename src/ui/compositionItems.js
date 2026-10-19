// Pure: a wave composition as an ordered list for chips (banner, preview).
import { ENEMIES, ENEMY_ORDER } from '../data/enemies.js';

/**
 * @param {Record<string, number>} unitsByType
 * @returns {{type: string, label: string, units: number}[]} in ENEMY_ORDER, zero units skipped
 */
export function compositionItems(unitsByType) {
  const items = [];
  for (const type of ENEMY_ORDER) {
    const units = unitsByType[type] ?? 0;
    if (units > 0) items.push({ type, label: ENEMIES[type].name, units });
  }
  return items;
}
