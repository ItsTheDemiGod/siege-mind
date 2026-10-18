// TEMPORARY plain placeholder drawing (Phase 1A); replaced in Phase 1B/2. Reads sim state, never mutates it.
import { config } from '../data/config.js';

const COLORS = {
  bg: '#070b14',
  hud: '#0d1424',
  buildable: '#1a2338',
  blocked: '#0b101c',
  blockedCross: '#2a3550',
  path: '#4a5a78',
  spawn: '#2e8b57',
  exit: '#b03a3a',
  grid: 'rgba(255,255,255,0.08)',
  walker: '#35e0ff',
  text: '#e8f0ff',
};

const pos = { x: 0, y: 0, angle: 0 }; // reused so drawing allocates nothing per walker

/**
 * Draw the whole debug scene in logical (1280x720) coordinates.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} game - sim state (read only)
 * @param {number} alpha - interpolation factor between the last two sim steps
 * @param {object} stats - { paused, showHud, fps, frameMs, ticksPerSecond, speed, steps, dpr, backingWidth, backingHeight }
 * @returns {void}
 */
export function drawDebugScene(ctx, game, alpha, stats) {
  const { width, height, hudHeight } = config.view;
  const { map } = game;
  const ts = map.tileSize;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = COLORS.hud;
  ctx.fillRect(0, 0, width, hudHeight);
  ctx.fillStyle = COLORS.text;
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('HUD strip (Phase 1B)', width - 160, 8);

  if (stats.showHud) {
    ctx.fillText(
      `FPS ${stats.fps.toFixed(0)}  frame ${stats.frameMs.toFixed(1)}ms  ticks/s ${stats.ticksPerSecond.toFixed(0)}  tick ${game.tick}  time ${game.time.toFixed(2)}s`,
      8, 8);
    ctx.fillText(
      `speed x${stats.speed}  paused ${stats.paused}  steps ${stats.steps}  alpha ${alpha.toFixed(2)}  walkers ${game.walkers.length}`,
      8, 28);
    ctx.fillText(`seed ${game.seed}  DPR ${stats.dpr}  backing ${stats.backingWidth}x${stats.backingHeight}`, 8, 48);
  }

  ctx.save();
  ctx.translate(0, hudHeight);
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const t = map.tileAt(c, r);
      const x = c * ts;
      const y = r * ts;
      ctx.fillStyle = t === '#' ? COLORS.blocked : t === 'S' ? COLORS.spawn : t === 'E' ? COLORS.exit : t === 'P' ? COLORS.path : COLORS.buildable;
      ctx.fillRect(x, y, ts, ts);
      if (t === '#') {
        ctx.strokeStyle = COLORS.blockedCross;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 8);
        ctx.lineTo(x + ts - 8, y + ts - 8);
        ctx.moveTo(x + ts - 8, y + 8);
        ctx.lineTo(x + 8, y + ts - 8);
        ctx.stroke();
      } else if (t === 'S' || t === 'E') {
        ctx.fillStyle = COLORS.text;
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t, x + ts / 2, y + ts / 2);
      }
    }
  }
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= map.cols; c++) {
    ctx.moveTo(c * ts + 0.5, 0);
    ctx.lineTo(c * ts + 0.5, map.height);
  }
  for (let r = 0; r <= map.rows; r++) {
    ctx.moveTo(0, r * ts + 0.5);
    ctx.lineTo(map.width, r * ts + 0.5);
  }
  ctx.stroke();

  ctx.fillStyle = COLORS.walker;
  for (const w of game.walkers) {
    map.path.positionAt(w.prevDistance + (w.distance - w.prevDistance) * alpha, pos);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (stats.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(width / 2 - 120, height / 2 - 40, 240, 80);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', width / 2, height / 2);
  }
}
