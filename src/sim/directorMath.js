// Director math (pure). Plain + - * / comparisons and Math.min/max only: no Math.pow, Math.exp or Math.log, so every JavaScript engine
// produces identical numbers. See docs/DIRECTOR.md for the algorithm.
import { ENEMY_ORDER } from '../data/enemies.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/**
 * @param {object} cfg config.director
 * @returns {true}
 * @throws {RangeError} naming the first bad key
 */
export function validateDirectorConfig(cfg) {
  const bad = (key, rule) => { throw new RangeError(`director config ${key} must be ${rule}, got ${String(cfg[key])}`); };
  const inRange = (key, lo, hi, loOpen = false) => { if (!isNum(cfg[key]) || cfg[key] > hi || (loOpen ? cfg[key] <= lo : cfg[key] < lo)) bad(key, `in ${loOpen ? '(' : '['}${lo}, ${hi}]`); };
  if (!Number.isInteger(cfg.firstAdaptiveWave) || cfg.firstAdaptiveWave < 1) bad('firstAdaptiveWave', 'an integer >= 1');
  if (!Number.isInteger(cfg.rewardExponent) || cfg.rewardExponent < 1 || cfg.rewardExponent > 4) bad('rewardExponent', 'an integer 1..4');
  inRange('alpha', 0, 1, true);
  inRange('decay', 0, 1);
  inRange('minThreatShare', 0, 0.5);
  if (!isNum(cfg.advClipHigh) || cfg.advClipHigh <= 0) bad('advClipHigh', '> 0');
  if (!isNum(cfg.beta) || cfg.beta < 0) bad('beta', '>= 0');
  if (!isNum(cfg.tiltMax) || cfg.tiltMax < 1) bad('tiltMax', '>= 1');
  inRange('absentFloorShare', 0, 0.2);
  if (!Number.isInteger(cfg.historyLimit) || cfg.historyLimit < 1) bad('historyLimit', 'an integer >= 1');
  return true;
}

/** @param {number} x @param {number} n integer >= 0 @returns {number} x to the power n by repeated multiplication */
export function intPow(x, n) {
  let r = 1;
  for (let i = 0; i < n; i++) r *= x;
  return r;
}

/**
 * Reward of one enemy type in one wave: damage it threatens, scaled by how far it got, per unit of threat spent.
 * @param {{leakDamage: number, meanProgress: number, threatCost: number, exponent: number}} o
 * @returns {number}
 */
export function rewardOf({ leakDamage, meanProgress, threatCost, exponent }) {
  if (!isNum(leakDamage) || !isNum(meanProgress) || !isNum(threatCost) || !isNum(exponent)) throw new TypeError('rewardOf needs finite numbers');
  if (meanProgress < 0 || meanProgress > 1) throw new RangeError(`meanProgress must be in [0,1], got ${meanProgress}`);
  if (threatCost <= 0) throw new RangeError(`threatCost must be > 0, got ${threatCost}`);
  return (leakDamage * intPow(meanProgress, exponent)) / threatCost;
}

/**
 * @param {Record<string, {units: number, leaked: number, progressSum: number}>} typeStats all five types
 * @param {Record<string, {leakDamage: number, threatCost: number}>} defs @param {object} cfg config.director
 * @returns {{average: number, types: Record<string, object>}}
 */
export function computeObservation(typeStats, defs, cfg) {
  let total = 0;
  for (const type of ENEMY_ORDER) total += typeStats[type].units * defs[type].threatCost;
  const types = {};
  let weighted = 0;
  let spentUpdated = 0;
  for (const type of ENEMY_ORDER) {
    const { units, leaked, progressSum } = typeStats[type];
    const threatSpent = units * defs[type].threatCost;
    const meanProgress = units > 0 ? Math.min(1, progressSum / units) : 0;
    const reward = units > 0 ? rewardOf({ leakDamage: defs[type].leakDamage, meanProgress, threatCost: defs[type].threatCost, exponent: cfg.rewardExponent }) : 0;
    const threatShare = total > 0 ? threatSpent / total : 0;
    const updated = units > 0 && threatShare >= cfg.minThreatShare;
    if (updated) { weighted += threatSpent * reward; spentUpdated += threatSpent; }
    types[type] = { units, leaked, meanProgress, threatSpent, threatShare, reward, advantage: 0, updated };
  }
  const average = spentUpdated > 0 ? weighted / spentUpdated : 0;
  if (average > 0) {
    for (const type of ENEMY_ORDER) if (types[type].updated) types[type].advantage = clamp((types[type].reward - average) / average, -1, cfg.advClipHigh);
  }
  return { average, types };
}

/**
 * @param {Record<string, number>} scores @param {{types: Record<string, {advantage: number, updated: boolean}>}} observation @param {object} cfg
 * @returns {Record<string, number>} a new score object (the input is not changed)
 */
export function updateScores(scores, observation, cfg) {
  const next = {};
  for (const type of ENEMY_ORDER) {
    const o = observation.types[type];
    next[type] = o.updated ? (1 - cfg.alpha) * scores[type] + cfg.alpha * o.advantage : cfg.decay * scores[type];
  }
  return next;
}

/** @param {Record<string, number>} scores @param {object} cfg @returns {Record<string, number>} per-type tilt in [1/tiltMax, tiltMax] */
export function tiltFromScores(scores, cfg) {
  const tilt = {};
  for (const type of ENEMY_ORDER) tilt[type] = clamp(1 + cfg.beta * scores[type], 1 / cfg.tiltMax, cfg.tiltMax);
  return tilt;
}

/**
 * Tilted shares: static template shares (a small floor for unlocked types the template omits), scaled by tilt and normalized.
 * @param {{templateShares: Record<string, number>, tilt: Record<string, number>, wave: number, isUnlocked: (type: string, wave: number) => boolean, cfg: object}} o
 * @returns {Record<string, number>}
 */
export function sharesFor({ templateShares, tilt, wave, isUnlocked, cfg }) {
  const weighted = {};
  let sum = 0;
  for (const type of ENEMY_ORDER) {
    const base = templateShares[type] > 0 ? templateShares[type] : (isUnlocked(type, wave) ? cfg.absentFloorShare : 0);
    weighted[type] = base * tilt[type];
    sum += weighted[type];
  }
  if (!(sum > 0)) return { ...templateShares };
  const shares = {};
  for (const type of ENEMY_ORDER) shares[type] = weighted[type] / sum;
  return shares;
}

/** @param {{next: () => number}} rng @param {object} cfg @returns {Record<string, number>} random tilt per type, drawn in ENEMY_ORDER */
export function randomTilt(rng, cfg) {
  const lo = 1 / cfg.tiltMax;
  const tilt = {};
  for (const type of ENEMY_ORDER) tilt[type] = lo + (cfg.tiltMax - lo) * rng.next();
  return tilt;
}

/** @param {Record<string, number>} a @param {Record<string, number>} b @returns {number} sum of absolute differences over the five types */
export function l1Distance(a, b) {
  let d = 0;
  for (const type of ENEMY_ORDER) d += Math.abs(a[type] - b[type]);
  return d;
}
