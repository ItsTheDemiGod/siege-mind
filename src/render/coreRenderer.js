// The base core: a hex body inside a segmented ring. Lost lives are visible by SHAPE (missing ring arcs, cracks, shards), not only color.
// coreView = { segments, state (0 healthy, 1 damaged, 2 critical, 3 destroyed), pulse, destroyT, victoryT }, a preallocated scratch.
import { THEME } from './theme.js';
import { config } from '../data/config.js';
import { buildTintTable } from './tint.js';
import { hash01 } from './hash.js';
import { polygonPath } from './shapes.js';

const C = THEME.colors;
const TAU = Math.PI * 2;
const GAP = 0.14; // radians between ring arcs
const RING_R = 25;
const BODY_R = 14;
const FLICKER_HZ = 12;
const SHARDS = 6;
const SHARD_TRAVEL = 64;
const SHARD_R = 5;
// body/ring colors per state, precomputed (never mixed per frame); extends the tint table with the danger token
const STATE_COLOR = buildTintTable({ core: C.primary }, { 1: C.danger, 2: C.danger, 3: C.danger }, { 0: 0, 1: 0.2, 2: 0.55, 3: 0.8 }).core;
const CRACKS = Object.freeze([
  [-3, -13, 2, -3], [2, -3, -5, 6], [4, -12, 9, -2], [9, -2, 3, 11], [-10, 4, -2, 2], [-2, 2, 4, 6],
]);
const CRACKS_BY_STATE = [0, 2, CRACKS.length, 0];
const DASH_RING = [5, 6];

/** Deterministic flicker multiplier for damaged/critical states (a pure hash of the 12 Hz time bucket). */
function flicker(state, time, reduced) {
  if (reduced || state === 0 || state === 3) return 1;
  const threshold = state === 1 ? 0.88 : 0.6;
  return hash01(Math.floor(time * FLICKER_HZ), state) > threshold ? 0.45 : 1;
}

function drawRing(ctx, view, time, color, reduced) {
  const n = config.fx.coreSegments;
  const span = TAU / n - GAP;
  const rot = reduced ? 0 : time * 0.3;
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i * TAU) / n;
    const lit = i < view.segments;
    ctx.globalAlpha = lit ? 0.95 : 0.2;
    ctx.lineWidth = lit ? 3 : 1;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, RING_R, a0, a0 + span);
    ctx.stroke();
  }
}

function drawShards(ctx, t, reduced) {
  const ease = reduced ? 1 : 1 - (1 - t) * (1 - t);
  ctx.strokeStyle = STATE_COLOR[3];
  ctx.lineWidth = 1.5;
  for (let k = 0; k < SHARDS; k++) {
    const a = (k / SHARDS) * TAU + 0.3;
    const d = SHARD_TRAVEL * ease;
    ctx.globalAlpha = Math.max(0.25, 1 - t * 0.75);
    ctx.save();
    ctx.translate(Math.cos(a) * (BODY_R + d * 0.5), Math.sin(a) * (BODY_R + d * 0.5));
    ctx.rotate(a + (reduced ? 0 : t * 4));
    polygonPath(ctx, SHARD_R, 6, 0);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Draw the core in its current state.
 * @param {CanvasRenderingContext2D} ctx @param {{draw: Function}|null} glow @param {number} x @param {number} y @param {number} time
 * @param {{segments: number, state: number, pulse: number, destroyT: number, victoryT: number}} view
 * @param {{glow: boolean}} params quality params @param {boolean} reduced reduced motion
 * @returns {void}
 */
export function drawBaseCore(ctx, glow, x, y, time, view, params, reduced) {
  const { state } = view;
  const scale = 1 + (reduced ? 0 : 0.06 * Math.sin(time * 2.4)) + view.pulse * 0.35;
  const color = STATE_COLOR[state];
  const useGlow = glow && params.glow;
  const victory = view.victoryT > 0;
  ctx.save();
  ctx.translate(x, y);

  if (state === 3) { // destroyed: shards and scattering ring arcs, then a dim wreck outline
    const t = Math.min(1, view.destroyT);
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = STATE_COLOR[3];
    ctx.lineWidth = 1;
    polygonPath(ctx, BODY_R, 6, 0.2);
    ctx.stroke();
    ctx.setLineDash(DASH_RING);
    ctx.beginPath();
    ctx.arc(0, 0, RING_R + (reduced ? 40 : 40 * t), 0, TAU);
    ctx.globalAlpha = Math.max(0.15, 0.6 * (1 - t));
    ctx.stroke();
    ctx.setLineDash([]);
    drawShards(ctx, t, reduced);
    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  const fl = flicker(state, time, reduced);
  if (useGlow) {
    ctx.globalCompositeOperation = 'lighter';
    glow.draw(ctx, color, (44 + (victory ? 20 : 0)) * scale, 0, 0, Math.min(1, (0.5 + view.pulse * 0.4 + (victory ? 0.3 : 0)) * fl));
    ctx.globalCompositeOperation = 'source-over';
  }

  drawRing(ctx, view, time, color, reduced);

  ctx.save();
  ctx.rotate(reduced ? 0 : time * 0.5);
  polygonPath(ctx, BODY_R * scale, 6, 0);
  ctx.globalAlpha = (0.25 + (victory ? 0.2 : 0)) * fl;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = fl;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const cracks = CRACKS_BY_STATE[state];
  if (cracks > 0) { // cracks are shape: they show without color
    ctx.globalAlpha = 0.9 * fl;
    ctx.strokeStyle = C.bg0;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < cracks; i++) { ctx.moveTo(CRACKS[i][0], CRACKS[i][1]); ctx.lineTo(CRACKS[i][2], CRACKS[i][3]); }
    ctx.stroke();
  }

  if (state < 2) { // healthy and damaged keep the outer dashed ring
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(DASH_RING);
    ctx.save();
    ctx.rotate(reduced ? 0 : -time * 0.6);
    ctx.beginPath();
    ctx.arc(0, 0, RING_R + 7, 0, TAU);
    ctx.stroke();
    ctx.restore();
    ctx.setLineDash([]);
  }

  if (victory) { // expanding rings; a single static one under reduced motion
    ctx.strokeStyle = C.whiteHot;
    ctx.lineWidth = 2;
    const rings = reduced ? 1 : 3;
    for (let k = 0; k < rings; k++) {
      const phase = reduced ? 0.5 : (view.victoryT * 4 + k / rings) % 1;
      ctx.globalAlpha = (1 - phase) * 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, RING_R + 8 + phase * 70, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export { STATE_COLOR };
