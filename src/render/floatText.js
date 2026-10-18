// Pooled floating texts ("+25", damage numbers). Fixed capacity, no allocation per frame.
import { THEME } from './theme.js';

const MAX = 64;

/**
 * @param {{capacity?: number}} [options]
 * @returns {object}
 */
export function createFloatText({ capacity = MAX } = {}) {
  const text = new Array(capacity).fill('');
  const color = new Array(capacity).fill(THEME.colors.text);
  const x = new Float32Array(capacity);
  const y = new Float32Array(capacity);
  const rise = new Float32Array(capacity);
  const life = new Float32Array(capacity);
  const maxLife = new Float32Array(capacity);
  const size = new Float32Array(capacity);
  const fonts = new Map(); // size -> font string, built once per distinct size
  let count = 0;
  let cap = capacity;
  let outline = true;

  const fontFor = (s) => {
    let f = fonts.get(s);
    if (!f) { f = `700 ${s}px ${THEME.fonts.display}`; fonts.set(s, f); }
    return f;
  };

  const remove = (i) => {
    const l = --count;
    text[i] = text[l]; color[i] = color[l]; x[i] = x[l]; y[i] = y[l]; rise[i] = rise[l];
    life[i] = life[l]; maxLife[i] = maxLife[l]; size[i] = size[l];
  };

  return {
    /** @returns {boolean} false when the pool is full */
    spawn(str, px, py, { color: c = THEME.colors.text, size: s = 20, rise: r = 36, life: l = 0.9 } = {}) {
      if (count >= Math.min(cap, capacity)) return false;
      const i = count++;
      text[i] = str; color[i] = c; x[i] = px; y[i] = py; rise[i] = r; life[i] = l; maxLife[i] = l; size[i] = s;
      return true;
    },
    update(dt) {
      if (dt <= 0) return;
      for (let i = count - 1; i >= 0; i--) {
        life[i] -= dt;
        if (life[i] <= 0) remove(i);
      }
    },
    draw(ctx) {
      if (count === 0) return;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = THEME.colors.bg0;
      for (let i = 0; i < count; i++) {
        const t = 1 - life[i] / maxLife[i];
        ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
        ctx.font = fontFor(size[i]);
        const py = y[i] - rise[i] * (1 - (1 - t) * (1 - t));
        if (outline) ctx.strokeText(text[i], x[i], py);
        ctx.fillStyle = color[i];
        ctx.fillText(text[i], x[i], py);
      }
      ctx.restore();
    },
    setCap(n) { cap = n; while (count > cap) remove(count - 1); },
    setOutline(on) { outline = on; },
    clear() { count = 0; },
    get count() { return count; },
    get cap() { return Math.min(cap, capacity); },
  };
}
