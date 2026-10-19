// Prior control ('prior'): a fixed, non-learning arm whose weights come ONLY from the static baseline table (src/data/directorBaseline.js).
// It reproduces the enemy-durability bias of the learning Directors without learning and without reading the defense, so it isolates that bias.
// Pure and deterministic: no rng, no state beyond the game object it is given, independent of telemetry. See docs/DIRECTOR.md.
import { config } from '../data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../data/enemies.js';
import { STATIC_WAVES, STATIC_THREAT, WAVE_TEMPLATES, planThreat, isTypeUnlocked, isIntroWave, isAdaptiveEligible } from '../data/waves.js';
import { planWithShares } from '../data/waveCompose.js';
import { sharesFor } from './directorMath.js';
import { baselineValue } from './directorMathV2.js';
import { explainDecision } from './directorExplain.js';
import { DECISION_KEYS } from './director.js';

export const DECISION_KEYS_PRIOR = Object.freeze([...DECISION_KEYS, 'arm', 'baselineAdvantage']);
const MIN_VISIBLE_TILT = 0.1;
const MAX_TYPE_LINES = 3;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const perType = (make) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, make(t)]));
const cfgOf = (game) => game.priorCfg ?? config.prior;

/** @param {object} cfg config.prior @returns {true} @throws {RangeError} naming the first bad key */
export function validatePriorConfig(cfg) {
  const bad = (key, rule) => { throw new RangeError(`prior config ${key} must be ${rule}, got ${String(cfg[key])}`); };
  if (!Number.isInteger(cfg.firstAdaptiveWave) || cfg.firstAdaptiveWave < 1) bad('firstAdaptiveWave', 'an integer >= 1');
  if (!isNum(cfg.beta) || cfg.beta < 0) bad('beta', '>= 0');
  if (!isNum(cfg.tiltMax) || cfg.tiltMax < 1) bad('tiltMax', '>= 1');
  if (!isNum(cfg.advClipHigh) || cfg.advClipHigh <= 0) bad('advClipHigh', '> 0');
  if (!isNum(cfg.absentFloorShare) || cfg.absentFloorShare < 0 || cfg.absentFloorShare > 0.2) bad('absentFloorShare', 'in [0, 0.2]');
  if (!isNum(cfg.baselineFloorFraction) || cfg.baselineFloorFraction <= 0 || cfg.baselineFloorFraction > 1) bad('baselineFloorFraction', 'in (0, 1]');
  return true;
}

/** @returns {object} fresh plain state for mode 'prior' (nothing is learned, so there is nothing to remember) */
export const createPriorState = () => ({ mode: 'prior' });

/**
 * Fixed tilt from the baseline: b(t) = baselineValue(t, wave); avg = template-share-weighted mean of b over the types the template contains;
 * advantage(t) = clamp((b - avg) / avg, -1, advClipHigh); tilt = clamp(1 + beta * advantage, 1 / tiltMax, tiltMax). Types outside the template get tilt 1.
 * @param {number} wave @param {Record<string, number>} templateShares @param {object} cfg config.prior
 * @returns {{tilt: Record<string, number>, advantage: Record<string, number>}}
 */
export function priorTilt(wave, templateShares, cfg) {
  let weighted = 0;
  let total = 0;
  const b = {};
  for (const t of ENEMY_ORDER) {
    if (!(templateShares[t] > 0)) continue;
    b[t] = baselineValue(t, wave, cfg);
    weighted += templateShares[t] * b[t];
    total += templateShares[t];
  }
  const avg = total > 0 ? weighted / total : 0;
  const advantage = perType((t) => (t in b && avg > 0 ? clamp((b[t] - avg) / avg, -1, cfg.advClipHigh) : 0));
  const tilt = perType((t) => (t in b ? clamp(1 + cfg.beta * advantage[t], 1 / cfg.tiltMax, cfg.tiltMax) : 1));
  return { tilt, advantage };
}

function staticReason(wave, cfg) {
  if (wave < cfg.firstAdaptiveWave) return 'static-early';
  if (isIntroWave(wave)) return 'static-intro';
  return 'static-fixed';
}

/** Explain lines of a prior decision (pure). @param {object} decision @returns {string[]} */
export function explainDecisionPrior(decision) {
  if (decision.reason !== 'prior') return explainDecision(decision);
  const moved = ENEMY_ORDER.filter((t) => Math.abs(decision.tilt[t] - 1) >= MIN_VISIBLE_TILT)
    .sort((a, b) => Math.abs(decision.tilt[b] - 1) - Math.abs(decision.tilt[a] - 1)).slice(0, MAX_TYPE_LINES);
  if (moved.length === 0) return ['The prior control changed almost nothing this wave: every fixed weight is within 0.1 of the static script.'];
  return moved.map((t) => `${ENEMIES[t].name}: weight x${decision.tilt[t].toFixed(2)}, a fixed weight from static baseline rewards (enemy durability), not learned from your defense`);
}

/**
 * The plan for a wave and the record of why. Pure: reads nothing but the wave number (and the game's optional config override), writes nothing.
 * @param {{priorCfg?: object}} game @param {number} wave 1..30 @returns {{plan: object, decision: object}}
 */
export function planForPrior(game, wave) {
  const cfg = cfgOf(game);
  const template = WAVE_TEMPLATES[wave - 1];
  const eligible = isAdaptiveEligible(wave, cfg);
  let plan = STATIC_WAVES[wave - 1];
  let reason = staticReason(wave, cfg);
  let tilt = perType(() => 1);
  let baselineAdvantage = perType(() => 0);
  let finalShares = { ...template.shares };
  if (eligible) {
    reason = 'prior';
    ({ tilt, advantage: baselineAdvantage } = priorTilt(wave, template.shares, cfg));
    finalShares = sharesFor({ templateShares: template.shares, tilt, wave, isUnlocked: isTypeUnlocked, cfg });
    plan = planWithShares({ wave, name: template.name, fixed: template.fixed, shares: finalShares, targetThreat: STATIC_THREAT[wave - 1], cfg: config.waves, fit: true });
  }
  const picks = perType((t) => plan.groups.find((g) => g.type === t)?.picks ?? 0);
  const observed = perType(() => ({ units: 0, leaked: 0, meanProgress: 0, threatSpent: 0, threatShare: 0, reward: 0, advantage: 0, updated: false }));
  const decision = {
    version: 2, wave, mode: 'prior', eligible, reason, templateShares: { ...template.shares }, tilt, finalShares, picks,
    threatTarget: STATIC_THREAT[wave - 1], threatRealized: planThreat(plan.groups), basedOnWave: 0,
    observed, scores: perType(() => 0), lines: [], arm: 'prior', baselineAdvantage,
  };
  decision.lines = explainDecisionPrior(decision);
  return { plan, decision };
}
