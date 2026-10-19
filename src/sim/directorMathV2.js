// Director v2 math (pure). Baseline-normalized rewards and shrinkage; the score update, tilt and share math are v1's, unchanged.
// Plain + - * / comparisons and Math.min/max only (no pow, exp or log). See docs/DIRECTOR.md.
import { ENEMY_ORDER } from '../data/enemies.js';
import { BASELINE_REWARD, BASELINE_FALLBACK } from '../data/directorBaseline.js';
import { rewardOf } from './directorMath.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/**
 * @param {object} cfg config.directorV2 @returns {true} @throws {RangeError} naming the first bad key
 */
export function validateDirectorV2Config(cfg) {
  const bad = (key, rule) => { throw new RangeError(`directorV2 config ${key} must be ${rule}, got ${String(cfg[key])}`); };
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
  if (!isNum(cfg.shrinkK) || cfg.shrinkK < 0) bad('shrinkK', '>= 0');
  if (!Number.isInteger(cfg.baselineWindow) || cfg.baselineWindow < 0) bad('baselineWindow', 'an integer >= 0');
  inRange('baselineFloorFraction', 0, 1, true);
  return true;
}

/**
 * @param {object} cfg config.counter @returns {true} @throws {RangeError} naming the first bad key
 */
export function validateCounterConfig(cfg) {
  const bad = (key, rule) => { throw new RangeError(`counter config ${key} must be ${rule}, got ${String(cfg[key])}`); };
  if (!Number.isInteger(cfg.firstAdaptiveWave) || cfg.firstAdaptiveWave < 1) bad('firstAdaptiveWave', 'an integer >= 1');
  if (!isNum(cfg.gain) || cfg.gain < 0) bad('gain', '>= 0');
  if (!isNum(cfg.tiltMax) || cfg.tiltMax < 1) bad('tiltMax', '>= 1');
  if (!isNum(cfg.absentFloorShare) || cfg.absentFloorShare < 0 || cfg.absentFloorShare > 0.2) bad('absentFloorShare', 'in [0, 0.2]');
  if (!isNum(cfg.levelWeight) || cfg.levelWeight < 0) bad('levelWeight', '>= 0');
  return true;
}

/**
 * Expected static reward of an enemy type in a wave. The table has 15 waves: later waves of a Full game use wave 15 (a documented limitation).
 * @param {string} type @param {number} wave integer >= 1 @param {{baselineFloorFraction: number}} cfg
 * @returns {number} max(table entry or the type's fallback, floor fraction * fallback) @throws {RangeError} when the type has no baseline
 */
export function baselineValue(type, wave, cfg) {
  const row = BASELINE_REWARD[type];
  const fallback = BASELINE_FALLBACK[type];
  if (!row || !isNum(fallback) || fallback <= 0) throw new RangeError(`no baseline for enemy type ${String(type)}`);
  if (!Number.isInteger(wave) || wave < 1) throw new RangeError(`wave must be an integer >= 1, got ${String(wave)}`);
  const raw = row[Math.min(wave, row.length) - 1];
  const base = raw === null || raw === undefined ? fallback : raw;
  return Math.max(base, cfg.baselineFloorFraction * fallback);
}

/** @param {number} units @param {number} k @returns {number} units / (units + k), 0 when there are no units */
export const shrinkFactor = (units, k) => (units > 0 ? units / (units + k) : 0);

/**
 * v2 observation of one finished wave. reward as in v1, norm = reward / baseline(type, wave), average = threat-weighted mean of norm over the
 * updated types, advantage = clamp((norm - average) / average, -1, advClipHigh), shrunk = advantage * units / (units + shrinkK).
 * @param {Record<string, {units: number, leaked: number, progressSum: number}>} typeStats @param {Record<string, {leakDamage: number, threatCost: number}>} defs
 * @param {object} cfg config.directorV2 @param {number} wave
 * @returns {{average: number, types: Record<string, object>}} types[t].advantage is the UNSHRUNK advantage; use forUpdate() for updateScores
 */
export function computeObservationV2(typeStats, defs, cfg, wave) {
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
    const norm = units > 0 ? reward / baselineValue(type, wave, cfg) : 0;
    const threatShare = total > 0 ? threatSpent / total : 0;
    const updated = units > 0 && threatShare >= cfg.minThreatShare;
    if (updated) { weighted += threatSpent * norm; spentUpdated += threatSpent; }
    types[type] = { units, leaked, meanProgress, threatSpent, threatShare, reward, norm, advantage: 0, shrunk: 0, updated };
  }
  const average = spentUpdated > 0 ? weighted / spentUpdated : 0;
  if (average > 0) {
    for (const type of ENEMY_ORDER) {
      const t = types[type];
      if (!t.updated) continue;
      t.advantage = clamp((t.norm - average) / average, -1, cfg.advClipHigh);
      t.shrunk = t.advantage * shrinkFactor(t.units, cfg.shrinkK);
    }
  }
  return { average, types };
}

/** @param {{types: Record<string, object>}} obs from computeObservationV2 @returns {{types: Record<string, {advantage: number, updated: boolean}>}} the shape v1's updateScores reads, with the SHRUNK advantage */
export function forUpdate(obs) {
  const types = {};
  for (const type of ENEMY_ORDER) types[type] = { advantage: obs.types[type].shrunk, updated: obs.types[type].updated };
  return { types };
}
