// Style bots for the experiment: scripted players with different tower mixes whose random choices come from their OWN seeded stream
// (createRng(game.seed).fork('bot-' + style)), so a seed gives a different but reproducible layout and the sim's streams are never touched.
// Bots act only through sim commands and read state only through exported getters. Knobs are calibrated by `npm run calibrate`.
import { config } from '../src/data/config.js';
import { TOWERS, TOWER_ORDER } from '../src/data/towers.js';
import { createRng } from '../src/sim/rng.js';
import { placeTower, upgradeTower, canPlaceTower, getTowerCost } from '../src/sim/towers.js';
import { startNextWave, canStartWave } from '../src/sim/waveRunner.js';
import { rankBuildableTiles } from './tiles.js';
import { PROTOCOL, styleWeights } from './protocol.js';

const TILE_RANGE = 150; // same tile ranking range as the other bots
const MAX_ACTIONS_PER_CALL = 20;

export const styleBotNames = PROTOCOL.styles;

/** Cheapest available upgrade (ties: lowest tower id), or null. */
function cheapestUpgrade(game) {
  let best = null;
  let bestCost = Infinity;
  for (const t of game.towers) {
    const u = TOWERS[t.type].upgrades[t.level];
    if (u && (u.cost < bestCost || (u.cost === bestCost && t.id < best.id))) { best = t; bestCost = u.cost; }
  }
  return best ? { tower: best, cost: bestCost } : null;
}

/**
 * @param {string} style one of PROTOCOL.styles @param {{tilePool: number, focusWeight: number, upgradeAfter: number}} [knobs]
 * @returns {{name: string, act: (game: object) => void}}
 */
export function createStyleBot(style, knobs = PROTOCOL.botKnobs) {
  const weights = styleWeights(style, knobs.focusWeight); // validates the style and the weight
  const states = new WeakMap();
  const stateOf = (game) => {
    let s = states.get(game);
    if (!s) {
      s = { rng: createRng(game.seed).fork(`bot-${style}`), tiles: rankBuildableTiles(game.map, TILE_RANGE), nextIsUpgrade: false, pendingType: null };
      states.set(game, s);
    }
    return s;
  };

  /** One build attempt. @returns {boolean} true when something was built */
  function build(game, s) {
    if (game.towers.length >= config.towers.maxTowers) return false;
    if (s.pendingType === null) s.pendingType = TOWER_ORDER[s.rng.weightedIndex(weights)]; // drawn once per build, not once per call
    if (game.gold < getTowerCost(game, s.pendingType)) return false;
    const pool = [];
    for (const t of s.tiles) {
      if (canPlaceTower(game, s.pendingType, t.col, t.row).ok) pool.push(t);
      if (pool.length >= knobs.tilePool) break;
    }
    if (pool.length === 0) return false;
    const tile = s.rng.pick(pool);
    if (!placeTower(game, s.pendingType, tile.col, tile.row).ok) return false;
    s.pendingType = null;
    if (game.towers.length >= knobs.upgradeAfter) s.nextIsUpgrade = true; // from here on, alternate with upgrades
    return true;
  }

  return {
    name: `style:${style}`,
    act(game) {
      if (game.over) return;
      const s = stateOf(game);
      for (let i = 0; i < MAX_ACTIONS_PER_CALL; i++) {
        if (game.over) return;
        const up = s.nextIsUpgrade ? cheapestUpgrade(game) : null;
        if (up) {
          if (game.gold < up.cost || !upgradeTower(game, up.tower.id).ok) break;
          s.nextIsUpgrade = false;
          continue;
        }
        if (!build(game, s)) break;
      }
      if (canStartWave(game).ok) startNextWave(game);
    },
  };
}
