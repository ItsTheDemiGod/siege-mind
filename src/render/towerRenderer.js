// Final procedural tower art: Path2D shapes, recoil, muzzle flash, charge glow, build-in, tier marks, sell ghosts.
// Allocation-free per frame: Path2D objects are built once per (type, level); colors come from precomputed constants.
import { THEME } from './theme.js';
import { lighten } from './color.js';
import { TOWER_ORDER } from '../data/towers.js';
import { TOWER_VISUALS } from '../data/towerVisuals.js';
import { TOWER_SHAPES } from './towerShapes.js';
import { towerPaths, tierPath } from './towerPaths.js';
import { towerAnim, spinAngle } from './towerAnim.js';
import { easeOutBack } from './tween.js';
import { hash01 } from './hash.js';
import { getTowerStats } from '../sim/towers.js';
import { config } from '../data/config.js';

const TAU = Math.PI * 2;
const C = THEME.colors;
const BRIGHT = Object.fromEntries(TOWER_ORDER.map((id) => [id, lighten(THEME.tower[id], 0.5)])); // computed once
const DASH = [4, 4];
const NO_DASH = [];
const TIER_DY = 7; // tier mark sits this far below the body
const BUBBLES = 4;
const BUBBLE_SPEED = 0.35; // rises per second (fraction of the flask)
const anim = { buildT: 1, recoil: 0, flash: 0, charge: 0 }; // reused scratch
const ghostAnim = { buildT: 1, recoil: 0, flash: 0, charge: 0 };
const towerInfo = { glow: true, reducedMotion: false, selected: false, upgrade: 0, seed: 0 }; // reused for every tower

function drawGroup(ctx, g, accent, bright, selected) {
  ctx.fillStyle = C.panel;
  ctx.fill(g.fill);
  ctx.fillStyle = bright;
  ctx.fill(g.brightFill);
  ctx.strokeStyle = selected ? bright : accent;
  ctx.lineWidth = selected ? 2.6 : 2;
  ctx.stroke(g.stroke);
  ctx.lineWidth = 1.6;
  ctx.stroke(g.thin);
  ctx.lineWidth = 2.2;
  ctx.stroke(g.thick);
  ctx.setLineDash(DASH);
  ctx.lineWidth = 1.6;
  ctx.stroke(g.dashed);
  ctx.setLineDash(NO_DASH);
  ctx.strokeStyle = bright;
  ctx.lineWidth = 2;
  ctx.stroke(g.bright);
}

function additiveGlow(ctx, glow, color, radius, x, y, alpha, plain) {
  if (alpha <= 0.01) return;
  ctx.globalCompositeOperation = 'lighter';
  if (glow) {
    glow.draw(ctx, color, radius, x, y, alpha);
  } else if (plain) { // Low tier: one flat disc instead of a glow sprite
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** The shared drawing core: base, rotating turret with recoiling barrel, poison liquid, flashes, tier mark. */
function drawBody(ctx, glow, type, level, x, y, angle, a, visual, time, info) {
  const accent = THEME.tower[type];
  const bright = BRIGHT[type];
  const shape = TOWER_SHAPES[type][level];
  const paths = towerPaths(type, level);
  ctx.save();
  ctx.translate(x, y);
  const gl = info.glow ? glow : null;
  additiveGlow(ctx, gl, accent, visual.bodyRadius * 1.7, 0, 0, 0.3 + a.flash * 0.3 + info.upgrade * 0.5, info.glow);

  drawGroup(ctx, paths.base, accent, bright, info.selected);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.6;
  ctx.save();
  ctx.translate(0, visual.bodyRadius + TIER_DY);
  ctx.stroke(tierPath(level));
  ctx.restore();

  ctx.save();
  ctx.rotate(visual.turnRate > 0 ? angle : spinAngle(time, info.reducedMotion ? 0 : visual.spinRate));
  drawGroup(ctx, paths.turret, accent, bright, info.selected);
  ctx.save();
  ctx.translate(-a.recoil * visual.recoilDistance, 0);
  drawGroup(ctx, paths.barrel, accent, bright, info.selected);
  ctx.restore();
  if (visual.flashSize > 0) additiveGlow(ctx, gl, bright, visual.flashSize * (0.6 + 0.4 * a.flash), shape.muzzle.x, 0, a.flash, info.glow);
  if (visual.chargeSeconds > 0) {
    additiveGlow(ctx, gl, bright, 6 + 12 * a.charge, shape.muzzle.x, 0, a.charge * 0.8, info.glow);
    if (shape.lens) additiveGlow(ctx, gl, bright, 5 + 5 * a.charge, shape.lens.x, shape.lens.y, 0.25 + 0.75 * a.charge, info.glow);
  } else if (shape.lens) {
    additiveGlow(ctx, gl, bright, 7, shape.lens.x, shape.lens.y, 0.7, info.glow);
  }
  if (visual.turnRate === 0 && visual.flashSeconds > 0) additiveGlow(ctx, gl, bright, visual.bodyRadius * 1.4, 0, 0, a.flash * 0.7, info.glow); // frost pulse
  ctx.restore();

  if (type === 'poison') drawPoisonFill(ctx, accent, bright, shape, info.seed, time, info.reducedMotion);
  ctx.restore();
}

/** Poison liquid level and rising bubbles, drawn in the unrotated frame so "down" stays down. */
function drawPoisonFill(ctx, accent, bright, shape, seed, time, reduced) {
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(0, 2, 8.5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  if (reduced) return;
  ctx.fillStyle = bright;
  for (let i = 0; i < BUBBLES; i++) {
    const phase = (time * BUBBLE_SPEED + hash01(seed, i)) % 1;
    ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.8;
    ctx.beginPath();
    ctx.arc((hash01(seed, i + 17) * 2 - 1) * 5, 8 - phase * 10, 1.1 + hash01(seed, i + 31), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Draw one tower with all its animation states (build-in, recoil, flash, charge, upgrade flash).
 * @param {CanvasRenderingContext2D} ctx @param {{draw: Function}|null} glow
 * @param {object} tower sim tower @param {object} stats getTowerStats(type, level) @param {object} visual TOWER_VISUALS[type]
 * @param {{buildT: number, recoil: number, flash: number, charge: number}} a anim values
 * @param {number} renderAngle smoothed aim angle @param {number} time seconds
 * @param {{glow: boolean, reducedMotion: boolean, selected: boolean, upgrade: number, seed: number}} info reused per call
 * @returns {void}
 */
export function drawTower(ctx, glow, tower, stats, visual, a, renderAngle, time, info) {
  if (a.buildT < 1) {
    const s = easeOutBack(a.buildT);
    ctx.save();
    ctx.translate(tower.x, tower.y);
    ctx.scale(s, s);
    ctx.globalAlpha = a.buildT;
    drawBody(ctx, glow, tower.type, tower.level, 0, 0, renderAngle, a, visual, time, info);
    ctx.restore();
    ctx.strokeStyle = THEME.tower[tower.type]; // expanding ring plus a scanline sweep
    ctx.lineWidth = 2;
    ctx.globalAlpha = 1 - a.buildT;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 10 + 36 * a.buildT, 0, TAU);
    ctx.stroke();
    const r = visual.bodyRadius;
    ctx.globalAlpha = 0.8 * (1 - a.buildT);
    ctx.beginPath();
    ctx.moveTo(tower.x - r, tower.y - r + 2 * r * a.buildT);
    ctx.lineTo(tower.x + r, tower.y - r + 2 * r * a.buildT);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  drawBody(ctx, glow, tower.type, tower.level, tower.x, tower.y, renderAngle, a, visual, time, info);
}

/** Sell dissolve: the tower shrinks and fades. @param {{type: string, level: number, x: number, y: number, angle: number, age: number, life: number}} g */
export function drawTowerGhost(ctx, glow, g, time, info) {
  towerInfo.glow = info.glow;
  towerInfo.reducedMotion = info.reducedMotion;
  towerInfo.selected = false;
  towerInfo.upgrade = 0;
  towerInfo.seed = 0;
  const t = g.age / g.life;
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.translate(g.x, g.y);
  ctx.scale(1 - 0.5 * t, 1 - 0.5 * t);
  drawBody(ctx, glow, g.type, g.level, 0, 0, g.angle, ghostAnim, TOWER_VISUALS[g.type], time, towerInfo);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/**
 * Draw every tower.
 * @param {CanvasRenderingContext2D} ctx @param {{draw: Function}|null} glow @param {object} game
 * @param {number} time seconds @param {number} dt real frame seconds (0 while paused) @param {number} alpha interpolation
 * @param {{angle: Function, upgradeAmount: Function}} view @param {{glow: boolean, reducedMotion: boolean}} flags
 * @param {number|null} selectedId
 * @returns {void}
 */
export function drawTowers(ctx, glow, game, time, dt, alpha, view, flags, selectedId) {
  const list = game.towers;
  towerInfo.glow = flags.glow;
  towerInfo.reducedMotion = flags.reducedMotion;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const visual = TOWER_VISUALS[t.type];
    const stats = getTowerStats(t.type, t.level);
    towerAnim(t, stats, game.tick + alpha, config.sim.stepSeconds, visual, anim);
    towerInfo.selected = t.id === selectedId;
    towerInfo.upgrade = view.upgradeAmount(t.id, time, visual.upgradeFlashSeconds);
    towerInfo.seed = t.id;
    drawTower(ctx, glow, t, stats, visual, anim, view.angle(t, dt), time, towerInfo);
  }
}

/** Draw a plain tower silhouette for the placement ghost (level 0, no animation). */
export function drawTowerPlain(ctx, glow, type, level, x, y, angle, time, flags) {
  towerInfo.glow = flags.glow;
  towerInfo.reducedMotion = flags.reducedMotion;
  towerInfo.selected = false;
  towerInfo.upgrade = 0;
  towerInfo.seed = 0;
  drawBody(ctx, glow, type, level, x, y, angle, ghostAnim, TOWER_VISUALS[type], time, towerInfo);
}
