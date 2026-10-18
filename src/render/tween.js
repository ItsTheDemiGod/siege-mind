// Easing functions and a pooled tween manager (no allocation after creation).

export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const linear = (t) => clamp01(t);
export const easeInQuad = (t) => { t = clamp01(t); return t * t; };
export const easeOutQuad = (t) => { t = clamp01(t); return 1 - (1 - t) * (1 - t); };
export const easeInOutQuad = (t) => { t = clamp01(t); return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; };
export const easeOutCubic = (t) => { t = clamp01(t); return 1 - (1 - t) ** 3; };
export const easeInOutCubic = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; };
/** Overshoots slightly past 1 mid-way, ends exactly on 1. */
export const easeOutBack = (t) => { t = clamp01(t); const c1 = 1.70158; return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2; };
export const easeOutExpo = (t) => { t = clamp01(t); return t === 1 ? 1 : 1 - 2 ** (-10 * t); };

/**
 * Pooled tween manager. Each tween animates target[key] from its current value to `to`.
 * @param {number} [capacity]
 * @returns {{start: Function, update: (dt: number) => void, cancel: (target: object) => void, readonly activeCount: number}}
 */
export function createTweens(capacity = 128) {
  const targets = new Array(capacity).fill(null);
  const keys = new Array(capacity).fill('');
  const from = new Float64Array(capacity);
  const to = new Float64Array(capacity);
  const dur = new Float64Array(capacity);
  const elapsed = new Float64Array(capacity);
  const delay = new Float64Array(capacity);
  const eases = new Array(capacity).fill(easeOutCubic);
  const onDone = new Array(capacity).fill(null);
  const free = new Int32Array(capacity); // stack of free slots
  const active = new Int32Array(capacity); // dense list of active slots
  let freeTop = capacity;
  let activeCount = 0;
  for (let i = 0; i < capacity; i++) free[i] = capacity - 1 - i;

  const release = (ai) => {
    const slot = active[ai];
    targets[slot] = null;
    onDone[slot] = null;
    free[freeTop++] = slot;
    active[ai] = active[--activeCount];
  };

  return {
    /**
     * @param {object} target @param {string} key @param {number} toValue
     * @param {number} durationSeconds @param {(t: number) => number} [ease]
     * @param {number} [delaySeconds] @param {(() => void)|null} [done]
     * @returns {number} slot handle, or -1 when the pool is full
     */
    start(target, key, toValue, durationSeconds, ease = easeOutCubic, delaySeconds = 0, done = null) {
      if (freeTop === 0) return -1;
      const slot = free[--freeTop];
      targets[slot] = target;
      keys[slot] = key;
      from[slot] = target[key];
      to[slot] = toValue;
      dur[slot] = durationSeconds;
      elapsed[slot] = 0;
      delay[slot] = delaySeconds;
      eases[slot] = ease;
      onDone[slot] = done;
      active[activeCount++] = slot;
      return slot;
    },
    update(dt) {
      if (dt <= 0) return;
      for (let ai = activeCount - 1; ai >= 0; ai--) {
        const s = active[ai];
        if (delay[s] > 0) {
          delay[s] -= dt;
          if (delay[s] > 0) continue;
          elapsed[s] = -delay[s]; // carry the overshoot into the tween
          delay[s] = 0;
        } else {
          elapsed[s] += dt;
        }
        const t = dur[s] <= 0 ? 1 : Math.min(elapsed[s] / dur[s], 1);
        targets[s][keys[s]] = t >= 1 ? to[s] : from[s] + (to[s] - from[s]) * eases[s](t);
        if (t >= 1) {
          const cb = onDone[s];
          release(ai);
          if (cb) cb();
        }
      }
    },
    cancel(target) {
      for (let ai = activeCount - 1; ai >= 0; ai--) if (targets[active[ai]] === target) release(ai);
    },
    get activeCount() { return activeCount; },
  };
}
