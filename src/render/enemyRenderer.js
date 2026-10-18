// Draws enemies from sim state: shape, spawn scale-in, hit flash, status overlays and health bars.
// No per-enemy render state: everything derives from tick fields (spawnTick, lastHitTick). No per-frame allocation.
import { config } from '../data/config.js';
import { ENEMIES } from '../data/enemies.js';
import { enemyPose } from '../sim/enemies.js';
import { THEME } from './theme.js';
import { lighten } from './color.js';
import { drawEnemyShape } from './shapes.js';
import { easeOutBack, clamp01 } from './tween.js';

const TAU = Math.PI * 2;
const C = THEME.colors;
const BAR_H = 3;
const BAR_GAP = 5;
const LOW_HP = 0.3;
const ORBIT_SPEED = 3;
const shapeOpts = { flash: 0, spawn: 1, glow: true }; // reused for every enemy
const BAR_COLOR = Object.fromEntries(Object.keys(ENEMIES).map((id) => [id, lighten(THEME.enemy[id], 0.25)]));

function drawBar(ctx, x, y, w, fraction, color) {
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = C.bg0;
  ctx.fillRect(x - 1, y - 1, w + 2, BAR_H + 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp01(fraction), BAR_H);
}

/**
 * Draw one enemy. `enemy` is any object with the enemy state fields (the gallery passes fake ones).
 * @param {CanvasRenderingContext2D} ctx
 * @param {{draw: Function}|null} glow
 * @param {object} enemy
 * @param {{x: number, y: number, angle: number}} pose
 * @param {number} time - animation clock, seconds
 * @param {{tick: number, alpha: number, stepSeconds: number, params: {glow: boolean}, reducedMotion: boolean}} info
 * @returns {void}
 */
export function drawEnemy(ctx, glow, enemy, pose, time, info) {
  const d = ENEMIES[enemy.type];
  const r = d.radius;
  const now = info.tick + info.alpha;
  const age = (now - enemy.spawnTick) * info.stepSeconds;
  shapeOpts.spawn = easeOutBack(clamp01(age / config.fx.spawnScaleSeconds));
  shapeOpts.flash = enemy.lastHitTick >= 0
    ? Math.max(0, 1 - ((now - enemy.lastHitTick) * info.stepSeconds) / config.fx.hitFlashSeconds)
    : 0;
  shapeOpts.glow = info.params.glow;
  drawEnemyShape(ctx, glow, enemy.type, pose.x, pose.y, 1, pose.angle, time, shapeOpts);

  // status overlays
  if (enemy.slowRemaining > 0) {
    ctx.strokeStyle = C.secondary;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(pose.x, pose.y, r + 3, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (enemy.poisonRemaining > 0 && enemy.poisonStacks > 0) {
    ctx.fillStyle = C.tertiary;
    const spin = info.reducedMotion ? 0 : time * ORBIT_SPEED;
    const n = enemy.poisonStacks;
    for (let i = 0; i < n; i++) {
      const a = spin + (i / n) * TAU;
      ctx.beginPath();
      ctx.arc(pose.x + Math.cos(a) * (r + 7), pose.y + Math.sin(a) * (r + 7), 2, 0, TAU);
      ctx.fill();
    }
  }

  // health (and shield) bars, only when damaged
  const hurt = enemy.hp < enemy.maxHp;
  const shieldHurt = enemy.maxShield > 0 && enemy.shield < enemy.maxShield;
  if (hurt || shieldHurt) {
    const w = r * 2;
    const x = pose.x - r;
    const y = pose.y - (r + 8);
    const frac = enemy.hp / enemy.maxHp;
    drawBar(ctx, x, y, w, frac, frac < LOW_HP ? C.danger : BAR_COLOR[enemy.type]);
    if (enemy.maxShield > 0) drawBar(ctx, x, y - BAR_H - BAR_GAP + 2, w, enemy.shield / enemy.maxShield, THEME.enemy.shieldRing);
  }
}

/**
 * Draw every alive enemy in array order (stable, so draw order never flickers).
 * @param {CanvasRenderingContext2D} ctx @param {{draw: Function}|null} glow @param {object} game
 * @param {number} alpha @param {number} time @param {object} info @param {{x: number, y: number, angle: number}} scratch
 * @returns {void}
 */
export function drawEnemies(ctx, glow, game, alpha, time, info, scratch) {
  const list = game.enemies;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e.alive) continue;
    drawEnemy(ctx, glow, e, enemyPose(game, e, alpha, scratch), time, info);
  }
}
