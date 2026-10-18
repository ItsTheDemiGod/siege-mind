// Draws enemies from sim state: shape, spawn scale-in, hit flash, status overlays and health bars.
// No per-enemy render state: everything derives from tick fields (spawnTick, lastHitTick). No per-frame allocation.
import { config } from '../data/config.js';
import { ENEMIES } from '../data/enemies.js';
import { enemyPose } from '../sim/enemies.js';
import { THEME } from './theme.js';
import { lighten } from './color.js';
import { drawEnemyShape } from './shapes.js';
import { hash01 } from './hash.js';
import { easeOutBack, clamp01 } from './tween.js';

const TAU = Math.PI * 2;
const C = THEME.colors;
const BAR_H = 3;
const BAR_GAP = 5;
const LOW_HP = 0.3;
const ORBIT_BASE = 1.5; // rad/s, plus ORBIT_PER_STACK per stack
const ORBIT_PER_STACK = 0.8;
const MAX_DOTS = 5;
const DOT_R = 4.5;
const BUBBLES = 3;
const BUBBLE_RISE = 0.5; // body heights per second
const ICON = 4; // half size of the status icons
const shapeOpts = { flash: 0, spawn: 1, glow: true, tintKey: 0 }; // reused for every enemy
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
  const slowed = enemy.slowRemaining > 0;
  const poisoned = enemy.poisonRemaining > 0 && enemy.poisonStacks > 0;
  shapeOpts.tintKey = (slowed ? 1 : 0) + (poisoned ? 2 : 0);
  const rich = info.params.name !== 'low' && !info.reducedMotion; // haze and bubbles are skipped on Low and under reduced motion

  if (poisoned && info.params.name !== 'low') { // faint green ground haze under the body
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = C.tertiary;
    ctx.beginPath();
    ctx.arc(pose.x, pose.y, r + 10, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  drawEnemyShape(ctx, glow, enemy.type, pose.x, pose.y, 1, pose.angle, time, shapeOpts);

  if (slowed) { // thick pulsing outer ring plus a thin inner ring
    const pulse = info.reducedMotion ? 0 : Math.sin(time * 5);
    ctx.strokeStyle = C.secondary;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.75 + 0.2 * pulse;
    ctx.beginPath();
    ctx.arc(pose.x, pose.y, r + 5 + pulse, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(pose.x, pose.y, r + 2, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (poisoned) { // one bright dot per stack (max 5); more stacks orbit faster
    const n = Math.min(MAX_DOTS, enemy.poisonStacks);
    const spin = info.reducedMotion ? 0 : time * (ORBIT_BASE + ORBIT_PER_STACK * n);
    ctx.fillStyle = C.tertiary;
    for (let i = 0; i < n; i++) {
      const ang = spin + (i / n) * TAU;
      ctx.beginPath();
      ctx.arc(pose.x + Math.cos(ang) * (r + 8), pose.y + Math.sin(ang) * (r + 8), DOT_R, 0, TAU);
      ctx.fill();
    }
    if (rich) { // bubbles rising from the body, deterministic from id and time
      ctx.fillStyle = C.whiteHot;
      for (let i = 0; i < BUBBLES; i++) {
        const phase = (time * BUBBLE_RISE + hash01(enemy.id, i)) % 1;
        ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.7;
        ctx.beginPath();
        ctx.arc(pose.x + (hash01(enemy.id, i + 9) * 2 - 1) * r * 0.7, pose.y + r * 0.5 - phase * (r * 2), 1.4 + hash01(enemy.id, i + 21) * 1.2, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // status icons beside the health bar: shapes (snowflake, droplet) so they read without color
  if (slowed || poisoned) {
    let ix = pose.x + r + 6;
    const iy = pose.y - (r + 8) + 1.5;
    ctx.lineWidth = 1.4;
    if (slowed) {
      ctx.strokeStyle = C.secondary;
      ctx.beginPath();
      ctx.moveTo(ix - ICON, iy); ctx.lineTo(ix + ICON, iy);
      ctx.moveTo(ix - ICON * 0.5, iy - ICON * 0.87); ctx.lineTo(ix + ICON * 0.5, iy + ICON * 0.87);
      ctx.moveTo(ix - ICON * 0.5, iy + ICON * 0.87); ctx.lineTo(ix + ICON * 0.5, iy - ICON * 0.87);
      ctx.stroke();
      ix += ICON * 2 + 3;
    }
    if (poisoned) {
      ctx.fillStyle = C.tertiary;
      ctx.beginPath();
      ctx.moveTo(ix, iy - ICON);
      ctx.quadraticCurveTo(ix + ICON, iy + ICON * 0.2, ix, iy + ICON);
      ctx.quadraticCurveTo(ix - ICON, iy + ICON * 0.2, ix, iy - ICON);
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
