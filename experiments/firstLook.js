// First look at the research arms (pure, deterministic): exploratory comparison of all modes present in a rows set, on the population of units
// whose STATIC game reached wave 5 or later (a pre-treatment condition). Nothing here is adjusted and nothing is confirmatory.
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { roundTo } from '../src/sim/telemetrySchema.js';
import { PROTOCOL } from './protocol.js';
import { ALL_MODES } from './modes.js';
import { contrastAtWave } from './firstLookContrast.js';
import { attribution, tiltAgreement, meanTilts, observedAt } from './firstLookChain.js';
import { coverageTable, chooseFixedWave, FIXED_WAVE_CANDIDATES, FIXED_WAVE_MIN_COVERAGE } from './fixedWave.js';
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
export const CONTRAST_MODES = Object.freeze(['adaptive', 'adaptive2', 'counter', 'prior', 'random']);
export const ZERO_BY_CONSTRUCTION = Object.freeze(['random', 'prior']); // their tilts cannot depend on the defense
export const ZERO_TOLERANCE = 1e-9;
export const NOTES = Object.freeze([
  'These results are exploratory and on the TRAIN seeds (1001-1020); nothing was tuned and nothing is adjusted for multiple comparisons.',
  'The prior and random tilts cannot depend on the defense (the random tilts depend only on the seed and the wave, the prior tilts only on the wave), so their fixed-wave contrast is zero by construction.',
  'The counter arm reads the tower loadout and is a reference, not a fair comparison.',
  'The attribution chain splits the total effect of Director v1 (adaptive minus static) into three parts that add up exactly: composition variability (random minus static), enemy-durability bias beyond variability (prior minus random) and learning on top of the prior (adaptive minus prior).',
  'Director v1 and v2 use the same eligibility and fairness rules (same threat per wave, same enemy HP, composition only).',
]);

const keyOf = (r) => `${r.style}|${r.seed}`;
const CHOICE_MODES = ['adaptive', 'adaptive2', 'counter', 'prior', 'random'];

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
  const zeroViolations = fixedWave.filter((c) => ZERO_BY_CONSTRUCTION.includes(c.mode) && c.mean !== null && Math.abs(c.mean) >= ZERO_TOLERANCE).map((c) => `${c.mode} wave ${c.wave}: ${c.mean}`);
  // matched-set sensitivity: only units observed at W in ALL of adaptive, adaptive2 and counter
  const matchModes = ['adaptive', 'adaptive2', 'counter'].filter((m) => modes.includes(m));
  const matched = matchModes.length === 3 ? FIXED_WAVES.flatMap((W) => {
    const sets = matchModes.map((m) => new Set(popRows.filter((r) => r.mode === m && observedAt(r, W)).map(keyOf)));
    const common = new Set([...sets[0]].filter((u) => sets.every((x) => x.has(u))));
    const sub = popRows.filter((r) => common.has(keyOf(r)));
    return matchModes.map((m) => ({ ...contrastAtWave(sub, m, W, protocol), matchedUnits: common.size }));
  }) : [];
  const avgCoverage = (W) => mean(fixedWave.filter((c) => c.wave === W && c.mode !== 'random' && c.mode !== 'static').map((c) => c.coverage));
  const bestWave = FIXED_WAVES.reduce((best, W) => (avgCoverage(W) > avgCoverage(best) + 1e-12 ? W : best), FIXED_WAVES[0]);
  const perPairAtBest = fixedWave.filter((c) => c.wave === bestWave).map((c) => ({ mode: c.mode, wave: c.wave, coverage: c.coverage, perPair: c.perPair }));

  const popKeys = new Set(popUnits);
  const cmodes = CHOICE_MODES.filter((m) => modes.includes(m));
  const coverage = coverageTable(popRows, { modes: cmodes, waves: [...FIXED_WAVES], population: popKeys });
  const choice = cmodes.length === CHOICE_MODES.length ? chooseFixedWave(coverage, { candidates: [...FIXED_WAVE_CANDIDATES], modes: cmodes, minCoverage: FIXED_WAVE_MIN_COVERAGE }) : null;
  const fixedWaveRule = choice ? { candidates: [...FIXED_WAVE_CANDIDATES], coverage, minCoverageByWave: choice.minCoverageByWave, chosen: choice.chosen, metRule: choice.metRule, rule: choice.rule } : null;
  const eligibleWaves = FIXED_WAVES.filter((W) => W >= 5);
  return {
    attribution: attribution(popBySeed, get, modes, st), zeroCheck: { ok: zeroViolations.length === 0, violations: zeroViolations }, matched, fixedWaveRule,
    tiltAgreement: tiltAgreement(popRows, modes, eligibleWaves), meanTilts: meanTilts(popRows, modes, eligibleWaves),
    modes, population, descriptive, pairs, fixedWave, bestWave, perPairAtBest, types: [...ENEMY_ORDER],
    earlyEnds: earlyLossReport(rows, { threshold: POPULATION_MIN_WAVE }), notes: [...NOTES],
  };
}
