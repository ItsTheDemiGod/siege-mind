// Shared synthetic inputs for the v4 figure, results-document and CLI tests (not a test file: the glob only matches *.test.js).
import { PROTOCOL } from '../experiments/protocol.js';

/** Protocol with fewer resamples so tests stay fast; the confirmatory plan itself is untouched. */
export const FAST_PROTOCOL = { ...PROTOCOL, stats: { ...PROTOCOL.stats, bootstrapResamples: 200, signFlipResamples: 500 } };

const TYPES = ['armoredGrunt', 'swarmling', 'fastRunner', 'regenerator', 'shieldedBruiser'];
const PREDICTED = ['noLance', 'noMortar', 'noPoison', 'noSniper'];
const BASE_EFFECT = { adaptive: 0.2, adaptive2: 0.1, counter: 0.4, prior: 0, random: 0 };

/**
 * Result rows of every confirmatory mode for every style and seed 1..seeds. Predicted-style units get tilt 1 + effect on their predicted type
 * (effect = BASE_EFFECT[mode] * (1 + index/2) + jitter * (seed % 2)); every other tilt is 1, so a pair contrast at any wave >= 5 is that effect exactly.
 * @param {{seeds?: number, jitter?: number, earlyLoss?: {style: string, seed: number}, firstSeed?: number}} [o] earlyLoss: a unit whose STATIC game ends at wave 3
 */
export function syntheticRows({ seeds = 8, jitter = 0.1, earlyLoss = null, firstSeed = 1 } = {}) {
  const rows = [];
  for (let seed = firstSeed; seed < firstSeed + seeds; seed++) {
    for (const [si, style] of PROTOCOL.styles.entries()) {
      for (const mode of PROTOCOL.confirmatory.modes) {
        const early = earlyLoss && earlyLoss.style === style && earlyLoss.seed === seed && mode === 'static';
        const idx = PREDICTED.indexOf(style);
        const tiltByWave = Array.from({ length: 15 }, (_, w) => {
          if (mode === 'static' || w < 4) return null;
          const t = Object.fromEntries(TYPES.map((x) => [x, 1]));
          if (idx >= 0) t[PROTOCOL.tiltPredictions[style][0]] = 1 + BASE_EFFECT[mode] * (1 + idx / 2) + jitter * (seed % 2);
          return t;
        });
        const extra = { static: 0, random: 0.5, prior: 2, adaptive: 2.25, adaptive2: 1, counter: 1.5 }[mode];
        rows.push({
          style, mode, seed, finalWave: early ? 3 : 15, won: seed % 4 === 0 ? 0 : 1, livesLost: 2 + si + extra + (seed % 3), leakFraction: 0.05 + 0.01 * extra, penetration: 0.3 + 0.02 * extra, tiltByWave,
        });
      }
    }
  }
  return rows;
}

const MODE_VALUE = { static: 0, random: 0.5, prior: 2, adaptive: 2.25, adaptive2: 1, counter: 1.5 }; // dyadic: pair differences add up exactly

/**
 * A hand-made analysis object of the shape analyzeConfirmatory returns (dyadic numbers so sums are exact).
 * @param {'CONFIRMATORY'|'EXPLORATORY DRY RUN'} label @param {number} shift added to every estimate and interval @param {{k1Label?: string}} [o]
 */
export function makeAnalysis(label, shift = 0, { k1Label = 'Composition variability costs lives' } = {}) {
  const C = PROTOCOL.confirmatory;
  const est = (x, w = 0.25) => ({ estimate: x + shift, ci95: [x + shift - w, x + shift + w] });
  const estimands = [];
  for (const [a, b] of C.estimands.pairs) for (const metric of C.estimands.metrics) estimands.push({ pair: `${a}-${b}`, a, b, metric, n: 8, ...est(MODE_VALUE[a] - MODE_VALUE[b]) });
  const contrasts = [];
  for (const wave of C.estimands.contrastWaves) for (const mode of C.estimands.contrastModes) {
    contrasts.push({ wave, mode, n: 7, unitsObserved: 30, populationUnits: 40, coverage: 0.75, ...est(BASE_EFFECT[mode], 0.0625 * (BASE_EFFECT[mode] > 0 ? 1 : 0)), matched: { units: 25, n: 6, ...est(BASE_EFFECT[mode]) } });
  }
  const k = (id, label2, x, supported) => ({ id, label: label2, direction: 'greater', n: 8, droppedSeeds: [], ...est(x), pRaw: 0.01, pHolm: 0.03, supported });
  return {
    label, banner: label, protocolVersion: 4, protocolHash: 'hash-for-tests', completeness: { complete: true, expected: 240, actual: 240, missing: [], duplicates: [], unknownRows: 0, seeds: [1, 2, 3, 4, 5, 6, 7, 8] }, notes: [],
    n: { seeds: 8, styles: 5, modes: 6, rows: 240, populationUnits: 40, excludedUnits: 0 }, population: { rule: 'static-reached', units: 40, excluded: 0 },
    confirmatory: [k('K1', k1Label, 0.5, false), k('K2', 'Director v1 contrast', 0.25, true), k('K3', 'Director v2 contrast', 0.125, true)],
    estimands, contrasts,
    coverageAtPrimary: { wave: 9, minCoverage: 0.7, metRule: false, perMode: {}, rule: 'r', ruleChoice: { chosen: 9, metRule: false }, registered: {} },
    sensitivity: {}, power: {},
  };
}

/** makeAnalysis whose K rows repeat their alias rows exactly (random-static lives lost, adaptive and adaptive2 at wave 9), as in the real analysis. */
export function makeAliasedAnalysis(label, shift = 0) {
  const a = makeAnalysis(label, shift);
  const c = (mode) => a.contrasts.find((x) => x.mode === mode && x.wave === 9);
  Object.assign(a.confirmatory[0], { estimate: a.estimands[0].estimate, ci95: a.estimands[0].ci95 });
  Object.assign(a.confirmatory[1], { estimate: c('adaptive').estimate, ci95: c('adaptive').ci95 });
  Object.assign(a.confirmatory[2], { estimate: c('adaptive2').estimate, ci95: c('adaptive2').ci95 });
  return a;
}
