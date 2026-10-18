// Glow sprite cache: pre-rendered radial gradients drawn additively (replaces per-frame blur shadows).
import { hexToRgb } from './color.js';

const STEP = 4; // radius quantization in px
const MAX_Q = 32; // largest sprite radius = MAX_Q * STEP

function makeCanvas(size) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(size, size);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

/**
 * @param {number} [limit] - max cached sprites; oldest are evicted first
 * @returns {{draw: Function, beginAdditive: Function, endAdditive: Function, readonly size: number}}
 */
export function createGlowCache(limit = 256) {
  /** @type {Map<string, any[]>} color -> sprites indexed by quantized radius (no string keys per draw) */
  const byColor = new Map();
  const fifo = []; // creation order, for eviction
  let size = 0;

  const create = (color, q) => {
    const r = q * STEP;
    const canvas = makeCanvas(r * 2);
    const g = canvas.getContext('2d');
    const [cr, cg, cb] = hexToRgb(color);
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
    grad.addColorStop(0.35, `rgba(${cr},${cg},${cb},0.45)`);
    grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, r * 2, r * 2);
    return canvas;
  };

  return {
    /** Draw a glow; caller has already set globalCompositeOperation to 'lighter'. */
    draw(ctx, color, radius, x, y, alpha) {
      const q = Math.min(MAX_Q, Math.max(1, Math.ceil(radius / STEP)));
      let sprites = byColor.get(color);
      if (!sprites) {
        sprites = [];
        byColor.set(color, sprites);
      }
      let sprite = sprites[q];
      if (!sprite) {
        sprite = create(color, q);
        sprites[q] = sprite;
        fifo.push(sprites, q);
        size++;
        if (size > limit) {
          const oldSprites = fifo.shift();
          const oldQ = fifo.shift();
          oldSprites[oldQ] = undefined;
          size--;
        }
      }
      const r = q * STEP;
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, x - r, y - r);
    },
    beginAdditive(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
    },
    endAdditive(ctx) {
      ctx.restore();
    },
    get size() { return size; },
  };
}
