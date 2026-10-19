// Record helpers for the telemetry collector (pure): internal state factories and the builders of the plain output records.
import { config } from '../data/config.js';
import { ENEMY_ORDER } from '../data/enemies.js';
import { TOWER_ORDER } from '../data/towers.js';
import { getTowerStats } from './towers.js';
import {
  SOURCE_IDS, roundTo, emptyByType, emptyTowerActivity, finalizeTypeStats,
} from './telemetrySchema.js';

const DIGITS = config.telemetry.floatDigits;
const isPlainObject = (v) => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

/**
 * Deep copy of plain JSON-like data (objects, arrays, finite numbers, strings, booleans, null).
 * @param {*} value @param {string} [path]
 * @returns {*}
 * @throws {TypeError} for anything else (functions, Maps, class instances, undefined, NaN)
 */
export function copyPlain(value, path = 'value') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} is not a finite number`);
    return value;
  }
  if (Array.isArray(value)) return value.map((v, i) => copyPlain(v, `${path}[${i}]`));
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, copyPlain(v, `${path}.${k}`)]));
  throw new TypeError(`${path} is not plain JSON data`);
}

/** Round every non-integer number in a freshly built tree, in place. @param {*} node @returns {*} the same node */
export function roundTree(node) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = typeof node[i] === 'number' ? roundNumber(node[i]) : roundTree(node[i]);
  } else if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) node[k] = typeof node[k] === 'number' ? roundNumber(node[k]) : roundTree(node[k]);
  }
  return node;
}
const roundNumber = (x) => (Number.isInteger(x) ? x : roundTo(x, DIGITS));

/** @returns {object} an aggregate bucket (used by every wave and by offWave) */
export const makeAggregate = () => ({ byType: emptyByType(), towerActivity: emptyTowerActivity(), livesLost: 0 });

/**
 * Internal state of one wave while it is collected.
 * @param {object} ev WAVE_STARTED payload (primitives are copied) @param {number} goldAtStart @param {{spent: number, refunded: number}} prep
 * @param {object} loadout
 * @returns {object}
 */
export function makeWaveState(ev, goldAtStart, prep, loadout) {
  return {
    ...makeAggregate(),
    wave: ev.wave, name: ev.name ?? null, fixed: Boolean(ev.fixed), complete: false, mode: ev.mode, startTick: ev.tick, endTick: null,
    hpMult: ev.hpMult, budget: ev.budget, threat: ev.threat, composition: { ...ev.composition }, picks: { ...ev.picks }, livesAfter: null, loadout,
    gold: { atStart: goldAtStart, prepSpent: prep.spent, prepRefunded: prep.refunded, earnedKills: 0, clearBonus: 0, spentDuring: 0, refundedDuring: 0, atEnd: null },
    director: null,
  };
}

/** @param {object} game @returns {object} read-only loadout snapshot of the towers right now */
export function loadoutSnapshot(game) {
  const byType = {};
  for (const id of TOWER_ORDER) byType[id] = { count: 0, levels: new Array(config.towers.maxLevel + 1).fill(0) };
  let totalInvested = 0;
  let nominalDps = 0;
  for (const t of game.towers) {
    byType[t.type].count++;
    byType[t.type].levels[t.level]++;
    totalInvested += t.invested;
    nominalDps += getTowerStats(t.type, t.level).dps;
  }
  return { totalTowers: game.towers.length, totalInvested, nominalDps, byType };
}

const zeroByEnemy = () => Object.fromEntries(ENEMY_ORDER.map((id) => [id, 0]));

/** @param {object} ev TOWER_PLACED payload @param {object} game @returns {object} internal tower record */
export function makeTowerRecord(ev, game) {
  return {
    id: ev.id, type: ev.type, col: ev.col, row: ev.row, builtTick: ev.tick, builtWave: game.waves.current, builtPhase: game.waves.phase, cost: ev.cost,
    upgrades: [], finalLevel: 0, invested: ev.cost, sold: false, soldTick: null, soldWave: null, refund: null,
    damageDealt: 0, kills: 0, shots: 0, damageByEnemyType: zeroByEnemy(), killsByEnemyType: zeroByEnemy(),
  };
}

/** @param {object} t internal tower record @returns {object} plain output copy */
export function towerOutput(t) {
  return {
    ...t, upgrades: t.upgrades.map((u) => ({ ...u })), damageByEnemyType: { ...t.damageByEnemyType }, killsByEnemyType: { ...t.killsByEnemyType },
  };
}

/** @param {object} w internal wave state @param {object} game @param {number} stepSeconds @returns {object} plain output record */
export function waveOutput(w, game, stepSeconds) {
  const open = !w.complete;
  const endTick = open ? game.tick : w.endTick;
  const byType = {};
  let spawned = 0;
  let killed = 0;
  let leaked = 0;
  for (const id of ENEMY_ORDER) {
    const s = w.byType[id];
    byType[id] = finalizeTypeStats(s, stepSeconds, DIGITS);
    spawned += s.spawned; killed += s.killed; leaked += s.leaked;
  }
  return {
    wave: w.wave, name: w.name, fixed: w.fixed, complete: w.complete, mode: w.mode, startTick: w.startTick, endTick,
    seconds: (endTick - w.startTick) * stepSeconds, hpMult: w.hpMult, budget: w.budget, threat: w.threat,
    composition: { ...w.composition }, picks: { ...w.picks }, spawnedUnits: spawned, killed, leaked, livesLost: w.livesLost,
    livesAfter: open ? game.lives : w.livesAfter,
    loadout: { ...w.loadout, byType: Object.fromEntries(Object.entries(w.loadout.byType).map(([k, v]) => [k, { count: v.count, levels: [...v.levels] }])) },
    gold: { ...w.gold, atEnd: open ? game.gold : w.gold.atEnd },
    byType, towerActivity: Object.fromEntries(Object.entries(w.towerActivity).map(([k, v]) => [k, { ...v }])),
    director: w.director === null ? null : copyPlain(w.director),
  };
}

/** @param {object} agg aggregate @param {number} stepSeconds @returns {object} offWave output */
export function offWaveOutput(agg, stepSeconds) {
  return {
    byType: Object.fromEntries(ENEMY_ORDER.map((id) => [id, finalizeTypeStats(agg.byType[id], stepSeconds, DIGITS)])),
    towerActivity: Object.fromEntries(Object.entries(agg.towerActivity).map(([k, v]) => [k, { ...v }])),
    livesLost: agg.livesLost,
  };
}

/**
 * @param {object} rec internal enemy record @param {{outcome?: string, outcomeTick?: number, progress?: number}} [override] for enemies still alive
 * @returns {object} plain output record
 */
export function enemyOutput(rec, override = {}) {
  const damageBySource = {};
  let taken = 0;
  SOURCE_IDS.forEach((id, i) => { damageBySource[id] = roundTo(rec.damage[i], DIGITS); taken += damageBySource[id]; });
  const outcome = override.outcome ?? rec.outcome;
  const outcomeTick = override.outcomeTick ?? rec.outcomeTick;
  return {
    id: rec.id, type: rec.type, wave: rec.wave, hpMult: rec.hpMult, spawnTick: rec.spawnTick, maxHp: rec.maxHp, maxShield: rec.maxShield,
    outcome, outcomeTick, timeAliveTicks: outcomeTick - rec.spawnTick, progress: override.progress ?? rec.progress,
    damageTaken: roundTo(taken, DIGITS), damageBySource, killer: rec.killerSource === null ? null : { source: rec.killerSource, towerId: rec.killerTower },
  };
}
