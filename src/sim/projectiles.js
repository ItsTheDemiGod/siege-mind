// Projectiles (pure): homing bolts and ballistic shells (no lead prediction), impacts and splash.
import { config } from '../data/config.js';
import { ENEMIES } from '../data/enemies.js';
import { EVENT_TYPES } from './events.js';
import { getEnemyById, forEachEnemyInRadius } from './enemies.js';
import { applyDamage } from './damage.js';
import { applyStatus } from './statuses.js';

function emitImpact(game, p, x, y, hits, radius, angle) {
  game.events.emit(EVENT_TYPES.PROJECTILE_IMPACT, { kind: p.kind, type: p.towerType, x, y, hit: hits > 0, hits, radius, angle });
}

function boltImpact(game, p, target) {
  if (p.poisonDps > 0) {
    const status = { type: 'poison', dps: p.poisonDps, duration: p.poisonSeconds, source: p.towerType, towerId: p.towerId };
    applyStatus(game, target, status);
    let hits = 1;
    forEachEnemyInRadius(game, target.x, target.y, p.cloudRadius, (e) => {
      if (e.id === target.id) return;
      applyStatus(game, e, status);
      hits++;
    });
    emitImpact(game, p, target.x, target.y, hits, p.cloudRadius, Math.atan2(target.y - p.y, target.x - p.x));
  } else {
    applyDamage(game, target, { amount: p.damage, kind: 'direct', armorPierce: p.armorPierce, shieldMult: p.shieldMult, source: p.towerType, towerId: p.towerId });
    emitImpact(game, p, target.x, target.y, 1, 0, Math.atan2(target.y - p.y, target.x - p.x));
  }
}

function shellImpact(game, p) {
  let hits = 0;
  const r = p.splashRadius;
  forEachEnemyInRadius(game, p.tx, p.ty, r, (e) => {
    const f = 1 + (p.splashMinFraction - 1) * Math.min(1, Math.hypot(e.x - p.tx, e.y - p.ty) / r); // 100% at center, minFraction at the edge
    applyDamage(game, e, { amount: p.damage * f, kind: 'direct', armorPierce: p.armorPierce, shieldMult: p.shieldMult, source: p.towerType, towerId: p.towerId });
    hits++;
  });
  emitImpact(game, p, p.tx, p.ty, hits, r, Math.atan2(p.ty - p.oy, p.tx - p.ox)); // shells fly straight from the origin
}

/**
 * Advance every projectile one step; finished ones are removed with stable compaction.
 * @param {object} game
 * @returns {void}
 */
export function stepProjectiles(game) {
  const list = game.projectiles;
  const dt = config.sim.stepSeconds;
  let w = 0;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    p.prevX = p.x;
    p.prevY = p.y;
    let done = false;
    if (p.kind === 'bolt') {
      const target = getEnemyById(game, p.targetId);
      if (!target) {
        emitImpact(game, p, p.x, p.y, 0, 0, Math.atan2(p.y - p.oy, p.x - p.ox)); // fizzles
        done = true;
      } else {
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const dist = Math.hypot(dx, dy);
        const step = p.speed * dt;
        if (dist <= step + ENEMIES[target.type].radius * 0.5) {
          boltImpact(game, p, target);
          done = true;
        } else {
          p.x += (dx / dist) * step;
          p.y += (dy / dist) * step;
          p.tx = target.x;
          p.ty = target.y;
          p.remaining = dist - step;
        }
      }
    } else {
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (dist <= step) {
        p.x = p.tx;
        p.y = p.ty;
        shellImpact(game, p);
        done = true;
      } else {
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
        p.remaining = dist - step;
      }
    }
    if (!done) list[w++] = p;
  }
  list.length = w;
}
