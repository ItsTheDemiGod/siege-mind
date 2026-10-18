// Towers (pure, fully deterministic: no rng). Placement, upgrades, selling, targeting and firing.
import { config } from '../data/config.js';
import { TOWERS, TARGET_MODES } from '../data/towers.js';
import { EVENT_TYPES } from './events.js';
import { spendGold, earnGold, canAfford } from './economy.js';
import { applyDamage } from './damage.js';
import { applyStatus } from './statuses.js';

const STEP = config.sim.stepSeconds;
const TICKS_PER_SECOND = 1 / STEP;

function computeStats(def, level) {
  const u = level >= 1 ? def.upgrades[level - 1] : null;
  const intervalTicks = Math.max(1, Math.round(def.intervalTicks * (u?.intervalMult ?? 1)));
  const damage = def.damage * (u?.damageMult ?? 1);
  const poisonDps = (def.poisonDps ?? 0) * (u?.dpsMult ?? 1);
  return Object.freeze({
    kind: def.kind,
    damage,
    range: def.range * (u?.rangeMult ?? 1),
    intervalTicks,
    armorPierce: def.armorPierce,
    shieldMult: def.shieldMult,
    projectileSpeed: def.projectileSpeed,
    splashRadius: (def.splashRadius ?? 0) * (u?.splashMult ?? 1),
    splashMinFraction: def.splashMinFraction ?? 0,
    slowFactor: u?.slowFactor ?? def.slowFactor ?? 1,
    slowSeconds: def.slowSeconds ?? 0,
    poisonDps,
    poisonSeconds: def.poisonSeconds ?? 0,
    cloudRadius: (def.cloudRadius ?? 0) * (u?.cloudMult ?? 1),
    dps: poisonDps > 0 ? poisonDps : (damage * TICKS_PER_SECOND) / intervalTicks, // display only
  });
}

// Derived stats per type and level, computed once (no allocation while stepping).
const STATS = Object.fromEntries(Object.values(TOWERS).map((d) => [d.id, Array.from({ length: config.towers.maxLevel + 1 }, (_, l) => computeStats(d, l))]));

/**
 * Derived stats for a tower type at a level (0 = base).
 * @param {string} typeId @param {number} level
 * @returns {Readonly<object>}
 */
export function getTowerStats(typeId, level) {
  return STATS[typeId][level];
}

/** @param {object} game @param {number} col @param {number} row @returns {object|null} */
export function towerAt(game, col, row) {
  const id = game.occupancy[row * game.map.cols + col];
  return id ? getTowerById(game, id) : null;
}

/** @param {object} game @param {number} id @returns {object|null} */
export function getTowerById(game, id) {
  for (const t of game.towers) if (t.id === id) return t;
  return null;
}

/**
 * Can this tower be placed here now?
 * @param {object} game @param {string} typeId @param {number} col @param {number} row
 * @returns {{ok: boolean, reason?: string}}
 */
export function canPlaceTower(game, typeId, col, row) {
  const def = TOWERS[typeId];
  if (!def) return { ok: false, reason: 'unknown_type' };
  if (game.map.tileAt(col, row) === null) return { ok: false, reason: 'out_of_bounds' };
  if (!game.map.isBuildable(col, row)) return { ok: false, reason: 'not_buildable' };
  if (game.occupancy[row * game.map.cols + col]) return { ok: false, reason: 'occupied' };
  if (!canAfford(game, def.cost)) return { ok: false, reason: 'insufficient_gold' };
  if (game.towers.length >= config.towers.maxTowers) return { ok: false, reason: 'tower_limit' };
  return { ok: true };
}

/**
 * Build a tower (spends gold).
 * @param {object} game @param {string} typeId @param {number} col @param {number} row
 * @returns {{ok: boolean, reason?: string, tower?: object}}
 */
export function placeTower(game, typeId, col, row) {
  const check = canPlaceTower(game, typeId, col, row);
  if (!check.ok) return check;
  const def = TOWERS[typeId];
  spendGold(game, def.cost, 'build');
  const c = game.map.tileToWorld(col, row);
  const tower = {
    id: game.nextTowerId++, type: typeId, col, row, x: c.x, y: c.y, level: 0, cooldown: 0, targetMode: def.defaultTarget,
    targetId: -1, angle: 0, invested: def.cost, builtTick: game.tick, damageDealt: 0, kills: 0, shots: 0,
  };
  game.occupancy[row * game.map.cols + col] = tower.id;
  game.towers.push(tower);
  game.events.emit(EVENT_TYPES.TOWER_PLACED, { id: tower.id, type: typeId, col, row, x: c.x, y: c.y, tick: game.tick, cost: def.cost });
  return { ok: true, tower };
}

/**
 * Upgrade one level (spends gold).
 * @param {object} game @param {number} towerId
 * @returns {{ok: boolean, reason?: string}}
 */
export function upgradeTower(game, towerId) {
  const t = getTowerById(game, towerId);
  if (!t) return { ok: false, reason: 'unknown_tower' };
  if (t.level >= config.towers.maxLevel) return { ok: false, reason: 'max_level' };
  const cost = TOWERS[t.type].upgrades[t.level].cost;
  if (!spendGold(game, cost, 'upgrade')) return { ok: false, reason: 'insufficient_gold' };
  t.level++;
  t.invested += cost;
  t.cooldown = Math.min(t.cooldown, STATS[t.type][t.level].intervalTicks);
  game.events.emit(EVENT_TYPES.TOWER_UPGRADED, { id: t.id, type: t.type, level: t.level, tick: game.tick, cost });
  return { ok: true };
}

/**
 * Sell a tower for floor(invested * refund fraction). Projectiles already in flight keep flying.
 * @param {object} game @param {number} towerId
 * @returns {{ok: boolean, refund: number}}
 */
export function sellTower(game, towerId) {
  const t = getTowerById(game, towerId);
  if (!t) return { ok: false, refund: 0 };
  const refund = Math.floor(t.invested * config.economy.sellRefundFraction);
  earnGold(game, refund, 'sell');
  game.occupancy[t.row * game.map.cols + t.col] = 0;
  const i = game.towers.indexOf(t);
  game.towers.splice(i, 1); // stable order
  game.events.emit(EVENT_TYPES.TOWER_SOLD, { id: t.id, type: t.type, level: t.level, col: t.col, row: t.row, x: t.x, y: t.y, refund, tick: game.tick });
  return { ok: true, refund };
}

/**
 * Change targeting mode. Rejects invalid modes, unknown towers and towers without targeting (frost).
 * @param {object} game @param {number} towerId @param {string} mode
 * @returns {boolean}
 */
export function setTargetMode(game, towerId, mode) {
  const t = getTowerById(game, towerId);
  if (!t || t.targetMode === null || !TARGET_MODES.includes(mode)) return false;
  t.targetMode = mode;
  return true;
}

/** Pick a target by mode among alive enemies in range; ties go to the lowest id (enemies are stored in id order). */
function acquire(game, t, range2) {
  let best = null;
  let bestScore = -Infinity;
  const list = game.enemies;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e.alive) continue;
    const dx = e.x - t.x;
    const dy = e.y - t.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > range2) continue;
    const score = t.targetMode === 'first' ? e.distance : t.targetMode === 'strongest' ? e.hp + e.shield : -d2;
    if (score > bestScore) { best = e; bestScore = score; }
  }
  return best;
}

function fire(game, t, s, target) {
  t.shots++;
  const emit = (targetId, tx, ty) => game.events.emit(EVENT_TYPES.TOWER_FIRED, {
    towerId: t.id, type: t.type, kind: s.kind, x: t.x, y: t.y, targetId, tx, ty, tick: game.tick,
  });
  if (s.kind === 'pulse') {
    emit(-1, t.x, t.y);
    const r2 = s.range * s.range;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      if (dx * dx + dy * dy > r2) continue;
      applyStatus(game, e, { type: 'slow', factor: s.slowFactor, duration: s.slowSeconds });
      applyDamage(game, e, { amount: s.damage, kind: 'direct', armorPierce: s.armorPierce, shieldMult: s.shieldMult, source: t.type, towerId: t.id });
    }
    return;
  }
  emit(target.id, target.x, target.y);
  if (s.kind === 'hitscan') {
    applyDamage(game, target, { amount: s.damage, kind: 'direct', armorPierce: s.armorPierce, shieldMult: s.shieldMult, source: t.type, towerId: t.id });
    return;
  }
  game.projectiles.push({
    id: game.nextProjectileId++, kind: s.kind, towerType: t.type, towerId: t.id, x: t.x, y: t.y, prevX: t.x, prevY: t.y, ox: t.x, oy: t.y, // ox/oy/flightDistance: origin and total straight-line distance at fire time (visual arcs)
    speed: s.projectileSpeed, targetId: target.id, tx: target.x, ty: target.y, remaining: Math.hypot(target.x - t.x, target.y - t.y),
    flightDistance: Math.hypot(target.x - t.x, target.y - t.y),
    damage: s.damage, armorPierce: s.armorPierce, shieldMult: s.shieldMult, splashRadius: s.splashRadius,
    splashMinFraction: s.splashMinFraction, poisonDps: s.poisonDps, poisonSeconds: s.poisonSeconds, cloudRadius: s.cloudRadius,
  });
}

/**
 * Advance every tower one step: cooldown, targeting, firing.
 * @param {object} game
 * @returns {void}
 */
export function stepTowers(game) {
  const list = game.towers;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const s = STATS[t.type][t.level];
    if (t.cooldown > 0) t.cooldown--;
    const range2 = s.range * s.range;
    let target = null;
    if (t.targetMode !== null) {
      target = acquire(game, t, range2);
      t.targetId = target ? target.id : -1;
      if (target) t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    } else {
      t.targetId = -1;
    }
    if (t.cooldown > 0) continue;
    if (s.kind === 'pulse') {
      if (anyInRange(game, t, range2)) { fire(game, t, s, null); t.cooldown = s.intervalTicks; }
    } else if (target) {
      fire(game, t, s, target);
      t.cooldown = s.intervalTicks;
    }
  }
}

function anyInRange(game, t, range2) {
  const list = game.enemies;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e.alive) continue;
    const dx = e.x - t.x;
    const dy = e.y - t.y;
    if (dx * dx + dy * dy <= range2) return true;
  }
  return false;
}
