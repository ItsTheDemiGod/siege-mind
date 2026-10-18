// Bot players for headless runs. Bots are plain objects { name, act(game) } that act ONLY through sim commands
// (placeTower, upgradeTower, startNextWave). Deterministic: no randomness. Phase 8 extends this file.
import { config } from '../src/data/config.js';
import { TOWERS } from '../src/data/towers.js';
import { placeTower, upgradeTower, towerAt } from '../src/sim/towers.js';
import { startNextWave } from '../src/sim/waveRunner.js';
import { rankBuildableTiles } from './tiles.js';

const BUILD_ORDER = ['lance', 'mortar', 'frost', 'poison', 'sniper', 'lance', 'mortar', 'poison', 'frost', 'sniper'];
const TILE_RANGE = 150; // rank tiles by path coverage within the Lance's range
const OPENING_TOWERS = 6; // build this many before alternating upgrades and builds

/** Never builds; starts each wave as soon as it can. */
function createNoneBot() {
  return { name: 'none', act(game) { startNextWave(game); } };
}

/** Builds from a fixed order on well-covered tiles, alternates upgrades and builds, then starts the next wave. */
function createBalancedBot() {
  const states = new WeakMap(); // per game: ranked tiles, build counter, whose turn it is
  const stateOf = (game) => {
    let s = states.get(game);
    if (!s) { s = { tiles: rankBuildableTiles(game.map, TILE_RANGE), built: 0, turn: 'build' }; states.set(game, s); }
    return s;
  };

  const tryBuild = (game, s) => {
    if (game.towers.length >= config.towers.maxTowers) return 'blocked';
    const tile = s.tiles.find((t) => !towerAt(game, t.col, t.row) && game.map.isBuildable(t.col, t.row));
    if (!tile) return 'blocked';
    const type = BUILD_ORDER[s.built % BUILD_ORDER.length];
    const r = placeTower(game, type, tile.col, tile.row);
    if (!r.ok) return r.reason === 'insufficient_gold' ? 'poor' : 'blocked';
    s.built++;
    return 'done';
  };

  const tryUpgrade = (game) => {
    let best = null;
    let bestCost = Infinity;
    for (const t of game.towers) {
      const u = TOWERS[t.type].upgrades[t.level];
      if (u && u.cost < bestCost) { best = t; bestCost = u.cost; }
    }
    if (!best) return 'blocked';
    return upgradeTower(game, best.id).ok ? 'done' : 'poor';
  };

  return {
    name: 'balanced',
    act(game) {
      if (game.over) return;
      const s = stateOf(game);
      for (;;) { // each pass does one action or stops
        let result;
        if (game.towers.length < OPENING_TOWERS) {
          result = tryBuild(game, s);
        } else if (s.turn === 'upgrade') {
          result = tryUpgrade(game);
          if (result === 'done' || result === 'blocked') s.turn = 'build'; // an exhausted upgrade list falls through to building
          if (result === 'blocked') continue;
        } else {
          result = tryBuild(game, s);
          if (result === 'done' || result === 'blocked') s.turn = 'upgrade';
          if (result === 'blocked') {
            if (tryUpgradeAvailable(game)) continue;
            break;
          }
        }
        if (result !== 'done') break;
      }
      startNextWave(game);
    },
  };
}

function tryUpgradeAvailable(game) {
  return game.towers.some((t) => TOWERS[t.type].upgrades[t.level]);
}

const FACTORIES = { none: createNoneBot, balanced: createBalancedBot };

/** @param {string} name 'none' | 'balanced' @returns {{name: string, act: (game: object) => void}} */
export function createBot(name) {
  const make = FACTORIES[name];
  if (!make) throw new Error(`unknown bot: ${name} (have: ${Object.keys(FACTORIES).join(', ')})`);
  return make();
}

export const BOT_NAMES = Object.keys(FACTORIES);
