// Telemetry export (pure): JSON text and RFC 4180 style CSV tables built from a run (see docs/TELEMETRY.md).
import { config } from '../data/config.js';
import { ENEMY_ORDER } from '../data/enemies.js';
import { TOWER_ORDER } from '../data/towers.js';
import {
  SOURCE_IDS, roundTo, ENEMY_CSV_COLUMNS, WAVE_CSV_COLUMNS, WAVE_TYPE_CSV_COLUMNS, TOWER_CSV_COLUMNS,
} from './telemetrySchema.js';

const NEEDS_QUOTES = /[",\r\n]/;

function field(value, floatDigits, column, rowIndex) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`CSV value is not finite (column ${column}, row ${rowIndex})`);
    return String(Number.isInteger(value) ? value : roundTo(value, floatDigits));
  }
  const text = String(value);
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * @param {Array<Array<*>>} rows values in column order @param {readonly string[]} columns
 * @param {{floatDigits?: number}} [options]
 * @returns {string} header plus one line per row, '\n' line endings, trailing newline
 */
export function toCsv(rows, columns, { floatDigits = config.telemetry.csvFloatDigits } = {}) {
  const lines = [columns.join(',')];
  rows.forEach((row, r) => {
    if (row.length !== columns.length) throw new RangeError(`CSV row ${r} has ${row.length} fields, expected ${columns.length}`);
    lines.push(row.map((v, c) => field(v, floatDigits, columns[c], r)).join(','));
  });
  return `${lines.join('\n')}\n`;
}

/** @param {object} run @param {{pretty?: boolean}} [options] @returns {string} */
export function runToJson(run, { pretty = false } = {}) {
  return JSON.stringify(run, null, pretty ? 2 : undefined);
}

const bySource = (counts) => SOURCE_IDS.map((id) => counts[id]);

/** @param {object} run @returns {string} one row per wave record */
export function wavesCsv(run) {
  const rows = run.waves.map((w) => [
    w.wave, w.name, w.fixed, w.complete, w.mode, w.startTick, w.endTick, w.seconds, w.hpMult, w.budget, w.threat, w.spawnedUnits, w.killed, w.leaked,
    w.livesLost, w.livesAfter, w.gold.atStart, w.gold.prepSpent, w.gold.prepRefunded, w.gold.earnedKills, w.gold.clearBonus, w.gold.spentDuring, w.gold.atEnd,
    w.loadout.totalTowers, w.loadout.totalInvested, w.loadout.nominalDps, ...TOWER_ORDER.map((id) => w.loadout.byType[id].count),
  ]);
  return toCsv(rows, WAVE_CSV_COLUMNS);
}

/** @param {object} run @returns {string} five rows (one per enemy type) per wave */
export function waveTypesCsv(run) {
  const rows = [];
  for (const w of run.waves) {
    for (const id of ENEMY_ORDER) {
      const t = w.byType[id];
      rows.push([w.wave, id, t.spawned, t.killed, t.leaked, t.leakRate, t.meanProgress, t.meanTimeAliveSeconds, t.damageTaken, ...bySource(t.damageBySource), ...bySource(t.killedBySource)]);
    }
  }
  return toCsv(rows, WAVE_TYPE_CSV_COLUMNS);
}

/** @param {object} run full-detail run @returns {string} one row per enemy record @throws {Error} for a summary run */
export function enemiesCsv(run) {
  if (!Array.isArray(run.enemies)) throw new Error("this run has no enemy records (detail 'summary'); export with detail 'full'");
  const step = run.meta.stepSeconds;
  const rows = run.enemies.map((e) => [
    e.id, e.type, e.wave, e.hpMult, e.spawnTick, e.spawnTick * step, e.maxHp, e.maxShield, e.outcome, e.outcomeTick, e.timeAliveTicks * step, e.progress,
    e.damageTaken, ...bySource(e.damageBySource), e.killer ? e.killer.source : null, e.killer ? e.killer.towerId : null,
  ]);
  return toCsv(rows, ENEMY_CSV_COLUMNS);
}

/** @param {object} run @returns {string} one row per tower record */
export function towersCsv(run) {
  const rows = run.towers.map((t) => [
    t.id, t.type, t.col, t.row, t.builtTick, t.builtWave, t.builtPhase, t.cost, t.finalLevel, t.invested, t.sold, t.soldWave, t.refund, t.damageDealt,
    t.kills, t.shots, ...ENEMY_ORDER.map((id) => t.damageByEnemyType[id]),
  ]);
  return toCsv(rows, TOWER_CSV_COLUMNS);
}
