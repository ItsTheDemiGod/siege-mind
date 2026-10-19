// Pure view model of a Director decision for the overlay (no DOM). Plain arithmetic only.
import { config } from '../data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../data/enemies.js';
import { tiltFromScores } from '../sim/directorMath.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/**
 * Where a tilt sits on a center-zero bar: 0 at x1.00, +1 at tiltMax, -1 at 1/tiltMax (symmetric in ratio terms).
 * @param {number} tilt > 0 @param {number} tiltMax > 1
 * @returns {number} in [-1, 1]
 */
export function tiltBarFraction(tilt, tiltMax) {
  if (typeof tilt !== 'number' || !(tilt > 0) || !Number.isFinite(tilt)) throw new RangeError(`tilt must be a positive finite number, got ${String(tilt)}`);
  if (typeof tiltMax !== 'number' || !(tiltMax > 1) || !Number.isFinite(tiltMax)) throw new RangeError(`tiltMax must be a finite number > 1, got ${String(tiltMax)}`);
  const f = tilt >= 1 ? (tilt - 1) / (tiltMax - 1) : -((1 / tilt) - 1) / (tiltMax - 1);
  return clamp(f, -1, 1);
}

/** @param {number} tilt @param {number} [ratio] @returns {'up'|'down'|'flat'} */
export function directionOf(tilt, ratio = config.report.directionRatio) {
  if (tilt >= ratio) return 'up';
  if (tilt <= 1 / ratio) return 'down';
  return 'flat';
}

/**
 * @param {{reason: string, tilt: Record<string, number>}|null} decision @param {number} [ratio]
 * @returns {Record<string, 'up'|'down'|'flat'>} all 'flat' unless the wave was actually adapted (random and static never show marks)
 */
export function directionByType(decision, ratio = config.report.directionRatio) {
  const out = {};
  for (const t of ENEMY_ORDER) out[t] = decision && decision && (decision.reason === 'adapted' || decision.reason === 'prior') ? directionOf(decision.tilt[t], ratio) : 'flat';
  return out;
}

/**
 * The weights to plot for a decision: the HELD weights for adaptive and adaptive2 (non-eligible waves report an applied tilt of 1), the applied tilt for random and counter.
 * @param {{mode: string, scores: Record<string, number>, tilt: Record<string, number>}} decision @param {object} [cfg] config.director @param {object} [cfgV2] config.directorV2
 * @returns {Record<string, number>}
 */
export function chartTilt(decision, cfg = config.director, cfgV2 = config.directorV2) {
  if (decision.mode === 'adaptive') return tiltFromScores(decision.scores, cfg);
  if (decision.mode === 'adaptive2') return tiltFromScores(decision.scores, cfgV2);
  return { ...decision.tilt };
}

const VIEW_TITLES = Object.freeze({ random: 'Random control', adaptive2: 'Director v2', counter: 'Counter arm', prior: 'Prior control' });
/** @param {string} mode @returns {number} the tilt limit of the mode's arm (for the overlay bars) */
export const tiltMaxOf = (mode) => (mode === 'adaptive2' ? config.directorV2.tiltMax : mode === 'counter' ? config.counter.tiltMax : mode === 'prior' ? config.prior.tiltMax : config.director.tiltMax);

const ZERO_EVIDENCE = Object.freeze({ units: 0, leaked: 0, meanProgress: 0, reward: 0, advantage: 0 });

/**
 * @param {object|null} decision a Director decision record @param {{tiltMax: number, defs?: Record<string, {name: string}>}} o
 * @returns {{mode: string, title: string|null, reason?: string, eligible?: boolean, wave?: number, basedOnWave?: number, lines: string[], rows: object[]}}
 */
export function buildDirectorView(decision, { tiltMax, defs = ENEMIES }) {
  if (!decision || decision.mode === 'static') return { mode: 'static', title: null, rows: [], lines: [] };
  const dir = directionByType(decision);
  const rows = ENEMY_ORDER.map((type) => {
    const o = decision.observed?.[type] ?? ZERO_EVIDENCE;
    const tilt = decision.tilt[type];
    return {
      type, label: defs[type].name, tilt, barFraction: tiltBarFraction(tilt, tiltMax), direction: dir[type],
      templateShare: decision.templateShares[type], finalShare: decision.finalShares[type], shareDelta: decision.finalShares[type] - decision.templateShares[type],
      units: o.units, leaked: o.leaked, meanProgress: o.meanProgress, reward: o.reward, advantage: o.advantage, score: decision.scores[type],
    };
  });
  return {
    mode: decision.mode, title: VIEW_TITLES[decision.mode] ?? 'Director', reason: decision.reason, eligible: decision.eligible,
    wave: decision.wave, basedOnWave: decision.basedOnWave, lines: [...decision.lines], rows,
  };
}
