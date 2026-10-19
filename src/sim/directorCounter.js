// Informed counter arm ('counter'): reads the tower loadout and tilts the static template toward enemy types the defense is weak against.
// It has information about the player's defense that the learning Directors lack, so it is an achievable ceiling, not a fair competitor.
// Pure and deterministic; reads game.towers and src/data/towers.js and writes nothing. See docs/DIRECTOR.md.
import { config } from '../data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../data/enemies.js';
import { TOWERS, TOWER_ORDER } from '../data/towers.js';
import { STATIC_WAVES, STATIC_THREAT, WAVE_TEMPLATES, planThreat, isTypeUnlocked, isIntroWave, isAdaptiveEligible } from '../data/waves.js';
import { planWithShares } from '../data/waveCompose.js';
import { sharesFor } from './directorMath.js';
import { explainDecision } from './directorExplain.js';
import { DECISION_KEYS } from './director.js';

export const DECISION_KEYS_COUNTER = Object.freeze([...DECISION_KEYS, 'arm', 'pressure', 'loadout']);
const MIN_VISIBLE_TILT = 0.1;
const MAX_TYPE_LINES = 3;

const perType = (make) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, make(t)]));
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const cfgOf = (game) => game.counterCfg ?? config.counter;

/** @returns {object} fresh plain state for mode 'counter' (nothing is learned: scores stay 0 and history stays empty; the shape matches the other director states) */
export function createCounterState() {
  return { mode: 'counter', scores: perType(() => 0), history: [], lastObservedWave: 0, acc: {}, enemyWave: {}, ignoredEvents: 0 };
}

/**
 * Loadout summary and per-type pressure. weight(tower) = 1 + levelWeight * level; pressure(t) = (weight of towers weak against t - weight of towers strong against t) / total weight.
 * @param {{towers: {type: string, level: number}[]}} game @param {{levelWeight: number}} cfg
 * @returns {{pressure: Record<string, number>, loadout: {towers: number, byType: Record<string, {count: number, weight: number}>}}}
 */
export function loadoutPressure(game, cfg) {
  const byType = Object.fromEntries(TOWER_ORDER.map((t) => [t, { count: 0, weight: 0 }]));
  let total = 0;
  const raw = perType(() => 0);
  for (const tw of game.towers) {
    const w = 1 + cfg.levelWeight * tw.level;
    byType[tw.type].count++;
    byType[tw.type].weight += w;
    total += w;
    for (const e of ENEMY_ORDER) {
      if (TOWERS[tw.type].weakVs.includes(e)) raw[e] += w;
      if (TOWERS[tw.type].strongVs.includes(e)) raw[e] -= w;
    }
  }
  const pressure = perType((e) => (total > 0 ? raw[e] / total : 0));
  return { pressure, loadout: { towers: game.towers.length, byType } };
}

function staticReason(wave, cfg) {
  if (wave < cfg.firstAdaptiveWave) return 'static-early';
  if (isIntroWave(wave)) return 'static-intro';
  return 'static-fixed';
}

/** Explain lines of a counter decision (pure). @param {object} decision @returns {string[]} */
export function explainDecisionCounter(decision) {
  if (decision.reason !== 'adapted') return explainDecision(decision);
  const moved = ENEMY_ORDER.filter((t) => Math.abs(decision.tilt[t] - 1) >= MIN_VISIBLE_TILT)
    .sort((a, b) => Math.abs(decision.tilt[b] - 1) - Math.abs(decision.tilt[a] - 1)).slice(0, MAX_TYPE_LINES);
  if (moved.length === 0) return ['The counter arm adapted only slightly this wave: every tilt is within 0.1 of the static script.'];
  return moved.map((t) => {
    const p = decision.pressure[t];
    return `${ENEMIES[t].name}: weight x${decision.tilt[t].toFixed(2)}, your towers are ${p > 0 ? 'weak' : 'strong'} against it (pressure ${p >= 0 ? '+' : ''}${p.toFixed(2)})`;
  });
}

/**
 * The plan for a wave and the record of why. Pure: reads the game, writes nothing.
 * @param {object} game with game.director set (mode 'counter') @param {number} wave 1..30 @returns {{plan: object, decision: object}}
 */
export function planForCounter(game, wave) {
  const cfg = cfgOf(game);
  const template = WAVE_TEMPLATES[wave - 1];
  const eligible = isAdaptiveEligible(wave, cfg);
  const { pressure, loadout } = loadoutPressure(game, cfg);
  let plan = STATIC_WAVES[wave - 1];
  let reason;
  let tilt = perType(() => 1);
  let finalShares = { ...template.shares };
  if (!eligible) reason = staticReason(wave, cfg);
  else {
    tilt = perType((t) => clamp(1 + cfg.gain * pressure[t], 1 / cfg.tiltMax, cfg.tiltMax));
    reason = ENEMY_ORDER.some((t) => tilt[t] !== 1) ? 'adapted' : 'cold-start';
  }
  if (reason === 'adapted') {
    finalShares = sharesFor({ templateShares: template.shares, tilt, wave, isUnlocked: isTypeUnlocked, cfg });
    plan = planWithShares({ wave, name: template.name, fixed: template.fixed, shares: finalShares, targetThreat: STATIC_THREAT[wave - 1], cfg: config.waves, fit: true });
  }
  const picks = perType((t) => plan.groups.find((g) => g.type === t)?.picks ?? 0);
  const observed = perType(() => ({ units: 0, leaked: 0, meanProgress: 0, threatSpent: 0, threatShare: 0, reward: 0, advantage: 0, updated: false }));
  const decision = {
    version: 2, wave, mode: 'counter', eligible, reason, templateShares: { ...template.shares }, tilt, finalShares, picks,
    threatTarget: STATIC_THREAT[wave - 1], threatRealized: planThreat(plan.groups), basedOnWave: 0,
    observed, scores: perType(() => 0), lines: [], arm: 'counter', pressure, loadout,
  };
  decision.lines = explainDecisionCounter(decision);
  return { plan, decision };
}
