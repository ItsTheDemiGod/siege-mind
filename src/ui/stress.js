// Stress mode (?debug=1&stress=1): deterministic crowd of towers for performance checks. Commands only, through sim functions.
import { TOWER_ORDER } from '../data/towers.js';
import { placeTower, upgradeTower } from '../sim/towers.js';

const UPGRADE_EVERY = 4; // every 4th tower is taken to level 2

/**
 * Place `count` towers (types round-robin) on buildable tiles taken at even intervals, upgrading every 4th to level 2.
 * Needs plenty of gold (the caller overrides startGold).
 * @param {object} game @param {number} [count]
 * @returns {number} how many towers were placed
 */
export function applyStress(game, count = 40) {
  const cells = game.map.buildableCells();
  let placed = 0;
  for (let i = 0; i < count; i++) {
    const cell = cells[Math.floor((i * cells.length) / count)];
    const r = placeTower(game, TOWER_ORDER[i % TOWER_ORDER.length], cell.col, cell.row);
    if (!r.ok) continue;
    placed++;
    if (i % UPGRADE_EVERY === 0) {
      upgradeTower(game, r.tower.id);
      upgradeTower(game, r.tower.id);
    }
  }
  return placed;
}
