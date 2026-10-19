// Building blocks of the confirmatory analysis (pure, deterministic): the population, population-restricted seed-level values and their summaries.
import { roundTo } from '../src/sim/telemetrySchema.js';
import { contrastSeedValues } from './firstLookContrast.js';
import { tiltAtWave } from './metrics.js';
import { mean, sd, signFlipTest, bootstrapCI, requiredN } from './stats.js';

const r6 = (x) => roundTo(x, 6);
export const HOLM_LEVEL = 0.016667; // 0.05 / 3: the Holm level of the smallest of the three confirmatory p-values
const keyOf = (r) => `${r.style}|${r.seed}`;

/**
 * Population: units (style, seed) whose STATIC row has finalWave >= the protocol minimum. The same units are used in every mode.
 * @returns {{keys: Set<string>, units: number, excluded: number, rows: object[]}} rows are the rows of all modes restricted to the population
 */
export function populationOf(rows, protocol) {
  const min = protocol.confirmatory.population.minStaticFinalWave;
  const all = new Set(rows.map(keyOf));
  const keys = new Set(rows.filter((r) => r.mode === 'static' && r.finalWave >= min).map(keyOf));
  return { keys, units: keys.size, excluded: all.size - keys.size, rows: rows.filter((r) => keys.has(keyOf(r))) };
}

/**
 * Population-restricted seed-level value of metric(modeA) - metric(modeB): per seed the mean over that seed's units in `rows`. Seeds without a unit are dropped.
 * @param {object[]} rows already restricted to the units to use @param {number[]} allSeeds every seed of the data set
 * @returns {{seeds: number[], values: number[], dropped: number[]}} @throws {Error} on a duplicate or on a missing unit inside the restriction
 */
export function seedValuesMetric(rows, allSeeds, metric, modeA, modeB) {
  const cell = new Map();
  for (const r of rows) {
    if (r.mode !== modeA && r.mode !== modeB) continue;
    const k = `${keyOf(r)}|${r.mode}`;
    if (cell.has(k)) throw new Error(`duplicate unit ${r.style}/${r.mode}/seed ${r.seed}`);
    cell.set(k, r[metric]);
  }
  const bySeed = new Map();
  for (const k of cell.keys()) { const [style, seed] = k.split('|'); (bySeed.get(Number(seed)) ?? bySeed.set(Number(seed), new Set()).get(Number(seed))).add(style); }
  const seeds = [];
  const values = [];
  const dropped = [];
  for (const seed of [...allSeeds].sort((x, y) => x - y)) {
    const styles = [...(bySeed.get(seed) ?? [])].sort();
    if (styles.length === 0) { dropped.push(seed); continue; }
    const diffs = styles.map((style) => {
      const a = cell.get(`${style}|${seed}|${modeA}`);
      const b = cell.get(`${style}|${seed}|${modeB}`);
      if (a === undefined || b === undefined) throw new Error(`missing unit ${style}/${a === undefined ? modeA : modeB}/seed ${seed}`);
      return a - b;
    });
    seeds.push(seed);
    values.push(mean(diffs));
  }
  return { seeds, values, dropped };
}

/** Estimate (mean) and 95% cluster bootstrap CI over seeds; null fields when there are no values. */
export function estimateOf(values, st) {
  if (values.length === 0) return { n: 0, estimate: null, ci95: null };
  const ci = bootstrapCI(values, { resamples: st.bootstrapResamples, alpha: st.alpha, seed: st.seed });
  return { n: values.length, estimate: r6(mean(values)), ci95: [r6(ci[0]), r6(ci[1])] };
}

/** Raw two-sided sign-flip p of the mean against 0 (1 when there are no values). */
export function pRawOf(values, st) {
  return values.length === 0 ? 1 : r6(signFlipTest(values, { resamples: st.signFlipResamples, exactMaxN: st.exactMaxN, seed: st.seed }).p);
}

/** Seed-level values of one confirmatory hypothesis on the given rows (K1: metric difference; K2/K3: fixed-wave contrast, unlocked pairs only). */
export function hypothesisValues(h, rows, allSeeds, protocol) {
  if (h.kind === 'metric') return seedValuesMetric(rows, allSeeds, h.metric, h.modeA, h.modeB);
  const c = contrastSeedValues(rows, h.mode, h.wave, protocol, { unlockedOnly: true });
  return { seeds: c.seeds, values: c.values, dropped: allSeeds.filter((s) => !c.seeds.includes(s)) };
}

/** Post hoc power note: seeds needed for 80% power at the observed estimate and the Holm level; null when the estimate is not positive or the spread is 0. */
export function powerOf(values) {
  if (values.length < 2) return { sd: null, seedsNeeded: null };
  const e = mean(values);
  const s = sd(values);
  return { sd: r6(s), seedsNeeded: e > 0 && s > 0 ? requiredN({ sd: s, effect: e, alpha: HOLM_LEVEL }) : null };
}

/** Units of `mode` observed (non-null tilt) at wave W among `rows`. @returns {Set<string>} unit keys */
export const observedUnits = (rows, mode, W) => new Set(rows.filter((r) => r.mode === mode && tiltAtWave(r, W)).map(keyOf));
export { keyOf };
