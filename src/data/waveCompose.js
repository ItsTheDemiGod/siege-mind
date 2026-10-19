// Shared wave composer (pure, no randomness): turns threat shares into spawn groups. The static builder and the Director both use it,
// so a Director plan follows exactly the same pick, timing and minimum-gap rules as a hand-authored wave.
import { ENEMIES, ENEMY_ORDER } from './enemies.js';

const FIT_MAX_ITERATIONS = 60;

/** @param {string} type @returns {number} threat of one pick (a pack counts as one pick) */
export const pickCost = (type) => ENEMIES[type].threatCost * ENEMIES[type].packSize;

const threatOf = (picks) => ENEMY_ORDER.reduce((n, type) => n + picks[type] * pickCost(type), 0);

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
 * Deterministic fit: nudge the picks until the realized threat is within tolerance of the target (used for Director plans only).
 * Removes the pick that best closes a surplus, adds the pick that best closes a deficit; never goes below one pick for a present type.
 * @param {Record<string, number>} picks mutated in place @param {Record<string, number>} shares @param {number} target
 * @param {{budgetTolerancePct: number, budgetToleranceMin: number}} cfg
 * @returns {void}
 */
function fitPicks(picks, shares, target, cfg) {
  const tol = Math.max(cfg.budgetTolerancePct * target, cfg.budgetToleranceMin);
  for (let i = 0; i < FIT_MAX_ITERATIONS; i++) {
    const diff = threatOf(picks) - target;
    if (Math.abs(diff) <= tol) return;
    let best = null;
    let bestScore = Infinity;
    for (const type of ENEMY_ORDER) {
      const cost = pickCost(type);
      if (diff > 0) {
        if (!(picks[type] > (shares[type] > 0 ? 1 : 0))) continue;
        const score = Math.abs(diff - cost);
        if (score < bestScore) { best = type; bestScore = score; }
      } else {
        if (!(shares[type] > 0)) continue;
        const score = Math.abs(diff + cost);
        if (score < bestScore || (score === bestScore && best !== null && shares[type] > shares[best])) { best = type; bestScore = score; }
      }
    }
    if (best === null || !(bestScore < Math.abs(diff))) return;
    picks[best] += diff > 0 ? -1 : 1;
  }
}

/**
 * @param {{wave: number, shares: Record<string, number>, targetThreat: number, cfg: object, fit?: boolean}} o cfg is config.waves
 * @returns {{type: string, picks: number, startSeconds: number, gapSeconds: number}[]} frozen groups in ENEMY_ORDER
 */
export function composeGroups({ wave, shares, targetThreat, cfg, fit = false }) {
  const counts = pickCounts(targetThreat, shares);
  if (fit) fitPicks(counts, shares, targetThreat, cfg);
  const window = Math.min(cfg.windowMaxSeconds, cfg.windowBaseSeconds + cfg.windowPerWave * wave);
  const present = ENEMY_ORDER.filter((type) => counts[type] > 0);
  return present.map((type, groupIndex) => Object.freeze({
    type,
    picks: counts[type],
    startSeconds: cfg.startStaggerSeconds * groupIndex,
    gapSeconds: Math.max(window / counts[type], cfg.minGapSeconds[type]), // never below the minimum gap: the window stretches instead
  }));
}

/**
 * @param {{wave: number, name: string|null, fixed: boolean, shares: Record<string, number>, targetThreat: number, cfg: object, fit?: boolean}} o
 * @returns {Readonly<{wave: number, name: string|null, fixed: boolean, groups: readonly object[]}>}
 */
export function planWithShares({ wave, name, fixed, shares, targetThreat, cfg, fit = false }) {
  const groups = Object.freeze(composeGroups({ wave, shares, targetThreat, cfg, fit }));
  return Object.freeze({ wave, name, fixed, groups });
}
