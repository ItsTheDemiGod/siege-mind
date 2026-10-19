// The difficulty-attribution chain, tilt agreement and mean tilts of the six-mode first look (pure, deterministic, exploratory).
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { roundTo } from '../src/sim/telemetrySchema.js';
import { tiltAtWave } from './metrics.js';
import { mean, signFlipTest, bootstrapCI, cohensDz } from './stats.js';

const r6 = (x) => roundTo(x, 6);
const rCI = (ci) => [r6(ci[0]), r6(ci[1])];
export const ATTRIBUTION_METRICS = Object.freeze(['livesLost', 'won', 'finalWave', 'leakFraction', 'penetration']);
/** random-static: composition variability; prior-random: enemy-durability bias beyond variability; adaptive-prior: learning on top of the prior; adaptive-static: the total. */
export const ATTRIBUTION_PAIRS = Object.freeze([['random', 'static'], ['prior', 'random'], ['adaptive', 'prior'], ['adaptive', 'static'], ['adaptive2', 'prior'], ['adaptive2', 'static'], ['counter', 'static'], ['counter', 'prior']]);
export const AGREEMENT_PAIRS = Object.freeze([['adaptive', 'prior'], ['adaptive2', 'prior'], ['adaptive', 'adaptive2'], ['random', 'prior']]);
export const TILT_MODES = Object.freeze(['adaptive', 'adaptive2', 'prior', 'counter']);
export const IDENTITY_TOLERANCE = 1e-9;

/** Seed-level difference a - b: per seed, the mean over the population styles of that seed. @returns {{seeds: number[], diffs: number[]}} */
export function seedDiffs(popBySeed, get, metric, a, b) {
  const seeds = [...popBySeed.keys()].sort((x, y) => x - y);
  return { seeds, diffs: seeds.map((seed) => mean(popBySeed.get(seed).map((style) => get(style, seed, a)[metric] - get(style, seed, b)[metric]))) };
}

/**
 * @param {Map<number, string[]>} popBySeed @param {(style: string, seed: number, mode: string) => object} get @param {string[]} modes modes present @param {object} st PROTOCOL.stats
 * @returns {{pairs: object[], identity: {checked: boolean, ok: boolean, maxError: number, seeds: number}}}
 */
export function attribution(popBySeed, get, modes, st) {
  const pairs = [];
  for (const [a, b] of ATTRIBUTION_PAIRS) {
    if (!modes.includes(a) || !modes.includes(b)) continue;
    for (const metric of ATTRIBUTION_METRICS) {
      const { seeds, diffs } = seedDiffs(popBySeed, get, metric, a, b);
      const test = signFlipTest(diffs, { resamples: st.signFlipResamples, exactMaxN: st.exactMaxN, seed: st.seed });
      pairs.push({ a, b, metric, n: seeds.length, meanDiff: r6(mean(diffs)), ci95: rCI(bootstrapCI(diffs, { resamples: st.bootstrapResamples, alpha: st.alpha, seed: st.seed })), pRaw: r6(test.p), dz: r6(cohensDz(diffs)) });
    }
  }
  const have = ['static', 'random', 'prior', 'adaptive'].every((m) => modes.includes(m));
  if (!have) return { pairs, identity: { checked: false, ok: true, maxError: 0, seeds: 0 } };
  const total = seedDiffs(popBySeed, get, 'livesLost', 'adaptive', 'static');
  const parts = [['random', 'static'], ['prior', 'random'], ['adaptive', 'prior']].map(([a, b]) => seedDiffs(popBySeed, get, 'livesLost', a, b).diffs);
  const maxError = Math.max(0, ...total.diffs.map((d, i) => Math.abs(d - (parts[0][i] + parts[1][i] + parts[2][i]))));
  return { pairs, identity: { checked: true, ok: maxError < IDENTITY_TOLERANCE, maxError, seeds: total.seeds.length } };
}

/** Units (style|seed) to row-tilt arrays of one mode: Map(unit -> tiltByWave). */
const tiltsOf = (popRows, mode) => new Map(popRows.filter((r) => r.mode === mode && Array.isArray(r.tiltByWave)).map((r) => [`${r.style}|${r.seed}`, r.tiltByWave]));

/**
 * Mean over units observed in BOTH modes at an eligible wave W of the mean over the five types of |tilt_A - tilt_B|; the pooled value averages all (unit, wave) cells.
 * @returns {{a: string, b: string, perWave: {wave: number, n: number, mean: number}[], pooled: {n: number, mean: number|null}}[]}
 */
export function tiltAgreement(popRows, modes, waves) {
  const out = [];
  for (const [a, b] of AGREEMENT_PAIRS) {
    if (!modes.includes(a) || !modes.includes(b)) continue;
    const ta = tiltsOf(popRows, a);
    const tb = tiltsOf(popRows, b);
    const perWave = [];
    const cells = [];
    for (const W of waves) {
      const vals = [];
      for (const [unit, arrA] of ta) {
        const x = arrA[W - 1];
        const y = tb.get(unit)?.[W - 1];
        if (x && y) vals.push(mean(ENEMY_ORDER.map((t) => Math.abs(x[t] - y[t]))));
      }
      if (vals.length) { perWave.push({ wave: W, n: vals.length, mean: r6(mean(vals)) }); cells.push(...vals); }
    }
    out.push({ a, b, perWave, pooled: { n: cells.length, mean: cells.length ? r6(mean(cells)) : null } });
  }
  return out;
}

/** Mean applied tilt per enemy type per wave over the units observed at that wave. @returns {{mode: string, wave: number, n: number, tilt: Record<string, number>}[]} */
export function meanTilts(popRows, modes, waves) {
  const out = [];
  for (const mode of TILT_MODES.filter((m) => modes.includes(m))) {
    const t = tiltsOf(popRows, mode);
    for (const W of waves) {
      const cells = [...t.values()].map((arr) => arr[W - 1]).filter(Boolean);
      if (cells.length) out.push({ mode, wave: W, n: cells.length, tilt: Object.fromEntries(ENEMY_ORDER.map((ty) => [ty, r6(mean(cells.map((c) => c[ty])))])) });
    }
  }
  return out;
}

/** @param {object} row @param {number} W @returns {boolean} whether the row has an observed tilt at W */
export const observedAt = (row, W) => tiltAtWave(row, W) !== null;
