// Telemetry schema (pure): ids, fresh-record factories, rounding, derived stats and the CSV column lists.
import { config } from '../data/config.js';
import { ENEMY_ORDER } from '../data/enemies.js';
import { TOWER_ORDER } from '../data/towers.js';

export { validateRun } from './telemetryValidate.js';

export const SCHEMA_VERSION = config.telemetry.schemaVersion;
export const ENEMY_TYPE_IDS = ENEMY_ORDER;
export const TOWER_TYPE_IDS = TOWER_ORDER;
export const SOURCE_IDS = Object.freeze([...TOWER_ORDER, 'debug', 'other']);

const OTHER_SLOT = TOWER_ORDER.length + 1;
const SOURCE_SLOTS = new Map(SOURCE_IDS.map((id, i) => [id, i]));
const POW10 = Object.freeze([1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9]);

/**
 * @param {string} source tower type id, 'debug' or anything else
 * @returns {number} slot in SOURCE_IDS (tower types first, then debug, then other)
 */
export function sourceIndex(source) {
  const i = SOURCE_SLOTS.get(source);
  return i === undefined ? OTHER_SLOT : i;
}

/**
 * Round to a fixed number of decimals (table of powers of ten, no Math.pow); -0 becomes 0.
 * @param {number} x @param {number} digits integer 0..9
 * @returns {number}
 */
export function roundTo(x, digits) {
  if (!Number.isInteger(digits) || digits < 0 || digits >= POW10.length) throw new RangeError(`roundTo digits must be an integer 0..${POW10.length - 1}, got ${String(digits)}`);
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new TypeError(`roundTo needs a finite number, got ${String(x)}`);
  const p = POW10[digits];
  const r = Math.round(x * p) / p;
  return r === 0 ? 0 : r;
}

const fill = (ids, make) => Object.fromEntries(ids.map((id) => [id, make()]));

/** @returns {Record<string, number>} fresh counts keyed by SOURCE_IDS, all 0 */
export const emptySourceCounts = () => fill(SOURCE_IDS, () => 0);

/** @returns {object} fresh per-enemy-type accumulator */
export const emptyTypeStats = () => ({
  spawned: 0, killed: 0, leaked: 0, progressSum: 0, timeAliveTicksSum: 0, damageTaken: 0,
  damageBySource: emptySourceCounts(), killedBySource: emptySourceCounts(),
});

/** @returns {Record<string, object>} fresh stats for all five enemy types */
export const emptyByType = () => fill(ENEMY_TYPE_IDS, emptyTypeStats);

/** @returns {Record<string, {shots: number, impacts: number, impactsWithHit: number}>} fresh activity for all five towers */
export const emptyTowerActivity = () => fill(TOWER_TYPE_IDS, () => ({ shots: 0, impacts: 0, impactsWithHit: 0 }));

const roundAll = (o, digits) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, roundTo(v, digits)]));

/**
 * Plain copy of an accumulator plus derived fields.
 * @param {object} stats from emptyTypeStats @param {number} stepSeconds @param {number} digits
 * @returns {object}
 */
export function finalizeTypeStats(stats, stepSeconds, digits) {
  const ended = stats.killed + stats.leaked;
  return {
    spawned: stats.spawned, killed: stats.killed, leaked: stats.leaked,
    leakRate: roundTo(stats.spawned > 0 ? stats.leaked / stats.spawned : 0, digits),
    meanProgress: roundTo(ended > 0 ? stats.progressSum / ended : 0, digits),
    meanTimeAliveSeconds: roundTo(ended > 0 ? (stats.timeAliveTicksSum * stepSeconds) / ended : 0, digits),
    progressSum: roundTo(stats.progressSum, digits), timeAliveTicksSum: stats.timeAliveTicksSum, damageTaken: roundTo(stats.damageTaken, digits),
    damageBySource: roundAll(stats.damageBySource, digits), killedBySource: { ...stats.killedBySource },
  };
}

const cols = (s) => Object.freeze(s.split(','));
const DMG = 'dmg_lance,dmg_mortar,dmg_frost,dmg_poison,dmg_sniper,dmg_debug,dmg_other';

export const ENEMY_CSV_COLUMNS = cols(`id,type,wave,hp_mult,spawn_tick,spawn_seconds,max_hp,max_shield,outcome,outcome_tick,time_alive_seconds,progress,damage_taken,${DMG},killer_source,killer_tower_id`);
export const WAVE_CSV_COLUMNS = cols('wave,name,fixed,complete,mode,start_tick,end_tick,seconds,hp_mult,budget,threat,spawned_units,killed,leaked,lives_lost,lives_after,gold_at_start,prep_spent,prep_refunded,earned_kills,clear_bonus,spent_during,gold_at_end,total_towers,total_invested,nominal_dps,towers_lance,towers_mortar,towers_frost,towers_poison,towers_sniper');
export const WAVE_TYPE_CSV_COLUMNS = cols(`wave,enemy_type,spawned,killed,leaked,leak_rate,mean_progress,mean_time_alive_seconds,damage_taken,${DMG},killed_lance,killed_mortar,killed_frost,killed_poison,killed_sniper,killed_debug,killed_other`);
export const TOWER_CSV_COLUMNS = cols('id,type,col,row,built_tick,built_wave,built_phase,cost,final_level,invested,sold,sold_wave,refund,damage_dealt,kills,shots,dmg_vs_armoredGrunt,dmg_vs_swarmling,dmg_vs_fastRunner,dmg_vs_regenerator,dmg_vs_shieldedBruiser');
