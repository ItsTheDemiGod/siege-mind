// Fixed-capacity pools for sniper beams and mortar scorch decals. Spawn/update are pure; draw only needs a 2D context.
import { THEME } from './theme.js';
import { config } from '../data/config.js';

const C = THEME.colors;
const BEAM_WIDE = 9;
const BEAM_CORE = 2;
const SCORCH_ALPHA = 0.55;
const EMBER_ALPHA = 0.45;
const TAU = Math.PI * 2;

function makePool(capacity, init) {
  const slots = Array.from({ length: capacity }, () => ({ active: false, age: 0, life: 1, ...init }));
  let count = 0;
  return {
    slots,
    capacity,
    /** @returns {object|null} the slot to fill in (already activated), or null when the pool is full */
    take(life) {
      for (let i = 0; i < capacity; i++) {
        const s = slots[i];
        if (!s.active) { s.active = true; s.age = 0; s.life = life; count++; return s; }
      }
      return null;
    },
    update(dt) {
      if (dt <= 0) return;
      for (let i = 0; i < capacity; i++) {
        const s = slots[i];
        if (!s.active) continue;
        s.age += dt;
        if (s.age >= s.life) { s.active = false; count--; }
      }
    },
    clear() { for (const s of slots) s.active = false; count = 0; },
    get count() { return count; },
  };
}

/** Sniper beams: a bright core line plus a wider soft line, fading over their life. */
export function createBeamPool(capacity = config.fx.beamCapacity) {
  const pool = makePool(capacity, { x1: 0, y1: 0, x2: 0, y2: 0 });
  return {
    slots: pool.slots,
    capacity: pool.capacity,
    update: pool.update,
    clear: pool.clear,
    get count() { return pool.count; },
    spawn(x1, y1, x2, y2, life) {
      const s = pool.take(life);
      if (!s) return false;
      s.x1 = x1; s.y1 = y1; s.x2 = x2; s.y2 = y2;
      return true;
    },
    /** Additive draw; `color` is the tower accent. */
    draw(ctx, color) {
      if (pool.count === 0) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (let i = 0; i < pool.slots.length; i++) {
        const s = pool.slots[i];
        if (!s.active) continue;
        const t = s.age / s.life;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3 * (1 - t);
        ctx.lineWidth = BEAM_WIDE * (1 - t * 0.6);
        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
        ctx.strokeStyle = C.whiteHot;
        ctx.globalAlpha = 1 - t;
        ctx.lineWidth = BEAM_CORE;
        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      }
      ctx.restore();
    },
  };
}

/** Mortar scorch marks: dark discs with a fading ember ring, drawn above the static layer and below enemies. */
export function createDecalPool(capacity = config.fx.decalCapacity) {
  const pool = makePool(capacity, { x: 0, y: 0, r: 0 });
  return {
    slots: pool.slots,
    capacity: pool.capacity,
    update: pool.update,
    clear: pool.clear,
    get count() { return pool.count; },
    spawn(x, y, r, life) {
      const s = pool.take(life);
      if (!s) return false;
      s.x = x; s.y = y; s.r = r;
      return true;
    },
    draw(ctx, emberColor) {
      if (pool.count === 0) return;
      for (let i = 0; i < pool.slots.length; i++) {
        const s = pool.slots[i];
        if (!s.active) continue;
        const fade = 1 - s.age / s.life;
        ctx.globalAlpha = SCORCH_ALPHA * fade;
        ctx.fillStyle = C.bg0;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.8, 0, TAU); ctx.fill();
        ctx.globalAlpha = EMBER_ALPHA * fade * fade;
        ctx.strokeStyle = emberColor;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.8, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  };
}
