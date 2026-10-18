// Damage model (pure). Armor is flat with a floor, shields absorb first, DoT ignores armor and can be blocked by shields.
import { config } from '../data/config.js';
import { ENEMIES } from '../data/enemies.js';
import { EVENT_TYPES } from './events.js';

const KINDS = new Set(['direct', 'dot']);

/**
 * Work out what a damage packet would do, without mutating anything.
 * @param {object} def - enemy definition
 * @param {{hp: number, shield: number}} enemy
 * @param {{amount: number, kind: 'direct'|'dot', armorPierce?: boolean, shieldMult?: number}} packet
 * @param {{minArmorDamageFraction: number, killEpsilon: number}} combat
 * @returns {{shieldDamage: number, hpDamage: number, blocked: boolean}}
 */
export function resolveDamage(def, enemy, packet, combat = config.combat) {
  const { amount, kind, armorPierce = false, shieldMult = 1 } = packet;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) throw new TypeError(`damage amount must be a finite number >= 0, got ${String(amount)}`);
  if (!KINDS.has(kind)) throw new TypeError(`unknown damage kind: ${String(kind)}`);

  if (kind === 'dot') {
    if (enemy.shield > 0 && def.shieldBlocksDot) return { shieldDamage: 0, hpDamage: 0, blocked: true };
    return { shieldDamage: 0, hpDamage: Math.min(enemy.hp, amount), blocked: false };
  }

  let remaining = amount;
  let shieldDamage = 0;
  if (enemy.shield > 0) {
    shieldDamage = Math.min(enemy.shield, remaining * shieldMult);
    remaining -= shieldDamage / shieldMult;
    if (remaining <= combat.killEpsilon) return { shieldDamage, hpDamage: 0, blocked: false };
  }
  const effective = armorPierce ? remaining : Math.max(remaining - def.armor, remaining * combat.minArmorDamageFraction);
  return { shieldDamage, hpDamage: Math.min(enemy.hp, effective), blocked: false };
}

function worldPos(game, enemy) {
  return game.map.path.sampleAt(enemy.distance, enemy.lane, { x: 0, y: 0, angle: 0 });
}

/**
 * Emit the aggregated DoT damage event and reset the accumulator.
 * @param {object} game @param {object} enemy
 * @returns {void}
 */
export function flushDot(game, enemy) {
  if (enemy.dotAcc <= 0) return;
  const amount = enemy.dotAcc;
  enemy.dotAcc = 0;
  const p = worldPos(game, enemy);
  game.events.emit(EVENT_TYPES.ENEMY_DAMAGED, {
    id: enemy.id, type: enemy.type, amount, shieldDamage: 0, hpDamage: amount, kind: 'dot', source: enemy.poisonSource, x: p.x, y: p.y, tick: game.tick,
  });
}

/**
 * Apply a damage packet to an enemy, emitting ENEMY_DAMAGED / ENEMY_KILLED. Dead enemies are ignored.
 * @param {object} game @param {object} enemy
 * @param {{amount: number, kind: 'direct'|'dot', armorPierce?: boolean, shieldMult?: number, source?: string}} packet
 * @returns {{shieldDamage: number, hpDamage: number, blocked: boolean, killed: boolean}}
 */
export function applyDamage(game, enemy, packet) {
  if (!enemy.alive) return { shieldDamage: 0, hpDamage: 0, blocked: false, killed: false };
  const def = ENEMIES[enemy.type];
  const result = resolveDamage(def, enemy, packet, config.combat);
  const source = packet.source ?? 'debug';
  enemy.shield -= result.shieldDamage;
  enemy.hp -= result.hpDamage;
  if (enemy.shield < 0) enemy.shield = 0;

  if (packet.kind === 'direct') {
    enemy.lastHitTick = game.tick;
    const total = result.shieldDamage + result.hpDamage;
    if (total > 0) {
      const p = worldPos(game, enemy);
      game.events.emit(EVENT_TYPES.ENEMY_DAMAGED, {
        id: enemy.id, type: enemy.type, amount: total, shieldDamage: result.shieldDamage, hpDamage: result.hpDamage,
        kind: 'direct', source, x: p.x, y: p.y, tick: game.tick,
      });
    }
  } else {
    enemy.dotAcc += result.hpDamage;
  }

  let killed = false;
  if (enemy.hp <= config.combat.killEpsilon) {
    enemy.hp = 0;
    enemy.alive = false;
    killed = true;
    flushDot(game, enemy); // DoT damage must be reported before the kill
    const p = worldPos(game, enemy);
    game.events.emit(EVENT_TYPES.ENEMY_KILLED, {
      id: enemy.id, type: enemy.type, reward: def.reward, progress: game.map.path.progressAt(enemy.distance), x: p.x, y: p.y, tick: game.tick, source,
    });
  }
  return { ...result, killed };
}
