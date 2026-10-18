// The 30-wave static script: budget formula, hand-authored templates and a pure builder (no DOM, no randomness).
// STATIC_THREAT is the REALIZED threat of each wave; the future Adaptive Director must spend STATIC_THREAT[w], not the formula target.
import { config } from './config.js';
import { ENEMIES, ENEMY_ORDER } from './enemies.js';

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

const pickCost = (type) => ENEMIES[type].threatCost * ENEMIES[type].packSize;

/**
 * Pick counts per type for a budget: floors, then at least one pick for every positive share when affordable,
 * then largest-remainder additions while they bring the total closer to the budget.
 * @param {number} budget @param {Record<string, number>} shares
 * @returns {Record<string, number>}
 */
function pickCounts(budget, shares) {
  const picks = {};
  const ideal = {};
  let allocated = 0;
  for (const type of ENEMY_ORDER) {
    ideal[type] = shares[type] > 0 ? (budget * shares[type]) / pickCost(type) : 0;
    picks[type] = Math.floor(ideal[type]);
    allocated += picks[type] * pickCost(type);
  }
  for (const type of ENEMY_ORDER) { // every present type shows up once if the budget allows it
    if (shares[type] > 0 && picks[type] === 0 && allocated + pickCost(type) <= budget) { picks[type] = 1; allocated += pickCost(type); }
  }
  for (;;) { // largest remainder first, ties by ENEMY_ORDER; only while it moves the total closer to the budget
    let best = null;
    let bestRem = -Infinity;
    for (const type of ENEMY_ORDER) {
      if (!(shares[type] > 0)) continue;
      const rem = ideal[type] - picks[type];
      if (Math.abs(allocated + pickCost(type) - budget) < Math.abs(allocated - budget) && rem > bestRem) { best = type; bestRem = rem; }
    }
    if (!best) break;
    picks[best]++;
    allocated += pickCost(best);
  }
  return picks;
}

/**
 * Turn budgets and templates into spawn plans. Pure.
 * @param {readonly number[]} budgets @param {readonly object[]} templates @param {typeof config.waves} cfg
 * @returns {readonly {wave: number, name: string|null, fixed: boolean, groups: readonly {type: string, picks: number, startSeconds: number, gapSeconds: number}[]}[]}
 */
export function buildStaticWaves(budgets, templates, cfg) {
  return Object.freeze(templates.map((t, i) => {
    const counts = pickCounts(budgets[i], t.shares);
    const window = Math.min(cfg.windowMaxSeconds, cfg.windowBaseSeconds + cfg.windowPerWave * t.wave);
    const present = ENEMY_ORDER.filter((type) => counts[type] > 0);
    const groups = present.map((type, groupIndex) => Object.freeze({
      type,
      picks: counts[type],
      startSeconds: cfg.startStaggerSeconds * groupIndex,
      gapSeconds: Math.max(window / counts[type], cfg.minGapSeconds[type]), // never below the minimum gap: the window stretches instead
    }));
    return Object.freeze({ wave: t.wave, name: t.name, fixed: t.fixed, groups: Object.freeze(groups) });
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
 * @returns {{wave: number, name: string|null, fixed: boolean, budget: number, threat: number}}
 */
export function waveInfo(w) {
  if (!Number.isInteger(w) || w < 1 || w > TOTAL_WAVES) throw new RangeError(`wave must be an integer 1..${TOTAL_WAVES}, got ${String(w)}`);
  const p = STATIC_WAVES[w - 1];
  return { wave: w, name: p.name, fixed: p.fixed, budget: BUDGETS[w - 1], threat: STATIC_THREAT[w - 1] };
}
