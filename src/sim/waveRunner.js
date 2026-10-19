// Wave runner (pure): phases prep -> running -> intermission -> ... -> won/lost, clear bonus, countdown, game end.
import { config } from '../data/config.js';
import { ENEMIES } from '../data/enemies.js';
import { BUDGETS, planThreat, hpMultiplierForWave } from '../data/waves.js';
import { EVENT_TYPES } from './events.js';
import { queueEnemy } from './enemies.js';
import { earnGold } from './economy.js';
import { planWave } from './waves.js';

/** @returns {object} fresh `game.waves` state */
export function createWavesState() {
  return { phase: 'prep', current: 0, nextWave: 1, countdownTicks: 0, startTick: -1, plan: null, waveStats: { kills: 0, leaks: 0, livesLost: 0, goldFromKills: 0 } };
}

/** @param {object} game @returns {boolean} */
export const isGameOver = (game) => game.over;

/** Alive enemies plus queued spawns. */
export function enemiesRemaining(game) {
  let n = game.spawnQueue.length;
  for (const e of game.enemies) if (e.alive) n++;
  return n;
}

/** Seconds left in the intermission countdown (0 outside intermissions). */
export function getWaveCountdownSeconds(game) {
  return game.waves.phase === 'intermission' ? game.waves.countdownTicks * config.sim.stepSeconds : 0;
}

/**
 * Can a wave be started right now?
 * @param {object} game
 * @returns {{ok: boolean, reason?: string}}
 */
export function canStartWave(game) {
  if (game.over) return { ok: false, reason: 'game_over' };
  const { phase, nextWave } = game.waves;
  if (phase === 'running') return { ok: false, reason: 'wave_in_progress' };
  if (nextWave > game.totalWaves) return { ok: false, reason: 'no_more_waves' };
  return { ok: true };
}

/**
 * Queue the next wave's enemies and enter the running phase. Calling it during an intermission starts early (no bonus).
 * @param {object} game
 * @returns {{ok: boolean, reason?: string, wave?: number}}
 */
export function startNextWave(game) {
  const can = canStartWave(game);
  if (!can.ok) return can;
  const w = game.waves;
  const wave = w.nextWave;
  const plan = planWave(game, wave);
  for (const g of plan.groups) {
    for (let i = 0; i < g.picks; i++) queueEnemy(game, g.type, { delayTicks: g.startTicks + i * g.gapTicks });
  }
  w.phase = 'running';
  w.current = wave;
  w.nextWave = wave + 1;
  w.startTick = game.tick;
  w.plan = plan;
  w.countdownTicks = 0;
  w.waveStats = { kills: 0, leaks: 0, livesLost: 0, goldFromKills: 0 };
  const composition = {};
  const picks = {};
  for (const g of plan.groups) {
    picks[g.type] = g.picks;
    composition[g.type] = g.picks * ENEMIES[g.type].packSize;
  }
  game.events.emit(EVENT_TYPES.WAVE_STARTED, {
    wave, total: game.totalWaves, name: plan.name, fixed: plan.fixed, mode: game.mode, budget: BUDGETS[wave - 1],
    threat: planThreat(plan.groups), hpMult: hpMultiplierForWave(wave), composition, picks, tick: game.tick,
  });
  return { ok: true, wave };
}

/** Make interpolation a no-op once the game has ended, so nothing keeps sliding. */
export function freezeInterpolation(game) {
  for (const e of game.enemies) e.prevDistance = e.distance;
  for (const p of game.projectiles) { p.prevX = p.x; p.prevY = p.y; }
}

/**
 * End the game (idempotent): emits GAME_OVER exactly once.
 * @param {object} game @param {'won'|'lost'} result
 * @returns {void}
 */
export function endGame(game, result) {
  if (game.over) return;
  if (result === 'lost' && game.waves.phase === 'running') { // the wave in progress becomes a partial log entry
    const w = game.waves;
    game.waveLog.push({
      wave: w.current, name: w.plan.name, fixed: w.plan.fixed, complete: false, kills: w.waveStats.kills, leaks: w.waveStats.leaks,
      livesLost: w.waveStats.livesLost, livesAfter: game.lives, goldFromKills: w.waveStats.goldFromKills, clearBonus: 0,
      seconds: (game.tick - w.startTick) * config.sim.stepSeconds, hpMult: hpMultiplierForWave(w.current), threat: planThreat(w.plan.groups),
    });
  }
  game.over = true;
  game.result = result;
  game.waves.phase = result;
  freezeInterpolation(game);
  game.events.emit(EVENT_TYPES.GAME_OVER, { result, wave: game.waves.current, lives: game.lives, tick: game.tick, stats: { ...game.stats } });
}

/**
 * Per-tick wave logic: completion, bonus, intermission countdown, auto start.
 * @param {object} game
 * @returns {void}
 */
export function stepWaves(game) {
  if (game.over) return;
  const w = game.waves;
  if (w.phase === 'running') {
    if (game.enemies.length > 0 || game.spawnQueue.length > 0) return;
    const wave = w.current;
    const bonus = config.economy.waveClearBonusBase + config.economy.waveClearBonusPerWave * wave;
    earnGold(game, bonus, 'wave_clear');
    game.events.emit(EVENT_TYPES.WAVE_ENDED, {
      wave, kills: w.waveStats.kills, leaks: w.waveStats.leaks, livesLost: w.waveStats.livesLost, goldFromKills: w.waveStats.goldFromKills,
      clearBonus: bonus, lives: game.lives, tick: game.tick,
    });
    if (wave >= game.totalWaves) {
      endGame(game, 'won');
    } else {
      w.phase = 'intermission';
      w.countdownTicks = Math.round(game.wavesCfg.intermissionSeconds / config.sim.stepSeconds);
    }
  } else if (w.phase === 'intermission') {
    w.countdownTicks--;
    if (w.countdownTicks <= 0) {
      w.countdownTicks = 0;
      if (game.wavesCfg.autoStartNext) startNextWave(game);
    }
  } else if (w.phase === 'prep' && game.wavesCfg.autoStartFirst) {
    startNextWave(game);
  }
}

/**
 * Subscribe per-wave counters to the event bus.
 * @param {object} game
 * @returns {void}
 */
export function wireWaves(game) {
  const { events } = game;
  events.on(EVENT_TYPES.ENEMY_KILLED, (ev) => { game.waves.waveStats.kills++; game.waves.waveStats.goldFromKills += ev.reward; });
  events.on(EVENT_TYPES.ENEMY_LEAKED, () => { game.waves.waveStats.leaks++; });
  events.on(EVENT_TYPES.LIVES_CHANGED, (ev) => { game.waves.waveStats.livesLost -= ev.delta; });
  events.on(EVENT_TYPES.WAVE_ENDED, (ev) => {
    const w = game.waves;
    game.waveLog.push({
      wave: ev.wave, name: w.plan.name, fixed: w.plan.fixed, complete: true, kills: ev.kills, leaks: ev.leaks, livesLost: ev.livesLost,
      livesAfter: ev.lives, goldFromKills: ev.goldFromKills, clearBonus: ev.clearBonus, seconds: (ev.tick - w.startTick) * config.sim.stepSeconds,
      hpMult: hpMultiplierForWave(ev.wave), threat: planThreat(w.plan.groups),
    });
  });
}
