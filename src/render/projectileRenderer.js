// Projectile drawing: lance comet tails (stateless), poison blobs with drips, mortar shells on a visual ballistic arc.
// Positions are interpolated with prevX/prevY and alpha. Allocation-free per frame.
import { THEME } from './theme.js';
import { lighten } from './color.js';
import { TOWER_VISUALS } from '../data/towerVisuals.js';
import { shellArc } from './shellArc.js';

const C = THEME.colors;
const TAU = Math.PI * 2;
const LANCE = THEME.tower.lance;
const POISON = THEME.tower.poison;
const LANCE_BRIGHT = lighten(LANCE, 0.5);
const POISON_BRIGHT = lighten(POISON, 0.4);
const TAIL_SEGMENTS = 3;
const SHELL_R = 6;
const SMOKE_STEPS = 3;
const SMOKE_GAP = 9; // world units between smoke puffs
const arc = { lift: 0, scale: 1, shadowScale: 1 };
const arc2 = { lift: 0, scale: 1, shadowScale: 1 };
let dripClock = 0;
let dripCounter = 0;

function tail(ctx, x, y, dx, dy, length, color, baseWidth) {
  for (let i = 0; i < TAIL_SEGMENTS; i++) {
    const a = (i * length) / TAIL_SEGMENTS;
    const b = ((i + 1) * length) / TAIL_SEGMENTS;
    ctx.globalAlpha = 0.85 * (1 - i / TAIL_SEGMENTS);
    ctx.lineWidth = Math.max(1, baseWidth * (1 - i / TAIL_SEGMENTS));
    ctx.beginPath();
    ctx.moveTo(x - dx * a, y - dy * a);
    ctx.lineTo(x - dx * b, y - dy * b);
    ctx.stroke();
  }
}

function dot(ctx, glow, color, x, y, r, alpha) {
  if (glow) {
    glow.draw(ctx, color, r * 2.6, x, y, alpha);
  } else {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}

function drawBolt(ctx, glow, p, x, y, dx, dy, time) {
  const lance = p.towerType === 'lance';
  const len = TOWER_VISUALS[p.towerType].trailLength;
  ctx.lineCap = 'round';
  ctx.strokeStyle = lance ? LANCE : POISON;
  tail(ctx, x, y, dx, dy, len, null, lance ? 4 : 5);
  if (lance) {
    dot(ctx, glow, LANCE, x, y, 5, 0.9);
    ctx.globalAlpha = 1;
    ctx.fillStyle = LANCE_BRIGHT;
    ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill();
  } else {
    dot(ctx, glow, POISON, x, y, 6 + Math.sin(time * 12 + p.id) * 1.2, 0.8); // pulsing halo
    ctx.globalAlpha = 1;
    ctx.fillStyle = POISON_BRIGHT;
    ctx.beginPath(); ctx.arc(x, y, 3.4, 0, TAU); ctx.fill();
  }
}

function drawShell(ctx, glow, p, x, y, dx, dy) {
  const visual = TOWER_VISUALS.mortar;
  const prog = p.flightDistance > 0 ? Math.hypot(x - p.ox, y - p.oy) / p.flightDistance : 1;
  shellArc(prog, visual.shellArcHeight, arc);
  // ground shadow
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = C.bg0;
  ctx.beginPath();
  ctx.ellipse(x, y, SHELL_R * 1.3 * arc.shadowScale, SHELL_R * 0.7 * arc.shadowScale, 0, 0, TAU);
  ctx.fill();
  // fading smoke tail along the visual arc
  ctx.fillStyle = C.muted;
  for (let i = 1; i <= SMOKE_STEPS; i++) {
    const back = i * SMOKE_GAP;
    shellArc(prog - back / Math.max(p.flightDistance, 1), visual.shellArcHeight, arc2);
    ctx.globalAlpha = 0.3 / i;
    ctx.beginPath();
    ctx.arc(x - dx * back, y - dy * back - arc2.lift, SHELL_R * (1 - i * 0.18), 0, TAU);
    ctx.fill();
  }
  // the shell itself, lifted and scaled
  ctx.globalCompositeOperation = 'lighter';
  dot(ctx, glow, THEME.tower.mortar, x, y - arc.lift, SHELL_R * arc.scale, 0.9);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.whiteHot;
  ctx.beginPath();
  ctx.arc(x, y - arc.lift, 2.4 * arc.scale, 0, TAU);
  ctx.fill();
}

/**
 * Draw every projectile; poison bolts also emit drip particles at a fixed rate (dt accumulator, tier-capped by the particle system).
 * @param {CanvasRenderingContext2D} ctx @param {{draw: Function}|null} glow @param {object} game
 * @param {number} alpha @param {number} dt seconds (0 while paused) @param {number} time
 * @param {{drip: Function}} fx
 * @returns {void}
 */
export function drawProjectiles(ctx, glow, game, alpha, dt, time, fx) {
  const list = game.projectiles;
  if (list.length === 0) return;
  dripClock += dt;
  const emitDrips = dripClock >= TOWER_VISUALS.poison.dripEverySeconds;
  if (emitDrips) dripClock = 0;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const x = p.prevX + (p.x - p.prevX) * alpha;
    const y = p.prevY + (p.y - p.prevY) * alpha;
    let dx = p.x - p.prevX;
    let dy = p.y - p.prevY;
    let len = Math.hypot(dx, dy);
    if (len < 1e-6) { dx = p.tx - p.ox; dy = p.ty - p.oy; len = Math.hypot(dx, dy) || 1; } // not moved yet: use the flight direction
    dx /= len; dy /= len;
    if (p.kind === 'shell') {
      ctx.globalCompositeOperation = 'source-over';
      drawShell(ctx, glow, p, x, y, dx, dy);
      ctx.globalCompositeOperation = 'lighter';
    } else {
      drawBolt(ctx, glow, p, x, y, dx, dy, time);
      if (emitDrips && p.towerType === 'poison') fx.drip(x, y, dripCounter++);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
