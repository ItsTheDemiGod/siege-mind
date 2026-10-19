// Consistency checks for a telemetry run (pure). Returns a list of problem strings; empty means valid.
import { config } from '../data/config.js';
import { ENEMY_ORDER } from '../data/enemies.js';

const REQUIRED = ['schemaVersion', 'meta', 'config', 'definitions', 'result', 'totals', 'offWave', 'waves', 'towers'];
const OUTCOMES = new Set(['killed', 'leaked', 'alive']);
const SUM_TOLERANCE = 1e-6;
const DIRECTOR_REASONS = new Set(['static-early', 'static-intro', 'static-fixed', 'cold-start', 'adapted', 'random', 'prior']);
const DIRECTOR_MODES = new Set(['adaptive', 'random', 'adaptive2', 'counter', 'prior']);

const isNum = (v) => typeof v === 'number';

/** Collect every non-finite or negative number under `value` (skipping `skipKeys`: free-form director data, and killer, whose towerId is -1 for non-tower sources). */
function badNumbers(value, path, out, skipKeys = ['director', 'killer']) {
  if (isNum(value)) {
    if (!Number.isFinite(value) || value < 0) out.push(`${path} is not a finite number >= 0 (${String(value)})`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => badNumbers(v, `${path}[${i}]`, out, skipKeys));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) if (!skipKeys.includes(k)) badNumbers(v, `${path}.${k}`, out, skipKeys);
  }
}

const sumOf = (byType, field) => Object.values(byType).reduce((n, t) => n + t[field], 0);

function checkWave(w, problems) {
  const where = `wave ${w.wave}`;
  const types = Object.values(w.byType);
  if (sumOf(w.byType, 'spawned') !== w.spawnedUnits) problems.push(`${where}: per-type spawned (${sumOf(w.byType, 'spawned')}) does not sum to spawnedUnits (${w.spawnedUnits})`);
  for (const [type, t] of Object.entries(w.byType)) {
    if (t.killed + t.leaked > t.spawned) problems.push(`${where}: ${type} killed + leaked exceeds spawned`);
    if (w.complete && t.killed + t.leaked !== t.spawned) problems.push(`${where}: ${type} killed + leaked is not equal to spawned in a complete wave`);
    if (t.meanProgress < 0 || t.meanProgress > 1) problems.push(`${where}: ${type} meanProgress is outside [0,1]`);
  }
  if (types.reduce((n, t) => n + t.killed, 0) !== w.killed) problems.push(`${where}: per-type killed does not sum to the wave killed`);
  if (types.reduce((n, t) => n + t.leaked, 0) !== w.leaked) problems.push(`${where}: per-type leaked does not sum to the wave leaked`);
}

function checkDirector(w, mode, problems) {
  const where = `wave ${w.wave}`;
  const d = w.director;
  if (mode === 'static') {
    if (d !== null) problems.push(`${where}: a static run must not have a director record`);
    return;
  }
  if (!DIRECTOR_MODES.has(mode)) return;
  if (d === null || typeof d !== 'object') { problems.push(`${where}: missing director record`); return; }
  if (d.wave !== w.wave) problems.push(`${where}: director record is for wave ${String(d.wave)}`);
  if (d.mode !== mode) problems.push(`${where}: director mode ${String(d.mode)} differs from run mode ${mode}`);
  if (!DIRECTOR_REASONS.has(d.reason)) problems.push(`${where}: unknown director reason ${String(d.reason)}`);
  for (const [key, minOpen] of [['tilt', true], ['finalShares', false]]) {
    const bad = ENEMY_ORDER.some((t) => !isNum(d[key]?.[t]) || !Number.isFinite(d[key][t]) || (minOpen ? d[key][t] <= 0 : d[key][t] < 0));
    if (bad) problems.push(`${where}: director ${key} needs a finite ${minOpen ? 'positive' : 'non-negative'} number for every enemy type`);
  }
}

function checkEnemies(enemies, problems) {
  const seen = new Set();
  for (const e of enemies) {
    if (seen.has(e.id)) problems.push(`enemy id ${e.id} is duplicated`);
    seen.add(e.id);
    if (!OUTCOMES.has(e.outcome)) problems.push(`enemy ${e.id}: unknown outcome ${String(e.outcome)}`);
    if (e.progress < 0 || e.progress > 1) problems.push(`enemy ${e.id}: progress is outside [0,1]`);
    if (e.outcome === 'leaked' && e.progress !== 1) problems.push(`enemy ${e.id}: a leaked enemy must have progress 1`);
    const parts = Object.values(e.damageBySource).reduce((n, v) => n + v, 0);
    if (Math.abs(parts - e.damageTaken) > SUM_TOLERANCE) problems.push(`enemy ${e.id}: damageTaken differs from the sum of damageBySource`);
  }
}

function checkTotals(run, problems) {
  const { totals, offWave, waves } = run;
  const fields = { spawned: 'spawned', killed: 'killed', leaked: 'leaked' };
  for (const [key, field] of Object.entries(fields)) {
    const sum = sumOf(offWave.byType, field) + waves.reduce((n, w) => n + sumOf(w.byType, field), 0);
    if (totals[key] !== sum) problems.push(`totals.${key} (${totals[key]}) differs from the sum over waves and offWave (${sum})`);
  }
  const lives = offWave.livesLost + waves.reduce((n, w) => n + w.livesLost, 0);
  if (totals.livesLost !== lives) problems.push(`totals.livesLost (${totals.livesLost}) differs from the sum over waves and offWave (${lives})`);
}

/**
 * @param {object} run result of getRun()
 * @returns {string[]} problems, empty when the run is internally consistent
 */
export function validateRun(run) {
  const problems = [];
  if (!run || typeof run !== 'object') return ['run is not an object'];
  if (run.schemaVersion !== config.telemetry.schemaVersion) problems.push(`schemaVersion is ${String(run.schemaVersion)}, expected ${config.telemetry.schemaVersion}`);
  const required = run.meta?.detail === 'full' ? [...REQUIRED, 'enemies'] : REQUIRED;
  for (const k of required) if (!(k in run)) problems.push(`missing top-level key: ${k}`);
  if (problems.some((p) => p.startsWith('missing'))) return problems;

  badNumbers(run.waves, 'waves', problems);
  badNumbers(run.towers, 'towers', problems);
  badNumbers(run.totals, 'totals', problems);
  badNumbers(run.offWave, 'offWave', problems);
  if (run.enemies) badNumbers(run.enemies, 'enemies', problems);

  run.waves.forEach((w, i) => {
    if (i > 0 && w.wave <= run.waves[i - 1].wave) problems.push(`wave numbers are not strictly increasing at wave ${w.wave}`);
    checkWave(w, problems);
    checkDirector(w, run.meta.mode, problems);
  });
  if (run.enemies) checkEnemies(run.enemies, problems);
  checkTotals(run, problems);

  const towerIds = new Set();
  for (const t of run.towers) {
    if (towerIds.has(t.id)) problems.push(`tower id ${t.id} is duplicated`);
    towerIds.add(t.id);
    if (t.sold && (!isNum(t.soldWave) || !isNum(t.refund) || t.refund < 0)) problems.push(`tower ${t.id}: sold needs soldWave and refund >= 0`);
    if (t.finalLevel !== t.upgrades.length) problems.push(`tower ${t.id}: finalLevel differs from the number of upgrades`);
  }
  return problems;
}
