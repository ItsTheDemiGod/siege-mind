// Placement ghost and selection overlays. Allocation-free per frame (validity is cached until its inputs change).
import { THEME } from './theme.js';
import { drawTower } from './towerRenderer.js';
import { canPlaceTower, getTowerStats, getTowerById } from '../sim/towers.js';

const C = THEME.colors;
const TAU = Math.PI * 2;
const RING_DASH = [8, 8];
const NO_DASH = [];
const BRACKET = 10;
const REASON_TEXT = {
  insufficient_gold: 'Not enough gold', occupied: 'Tile occupied', tower_limit: 'Tower limit reached',
};
const DEFAULT_REASON = "Can't build there";

const check = { type: null, col: -1, row: -1, gold: -1, count: -1, ok: false, reason: '' }; // cached canPlaceTower result
const ghost = { type: 'lance', x: 0, y: 0, angle: -Math.PI / 4, level: 0 };

/**
 * Placing mode: tile outline, dashed range ring and a half-transparent glyph under the pointer.
 * @param {CanvasRenderingContext2D} ctx @param {{draw: Function}|null} glow @param {object} game
 * @param {{state: {mode: string, typeId: string|null, hoverCol: number|null, hoverRow: number|null}}} buildState
 * @param {number} time @returns {void}
 */
export function drawPlacementOverlay(ctx, glow, game, buildState, time) {
  const s = buildState.state;
  if (s.mode !== 'placing' || s.hoverCol === null) return;
  if (check.type !== s.typeId || check.col !== s.hoverCol || check.row !== s.hoverRow || check.gold !== game.gold || check.count !== game.towers.length) {
    const r = canPlaceTower(game, s.typeId, s.hoverCol, s.hoverRow);
    check.type = s.typeId; check.col = s.hoverCol; check.row = s.hoverRow; check.gold = game.gold; check.count = game.towers.length;
    check.ok = r.ok; check.reason = r.ok ? '' : (REASON_TEXT[r.reason] ?? DEFAULT_REASON);
  }
  const ts = game.map.tileSize;
  const x = s.hoverCol * ts;
  const y = s.hoverRow * ts;
  const color = check.ok ? C.primary : C.danger;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(x, y, ts, ts);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);

  const cx = x + ts / 2;
  const cy = y + ts / 2;
  ctx.globalAlpha = 0.6;
  ctx.setLineDash(RING_DASH);
  ctx.beginPath();
  ctx.arc(cx, cy, getTowerStats(s.typeId, 0).range, 0, TAU);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);

  ghost.type = s.typeId; ghost.x = cx; ghost.y = cy;
  ctx.globalAlpha = 0.5;
  drawTower(ctx, glow, ghost, null, time);
  ctx.globalAlpha = 1;

  if (!check.ok) { // the reason in words, never colour alone
    ctx.font = `600 13px ${THEME.fonts.body}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = C.danger;
    ctx.fillText(check.reason, cx, y - 4);
  }
}

/**
 * Selected tower: solid range ring plus corner brackets around its tile.
 * @param {CanvasRenderingContext2D} ctx @param {object} game @param {object} buildState
 * @returns {void}
 */
export function drawSelectionOverlay(ctx, game, buildState) {
  const s = buildState.state;
  if (s.mode !== 'selected') return;
  const t = getTowerById(game, s.towerId);
  if (!t) return;
  const ts = game.map.tileSize;
  ctx.strokeStyle = C.primary;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(t.x, t.y, getTowerStats(t.type, t.level).range, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const x = t.col * ts;
  const y = t.row * ts;
  ctx.beginPath();
  ctx.moveTo(x, y + BRACKET); ctx.lineTo(x, y); ctx.lineTo(x + BRACKET, y);
  ctx.moveTo(x + ts - BRACKET, y); ctx.lineTo(x + ts, y); ctx.lineTo(x + ts, y + BRACKET);
  ctx.moveTo(x + ts, y + ts - BRACKET); ctx.lineTo(x + ts, y + ts); ctx.lineTo(x + ts - BRACKET, y + ts);
  ctx.moveTo(x + BRACKET, y + ts); ctx.lineTo(x, y + ts); ctx.lineTo(x, y + ts - BRACKET);
  ctx.stroke();
}
