// Keyboard tile cursor (pure): moves between buildable tiles with the arrow keys, describes the tile for a screen reader, cycles tower selection and
// decides what Enter does. No DOM and no clock; it reads the map and the sim state only.
import { TOWERS } from '../data/towers.js';
import { towerAt } from '../sim/towers.js';

const STEPS = Object.freeze({ left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] });

/** @param {{cols: number, rows: number, tileAt: Function, isBuildable: Function}} map @returns {object} cursor */
export function createTileCursor(map) {
  const inside = (c, r) => c >= 0 && c < map.cols && r >= 0 && r < map.rows;

  /** The buildable tile closest to (col, row) by Manhattan distance; ties go to the smaller row, then the smaller column. @returns {{col: number, row: number} | null} */
  function nearestBuildable(col, row) {
    let best = null;
    let bestD = Infinity;
    for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) {
      if (!map.isBuildable(c, r)) continue;
      const d = Math.abs(c - col) + Math.abs(r - row);
      if (d < bestD) { bestD = d; best = { col: c, row: r }; } // row-major scan order breaks ties by row, then column
    }
    return best;
  }

  let pos = nearestBuildable(Math.floor(map.cols / 2), Math.floor(map.rows / 2)) ?? { col: 0, row: 0 };

  return {
    get: () => ({ ...pos }),
    /** Put the cursor on any tile inside the map (a pointer position may be a path tile). @returns {boolean} whether it moved */
    set(col, row) {
      if (!inside(col, row) || (col === pos.col && row === pos.row)) return false;
      pos = { col, row };
      return true;
    },
    /** Jump to the next buildable tile in a direction along the row or column, skipping path, spawn, exit and blocked tiles. @returns {boolean} false (and no move) when there is none */
    move(dir) {
      const step = STEPS[dir];
      if (!step) return false;
      let c = pos.col + step[0];
      let r = pos.row + step[1];
      while (inside(c, r)) {
        if (map.isBuildable(c, r)) { pos = { col: c, row: r }; return true; }
        c += step[0];
        r += step[1];
      }
      return false;
    },
    nearestBuildable,
    /** Short text for the live region, columns and rows counted from 1. @param {object} game */
    describe: (game) => describeTile(game, pos.col, pos.row),
  };
}

/** @returns {string} e.g. 'Column 5, row 3: free', 'occupied by Mortar', 'path' or 'blocked' */
export function describeTile(game, col, row) {
  const place = `Column ${col + 1}, row ${row + 1}`;
  const tile = game.map.tileAt(col, row);
  if (tile === null) return `${place}: outside the map`;
  if (tile === '#') return `${place}: blocked`;
  if (tile !== '.') return `${place}: path`;
  const t = towerAt(game, col, row);
  return t ? `${place}: occupied by ${TOWERS[t.type].name}` : `${place}: free`;
}

/** The next (direction 1) or previous (-1) tower id in id order, wrapping; null when there are no towers. @param {object} game @param {number} direction @param {number | null} currentId */
export function cycleSelection(game, direction, currentId) {
  const ids = game.towers.map((t) => t.id).sort((a, b) => a - b);
  if (ids.length === 0) return null;
  const i = currentId === null || currentId === undefined ? -1 : ids.indexOf(currentId);
  if (i < 0) return direction >= 0 ? ids[0] : ids[ids.length - 1];
  return ids[(i + (direction >= 0 ? 1 : -1) + ids.length) % ids.length];
}

/**
 * What Enter does. An open dialog takes the key; placing places at the cursor; otherwise a startable wave starts. The Director overlay does not take Enter.
 * @param {{buildMode: 'idle'|'placing'|'selected', waveStartable: boolean, overlayOpen: boolean, dialogOpen: boolean}} ui
 * @returns {'place-at-cursor' | 'start-wave' | 'none'}
 */
export function resolveEnter({ buildMode, waveStartable, dialogOpen }) {
  if (dialogOpen) return 'none';
  if (buildMode === 'placing') return 'place-at-cursor';
  return waveStartable ? 'start-wave' : 'none';
}
