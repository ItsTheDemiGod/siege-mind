// Director v2 ('adaptive2'): the v1 mechanism with rewards normalized by a static baseline and advantages shrunk for types with few units.
// Pure and deterministic, independent of telemetry; planForV2 consumes no rng and writes nothing. See docs/DIRECTOR.md.
import { config } from '../data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../data/enemies.js';
import { STATIC_WAVES, STATIC_THREAT, WAVE_TEMPLATES, planThreat, isTypeUnlocked, isIntroWave, isAdaptiveEligible } from '../data/waves.js';
import { planWithShares } from '../data/waveCompose.js';
import { EVENT_TYPES } from './events.js';
import { updateScores, tiltFromScores, sharesFor } from './directorMath.js';
import { computeObservationV2, forUpdate } from './directorMathV2.js';
import { explainDecision } from './directorExplain.js';
import { DECISION_KEYS } from './director.js';

export const DECISION_KEYS_V2 = Object.freeze([...DECISION_KEYS, 'arm']);
const MIN_VISIBLE_TILT = 0.1;
const MAX_TYPE_LINES = 3;

const perType = (make) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, make(t)]));
const zeroStats = () => perType(() => ({ units: 0, leaked: 0, progressSum: 0 }));
const zeroObserved = () => perType(() => ({ units: 0, leaked: 0, meanProgress: 0, threatSpent: 0, threatShare: 0, reward: 0, norm: 0, advantage: 0, shrunk: 0, updated: false }));
const cfgOf = (game) => game.directorV2Cfg ?? config.directorV2;

/** @returns {object} fresh plain director state for mode 'adaptive2' (same shape as v1's) */
export function createDirectorV2State() {
  return { mode: 'adaptive2', scores: perType(() => 0), history: [], lastObservedWave: 0, acc: {}, enemyWave: {}, ignoredEvents: 0 };
}

/**
 * Subscribe Director v2 to the game's event bus. Observations are attributed to the enemy's SPAWN wave; debug spawns outside a running wave are ignored.
 * @param {object} game with game.director set @returns {() => void} unsubscribe
 */
export function wireDirectorV2(game) {
  const d = game.director;
  const bus = game.events;
  const offs = [
    bus.on(EVENT_TYPES.ENEMY_SPAWNED, (ev) => {
      if (game.waves.phase !== 'running' || ev.wave !== game.waves.current) return;
      const stats = d.acc[ev.wave] ?? (d.acc[ev.wave] = zeroStats());
      stats[ev.type].units++;
      d.enemyWave[ev.id] = ev.wave;
    }),
    bus.on(EVENT_TYPES.ENEMY_KILLED, (ev) => {
      const wave = d.enemyWave[ev.id];
      if (wave === undefined) { d.ignoredEvents++; return; }
      delete d.enemyWave[ev.id];
      if (d.acc[wave]) d.acc[wave][ev.type].progressSum += ev.progress;
    }),
    bus.on(EVENT_TYPES.ENEMY_LEAKED, (ev) => {
      const wave = d.enemyWave[ev.id];
      if (wave === undefined) { d.ignoredEvents++; return; }
      delete d.enemyWave[ev.id];
      if (d.acc[wave]) { d.acc[wave][ev.type].leaked++; d.acc[wave][ev.type].progressSum += 1; }
    }),
    bus.on(EVENT_TYPES.WAVE_ENDED, (ev) => {
      const cfg = cfgOf(game);
      const obs = computeObservationV2(d.acc[ev.wave] ?? zeroStats(), ENEMIES, cfg, ev.wave);
      d.history.push({ wave: ev.wave, average: obs.average, types: obs.types });
      if (d.history.length > cfg.historyLimit) d.history.splice(0, d.history.length - cfg.historyLimit);
      d.scores = updateScores(d.scores, forUpdate(obs), cfg); // scores are updated on EVERY finished wave
      d.lastObservedWave = ev.wave;
      delete d.acc[ev.wave];
    }),
  ];
  return () => offs.forEach((off) => off());
}

function staticReason(wave, cfg) {
  if (wave < cfg.firstAdaptiveWave) return 'static-early';
  if (isIntroWave(wave)) return 'static-intro';
  return 'static-fixed';
}

/** Explain lines of a v2 decision (pure). @param {object} decision @param {number|null} average norm-average of the observed wave @returns {string[]} */
export function explainDecisionV2(decision, average) {
  if (decision.reason !== 'adapted') return explainDecision(decision);
  const moved = ENEMY_ORDER.filter((t) => Math.abs(decision.tilt[t] - 1) >= MIN_VISIBLE_TILT)
    .sort((a, b) => Math.abs(decision.tilt[b] - 1) - Math.abs(decision.tilt[a] - 1)).slice(0, MAX_TYPE_LINES);
  if (moved.length === 0) return ['The Director adapted only slightly this wave: every tilt is within 0.1 of the static script.'];
  return moved.map((t) => {
    const o = decision.observed[t];
    const ratio = average !== null && average > 0 ? o.norm / average : 1 + o.advantage;
    return `${ENEMIES[t].name}: weight x${decision.tilt[t].toFixed(2)}, earned ${ratio.toFixed(1)}x the expected reward for its type and wave (${o.leaked} of ${o.units} leaked)`;
  });
}

/**
 * The plan for a wave and the record of why. Pure: reads the game, writes nothing.
 * @param {object} game with game.director set (mode 'adaptive2') @param {number} wave 1..30 @returns {{plan: object, decision: object}}
 */
export function planForV2(game, wave) {
  const cfg = cfgOf(game);
  const d = game.director;
  const template = WAVE_TEMPLATES[wave - 1];
  const eligible = isAdaptiveEligible(wave, cfg);
  const last = d.history.length > 0 ? d.history[d.history.length - 1] : null;
  let plan = STATIC_WAVES[wave - 1];
  let reason;
  let tilt = perType(() => 1);
  let finalShares = { ...template.shares };
  if (!eligible) reason = staticReason(wave, cfg);
  else {
    tilt = tiltFromScores(d.scores, cfg);
    reason = ENEMY_ORDER.some((t) => tilt[t] !== 1) ? 'adapted' : 'cold-start';
  }
  if (reason === 'adapted') {
    finalShares = sharesFor({ templateShares: template.shares, tilt, wave, isUnlocked: isTypeUnlocked, cfg });
    plan = planWithShares({ wave, name: template.name, fixed: template.fixed, shares: finalShares, targetThreat: STATIC_THREAT[wave - 1], cfg: config.waves, fit: true });
  }
  const picks = perType((t) => plan.groups.find((g) => g.type === t)?.picks ?? 0);
  const decision = {
    version: 2, wave, mode: 'adaptive2', eligible, reason, templateShares: { ...template.shares }, tilt, finalShares, picks,
    threatTarget: STATIC_THREAT[wave - 1], threatRealized: planThreat(plan.groups), basedOnWave: d.lastObservedWave,
    observed: last ? JSON.parse(JSON.stringify(last.types)) : zeroObserved(), scores: { ...d.scores }, lines: [], arm: 'adaptive2',
  };
  decision.lines = explainDecisionV2(decision, last ? last.average : null);
  return { plan, decision };
}
