// The pre-registered experiment protocol (frozen data, pure helpers). docs/EXPERIMENT.md explains every field.
// Changing anything here changes protocolHash(): the analysis and the held-out lock both record it.
import { createHash } from 'node:crypto';
import { TOWER_ORDER } from '../src/data/towers.js';

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
};

const hyp = (id, family, metric, modeA, modeB, direction, label) => ({ id, family, metric, modeA, modeB, direction, label });

export const PROTOCOL = deepFreeze({
  version: 1,
  waves: 15,
  startLives: 20,
  styles: ['balancedR', 'lanceHeavy', 'mortarHeavy', 'poisonHeavy', 'sniperHeavy'],
  modes: ['static', 'adaptive', 'random'],
  seedSets: {
    calibration: { start: 1001, count: 10 },
    tuning: { start: 1001, count: 30 },
    heldout: { start: 2001, count: 60 },
  },
  botKnobs: { tilePool: 6, focusWeight: 0.4, upgradeAfter: 6 }, // initial values; `npm run calibrate` chooses them (static mode only)
  stats: { seed: 20261019, signFlipResamples: 100000, bootstrapResamples: 10000, exactMaxN: 16, alpha: 0.05, alignmentThreshold: 1.15 },
  primaryMetric: 'livesLost',
  tiltPredictions: {
    balancedR: null,
    lanceHeavy: ['swarmling'],
    mortarHeavy: ['fastRunner'],
    poisonHeavy: ['fastRunner', 'shieldedBruiser'],
    sniperHeavy: ['swarmling', 'fastRunner'],
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
    hyp('T1', 'secondary', 'tiltAligned', 'adaptive', 'random', 'greater', 'The final weights lean toward the predicted enemy types more often under adaptive than random'),
    hyp('C1', 'descriptive', 'livesLost', 'random', 'static', 'greater', 'Composition variability alone (random versus static) costs lives'),
  ],
});

/** @param {'calibration'|'tuning'|'heldout'} name @returns {number[]} the seeds of a set @throws {RangeError} for an unknown set */
export function seedsOf(name) {
  const set = PROTOCOL.seedSets[name];
  if (!set) throw new RangeError(`unknown seed set: ${String(name)} (have: ${Object.keys(PROTOCOL.seedSets).join(', ')})`);
  return Array.from({ length: set.count }, (_, i) => set.start + i);
}

const FOCUS_TOWER = { lanceHeavy: 'lance', mortarHeavy: 'mortar', poisonHeavy: 'poison', sniperHeavy: 'sniper' };

/**
 * Tower mix of a style, in TOWER_ORDER (lance, mortar, frost, poison, sniper); sums to 1.
 * @param {string} style @param {number} focusWeight in [0.2, 0.7] @returns {number[]}
 */
export function styleWeights(style, focusWeight) {
  if (!PROTOCOL.styles.includes(style)) throw new RangeError(`unknown style: ${String(style)}`);
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
