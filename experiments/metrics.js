// Per-game metrics from a telemetry run (pure). Definitions are pre-registered in docs/EXPERIMENT.md.
import { config } from '../src/data/config.js';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { TOWER_ORDER } from '../src/data/towers.js';
import { roundTo } from '../src/sim/telemetrySchema.js';
import { tiltFromScores } from '../src/sim/directorMath.js';

const TILTS = ENEMY_ORDER.map((t) => `tilt_${t}`);
const SHARES = TOWER_ORDER.map((t) => `dmgShare_${t}`);

/** Columns of a result row, in file order (the array field livesLostByWave is JSON-only). */
export const METRIC_COLUMNS = Object.freeze([
  'style', 'mode', 'seed', 'result', 'won', 'finalWave', 'completedWaves', 'livesLeft', 'livesLost', 'minutes', 'spawnedThreat', 'leakedUnits', 'leakedThreat',
  'leakFraction', 'penetration', 'towersBuilt', 'upgrades', ...SHARES, 'eligibleWaves', 'adaptedWaves', 'meanShiftFrac', ...TILTS, 'tiltAligned',
]);

const r6 = (x) => roundTo(x, 6);

/** @param {object} d a Director decision record @returns {number} half the L1 distance between final and template shares */
const shiftOf = (d) => 0.5 * ENEMY_ORDER.reduce((n, t) => n + Math.abs(d.finalShares[t] - d.templateShares[t]), 0);

/** Final held weights: the scores of the last Director record turned into tilts (adaptive), its applied tilt (random), all 1 (static). */
function finalTilts(run) {
  const ones = Object.fromEntries(ENEMY_ORDER.map((t) => [t, 1]));
  const last = [...run.waves].reverse().find((w) => w.director);
  if (!last || run.meta.mode === 'static') return ones;
  return run.meta.mode === 'adaptive' ? tiltFromScores(last.director.scores, config.director) : { ...last.director.tilt };
}

/**
 * @param {object} run telemetry run (summary detail is enough)
 * @returns {object} the metrics of one game (see METRIC_COLUMNS; style, mode, seed and tiltAligned are added by the experiment) plus livesLostByWave
 */
export function metricsFromRun(run) {
  const cost = (t) => run.definitions.enemies[t].threatCost;
  let spawnedThreat = 0;
  let leakedThreat = 0;
  let progressWeighted = 0;
  let endedThreat = 0;
  for (const w of run.waves) {
    for (const t of ENEMY_ORDER) {
      const s = w.byType[t];
      spawnedThreat += s.spawned * cost(t);
      leakedThreat += s.leaked * cost(t);
      progressWeighted += cost(t) * s.progressSum;
      endedThreat += cost(t) * (s.killed + s.leaked);
    }
  }
  const by = run.totals.damageBySource;
  const towerDamage = TOWER_ORDER.reduce((n, t) => n + by[t], 0);
  const withDirector = run.waves.filter((w) => w.director);
  const eligible = withDirector.filter((w) => w.director.eligible);
  const tilts = finalTilts(run);
  const m = {
    result: run.result.result ?? 'unfinished',
    won: run.result.result === 'won' ? 1 : 0,
    finalWave: run.result.wave,
    completedWaves: run.waves.filter((w) => w.complete).length,
    livesLeft: run.result.lives,
    livesLost: run.meta.startLives - run.result.lives,
    minutes: r6(run.result.seconds / 60),
    spawnedThreat,
    leakedUnits: run.totals.leaked,
    leakedThreat,
    leakFraction: r6(spawnedThreat > 0 ? leakedThreat / spawnedThreat : 0),
    penetration: r6(endedThreat > 0 ? progressWeighted / endedThreat : 0),
    towersBuilt: run.totals.towersBuilt,
    upgrades: run.totals.upgrades,
  };
  TOWER_ORDER.forEach((t, i) => { m[SHARES[i]] = r6(towerDamage > 0 ? by[t] / towerDamage : 0); });
  m.eligibleWaves = eligible.length;
  m.adaptedWaves = eligible.filter((w) => w.director.reason === 'adapted').length;
  m.meanShiftFrac = r6(eligible.length ? eligible.reduce((n, w) => n + shiftOf(w.director), 0) / eligible.length : 0);
  ENEMY_ORDER.forEach((t, i) => { m[TILTS[i]] = r6(tilts[t]); });
  m.livesLostByWave = Array.from({ length: run.meta.totalWaves }, (_, i) => run.waves.find((w) => w.wave === i + 1)?.livesLost ?? null);
  return m;
}

/**
 * Did the final weights lean toward the types this style is predicted to be weak against?
 * @param {string} style @param {Record<string, number>} tiltRow an object with tilt_<type> fields @param {Record<string, string[]|null>} predictions @param {number} threshold
 * @returns {1|0|null} null when the style has no prediction
 */
export function tiltAlignedOf(style, tiltRow, predictions, threshold) {
  const predicted = predictions[style];
  if (!predicted) return null;
  return Math.max(...predicted.map((t) => tiltRow[`tilt_${t}`])) >= threshold ? 1 : 0;
}
