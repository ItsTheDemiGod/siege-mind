// Pure price / affordability computation for the build tray (tower prices grow with the number of towers owned).
import { TOWERS } from '../data/towers.js';
import { config } from '../data/config.js';
import { getTowerCost } from '../sim/towers.js';

/**
 * @param {{gold: number, towers: unknown[]}} game @param {string} typeId
 * @returns {{cost: number, base: number, affordable: boolean, label: string, priceLine: string}}
 */
export function trayEntry(game, typeId) {
  const d = TOWERS[typeId];
  const cost = getTowerCost(game, typeId);
  const affordable = game.gold >= cost;
  const pct = Math.round(config.economy.towerCostGrowth * 1000) / 10; // e.g. 0.03 -> 3
  return {
    cost,
    base: d.cost,
    affordable,
    label: `${d.name} tower, ${cost} gold, hotkey ${d.hotkey.toUpperCase()}${affordable ? '' : ', not enough gold'}`,
    priceLine: `Price: ${cost} gold (base ${d.cost}, +${pct}% per tower owned)`,
  };
}

/** @param {{towers: unknown[]}} game @returns {number} current price multiplier (1 with no towers) */
export function priceMultiplier(game) {
  return 1 + config.economy.towerCostGrowth * game.towers.length;
}
