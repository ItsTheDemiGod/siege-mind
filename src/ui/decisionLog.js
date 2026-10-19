// Pure: the Director decision records of the waves that have started, in wave order (a plain-data log, no sim state).
import { copyPlain } from '../sim/telemetryRecords.js';

/**
 * @param {number} [limit] oldest entries drop beyond this
 * @returns {{push: (director: object|null) => boolean, entries: () => object[], latest: () => object|null, clear: () => void, readonly size: number}}
 */
export function createDecisionLog(limit = 40) {
  let list = [];
  return {
    /** @returns {boolean} false for null or non-plain input; otherwise a deep plain copy is stored */
    push(director) {
      if (director === null || typeof director !== 'object' || Array.isArray(director)) return false;
      let copy;
      try { copy = copyPlain(director, 'director'); } catch { return false; }
      list.push(copy);
      if (list.length > limit) list = list.slice(list.length - limit);
      return true;
    },
    entries: () => list.map((d) => copyPlain(d)),
    latest: () => (list.length ? copyPlain(list[list.length - 1]) : null),
    clear() { list = []; },
    get size() { return list.length; },
  };
}
