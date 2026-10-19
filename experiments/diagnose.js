// Diagnostics of the Director's reward signal on STATIC games (tuning seeds): does the reward mostly reflect the enemy type and the wave
// (tankiness) rather than the player's defense? Diagnostic only: nothing in the sim or the Director reads these numbers.
import { config } from '../src/data/config.js';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { rewardOf } from '../src/sim/directorMath.js';
import { roundTo } from '../src/sim/telemetrySchema.js';
import { playGame } from './playthrough.js';
import { createStyleBot } from './styleBots.js';
import { PROTOCOL, seedsOf } from './protocol.js';
import { mean, sd, median } from './stats.js';

export { formatDiagnostics, diagnosticsToMarkdown } from './diagnoseFormat.js';

const r6 = (x) => roundTo(x, 6);
export const NOTES = Object.freeze([
  'These are static-mode measurements: no Director influenced the games.',
  'A type ratio above 1 means the reward formula favors that type regardless of the Director.',
  'A low etaStyle means the reward mostly reflects the enemy type and the wave, not the player\'s defense.',
  'The table is diagnostic only and is used by no code in this phase.',
]);

/**
 * Play static games and collect one observation per (seed, style, wave, enemy type) from complete waves.
 * @param {{seeds: number[], styles: string[], waves: number, knobs: object, playGameFn?: Function}} o
 * @returns {{seed: number, style: string, wave: number, type: string, units: number, killed: number, leaked: number, progressSum: number, threatCost: number, leakDamage: number}[]}
 */
export function collectBaselineObservations({ seeds, styles, waves, knobs, playGameFn = playGame }) {
  const obs = [];
  for (const seed of seeds) {
    for (const style of styles) {
      const r = playGameFn({ seed, bot: createStyleBot(style, knobs), mode: 'static', totalWaves: waves, telemetry: 'summary' });
      if (r.result === 'timeout') throw new Error(`static game ${style}/seed ${seed} timed out`);
      for (const w of r.run.waves) {
        if (!w.complete) continue;
        for (const type of ENEMY_ORDER) {
          const s = w.byType[type];
          const def = r.run.definitions.enemies[type];
          obs.push({ seed, style, wave: w.wave, type, units: s.spawned, killed: s.killed, leaked: s.leaked, progressSum: s.progressSum, threatCost: def.threatCost, leakDamage: def.leakDamage });
        }
      }
    }
  }
  return obs;
}

/** Reward of one cell, or null when nothing was sent. */
export function cellReward(o) {
  if (o.units <= 0) return null;
  return rewardOf({ leakDamage: o.leakDamage, meanProgress: Math.min(1, o.progressSum / o.units), threatCost: o.threatCost, exponent: config.director.rewardExponent });
}

function pooled(cells) {
  let w = 0;
  let spent = 0;
  let units = 0;
  for (const c of cells) { const spentHere = c.units * c.threatCost; w += spentHere * c.reward; spent += spentHere; units += c.units; }
  return { cells: cells.length, units, pooledReward: spent > 0 ? w / spent : 0 };
}

const withRewards = (obs, minWave = 1) => obs.filter((o) => o.wave >= minWave && o.units > 0).map((o) => ({ ...o, reward: cellReward(o) }));

/** Pooled threat-weighted reward per enemy type (overall and per style) and its ratio to the all-type pooled reward in the same grouping. */
export function baselineTable(obs, { minWave }) {
  const cells = withRewards(obs, minWave);
  const styles = [...new Set(cells.map((c) => c.style))].sort();
  const group = (list) => {
    const all = pooled(list).pooledReward;
    return Object.fromEntries(ENEMY_ORDER.map((t) => {
      const p = pooled(list.filter((c) => c.type === t));
      return [t, { cells: p.cells, units: p.units, pooledReward: r6(p.pooledReward), ratio: r6(all > 0 ? p.pooledReward / all : 0) }];
    }));
  };
  const all = r6(pooled(cells).pooledReward);
  return { minWave, allTypesPooledReward: all, overall: group(cells), perStyle: Object.fromEntries(styles.map((s) => [s, group(cells.filter((c) => c.style === s))])) };
}

function eta(values, keys) {
  const m = mean(values);
  const sst = values.reduce((a, x) => a + (x - m) * (x - m), 0);
  if (sst < 1e-12) return 0; // float noise around a constant reward is not variance
  const groups = new Map();
  values.forEach((x, i) => { (groups.get(keys[i]) ?? groups.set(keys[i], []).get(keys[i])).push(x); });
  let ssb = 0;
  for (const g of groups.values()) ssb += g.length * (mean(g) - m) * (mean(g) - m);
  return ssb / sst;
}

/** Per enemy type: the share of the variance of per-cell rewards explained by the style and by the wave. */
export function varianceDecomposition(obs) {
  const cells = withRewards(obs);
  return Object.fromEntries(ENEMY_ORDER.map((t) => {
    const c = cells.filter((x) => x.type === t);
    const values = c.map((x) => x.reward);
    return [t, { cells: c.length, etaStyle: r6(eta(values, c.map((x) => x.style))), etaWave: r6(eta(values, c.map((x) => x.wave))) }];
  }));
}

/** Per enemy type: median sd of the cell reward over (style, wave) groups with at least 2 seeds, against the spread of the per-type pooled rewards (waves 5 and later). */
export function noiseFloor(obs) {
  const cells = withRewards(obs);
  const base5 = baselineTable(obs, { minWave: 5 });
  const rewards = ENEMY_ORDER.map((t) => base5.overall[t].pooledReward).filter((_, i) => base5.overall[ENEMY_ORDER[i]].cells > 0);
  const spread = rewards.length ? Math.max(...rewards) - Math.min(...rewards) : 0;
  const perType = {};
  const ratio = {};
  for (const t of ENEMY_ORDER) {
    const groups = new Map();
    for (const c of cells.filter((x) => x.type === t)) (groups.get(`${c.style}|${c.wave}`) ?? groups.set(`${c.style}|${c.wave}`, []).get(`${c.style}|${c.wave}`)).push(c.reward);
    const sds = [...groups.values()].filter((g) => g.length >= 2).map((g) => sd(g));
    const med = sds.length ? median(sds) : 0;
    perType[t] = { groups: sds.length, medianSd: r6(med) };
    ratio[t] = r6(spread > 0 ? med / spread : 0);
  }
  return { perType, spread: { minWave: 5, value: r6(spread) }, ratio };
}

/** @param {object[]} obs @returns {object} { baseline1, baseline5, variance, noise, notes } */
export function diagnose(obs) {
  return { baseline1: baselineTable(obs, { minWave: 1 }), baseline5: baselineTable(obs, { minWave: 5 }), variance: varianceDecomposition(obs), noise: noiseFloor(obs), notes: [...NOTES] };
}
