// Pooled sell-dissolve ghosts (pure; slots preallocated, no allocation after creation).
import { config } from '../data/config.js';

/**
 * @param {number} [capacity]
 * @returns {{slots: {active: boolean, type: string, x: number, y: number, angle: number, level: number, age: number, life: number}[],
 *   capacity: number, spawn: Function, update: (dt: number) => void, clear: () => void, readonly count: number}}
 */
export function createGhostPool(capacity = config.fx.ghostCapacity) {
  const slots = Array.from({ length: capacity }, () => ({ active: false, type: '', x: 0, y: 0, angle: 0, level: 0, age: 0, life: 1 }));
  let count = 0;
  return {
    slots,
    capacity,
    /** @returns {number} slot index, or -1 when the pool is full */
    spawn(type, x, y, angle, level, life) {
      for (let i = 0; i < capacity; i++) {
        const s = slots[i];
        if (s.active) continue;
        s.active = true; s.type = type; s.x = x; s.y = y; s.angle = angle; s.level = level; s.age = 0; s.life = life;
        count++;
        return i;
      }
      return -1;
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
    clear() {
      for (const s of slots) s.active = false;
      count = 0;
    },
    get count() { return count; },
  };
}
