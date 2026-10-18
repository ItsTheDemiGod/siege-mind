// Persisted user settings. The only module (besides the one line in main.js) that touches storage, via an injectable object.

const STORAGE_KEY = 'siegeMind.settings.v1';
const TIERS = ['low', 'medium', 'high'];

/**
 * @param {{storage?: {getItem: Function, setItem: Function}|null, prefersReducedMotion?: boolean}} [options]
 * @returns {{get: Function, set: Function, getAll: Function, reset: Function, subscribe: Function}}
 */
export function createSettings({ storage = null, prefersReducedMotion = false } = {}) {
  const defaults = () => ({
    quality: 'high',
    autoQuality: true,
    screenShake: true,
    reducedMotion: prefersReducedMotion,
    particleDensity: 1,
  });
  // Each key: coerce a candidate value to a valid one, or return undefined to reject it.
  const validators = {
    quality: (v) => (TIERS.includes(v) ? v : undefined),
    autoQuality: (v) => (typeof v === 'boolean' ? v : undefined),
    screenShake: (v) => (typeof v === 'boolean' ? v : undefined),
    reducedMotion: (v) => (typeof v === 'boolean' ? v : undefined),
    particleDensity: (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0.25, v)) : undefined),
  };

  let values = defaults();
  const listeners = [];

  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && typeof saved === 'object') {
      for (const k of Object.keys(validators)) {
        const ok = validators[k](saved[k]);
        if (ok !== undefined) values[k] = ok;
      }
    }
  } catch {
    values = defaults(); // corrupt JSON or throwing storage
  }

  const persist = () => {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(values)); } catch { /* storage unavailable: keep in memory */ }
  };
  const notify = (key) => { for (const l of listeners) l(key, values[key], values); };

  return {
    get: (key) => values[key],
    set(key, value) {
      const check = validators[key];
      if (!check) return;
      const v = check(value);
      if (v === undefined || v === values[key]) return;
      values[key] = v;
      persist();
      notify(key);
    },
    getAll: () => ({ ...values }),
    reset() {
      const before = values;
      values = defaults();
      persist();
      for (const k of Object.keys(values)) if (values[k] !== before[k]) notify(k);
    },
    /** @returns {() => void} unsubscribe */
    subscribe(listener) {
      listeners.push(listener);
      return () => { const i = listeners.indexOf(listener); if (i >= 0) listeners.splice(i, 1); };
    },
  };
}
