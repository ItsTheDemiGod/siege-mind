// Pooled particle system: structure-of-arrays in typed arrays, capacity allocated once, additive draw.

export const KIND = Object.freeze({ SPARK: 0, RING: 1, STREAK: 2, CLOUD: 3 });
const TAU = Math.PI * 2;

/**
 * @param {{capacity: number, rng: {next: () => number, range: (a: number, b: number) => number}}} options
 * @returns {object} particle system
 */
export function createParticleSystem({ capacity, rng }) {
  const kind = new Uint8Array(capacity);
  const color = new Uint16Array(capacity);
  const x = new Float32Array(capacity);
  const y = new Float32Array(capacity);
  const vx = new Float32Array(capacity);
  const vy = new Float32Array(capacity);
  const life = new Float32Array(capacity);
  const maxLife = new Float32Array(capacity);
  const size0 = new Float32Array(capacity);
  const size1 = new Float32Array(capacity);
  const drag = new Float32Array(capacity);
  const colors = [];
  const colorIds = new Map();
  let count = 0;
  let limit = capacity;
  let density = 1;
  let activeCap = capacity;

  const recompute = () => { activeCap = Math.floor(Math.min(limit, capacity) * density); };

  const emit = (k, px, py, pvx, pvy, plife, s0, s1, colorId, pdrag = 0) => {
    if (count >= activeCap) return -1;
    const i = count++;
    kind[i] = k; color[i] = colorId; x[i] = px; y[i] = py; vx[i] = pvx; vy[i] = pvy;
    life[i] = plife; maxLife[i] = plife; size0[i] = s0; size1[i] = s1; drag[i] = pdrag;
    return i;
  };

  const remove = (i) => {
    const l = --count;
    if (i === l) return;
    kind[i] = kind[l]; color[i] = color[l]; x[i] = x[l]; y[i] = y[l]; vx[i] = vx[l]; vy[i] = vy[l];
    life[i] = life[l]; maxLife[i] = maxLife[l]; size0[i] = size0[l]; size1[i] = size1[l]; drag[i] = drag[l];
  };

  return {
    registerColor(hex) {
      let id = colorIds.get(hex);
      if (id === undefined) {
        id = colors.length;
        colors.push(hex);
        colorIds.set(hex, id);
      }
      return id;
    },
    emit,
    /** Radial spark burst. opts: count, speed, life, size0, size1, color (id), drag, kind. */
    burst(px, py, opts) {
      const { count: n = 12, speed = 160, life: l = 0.5, size0: s0 = 6, size1: s1 = 1, color: c = 0, drag: d = 2.5, kind: k = KIND.SPARK } = opts;
      for (let i = 0; i < n; i++) {
        const a = rng.next() * TAU;
        const sp = speed * rng.range(0.4, 1);
        if (emit(k, px, py, Math.cos(a) * sp, Math.sin(a) * sp, l * rng.range(0.6, 1), s0, s1, c, d) < 0) return;
      }
    },
    /** Expanding shockwave ring. opts: life, size0, size1, color. */
    ring(px, py, opts) {
      const { life: l = 0.45, size0: s0 = 4, size1: s1 = 48, color: c = 0 } = opts;
      emit(KIND.RING, px, py, 0, 0, l, s0, s1, c, 0);
    },
    setLimit(n) { limit = Math.max(0, n); recompute(); },
    setDensity(d) { density = Math.min(1, Math.max(0, d)); recompute(); },
    update(dt) {
      if (dt <= 0) return;
      for (let i = count - 1; i >= 0; i--) {
        life[i] -= dt;
        if (life[i] <= 0) { remove(i); continue; }
        const k = Math.max(0, 1 - drag[i] * dt);
        vx[i] *= k;
        vy[i] *= k;
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
      }
      // If the cap was lowered (quality change / density), cull the surplus oldest-first by index.
      while (count > activeCap) remove(count - 1);
    },
    clear() { count = 0; },
    /**
     * Draw additively. `glow` may be null (Low tier): particles then use flat fills.
     * @param {CanvasRenderingContext2D} ctx
     * @param {{draw: Function}|null} glow
     */
    draw(ctx, glow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      let lastColor = -1;
      for (let i = 0; i < count; i++) {
        const t = 1 - life[i] / maxLife[i];
        const a = (1 - t) * (1 - t);
        const s = size0[i] + (size1[i] - size0[i]) * t;
        const c = color[i];
        if (c !== lastColor) {
          ctx.fillStyle = colors[c];
          ctx.strokeStyle = colors[c];
          lastColor = c;
        }
        switch (kind[i]) {
          case KIND.RING:
            ctx.globalAlpha = a;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x[i], y[i], s, 0, TAU);
            ctx.stroke();
            break;
          case KIND.STREAK:
            ctx.globalAlpha = a;
            ctx.lineWidth = Math.max(1, s);
            ctx.beginPath();
            ctx.moveTo(x[i], y[i]);
            ctx.lineTo(x[i] - vx[i] * 0.06, y[i] - vy[i] * 0.06);
            ctx.stroke();
            break;
          case KIND.CLOUD:
            if (glow) glow.draw(ctx, colors[c], s, x[i], y[i], a * 0.35);
            else { ctx.globalAlpha = a * 0.25; ctx.beginPath(); ctx.arc(x[i], y[i], s, 0, TAU); ctx.fill(); }
            break;
          default:
            if (glow) glow.draw(ctx, colors[c], s * 2, x[i], y[i], a);
            else { ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x[i], y[i], s * 0.6, 0, TAU); ctx.fill(); }
        }
      }
      ctx.restore();
    },
    get count() { return count; },
    get limit() { return activeCap; },
    get capacity() { return capacity; },
    // Read access for tests.
    positionOf: (i) => [x[i], y[i]],
  };
}
