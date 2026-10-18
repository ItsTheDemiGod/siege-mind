// Pure integer hash -> [0,1). For deterministic visuals (bubbles, drip jitter) without any random source.

/**
 * @param {number} a integer @param {number} [b] integer
 * @returns {number} value in [0, 1)
 */
export function hash01(a, b = 0) {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
