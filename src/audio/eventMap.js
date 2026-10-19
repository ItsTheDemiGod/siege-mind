// Pure mapping from sim events to sounds. Reads event types and enemy definitions only; deterministic (pitch jitter from an integer hash).
import { EVENT_TYPES } from '../sim/events.js';
import { ENEMIES } from '../data/enemies.js';
import { audioConfig } from './audioConfig.js';
import { FIRE_SOUND, IMPACT_SOUND, KILL_PITCH } from './sounds.js';

/** Enemy radius below SMALL_RADIUS is a small kill, from LARGE_RADIUS a large kill (world units). */
export const SMALL_RADIUS = 12;
export const LARGE_RADIUS = 20;
const NONE = Object.freeze([]);

/** @returns {number} a 32-bit integer hash of three integers */
function hash3(a, b, c) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul((c | 0) + 0x165667b1, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
}

/** @returns {number} pitch multiplier in [1 - jitter, 1 + jitter], deterministic in (id, tick, salt) */
export function pitchJitter(id, tick, salt = 0) {
  const u = (hash3(Number.isFinite(id) ? id : 0, Number.isFinite(tick) ? tick : 0, salt) >>> 8) / 16777216; // 24 bits -> [0, 1)
  return 1 + audioConfig.jitterFraction * (u * 2 - 1);
}

const one = (id, pitch = 1, gainMul = 1) => [{ id, pitch, gainMul }];

/**
 * @param {string} type an EVENT_TYPES value @param {object} payload the event payload @param {{mode?: string, tick?: number}} [ctx]
 * @returns {{id: string, pitch: number, gainMul: number}[]} the sounds to play (empty when none; never throws)
 */
export function soundForEvent(type, payload, ctx = {}) {
  if (!payload || typeof payload !== 'object') return NONE;
  const tick = Number.isFinite(ctx?.tick) ? ctx.tick : 0;
  switch (type) {
    case EVENT_TYPES.TOWER_PLACED: return one('towerPlace', pitchJitter(payload.id, tick, 1));
    case EVENT_TYPES.TOWER_UPGRADED: return one('towerUpgrade');
    case EVENT_TYPES.TOWER_SOLD: return one('towerSell');
    case EVENT_TYPES.TOWER_FIRED: {
      const id = FIRE_SOUND[payload.type];
      return id ? one(id, pitchJitter(payload.towerId, tick, 2)) : NONE;
    }
    case EVENT_TYPES.PROJECTILE_IMPACT: {
      if (payload.hit !== true) return NONE;
      const kind = payload.kind === 'shell' ? 'shell' : payload.type === 'poison' ? 'cloud' : 'spark';
      return one(IMPACT_SOUND[kind], pitchJitter(Math.round(payload.x ?? 0), tick, 3));
    }
    case EVENT_TYPES.ENEMY_SPAWNED: return one('enemySpawn', pitchJitter(payload.id, tick, 4));
    case EVENT_TYPES.ENEMY_KILLED: {
      const def = ENEMIES[payload.type];
      if (!def) return NONE;
      const jit = pitchJitter(payload.id, tick, 5) * (KILL_PITCH[payload.type] ?? 1);
      if (payload.type === 'shieldedBruiser') return one('shieldedKill', jit);
      return one(def.radius < SMALL_RADIUS ? 'killSmall' : def.radius >= LARGE_RADIUS ? 'killLarge' : 'killMedium', jit);
    }
    case EVENT_TYPES.ENEMY_LEAKED: return one('leak');
    case EVENT_TYPES.LIVES_CHANGED: return payload.delta < 0 ? one('lifeLost') : NONE;
    case EVENT_TYPES.WAVE_STARTED: {
      const out = one('waveStart');
      const r = payload.director && payload.director.reason;
      if (r === 'adapted' || r === 'prior') out.push({ id: 'directorSweep', pitch: 1, gainMul: 1 });
      return out;
    }
    case EVENT_TYPES.WAVE_ENDED: return one('waveClear');
    case EVENT_TYPES.GAME_OVER: return one(payload.result === 'won' ? 'victory' : 'defeat');
    default: return NONE;
  }
}

/** The event types the mapper reacts to (main.js subscribes to exactly these). */
export const MAPPED_EVENTS = Object.freeze([
  EVENT_TYPES.TOWER_PLACED, EVENT_TYPES.TOWER_UPGRADED, EVENT_TYPES.TOWER_SOLD, EVENT_TYPES.TOWER_FIRED, EVENT_TYPES.PROJECTILE_IMPACT, EVENT_TYPES.ENEMY_SPAWNED,
  EVENT_TYPES.ENEMY_KILLED, EVENT_TYPES.ENEMY_LEAKED, EVENT_TYPES.LIVES_CHANGED, EVENT_TYPES.WAVE_STARTED, EVENT_TYPES.WAVE_ENDED, EVENT_TYPES.GAME_OVER,
]);
