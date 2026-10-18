// Seeded PRNG (mulberry32) with string seeds, saved state and independent forks.

/**
 * xmur3-style string hash to an unsigned 32-bit integer.
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Normalize a seed to an unsigned 32-bit integer.
 * @param {number|string} seed - finite integer or string
 * @returns {number}
 */
function normalizeSeed(seed) {
  if (typeof seed === 'string') return hashString(seed);
  if (typeof seed === 'number' && Number.isInteger(seed)) return seed >>> 0;
  throw new TypeError(`rng seed must be a finite integer or a string, got ${typeof seed} (${String(seed)})`);
}

/**
 * Create a seeded random stream.
 * @param {number|string} seed
 * @returns {object} rng with next/int/range/chance/pick/shuffle/weightedIndex/getState/setState/fork and `seed`
 */
export function createRng(seed) {
  const origin = normalizeSeed(seed);
  let a = origin;

  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    seed: origin,
    next,
    int(minInclusive, maxInclusive) {
      return minInclusive + Math.floor(next() * (maxInclusive - minInclusive + 1));
    },
    range(min, max) {
      return min + next() * (max - min);
    },
    chance(p) {
      return next() < p;
    },
    pick(array) {
      if (array.length === 0) throw new RangeError('rng.pick: empty array');
      return array[Math.floor(next() * array.length)];
    },
    shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
      }
      return array;
    },
    weightedIndex(weights) {
      let total = 0;
      for (const w of weights) {
        if (!(w >= 0)) throw new RangeError('rng.weightedIndex: weights must be non-negative numbers');
        total += w;
      }
      if (!(total > 0)) throw new RangeError('rng.weightedIndex: need at least one positive weight');
      let r = next() * total;
      let last = -1;
      for (let i = 0; i < weights.length; i++) {
        if (weights[i] <= 0) continue;
        last = i;
        r -= weights[i];
        if (r < 0) return i;
      }
      return last; // float rounding fallback: last positive weight
    },
    getState: () => a,
    setState(state) {
      a = state >>> 0;
    },
    // Derived from the original seed and label only, so parent consumption never shifts it.
    fork(label) {
      return createRng(hashString(`${origin}:${label}`));
    },
  };
}
