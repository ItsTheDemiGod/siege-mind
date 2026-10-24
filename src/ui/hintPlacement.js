// Where the first-run hint card sits (pure). The card must never cover the spawn, exit or a path tile, so it is placed once at startup on the
// candidate that avoids every fixed UI element and hides the fewest buildable tiles. Stage coordinates include the HUD offset.
import { config } from '../data/config.js';

/** Ordered candidate top-left corners (stage px); the first one wins ties. Left band between the path rows, then the other free bands. */
export const HINT_CANDIDATES = Object.freeze([
  [16, 216], [16, 232], [16, 240], [32, 224], [16, 600], [480, 600], [964, 600], [16, 420], [200, 420], [964, 420],
].map((c) => Object.freeze(c)));

const hits = (a, b) => a.left < b.left + b.w && b.left < a.left + a.w && a.top < b.top + b.h && b.top < a.top + a.h;

/** @param {{cols: number, rows: number, tileAt: Function}} map @param {number} tile @param {number} hudH @returns {{path: object[], buildable: object[]}} tile rectangles (path = spawn, exit and path tiles) */
export function tileRects(map, tile, hudH) {
  const path = [];
  const buildable = [];
  for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) {
    const t = map.tileAt(c, r);
    const rect = { left: c * tile, top: hudH + r * tile, w: tile, h: tile };
    if (t === '.') buildable.push(rect);
    else if (t !== '#') path.push(rect);
  }
  return { path, buildable };
}

/**
 * @param {{stageW: number, stageH: number, hudH: number, cardW: number, cardH: number, margin: number, blockedRects: object[], avoidRects: object[], candidates: readonly (readonly [number, number])[], buildableRects?: object[]}} o
 * margin: smallest distance to the stage edge. blockedRects: never covered. avoidRects: other UI. buildableRects: tiles to hide as few of as possible.
 * @returns {{left: number, top: number, w: number, h: number}} the valid candidate covering the fewest buildable tiles (ties: earlier candidate); throws when none is valid
 */
export function placeHintCard({ stageW, stageH, hudH, cardW, cardH, margin, blockedRects, avoidRects, candidates, buildableRects = [] }) {
  let best = null;
  let bestCover = Infinity;
  for (const [left, top] of candidates) {
    const rect = { left, top, w: cardW, h: cardH };
    const inside = left >= margin && top >= hudH && left + cardW <= stageW - margin && top + cardH <= stageH - margin;
    if (!inside || blockedRects.some((b) => hits(rect, b)) || avoidRects.some((a) => hits(rect, a))) continue;
    const cover = buildableRects.reduce((n, b) => n + (hits(rect, b) ? 1 : 0), 0);
    if (cover < bestCover) { bestCover = cover; best = rect; }
  }
  if (!best) throw new RangeError('placeHintCard: no candidate position is free of the path and the other UI');
  return best;
}

/** Rectangles of the fixed UI the card must not touch, from config.view and config.ui. @returns {object[]} */
export function avoidRectsFor(view = config.view, ui = config.ui) {
  const { width: stageW, height: stageH, hudHeight: hudH } = view;
  const rect = (left, top, w, h) => ({ left, top, w, h });
  const control = rect((stageW - ui.waveControlWidth) / 2, stageH - ui.waveControlBottomMargin - ui.waveControlHeight, ui.waveControlWidth, ui.waveControlHeight);
  return [
    rect(0, 0, stageW, hudH), // HUD strip
    rect((stageW - 600) / 2, hudH + 72, 600, stageH - hudH - 72), // widest banner
    rect(stageW - ui.directorOverlayMargin - ui.directorOverlayWidth, hudH + ui.directorOverlayMargin, ui.directorOverlayWidth, ui.directorOverlayMaxHeight),
    rect(ui.towerPanelMargin, stageH - ui.towerPanelMargin - ui.towerPanelHeight, ui.towerPanelWidth, ui.towerPanelHeight),
    rect(stageW - ui.towerPanelMargin - ui.towerPanelWidth, stageH - ui.towerPanelMargin - ui.towerPanelHeight, ui.towerPanelWidth, ui.towerPanelHeight),
    control,
    rect((stageW - ui.wavePreviewWidth) / 2, control.top - ui.wavePreviewGap - ui.wavePreviewHeight, ui.wavePreviewWidth, ui.wavePreviewHeight),
  ];
}

/** The hint card rectangle for a map on the real stage. @param {{cols: number, rows: number, tileAt: Function}} map @param {number} cardW @param {number} cardH @param {number} margin */
export function hintRectFor(map, cardW, cardH, margin) {
  const { width: stageW, height: stageH, hudHeight: hudH } = config.view;
  const { path, buildable } = tileRects(map, config.world.tileSize, hudH);
  return placeHintCard({ stageW, stageH, hudH, cardW, cardH, margin, blockedRects: path, avoidRects: avoidRectsFor(), candidates: HINT_CANDIDATES, buildableRects: buildable });
}
