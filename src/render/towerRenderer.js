// TEMPORARY (Phase 3A): simple tower and projectile glyphs, replaced by final art in Phase 3B.
import { THEME } from './theme.js';

const TAU = Math.PI * 2;
const DISK_R = 20;
const BARREL_LEN = 26;
const BARREL_W = 4;
const PIP_R = 2.5;
const PIP_GAP = 10;
const PIP_DY = 27;
const BOLT_R = 4;
const SHELL_R = 6;

/**
 * Draw one tower glyph: dark disk, accent stroke, additive core, barrel along its angle, level pips.
 * @param {CanvasRenderingContext2D} ctx @param {{draw: Function}|null} glow
 * @param {{type: string, x: number, y: number, angle: number, level: number}} tower
 * @param {object} stats unused until 3B (kept so the signature is stable)
 * @param {number} time
 * @returns {void}
 */
export function drawTower(ctx, glow, tower, stats, time) {
  const accent = THEME.tower[tower.type];
  const { x, y } = tower;
  ctx.fillStyle = THEME.colors.panel;
  ctx.beginPath();
  ctx.arc(x, y, DISK_R, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();

  if (glow) {
    ctx.globalCompositeOperation = 'lighter';
    glow.draw(ctx, accent, 16, x, y, 0.45 + 0.1 * Math.sin(time * 3));
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tower.angle);
  ctx.fillRect(0, -BARREL_W / 2, BARREL_LEN, BARREL_W);
  ctx.restore();

  for (let i = 0; i < tower.level; i++) {
    ctx.beginPath();
    ctx.arc(x + (i - (tower.level - 1) / 2) * PIP_GAP, y + PIP_DY, PIP_R, 0, TAU);
    ctx.fill();
  }
}

/** Draw every tower. */
export function drawTowers(ctx, glow, game, time) {
  const list = game.towers;
  for (let i = 0; i < list.length; i++) drawTower(ctx, glow, list[i], null, time);
}

/**
 * Draw one projectile at its interpolated position (additive dot).
 * @param {CanvasRenderingContext2D} ctx @param {{draw: Function}|null} glow
 * @param {object} p projectile @param {number} alpha @returns {void}
 */
export function drawProjectile(ctx, glow, p, alpha) {
  const accent = THEME.tower[p.towerType];
  const x = p.prevX + (p.x - p.prevX) * alpha;
  const y = p.prevY + (p.y - p.prevY) * alpha;
  const r = p.kind === 'shell' ? SHELL_R : BOLT_R;
  ctx.globalCompositeOperation = 'lighter';
  if (glow) {
    glow.draw(ctx, accent, r * 2.5, x, y, 0.9);
  } else {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Draw every projectile. */
export function drawProjectiles(ctx, glow, game, alpha) {
  const list = game.projectiles;
  for (let i = 0; i < list.length; i++) drawProjectile(ctx, glow, list[i], alpha);
}
