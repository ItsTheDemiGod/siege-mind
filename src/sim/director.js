// Adaptive Director (pure, deterministic). Observes finished waves from sim events only (independent of telemetry), keeps one score per
// enemy type and tilts the static template shares of eligible waves toward what worked. 'random' mode records the same observations but
// plans with random tilts (a control). planFor never mutates anything and consumes no shared rng. See docs/DIRECTOR.md.
import { config } from '../data/config.js';
import { ENEMIES, ENEMY_ORDER } from '../data/enemies.js';
import {
  STATIC_WAVES, STATIC_THREAT, WAVE_TEMPLATES, planThreat, isTypeUnlocked, isIntroWave, isAdaptiveEligible,
} from '../data/waves.js';
import { planWithShares } from '../data/waveCompose.js';
import { createRng } from './rng.js';
import { EVENT_TYPES } from './events.js';
import { computeObservation, updateScores, tiltFromScores, sharesFor, randomTilt } from './directorMath.js';
import { explainDecision } from './directorExplain.js';

export { explainDecision };
export const DIRECTOR_MODES = Object.freeze(['adaptive', 'random']);
export const DECISION_KEYS = Object.freeze([
  'version', 'wave', 'mode', 'eligible', 'reason', 'templateShares', 'tilt', 'finalShares', 'picks', 'threatTarget', 'threatRealized',
  'basedOnWave', 'observed', 'scores', 'lines',
]);

const perType = (make) => Object.fromEntries(ENEMY_ORDER.map((t) => [t, make(t)]));
const zeroStats = () => perType(() => ({ units: 0, leaked: 0, progressSum: 0 }));
const zeroObserved = () => perType(() => ({ units: 0, leaked: 0, meanProgress: 0, threatSpent: 0, threatShare: 0, reward: 0, advantage: 0, updated: false }));

/** @param {'adaptive'|'random'} mode @returns {object} fresh plain director state */
export function createDirectorState(mode) {
  return { mode, scores: perType(() => 0), history: [], lastObservedWave: 0, acc: {}, enemyWave: {}, ignoredEvents: 0 };
}

const cfgOf = (game) => game.directorCfg ?? config.director;

/**
 * Subscribe the Director to the game's event bus.
 * @param {object} game with game.director set @returns {() => void} unsubscribe
 */
export function wireDirector(game) {
  const d = game.director;
  const bus = game.events;
  const offs = [
    bus.on(EVENT_TYPES.ENEMY_SPAWNED, (ev) => {
      // only enemies spawned while the wave runs are observed: debug spawns between waves carry a stale wave number
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
      const obs = computeObservation(d.acc[ev.wave] ?? zeroStats(), ENEMIES, cfg);
      d.history.push({ wave: ev.wave, average: obs.average, types: obs.types });
      if (d.history.length > cfg.historyLimit) d.history.splice(0, d.history.length - cfg.historyLimit);
      d.scores = updateScores(d.scores, obs, cfg); // 'random' mode learns too, it just never uses the result
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

/**
 * The plan for a wave and the record of why. Pure: reads the game, writes nothing.
 * @param {object} game with game.director set @param {number} wave 1..30
 * @returns {{plan: object, decision: object}} plan is in seconds (the STATIC_WAVES form)
 */
export function planFor(game, wave) {
  const cfg = cfgOf(game);
  const d = game.director;
  const staticPlan = STATIC_WAVES[wave - 1];
  const template = WAVE_TEMPLATES[wave - 1];
  const eligible = isAdaptiveEligible(wave, cfg);
  const ones = perType(() => 1);
  const last = d.history.length > 0 ? d.history[d.history.length - 1] : null;

  let plan = staticPlan;
  let reason;
  let tilt = ones;
  let finalShares = { ...template.shares };
  if (!eligible) {
    reason = staticReason(wave, cfg);
  } else if (d.mode === 'random') {
    reason = 'random';
    tilt = randomTilt(createRng(game.seed).fork(`director-wave-${wave}`), cfg);
  } else {
    tilt = tiltFromScores(d.scores, cfg);
    reason = ENEMY_ORDER.some((t) => tilt[t] !== 1) ? 'adapted' : 'cold-start';
  }
  if (reason === 'adapted' || reason === 'random') {
    finalShares = sharesFor({ templateShares: template.shares, tilt, wave, isUnlocked: isTypeUnlocked, cfg });
    plan = planWithShares({ wave, name: template.name, fixed: template.fixed, shares: finalShares, targetThreat: STATIC_THREAT[wave - 1], cfg: config.waves, fit: true });
  }
  const picks = perType((t) => plan.groups.find((g) => g.type === t)?.picks ?? 0);
  const decision = {
    version: 1, wave, mode: d.mode, eligible, reason, templateShares: { ...template.shares }, tilt, finalShares, picks,
    threatTarget: STATIC_THREAT[wave - 1], threatRealized: planThreat(plan.groups), basedOnWave: d.lastObservedWave,
    observed: last ? JSON.parse(JSON.stringify(last.types)) : zeroObserved(), scores: { ...d.scores }, lines: [],
  };
  decision.lines = explainDecision(decision, undefined, last ? last.average : null);
  return { plan, decision };
}
