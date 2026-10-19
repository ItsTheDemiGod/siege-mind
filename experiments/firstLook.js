// First look at the research arms (pure, deterministic): exploratory comparison of all modes present in a rows set, on the population of units
// whose STATIC game reached wave 5 or later (a pre-treatment condition). Nothing here is adjusted and nothing is confirmatory.
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { roundTo } from '../src/sim/telemetrySchema.js';
import { PROTOCOL } from './protocol.js';
import { ALL_MODES } from './modes.js';
import { tiltAtWave } from './metrics.js';
import { earlyLossReport } from './earlyLosses.js';
import { mean, sd, signFlipTest, bootstrapCI, cohensDz, wilson } from './stats.js';

export { formatFirstLook, firstLookToMarkdown } from './firstLookFormat.js';

const r6 = (x) => roundTo(x, 6);
const rCI = (ci) => [r6(ci[0]), r6(ci[1])];
export const POPULATION_MIN_WAVE = 5;
export const DESCRIPTIVE_METRICS = ['livesLost', 'won', 'finalWave', 'leakFraction', 'penetration'];
export const PAIR_METRICS = ['livesLost', 'won', 'finalWave'];
export const PAIRS = Object.freeze([['adaptive', 'static'], ['adaptive', 'random'], ['adaptive2', 'static'], ['adaptive2', 'random'], ['adaptive2', 'adaptive'], ['counter', 'static'], ['counter', 'random'], ['counter', 'adaptive2']]);
export const FIXED_WAVES = Object.freeze([5, 7, 9, 11, 12, 13, 14, 15]);
export const CONTRAST_MODES = Object.freeze(['adaptive', 'adaptive2', 'counter', 'random']);
export const NOTES = Object.freeze([
  'These results are exploratory and on the TRAIN seeds (1001-1020); nothing was tuned and nothing is adjusted for multiple comparisons.',
  'The random control draws its tilts from the seed and the wave only, so its tilts are identical across styles for a seed and wave and its fixed-wave contrast is exactly 0 by construction.',
  'The counter arm has information about the player\'s defense (the tower loadout) and is a ceiling, not a fair comparison.',
  'Director v1 and v2 use the same eligibility and fairness rules (same threat per wave, same enemy HP, composition only).',
]);

const keyOf = (r) => `${r.style}|${r.seed}`;

/** Validates that every (style, seed) unit has exactly one row per mode present. @throws {Error} naming the unit */
function checkComplete(rows, modes) {
  const seen = new Map();
  for (const r of rows) {
    const k = `${keyOf(r)}|${r.mode}`;
    if (seen.has(k)) throw new Error(`duplicate unit ${r.style}/${r.mode}/seed ${r.seed}`);
    seen.set(k, r);
  }
  for (const r of rows) for (const m of modes) if (!seen.has(`${keyOf(r)}|${m}`)) throw new Error(`missing unit ${r.style}/${m}/seed ${r.seed}`);
  return seen;
}

function describe(values) { return { n: values.length, mean: r6(mean(values)), sd: r6(sd(values)) }; }

function pairedDifference(popBySeed, get, metric, a, b, st) {
  const seeds = [...popBySeed.keys()].sort((x, y) => x - y);
  const diffs = seeds.map((seed) => mean(popBySeed.get(seed).map((style) => get(style, seed, a)[metric] - get(style, seed, b)[metric])));
  const test = signFlipTest(diffs, { resamples: st.signFlipResamples, exactMaxN: st.exactMaxN, seed: st.seed });
  return {
    a, b, metric, n: seeds.length, meanDiff: r6(mean(diffs)), ci95: rCI(bootstrapCI(diffs, { resamples: st.bootstrapResamples, alpha: st.alpha, seed: st.seed })),
    pRaw: r6(test.p), dz: r6(cohensDz(diffs)),
  };
}

/** Style contrast at a fixed wave W for one mode (same definition as contrastPerSeed, with the tilt taken from tiltByWave at W). */
function contrastAtWave(popRows, mode, W, protocol) {
  const st = protocol.stats;
  const cell = new Map();
  for (const r of popRows) { const t = r.mode === mode ? tiltAtWave(r, W) : null; if (t) cell.set(keyOf(r), t); }
  const S = protocol.styles.filter((s) => Array.isArray(protocol.tiltPredictions[s]) && protocol.tiltPredictions[s].length > 0);
  const seeds = [...new Set(popRows.map((r) => r.seed))].sort((x, y) => x - y);
  const values = [];
  const pairAcc = new Map();
  for (const seed of seeds) {
    const pairs = [];
    for (const s of S) {
      const own = cell.get(`${s}|${seed}`);
      const refs = S.filter((x) => x !== s).map((x) => cell.get(`${x}|${seed}`)).filter(Boolean);
      if (!own || refs.length < 1) continue;
      for (const t of protocol.tiltPredictions[s]) {
        const v = r6(own[t] - mean(refs.map((x) => x[t])));
        pairs.push(v);
        (pairAcc.get(`${s}|${t}`) ?? pairAcc.set(`${s}|${t}`, []).get(`${s}|${t}`)).push(v);
      }
    }
    if (pairs.length) values.push(mean(pairs));
  }
  const popUnits = new Set(popRows.map(keyOf)).size;
  const base = { mode, wave: W, observedUnits: cell.size, popUnits, coverage: r6(popUnits ? cell.size / popUnits : 0), seeds: values.length };
  const perPair = [...pairAcc.entries()].map(([k, v]) => { const [style, type] = k.split('|'); return { style, type, n: v.length, mean: r6(mean(v)) }; }).sort((a, b) => (a.style + a.type < b.style + b.type ? -1 : 1));
  if (values.length === 0) return { ...base, mean: null, ci95: null, pRaw: null, perPair };
  const test = signFlipTest(values, { resamples: st.signFlipResamples, exactMaxN: st.exactMaxN, seed: st.seed });
  return { ...base, mean: r6(mean(values)), ci95: rCI(bootstrapCI(values, { resamples: st.bootstrapResamples, alpha: st.alpha, seed: st.seed })), pRaw: r6(test.p), perPair };
}

/**
 * @param {object[]} rows result rows of ONE unit set, every mode present for every (style, seed) @param {typeof PROTOCOL} [protocol]
 * @returns {object} plain JSON-serializable result
 * @throws {Error} on missing or duplicate units or when the static mode is absent
 */
export function firstLook(rows, protocol = PROTOCOL) {
  const modes = ALL_MODES.filter((m) => rows.some((r) => r.mode === m));
  if (!modes.includes('static')) throw new Error('the static mode is required to define the population');
  const seen = checkComplete(rows, modes);
  const st = protocol.stats;
  const styles = protocol.styles.filter((s) => rows.some((r) => r.style === s));
  const units = [...new Set(rows.map(keyOf))];
  const popUnits = units.filter((u) => seen.get(`${u}|static`).finalWave >= POPULATION_MIN_WAVE);
  const popRows = rows.filter((r) => popUnits.includes(keyOf(r)));
  const popBySeed = new Map();
  for (const u of popUnits) { const [style, seed] = u.split('|'); (popBySeed.get(Number(seed)) ?? popBySeed.set(Number(seed), []).get(Number(seed))).push(style); }
  const get = (style, seed, mode) => seen.get(`${style}|${seed}|${mode}`);

  const population = { units: popUnits.length, excluded: units.length - popUnits.length, totalUnits: units.length, seeds: popBySeed.size, allSeeds: new Set(rows.map((r) => r.seed)).size, minWave: POPULATION_MIN_WAVE };
  const descriptive = {};
  for (const metric of DESCRIPTIVE_METRICS) {
    descriptive[metric] = { byMode: {}, byStyleMode: Object.fromEntries(styles.map((s) => [s, {}])) };
    for (const mode of modes) {
      const all = popRows.filter((r) => r.mode === mode).map((r) => r[metric]);
      descriptive[metric].byMode[mode] = describe(all);
      if (metric === 'won') descriptive[metric].byMode[mode].wilson = rCI(wilson(all.reduce((a, b) => a + b, 0), all.length));
      for (const style of styles) {
        const v = popRows.filter((r) => r.mode === mode && r.style === style).map((r) => r[metric]);
        descriptive[metric].byStyleMode[style][mode] = describe(v);
        if (metric === 'won') descriptive[metric].byStyleMode[style][mode].wilson = rCI(wilson(v.reduce((a, b) => a + b, 0), v.length));
      }
    }
  }
  const pairs = [];
  for (const [a, b] of PAIRS) if (modes.includes(a) && modes.includes(b)) for (const metric of PAIR_METRICS) pairs.push(pairedDifference(popBySeed, get, metric, a, b, st));

  const contrastModes = CONTRAST_MODES.filter((m) => modes.includes(m));
  const fixedWave = [];
  for (const W of FIXED_WAVES) for (const mode of contrastModes) fixedWave.push(contrastAtWave(popRows, mode, W, protocol));
  const avgCoverage = (W) => mean(fixedWave.filter((c) => c.wave === W && c.mode !== 'random' && c.mode !== 'static').map((c) => c.coverage));
  const bestWave = FIXED_WAVES.reduce((best, W) => (avgCoverage(W) > avgCoverage(best) + 1e-12 ? W : best), FIXED_WAVES[0]);
  const perPairAtBest = fixedWave.filter((c) => c.wave === bestWave).map((c) => ({ mode: c.mode, wave: c.wave, coverage: c.coverage, perPair: c.perPair }));

  return {
    modes, population, descriptive, pairs, fixedWave, bestWave, perPairAtBest, types: [...ENEMY_ORDER],
    earlyEnds: earlyLossReport(rows, { threshold: POPULATION_MIN_WAVE }), notes: [...NOTES],
  };
}
