// Procedural enemy shapes (Section 6B): distinct silhouette + color per type. Allocation-free per call.
import { THEME } from './theme.js';
import { mixHex } from './color.js';
import { buildTintTable } from './tint.js';
import { config } from '../data/config.js';

const TAU = Math.PI * 2;
const SIZES = Object.freeze({ armoredGrunt: 16, swarmling: 9, fastRunner: 12, regenerator: 14, shieldedBruiser: 22 });
const DASH = [7, 6]; // shared constant: setLineDash copies it, we never mutate it
const NO_DASH = [];
const NEUTRAL = Object.freeze({ flash: 0, spawn: 1, glow: true, tintKey: 0 });

// Body fill per enemy and status (0 none, 1 slowed, 2 poisoned, 3 both): a dark body, mixed toward the status color. Computed once.
// Slow uses the Defense blue (secondary) rather than the near-white frost tower accent so it stays distinguishable on a dark body.
const SLOW_TINT = THEME.colors.secondary;
const POISON_TINT = THEME.tower.poison;
export const BODY_FILL = buildTintTable(
  Object.fromEntries(Object.keys(SIZES).map((id) => [id, mixHex(THEME.colors.panel, THEME.enemy[id], 0.22)])),
  { 1: SLOW_TINT, 2: POISON_TINT, 3: mixHex(SLOW_TINT, POISON_TINT, 0.5) },
  { 0: 0, 1: config.fx.statusTintAmount, 2: config.fx.statusTintAmount, 3: config.fx.statusTintAmount },
);

export const ENEMY_TYPES = Object.freeze(Object.keys(SIZES));

/** Trace a regular polygon path centered at (0,0) in local space. */
export function polygonPath(ctx, r, sides, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * TAU;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Trace a triangle pointing along +x. */
export function trianglePath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(-r * 0.8, r * 0.8);
  ctx.lineTo(-r * 0.8, -r * 0.8);
  ctx.closePath();
}

/** Trace an elongated chevron pointing along +x. */
export function chevronPath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(r * 1.4, 0);
  ctx.lineTo(-r, r * 0.8);
  ctx.lineTo(-r * 0.4, 0);
  ctx.lineTo(-r, -r * 0.8);
  ctx.closePath();
}

/** Dashed arc (full circle by default) in local space; call setLineDash restore is handled here. */
export function dashedArc(ctx, r, offset, from = 0, to = TAU) {
  ctx.setLineDash(DASH);
  ctx.lineDashOffset = offset;
  ctx.beginPath();
  ctx.arc(0, 0, r, from, to);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);
}

function traceBody(ctx, typeId, r) {
  switch (typeId) {
    case 'armoredGrunt': polygonPath(ctx, r, 6, 0); break;
    case 'swarmling': trianglePath(ctx, r); break;
    case 'fastRunner': chevronPath(ctx, r); break;
    case 'regenerator': ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); break;
    case 'shieldedBruiser': polygonPath(ctx, r, 8, Math.PI / 8); break;
    default: throw new Error(`Unknown enemy type: ${typeId}`);
  }
}

/**
 * Draw one enemy.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{draw: Function}|null} glow - glow cache, or null to skip the glow (Low tier)
 * @param {string} typeId - one of ENEMY_TYPES
 * @param {number} x @param {number} y - logical position
 * @param {number} scale @param {number} angle - heading in radians
 * @param {number} time - seconds, drives pulses/rotation
 * @param {{flash: number, spawn: number, tintKey?: number}} [opts] - flash 0-1 toward white-hot, spawn 0-1 scale-in, tintKey 0 none / 1 slowed / 2 poisoned / 3 both (reuse one object)
 * @returns {void}
 */
export function drawEnemyShape(ctx, glow, typeId, x, y, scale, angle, time, opts = NEUTRAL) {
  const color = THEME.enemy[typeId];
  const r = SIZES[typeId] * scale * opts.spawn;
  if (r <= 0.01) return;

  if (glow && opts.glow !== false) {
    ctx.globalCompositeOperation = 'lighter';
    glow.draw(ctx, color, r * 2.2, x, y, 0.55 * opts.spawn);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(typeId === 'swarmling' || typeId === 'fastRunner' || typeId === 'armoredGrunt' ? angle : 0);
  traceBody(ctx, typeId, r);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = BODY_FILL[typeId][opts.tintKey || 0];
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.lineJoin = 'round';
  ctx.stroke();

  if (typeId === 'armoredGrunt') { // plate line across the front
    ctx.beginPath();
    ctx.moveTo(r * 0.35, -r * 0.55);
    ctx.lineTo(r * 0.35, r * 0.55);
    ctx.stroke();
  } else if (typeId === 'fastRunner') { // speed streak behind
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(-r * 1.3, 0);
    ctx.lineTo(-r * 2.4, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (typeId === 'regenerator') { // softly pulsing ring
    ctx.globalAlpha = 0.45 + 0.35 * Math.sin(time * 3);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4 + Math.sin(time * 3) * 1.5, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (typeId === 'shieldedBruiser') { // pale rotating dashed shield ring
    ctx.strokeStyle = THEME.enemy.shieldRing;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.85;
    dashedArc(ctx, r + 5, -time * 24);
    ctx.globalAlpha = 1;
  }

  // small highlight, then optional hit flash
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = THEME.colors.whiteHot;
  ctx.beginPath();
  ctx.arc(-r * 0.25, -r * 0.3, Math.max(1, r * 0.12), 0, TAU);
  ctx.fill();
  if (opts.flash > 0) {
    traceBody(ctx, typeId, r);
    ctx.globalAlpha = opts.flash;
    ctx.fillStyle = THEME.colors.whiteHot;
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Flat single-color silhouette of the same outline (proves shapes read without color).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} typeId
 * @param {number} x @param {number} y @param {number} scale @param {number} angle
 * @param {string} color
 * @returns {void}
 */
export function drawSilhouette(ctx, typeId, x, y, scale, angle, color) {
  const r = SIZES[typeId] * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(typeId === 'swarmling' || typeId === 'fastRunner' || typeId === 'armoredGrunt' ? angle : 0);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  traceBody(ctx, typeId, r);
  ctx.fill();
  if (typeId === 'regenerator') {
    ctx.beginPath();
    ctx.arc(0, 0, r + 5, 0, TAU);
    ctx.stroke();
  } else if (typeId === 'shieldedBruiser') {
    dashedArc(ctx, r + 5, 0);
  }
  ctx.restore();
}

/** @param {string} typeId @returns {number} base logical size */
export const enemySize = (typeId) => SIZES[typeId];
