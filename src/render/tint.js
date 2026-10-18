// Precomputed color tint table so no color mixing happens at draw time.
import { mixHex } from './color.js';

/**
 * table[id][key] = base color of `id` mixed toward tintHexByKey[key] by amountByKey[key].
 * @param {Record<string, string>} baseHexById
 * @param {Record<string|number, string>} tintHexByKey
 * @param {Record<string|number, number>} amountByKey - one entry per key; 0 gives the base color
 * @returns {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
export function buildTintTable(baseHexById, tintHexByKey, amountByKey) {
  const table = {};
  for (const [id, base] of Object.entries(baseHexById)) {
    const row = {};
    for (const [key, amount] of Object.entries(amountByKey)) {
      row[key] = amount === 0 ? base : mixHex(base, tintHexByKey[key], amount);
    }
    table[id] = Object.freeze(row);
  }
  return Object.freeze(table);
}
