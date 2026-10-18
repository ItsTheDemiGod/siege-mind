// Pure placement of the selected-tower panel so it never covers the tower, the HUD strip or leaves the stage.

const MARGIN_AROUND_TOWER = 8; // extra clearance beyond the tower radius
const TILE = 64; // tile size the tower occupies

const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * Choose where to put the panel. Coordinates are logical stage coordinates (including the HUD offset).
 * Candidates in order: bottom-left, bottom-right, top-left (below the HUD), top-right; the side opposite the tower
 * horizontally is preferred, bottoms before tops. Returns the first one that fits and clears the tower.
 * @param {{towerX: number, towerY: number, towerRadius: number, stageW: number, stageH: number, hudH: number, panelW: number, panelH: number, margin: number}} o
 * @returns {{left: number, top: number, side: 'bottom-left'|'bottom-right'|'top-left'|'top-right'}}
 */
export function placeTowerPanel({ towerX, towerY, towerRadius, stageW, stageH, hudH, panelW, panelH, margin }) {
  for (const [name, v] of Object.entries({ stageW, stageH, panelW, panelH })) {
    if (!positive(v)) throw new RangeError(`placeTowerPanel: ${name} must be a positive finite number, got ${String(v)}`);
  }
  for (const [name, v] of Object.entries({ towerX, towerY, towerRadius, hudH, margin })) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new RangeError(`placeTowerPanel: ${name} must be a finite number >= 0, got ${String(v)}`);
  }
  const lefts = { left: margin, right: stageW - margin - panelW };
  const tops = { top: hudH + margin, bottom: stageH - margin - panelH };
  const cands = [];
  const preferRight = towerX < stageW / 2;
  for (const v of ['bottom', 'top']) {
    for (const h of (preferRight ? ['right', 'left'] : ['left', 'right'])) {
      cands.push({ left: lefts[h], top: tops[v], side: `${v}-${h}` });
    }
  }
  const pad = TILE / 2 + towerRadius + MARGIN_AROUND_TOWER;
  const clear = (c) => c.left + panelW <= towerX - pad || c.left >= towerX + pad || c.top + panelH <= towerY - pad || c.top >= towerY + pad;
  const fits = (c) => c.left >= 0 && c.top >= hudH && c.left + panelW <= stageW && c.top + panelH <= stageH;
  return cands.find((c) => fits(c) && clear(c)) ?? cands.find(fits) ?? cands[0];
}
