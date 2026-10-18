// Run statistics (pure), filled from events only. Full telemetry arrives in Phase 5.
import { EVENT_TYPES } from './events.js';

/** @returns {object} a zeroed stats object */
export function createStats() {
  return {
    kills: 0, leaks: 0, livesLost: 0, goldFromKills: 0, goldFromBonus: 0, goldRefunded: 0, goldSpent: 0,
    towersBuilt: 0, towersSold: 0, towersUpgraded: 0, enemiesSpawned: 0, wavesCleared: 0,
  };
}

/**
 * Subscribe the stats counters to the game's event bus.
 * @param {object} game
 * @returns {void}
 */
export function wireStats(game) {
  const { events } = game;
  const s = game.stats;
  events.on(EVENT_TYPES.ENEMY_KILLED, () => { s.kills++; });
  events.on(EVENT_TYPES.ENEMY_LEAKED, () => { s.leaks++; });
  events.on(EVENT_TYPES.LIVES_CHANGED, (ev) => { s.livesLost -= ev.delta; });
  events.on(EVENT_TYPES.GOLD_CHANGED, (ev) => {
    if (ev.reason === 'kill') s.goldFromKills += ev.delta;
    else if (ev.reason === 'wave_clear') s.goldFromBonus += ev.delta;
    else if (ev.reason === 'sell') s.goldRefunded += ev.delta;
    else if (ev.reason === 'build' || ev.reason === 'upgrade') s.goldSpent -= ev.delta;
  });
  events.on(EVENT_TYPES.TOWER_PLACED, () => { s.towersBuilt++; });
  events.on(EVENT_TYPES.TOWER_SOLD, () => { s.towersSold++; });
  events.on(EVENT_TYPES.TOWER_UPGRADED, () => { s.towersUpgraded++; });
  events.on(EVENT_TYPES.ENEMY_SPAWNED, () => { s.enemiesSpawned++; });
  events.on(EVENT_TYPES.WAVE_ENDED, () => { s.wavesCleared++; });
}
