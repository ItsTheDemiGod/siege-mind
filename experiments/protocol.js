// The pre-registered experiment protocol (frozen data, pure helpers). docs/EXPERIMENT.md explains every field.
// Changing anything here changes protocolHash(): the analysis and the held-out lock both record it.
import { createHash } from 'node:crypto';
import { TOWER_ORDER } from '../src/data/towers.js';

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
};

const hyp = (id, family, metric, modeA, modeB, direction, label) => ({ id, family, kind: 'metric', metric, modeA, modeB, direction, label });
const contrastHyp = (id, family, modeA, modeB, direction, label) => ({ id, family, kind: 'contrast', metric: 'tiltContrast', modeA, modeB, direction, label });

export const PROTOCOL = deepFreeze({
  version: 4,
  waves: 15,
  amendments: [
    { id: 'A1', summary: 'The final enemy weights are measured at the last ELIGIBLE wave (director.tilt) for adaptive and random alike, with a tiltObserved flag.', affects: ['tilt_*', 'tiltAligned', 'tiltObserved', 'T1'], madeAfterSeeingTuningResults: true, madeBeforeHeldout: true },
    { id: 'A2', summary: 'The focus styles are replaced by ablation styles (each omits one tower); T1 is retired and replaced by the style-contrast hypotheses T2 and T0; a reached-wave-5 sensitivity analysis is added.', affects: ['styles', 'tiltPredictions', 'calibration', 'botKnobs', 'T1', 'T2', 'T0'], madeAfterSeeingTuningResults: true, madeBeforeHeldout: true },
    { id: 'A3', summary: 'Confirmatory plan fixed before the held-out run: six modes, primary population, fixed-wave style contrast at wave 9, a three-hypothesis confirmatory family (K1-K3) with Holm, estimands with CIs only, held-out size 150 seeds; validation seeds not used for confirmation', affects: ['seedSets.heldout', 'confirmatory', 'modes for heldout'], madeAfterSeeingTuningResults: true, madeBeforeHeldout: true, notes: 'seeds 1021-1030 are not pristine (see the incident log); the held-out seeds 2001-2150 are untouched' },
  ],
  startLives: 20,
  styles: ['balancedR', 'noLance', 'noMortar', 'noPoison', 'noSniper'], // noFrost was dropped by calibration stage 3 (static win rate 0.00; see docs/results/calibration.md)
  modes: ['static', 'adaptive', 'random'],
  seedSets: {
    calibration: { start: 1001, count: 10 },
    tuning: { start: 1001, count: 30 },
    heldout: { start: 2001, count: 150 },
  },
  botKnobs: { tilePool: 6, focusWeight: 0.3, upgradeAfter: 4 }, // chosen by `npm run calibrate` (static mode, calibration seeds only); see docs/results/calibration.md
  stats: { seed: 20261019, signFlipResamples: 100000, bootstrapResamples: 10000, exactMaxN: 16, alpha: 0.05, alignmentThreshold: 1.15 },
  primaryMetric: 'livesLost',
  // each prediction is the enemy type in strongVs of the tower the style does NOT build (src/data/towers.js)
  tiltPredictions: {
    balancedR: null,
    noLance: ['armoredGrunt'],
    noMortar: ['swarmling'],
    noPoison: ['regenerator'],
    noSniper: ['shieldedBruiser'],
  },
  // difference = metric(modeA) - metric(modeB) per (style, seed), averaged over styles per seed
  hypotheses: [
    hyp('P1', 'primary', 'livesLost', 'adaptive', 'static', 'greater', 'Adaptive costs the player more lives than static'),
    hyp('P2', 'primary', 'livesLost', 'adaptive', 'random', 'greater', 'Adaptive costs the player more lives than the random control'),
    hyp('S1', 'secondary', 'won', 'adaptive', 'static', 'less', 'Adaptive wins less often than static'),
    hyp('S2', 'secondary', 'won', 'adaptive', 'random', 'less', 'Adaptive wins less often than the random control'),
    hyp('S3', 'secondary', 'leakFraction', 'adaptive', 'static', 'greater', 'A larger fraction of threat leaks under adaptive than static'),
    hyp('S4', 'secondary', 'leakFraction', 'adaptive', 'random', 'greater', 'A larger fraction of threat leaks under adaptive than random'),
    hyp('S5', 'secondary', 'penetration', 'adaptive', 'static', 'greater', 'Enemies get further along the path under adaptive than static'),
    hyp('S6', 'secondary', 'penetration', 'adaptive', 'random', 'greater', 'Enemies get further along the path under adaptive than random'),
    hyp('S7', 'secondary', 'finalWave', 'adaptive', 'static', 'less', 'The final wave reached is lower under adaptive than static'),
    hyp('S8', 'secondary', 'finalWave', 'adaptive', 'random', 'less', 'The final wave reached is lower under adaptive than random'),
    contrastHyp('T2', 'secondary', 'adaptive', 'random', 'greater', 'The final weights separate defenses in the predicted direction more under adaptive than under the random control'),
    contrastHyp('T0', 'descriptive', 'random', null, 'twosided', 'Null check: the random control shows no style contrast'),
    hyp('C1', 'descriptive', 'livesLost', 'random', 'static', 'greater', 'Composition variability alone (random versus static) costs lives'),
  ],
  // Amendment A3: the ONLY confirmatory analysis of the held-out run. Everything else is estimation or exploration. docs/EXPERIMENT.md explains every field.
  confirmatory: {
    modes: ['static', 'random', 'prior', 'adaptive', 'adaptive2', 'counter'],
    population: { rule: 'static-reached', minStaticFinalWave: 5, description: 'units (style, seed) whose static game reached wave 5 or later (a pre-treatment condition: waves 1-4 are identical in every mode)' },
    fixedWave: {
      primary: 9, secondary: 5,
      coverageRule: 'smallest eligible wave >= 9 whose minimum coverage over adaptive, adaptive2, counter, prior and random is at least 0.75; otherwise the wave with the largest minimum coverage',
      coverageRuleMet: false, trainingCoverageAtPrimary: 0.70,
      rationale: 'The coverage rule was not met on the training seeds (70% at wave 9). Wave 9 is kept because it is the first eligible wave at which all four predicted enemy types are unlocked (Regenerator from wave 6, Shielded Bruiser from wave 8, and wave 8 is an introduction wave); wave 5 is the only pre-treatment wave and can test only the predicted types unlocked at that wave.',
    },
    alpha: 0.05, correction: 'holm',
    test: 'two-sided sign-flip permutation over seeds; a hypothesis is supported only if the mean has the predicted sign and the Holm-adjusted p is below alpha',
    hypotheses: [
      { id: 'K1', kind: 'metric', metric: 'livesLost', modeA: 'random', modeB: 'static', direction: 'greater', label: 'Composition variability alone (random versus static) costs the player lives' },
      { id: 'K2', kind: 'contrast', metric: 'tiltContrast', mode: 'adaptive', wave: 9, direction: 'greater', label: 'Director v1 final weights separate defenses in the predicted direction at wave 9' },
      { id: 'K3', kind: 'contrast', metric: 'tiltContrast', mode: 'adaptive2', wave: 9, direction: 'greater', label: 'Director v2 weights separate defenses in the predicted direction at wave 9' },
    ],
    estimands: {
      metrics: ['livesLost', 'won', 'finalWave', 'leakFraction', 'penetration'],
      pairs: [['random', 'static'], ['prior', 'random'], ['adaptive', 'prior'], ['adaptive2', 'prior'], ['adaptive', 'static'], ['adaptive2', 'static'], ['counter', 'static'], ['counter', 'prior']],
      contrastWaves: [5, 9, 13], contrastModes: ['adaptive', 'adaptive2', 'counter', 'prior', 'random'],
      reporting: 'point estimate and 95% cluster bootstrap CI over seeds; no p-values',
    },
    sensitivity: ['K1 on all units instead of the reached-wave-5 population', 'K2 and K3 on the matched set of units observed at the primary wave in adaptive, adaptive2 and counter', 'leave-one-style-out recomputation of K1-K3'],
  },
});

/** Hashes of the protocol under earlier versions, kept so rows produced under them can still be analyzed with a note (not part of PROTOCOL). */
export const PROTOCOL_PREVIOUS_HASHES = Object.freeze({ 3: '592e7934cb1d165e373a656b127b050beb836d941517656f3b9d9f984b59efa3' });

/** @param {'calibration'|'tuning'|'heldout'} name @returns {number[]} the seeds of a set @throws {RangeError} for an unknown set */
export function seedsOf(name) {
  const set = PROTOCOL.seedSets[name];
  if (!set) throw new RangeError(`unknown seed set: ${String(name)} (have: ${Object.keys(PROTOCOL.seedSets).join(', ')})`);
  return Array.from({ length: set.count }, (_, i) => set.start + i);
}

const FOCUS_TOWER = { lanceHeavy: 'lance', mortarHeavy: 'mortar', poisonHeavy: 'poison', sniperHeavy: 'sniper' };
const ABLATED_TOWER = { noLance: 'lance', noMortar: 'mortar', noFrost: 'frost', noPoison: 'poison', noSniper: 'sniper' };
/** Every style the bots know: the current protocol styles plus the archived focus styles (their results must stay reproducible). */
export const KNOWN_STYLES = Object.freeze(['balancedR', 'lanceHeavy', 'mortarHeavy', 'poisonHeavy', 'sniperHeavy', ...Object.keys(ABLATED_TOWER)]);

/**
 * Tower mix of a style, in TOWER_ORDER (lance, mortar, frost, poison, sniper); sums to 1. noX gives X weight 0 and the rest 0.25.
 * @param {string} style @param {number} focusWeight in [0.2, 0.7] @returns {number[]}
 */
export function styleWeights(style, focusWeight) {
  if (!KNOWN_STYLES.includes(style)) throw new RangeError(`unknown style: ${String(style)}`);
  if (ABLATED_TOWER[style]) return TOWER_ORDER.map((t) => (t === ABLATED_TOWER[style] ? 0 : 1 / (TOWER_ORDER.length - 1))); // focusWeight is ignored
  if (typeof focusWeight !== 'number' || !(focusWeight >= 0.2 && focusWeight <= 0.7)) throw new RangeError(`focusWeight must be in [0.2, 0.7], got ${String(focusWeight)}`);
  const focus = FOCUS_TOWER[style];
  if (!focus) return TOWER_ORDER.map(() => 1 / TOWER_ORDER.length);
  const rest = (1 - focusWeight) / (TOWER_ORDER.length - 1);
  return TOWER_ORDER.map((t) => (t === focus ? focusWeight : rest));
}

/** @param {*} v @returns {string} JSON with sorted object keys (stable across engines and key order) */
export function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

/** @param {object} obj @returns {string} sha256 hex of the stable JSON of obj */
export const hashOf = (obj) => createHash('sha256').update(stableStringify(obj)).digest('hex');

/** @returns {string} sha256 hex of the current protocol */
export const protocolHash = () => hashOf(PROTOCOL);
