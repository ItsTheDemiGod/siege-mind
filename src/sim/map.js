// Grid map and path logic. World units: 1 unit = 1 logical pixel, origin at the map's top-left corner.
import { config } from '../data/config.js';

const VALID_CHARS = new Set(['.', '#', 'P', 'S', 'E']);

/** Tiles on the polyline between consecutive waypoints, as "col,row" keys (assumes axis-aligned segments). */
function polylineKeys(waypoints) {
  const keys = new Set([`${waypoints[0].col},${waypoints[0].row}`]);
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const dc = Math.sign(b.col - a.col);
    const dr = Math.sign(b.row - a.row);
    for (let c = a.col, r = a.row; c !== b.col || r !== b.row;) {
      c += dc;
      r += dr;
      keys.add(`${c},${r}`);
    }
  }
  return keys;
}

/**
 * Validate a map definition; throws a descriptive Error on the first problem.
 * @param {{tileSize: number, grid: string[], waypoints: {col: number, row: number}[]}} def
 * @returns {void}
 */
export function validateMap(def) {
  const { grid, waypoints } = def;
  const { rows, cols } = config.world;
  if (grid.length !== rows) throw new Error(`Map must have ${rows} rows, got ${grid.length}`);
  let spawn = null;
  let exit = null;
  let spawnCount = 0;
  let exitCount = 0;
  const marked = new Set();
  grid.forEach((line, r) => {
    if (line.length !== cols) throw new Error(`Map row ${r} must have ${cols} columns, got ${line.length}`);
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (!VALID_CHARS.has(ch)) throw new Error(`Unknown map character "${ch}" at (${c},${r})`);
      if (ch === 'S') { spawnCount++; spawn = { col: c, row: r }; }
      if (ch === 'E') { exitCount++; exit = { col: c, row: r }; }
      if (ch === 'P' || ch === 'S' || ch === 'E') marked.add(`${c},${r}`);
    }
  });
  if (spawnCount !== 1) throw new Error(`Map must have exactly one spawn 'S', found ${spawnCount}`);
  if (exitCount !== 1) throw new Error(`Map must have exactly one exit 'E', found ${exitCount}`);
  if (!waypoints || waypoints.length < 2) throw new Error('Map needs at least 2 waypoints');
  for (const w of waypoints) {
    if (w.col < 0 || w.col >= cols || w.row < 0 || w.row >= rows) {
      throw new Error(`Waypoint (${w.col},${w.row}) is out of bounds`);
    }
  }
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    if (a.col === b.col && a.row === b.row) throw new Error(`Consecutive waypoints ${i - 1} and ${i} are identical`);
    if (a.col !== b.col && a.row !== b.row) throw new Error(`Waypoints ${i - 1} and ${i} are not axis-aligned`);
  }
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  if (first.col !== spawn.col || first.row !== spawn.row) throw new Error('First waypoint must be on the spawn tile');
  if (last.col !== exit.col || last.row !== exit.row) throw new Error('Last waypoint must be on the exit tile');
  const line = polylineKeys(waypoints);
  for (const k of marked) if (!line.has(k)) throw new Error(`Path tile (${k}) is not on the waypoint polyline`);
  for (const k of line) if (!marked.has(k)) throw new Error(`Waypoint polyline tile (${k}) is not marked as path`);
}

/**
 * Build the map object (tile queries plus path geometry).
 * @param {{tileSize: number, grid: string[], waypoints: {col: number, row: number}[]}} def
 * @returns {object} map
 */
export function createMap(def) {
  validateMap(def);
  const { tileSize, grid, waypoints } = def;
  const rows = grid.length;
  const cols = grid[0].length;

  const tileAt = (col, row) => (col >= 0 && col < cols && row >= 0 && row < rows ? grid[row][col] : null);
  const isPath = (col, row) => {
    const t = tileAt(col, row);
    return t === 'P' || t === 'S' || t === 'E';
  };

  // Path geometry: points in world units, cumulative distance at each waypoint.
  const pts = waypoints.map((w) => ({ x: (w.col + 0.5) * tileSize, y: (w.row + 0.5) * tileSize }));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y));
  }
  const totalLength = cum[cum.length - 1];

  const positionAt = (distance, out) => {
    const d = Math.min(Math.max(distance, 0), totalLength);
    let i = 1;
    while (i < cum.length - 1 && d > cum[i]) i++;
    const a = pts[i - 1];
    const b = pts[i];
    const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1]);
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.angle = Math.atan2(b.y - a.y, b.x - a.x);
    return out;
  };

  const buildable = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (grid[r][c] === '.') buildable.push({ col: c, row: r });

  return {
    cols,
    rows,
    tileSize,
    width: cols * tileSize,
    height: rows * tileSize,
    tileAt,
    isBuildable: (col, row) => tileAt(col, row) === '.',
    isPath,
    worldToTile(x, y) {
      const col = Math.floor(x / tileSize);
      const row = Math.floor(y / tileSize);
      return tileAt(col, row) === null ? null : { col, row };
    },
    tileToWorld: (col, row) => ({ x: (col + 0.5) * tileSize, y: (row + 0.5) * tileSize }),
    buildableCells: () => buildable.map((c) => ({ ...c })),
    path: {
      totalLength,
      positionAt,
      progressAt: (distance) => Math.min(Math.max(distance / totalLength, 0), 1),
    },
  };
}
