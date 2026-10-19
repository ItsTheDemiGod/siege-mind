// Layered scene pieces: cached static background plus cheap per-frame dynamic layers (path flow, portal, core, motes).
import { THEME } from './theme.js';
import { mixHex, withAlpha } from './color.js';
import { dashedArc } from './shapes.js';

const TAU = Math.PI * 2;
const C = THEME.colors;
const FLOW_SPEED = 80; // world units per second
const MIN_REBUILD_MS = 150;
const GUIDE_DASH = [10, 10];
const NO_DASH = [];

/**
 * Static layer rebuild policy: rebuild when the key (backing size, dpr, quality tier, map) changes,
 * but at most once per MIN_REBUILD_MS. Between rebuilds the previous canvas is drawn scaled to the new size.
 * @param {string|null} builtKey @param {string} wantedKey @param {number} lastBuildMs @param {number} nowMs
 * @returns {boolean}
 */
export function shouldRebuild(builtKey, wantedKey, lastBuildMs, nowMs) {
  if (builtKey === null) return true;
  return builtKey !== wantedKey && nowMs - lastBuildMs >= MIN_REBUILD_MS;
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function drawBrackets(ctx, x, y, s, len) {
  ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
  ctx.moveTo(x + s - len, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + len);
  ctx.moveTo(x + s, y + s - len); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s - len, y + s);
  ctx.moveTo(x + len, y + s); ctx.lineTo(x, y + s); ctx.lineTo(x, y + s - len);
}

function chamferPath(ctx, x, y, s, c) {
  ctx.beginPath();
  ctx.moveTo(x + c, y); ctx.lineTo(x + s - c, y); ctx.lineTo(x + s, y + c); ctx.lineTo(x + s, y + s - c);
  ctx.lineTo(x + s - c, y + s); ctx.lineTo(x + c, y + s); ctx.lineTo(x, y + s - c); ctx.lineTo(x, y + c);
  ctx.closePath();
}

/**
 * Build the cached background at backing resolution, drawn in logical coordinates.
 * @param {{map: object, hudHeight: number, width: number, height: number, backingWidth: number, backingHeight: number, waypoints: {col: number, row: number}[]}} o
 * @returns {HTMLCanvasElement|OffscreenCanvas}
 */
export function buildStaticLayer({ map, hudHeight, width, height, backingWidth, backingHeight, waypoints }) {
  const canvas = makeCanvas(backingWidth, backingHeight);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(backingWidth / width, 0, 0, backingHeight / height, 0, 0);
  const ts = map.tileSize;

  // 1. background
  const bg = ctx.createRadialGradient(width / 2, height / 2 + hudHeight / 2, 40, width / 2, height / 2, width * 0.7);
  bg.addColorStop(0, C.bg1);
  bg.addColorStop(1, C.bg0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(0, hudHeight);

  // 2. grids: fine 16 px table grid, then the 64 px tile grid
  ctx.strokeStyle = C.gridLine;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  for (let x = 0; x <= map.width; x += 16) { ctx.moveTo(x, 0); ctx.lineTo(x, map.height); }
  for (let y = 0; y <= map.height; y += 16) { ctx.moveTo(0, y); ctx.lineTo(map.width, y); }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= map.cols; c++) { ctx.moveTo(c * ts + 0.5, 0); ctx.lineTo(c * ts + 0.5, map.height); }
  for (let r = 0; r <= map.rows; r++) { ctx.moveTo(0, r * ts + 0.5); ctx.lineTo(map.width, r * ts + 0.5); }
  ctx.stroke();

  // 3. buildable slots: faint inner square + corner brackets
  ctx.strokeStyle = C.secondary;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  for (const { col, row } of map.buildableCells()) ctx.rect(col * ts + 8, row * ts + 8, ts - 16, ts - 16);
  ctx.stroke();
  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  for (const { col, row } of map.buildableCells()) drawBrackets(ctx, col * ts + 6, row * ts + 6, ts - 12, 6);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 4. blocked obstacles: chamfered dark slabs with hatching
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (map.tileAt(c, r) !== '#') continue;
      const x = c * ts + 5;
      const y = r * ts + 5;
      const s = ts - 10;
      chamferPath(ctx, x, y, s, 9);
      ctx.fillStyle = C.bg0;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = C.muted;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      for (let k = -s; k < s; k += 8) { ctx.moveTo(x + k, y + s); ctx.lineTo(x + k + s, y); }
      ctx.stroke();
      ctx.restore();
      chamferPath(ctx, x, y, s, 9);
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = C.muted;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // 5. path channel: soft outer glow, lit inner channel, dashed center guide
  const pts = waypoints.map((w) => map.tileToWorld(w.col, w.row));
  const trace = () => {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  trace();
  ctx.lineWidth = 56; ctx.strokeStyle = C.secondary; ctx.globalAlpha = 0.18; ctx.stroke();
  trace();
  ctx.lineWidth = 48; ctx.strokeStyle = mixHex(C.panel, C.whiteHot, 0.06); ctx.globalAlpha = 1; ctx.stroke();
  trace();
  ctx.lineWidth = 2; ctx.strokeStyle = C.primary; ctx.globalAlpha = 0.3; ctx.setLineDash(GUIDE_DASH); ctx.stroke();
  ctx.setLineDash(NO_DASH);
  ctx.globalAlpha = 1;
  ctx.restore();

  // 6. scanlines
  ctx.fillStyle = C.whiteHot;
  ctx.globalAlpha = 0.03;
  ctx.beginPath();
  for (let y = 0; y < height; y += 3) ctx.rect(0, y, width, 1);
  ctx.fill();

  // 7. vignette
  const vg = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, width * 0.62);
  vg.addColorStop(0, withAlpha(C.bg0, 0));
  vg.addColorStop(1, C.bg0);
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, width, height);

  // 8. HUD strip with a glowing bottom edge
  const hg = ctx.createLinearGradient(0, 0, 0, hudHeight);
  hg.addColorStop(0, C.bg0);
  hg.addColorStop(1, C.panel);
  ctx.globalAlpha = 1;
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, width, hudHeight);
  ctx.fillStyle = C.primary;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(0, hudHeight - 4, width, 3);
  ctx.globalAlpha = 0.7;
  ctx.fillRect(0, hudHeight - 1, width, 1);
  ctx.globalAlpha = 1;
  return canvas;
}

/**
 * Chevron pulses flowing along the path. Static and dimmer under reduced motion; no glow sprites when params.glow is false.
 * @param {CanvasRenderingContext2D} ctx @param {{draw: Function}|null} glow @param {object} map
 * @param {number} time @param {{pathPulseSpacing: number, glow: boolean}} params
 * @param {boolean} reducedMotion @param {{x: number, y: number, angle: number}} scratch - reused output object
 * @returns {void}
 */
export function drawPathFlow(ctx, glow, map, time, params, reducedMotion, scratch) {
  const spacing = params.pathPulseSpacing;
  const offset = reducedMotion ? 0 : (time * FLOW_SPEED) % spacing;
  const total = map.path.totalLength;
  ctx.strokeStyle = C.primary;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let d = offset; d < total; d += spacing) {
    map.path.positionAt(d, scratch);
    if (glow && params.glow) {
      ctx.globalCompositeOperation = 'lighter';
      glow.draw(ctx, C.primary, 12, scratch.x, scratch.y, reducedMotion ? 0.08 : 0.2);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.translate(scratch.x, scratch.y);
    ctx.rotate(scratch.angle);
    ctx.globalAlpha = reducedMotion ? 0.25 : 0.55;
    ctx.beginPath();
    ctx.moveTo(-5, -6); ctx.lineTo(3, 0); ctx.lineTo(-5, 6);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** Spawn portal: concentric rotating dashed rings in the Director violet (the Director sends the waves). */
export function drawSpawnPortal(ctx, glow, x, y, time) {
  if (glow) {
    ctx.globalCompositeOperation = 'lighter';
    glow.draw(ctx, C.director, 40, x, y, 0.45 + 0.1 * Math.sin(time * 2));
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = C.director;
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.9 - i * 0.2;
    ctx.save();
    ctx.rotate(time * (i % 2 === 0 ? 1 : -1) * (0.9 - i * 0.2));
    dashedArc(ctx, 12 + i * 8, 0);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Ambient motes: slow drifting dots, preallocated typed arrays.
 * @param {number} count @param {{range: Function}} rng - the fx rng @param {number} width @param {number} height
 * @returns {{count: number, x: Float32Array, y: Float32Array, vx: Float32Array, vy: Float32Array, size: Float32Array, width: number, height: number}}
 */
export function createAmbientMotes(count, rng, width, height) {
  const m = {
    count, width, height,
    x: new Float32Array(count), y: new Float32Array(count),
    vx: new Float32Array(count), vy: new Float32Array(count), size: new Float32Array(count),
  };
  for (let i = 0; i < count; i++) {
    m.x[i] = rng.range(0, width);
    m.y[i] = rng.range(0, height);
    m.vx[i] = rng.range(-6, 6);
    m.vy[i] = rng.range(-10, -2);
    m.size[i] = rng.range(1, 2.2);
  }
  return m;
}

/** Advance motes and wrap them around the stage. */
export function updateAmbientMotes(m, dt) {
  for (let i = 0; i < m.count; i++) {
    m.x[i] += m.vx[i] * dt;
    m.y[i] += m.vy[i] * dt;
    if (m.x[i] < 0) m.x[i] += m.width; else if (m.x[i] > m.width) m.x[i] -= m.width;
    if (m.y[i] < 0) m.y[i] += m.height; else if (m.y[i] > m.height) m.y[i] -= m.height;
  }
}

/** Draw motes at very low alpha; nothing when count is 0. */
export function drawAmbientMotes(ctx, m) {
  if (m.count === 0) return;
  ctx.fillStyle = C.primary;
  ctx.globalAlpha = 0.14;
  ctx.beginPath();
  for (let i = 0; i < m.count; i++) ctx.rect(m.x[i], m.y[i], m.size[i], m.size[i]);
  ctx.fill();
  ctx.globalAlpha = 1;
}
