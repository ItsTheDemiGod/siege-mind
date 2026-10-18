// Shared tile ranking for bots and the matchup harness (pure, deterministic).

const SAMPLE_STEP = 8; // world units between path samples

/**
 * Buildable tiles ranked by how much path lies within `range` of the tile centre (best first; ties by row, then col).
 * @param {object} map a sim map (createMap result)
 * @param {number} range world units
 * @returns {{col: number, row: number, score: number}[]}
 */
export function rankBuildableTiles(map, range) {
  const pos = { x: 0, y: 0, angle: 0 };
  const samples = [];
  for (let d = 0; d <= map.path.totalLength; d += SAMPLE_STEP) {
    map.path.positionAt(d, pos);
    samples.push({ x: pos.x, y: pos.y });
  }
  return map.buildableCells()
    .map((cell) => {
      const c = map.tileToWorld(cell.col, cell.row);
      let score = 0;
      for (const s of samples) if (Math.hypot(s.x - c.x, s.y - c.y) <= range) score++;
      return { col: cell.col, row: cell.row, score };
    })
    .sort((a, b) => b.score - a.score || a.row - b.row || a.col - b.col);
}
