// The 30-wave static script: budget formula, hand-authored templates and a pure builder (no DOM, no randomness).
// STATIC_THREAT is the REALIZED threat of each wave; the future Adaptive Director must spend STATIC_THREAT[w], not the formula target.
import { config } from './config.js';
import { ENEMY_ORDER } from './enemies.js';
import { composeGroups, pickCost } from './waveCompose.js';

export const TOTAL_WAVES = 30;

/** @returns {true} throws if the wave data disagrees with config.game.totalWaves */
export function checkWaveData() {
  if (TOTAL_WAVES !== config.game.totalWaves) throw new Error(`TOTAL_WAVES ${TOTAL_WAVES} != config.game.totalWaves ${config.game.totalWaves}`);
  return true;
}

/**
 * Formula target threat budget for a wave (1-based).
 * @param {number} w @param {typeof config.waves} [cfg]
 * @returns {number}
 */
export function waveBudgetTarget(w, cfg = config.waves) {
  return Math.round(cfg.budgetScale * (cfg.budgetBase + cfg.budgetLinear * (w - 1) + cfg.budgetQuad * (w - 1) ** 2));
}

// Enemy HP and shield multiplier per wave, built with plain + - * arithmetic only (no pow or exp calls) so every machine gets
// identical numbers. Threat accounting (BUDGETS, STATIC_THREAT, planThreat) stays in BASE threat units: the multiplier is applied
// identically in Static and Adaptive mode and never changes the threat a wave spends.
/**
 * @param {{hpCurve: string, hpGrowthPerWave: number, hpLinear: number, hpQuad: number}} cfg
 * @returns {readonly number[]} length TOTAL_WAVES + 1; entries 0 and 1 are 1
 */
export function buildHpMult(cfg) {
  if (cfg.hpCurve !== 'exponential' && cfg.hpCurve !== 'polynomial') throw new RangeError(`unknown hpCurve: ${String(cfg.hpCurve)}`);
  for (const k of ['hpGrowthPerWave', 'hpLinear', 'hpQuad']) {
    if (typeof cfg[k] !== 'number' || !Number.isFinite(cfg[k]) || cfg[k] < 0) throw new RangeError(`${k} must be a finite number >= 0, got ${String(cfg[k])}`);
  }
  const m = [1, 1];
  for (let w = 2; w <= TOTAL_WAVES; w++) {
    if (cfg.hpCurve === 'exponential') {
      m.push(m[w - 1] * (1 + cfg.hpGrowthPerWave));
    } else {
      const d = w - 1;
      m.push(1 + cfg.hpLinear * d + cfg.hpQuad * d * d);
    }
  }
  for (let w = 1; w < m.length; w++) {
    if (!Number.isFinite(m[w]) || m[w] < 1 || m[w] < m[w - 1]) throw new RangeError(`HP multiplier must be finite, >= 1 and non-decreasing (wave ${w}: ${m[w]})`);
  }
  return Object.freeze(m);
}

export const HP_MULT = buildHpMult(config.waves);

/** @param {number} w wave number @returns {number} HP/shield multiplier (1 for waves <= 1, capped at wave 30) */
export function hpMultiplierForWave(w) {
  if (!Number.isFinite(w) || w <= 1) return 1;
  const i = Math.floor(w);
  return i >= TOTAL_WAVES ? HP_MULT[TOTAL_WAVES] : HP_MULT[i];
}

export const BUDGETS = Object.freeze(Array.from({ length: TOTAL_WAVES }, (_, i) => waveBudgetTarget(i + 1)));

const share = (g = 0, s = 0, f = 0, r = 0, b = 0) => ({ armoredGrunt: g, swarmling: s, fastRunner: f, regenerator: r, shieldedBruiser: b });
const tpl = (wave, name, fixed, shares) => Object.freeze({ wave, name, fixed, shares: Object.freeze(shares) });

// Rotating themes reused for waves 11-19 and 21-29 so every tower matters at different times.
const ROTATION = [
  share(0.5, 0.15, 0.1, 0.1, 0.15), // grunt-heavy
  share(0.15, 0.5, 0.15, 0.1, 0.1), // swarm-heavy
  share(0.15, 0.15, 0.5, 0.1, 0.1), // runner-heavy
  share(0.15, 0.1, 0.1, 0.5, 0.15), // regenerator-heavy
  share(0.15, 0.1, 0.1, 0.15, 0.5), // shield-heavy
  share(0.45, 0.2, 0.15, 0.1, 0.1), // mixed, grunt-led
  share(0.2, 0.15, 0.45, 0.1, 0.1), // mixed, runner-led
  share(0.2, 0.1, 0.1, 0.45, 0.15), // mixed, regenerator-led
  share(0.2, 0.15, 0.1, 0.1, 0.45), // mixed, shield-led
];

const OPENING = [
  tpl(1, null, false, share(1)),
  tpl(2, null, false, share(1)),
  tpl(3, 'First Swarm', false, share(0.6, 0.4)),
  tpl(4, 'Speed Run', false, share(0.4, 0.3, 0.3)),
  tpl(5, null, false, share(0.25, 0.6, 0.15)),
  tpl(6, 'Regrowth', false, share(0.35, 0.25, 0.2, 0.2)),
  tpl(7, null, false, share(0.25, 0.15, 0.45, 0.15)),
  tpl(8, 'Iron Skin', false, share(0.3, 0.2, 0.15, 0.1, 0.25)),
  tpl(9, null, false, share(0.3, 0.25, 0.2, 0.15, 0.1)),
  tpl(10, 'The Vanguard', true, share(0.5, 0, 0, 0.15, 0.35)),
];

export const WAVE_TEMPLATES = Object.freeze([
  ...OPENING,
  ...ROTATION.map((s, i) => tpl(11 + i, null, false, s)),
  tpl(20, 'Tide of Swarm', true, share(0.15, 0.55, 0.3)),
  ...ROTATION.map((s, i) => tpl(21 + i, null, false, s)),
  tpl(30, 'The Siege', true, share(0.25, 0.2, 0.15, 0.2, 0.2)),
]);

/**
 * Turn budgets and templates into spawn plans. Pure.
 * @param {readonly number[]} budgets @param {readonly object[]} templates @param {typeof config.waves} cfg
 * @returns {readonly {wave: number, name: string|null, fixed: boolean, groups: readonly {type: string, picks: number, startSeconds: number, gapSeconds: number}[]}[]}
 */
export function buildStaticWaves(budgets, templates, cfg) {
  return Object.freeze(templates.map((t, i) => {
    const groups = Object.freeze(composeGroups({ wave: t.wave, shares: t.shares, targetThreat: budgets[i], cfg, fit: false }));
    return Object.freeze({ wave: t.wave, name: t.name, fixed: t.fixed, groups });
  }));
}

export const STATIC_WAVES = buildStaticWaves(BUDGETS, WAVE_TEMPLATES, config.waves);

/** @param {readonly {type: string, picks: number}[]} groups @returns {number} total threat of a plan */
export function planThreat(groups) {
  let sum = 0;
  for (const g of groups) sum += g.picks * pickCost(g.type);
  return sum;
}

export const STATIC_THREAT = Object.freeze(STATIC_WAVES.map((w) => planThreat(w.groups)));

/**
 * @param {number} w wave number 1..30
 * @returns {{wave: number, name: string|null, fixed: boolean, budget: number, threat: number, hpMult: number}}
 */
export function waveInfo(w) {
  if (!Number.isInteger(w) || w < 1 || w > TOTAL_WAVES) throw new RangeError(`wave must be an integer 1..${TOTAL_WAVES}, got ${String(w)}`);
  const p = STATIC_WAVES[w - 1];
  return { wave: w, name: p.name, fixed: p.fixed, budget: BUDGETS[w - 1], threat: STATIC_THREAT[w - 1], hpMult: hpMultiplierForWave(w) };
}

/** First wave in which each enemy type may appear (the first wave whose template gives it a positive share). */
export const INTRO_WAVES = Object.freeze({ armoredGrunt: 1, swarmling: 3, fastRunner: 4, regenerator: 6, shieldedBruiser: 8 });

/** @param {string} type @param {number} wave @returns {boolean} true once the type has been introduced */
export const isTypeUnlocked = (type, wave) => wave >= INTRO_WAVES[type];

/** @param {number} wave @returns {boolean} true for the waves that introduce a new enemy type after wave 1 (3, 4, 6, 8) */
export const isIntroWave = (wave) => ENEMY_ORDER.some((type) => INTRO_WAVES[type] > 1 && INTRO_WAVES[type] === wave);

/**
 * @param {number} wave @param {{firstAdaptiveWave: number}} directorCfg
 * @returns {boolean} true when the Director may change this wave's composition
 */
export function isAdaptiveEligible(wave, directorCfg) {
  if (!Number.isInteger(wave) || wave < 1 || wave > TOTAL_WAVES) return false;
  return !WAVE_TEMPLATES[wave - 1].fixed && !isIntroWave(wave) && wave >= directorCfg.firstAdaptiveWave;
}
