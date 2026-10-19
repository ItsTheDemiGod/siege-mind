// Pure description of the wave control (title, subtitle, button, progress) for each wave phase.
import { config } from '../data/config.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * @param {{phase: string, nextWave: number, current: number}} waves game.waves
 * @param {{enemiesRemaining: number, countdownSeconds: number, totalWaves: number, nextWaveName: string|null, hpMultNext: number}} derived
 * @returns {{mode: 'prep'|'running'|'intermission'|'over', title: string, subtitle: string, buttonLabel: string, canStart: boolean, progress: number|null}}
 */
export function describeWaveControl(waves, derived) {
  const { phase, nextWave, current } = waves;
  if (phase === 'won' || phase === 'lost') return { mode: 'over', title: '', subtitle: '', buttonLabel: '', canStart: false, progress: null };
  if (phase === 'running') {
    const n = derived.enemiesRemaining;
    return { mode: 'running', title: `Wave ${current} in progress`, subtitle: `${n} ${n === 1 ? 'enemy' : 'enemies'} left`, buttonLabel: '', canStart: false, progress: null };
  }
  if (phase === 'intermission') {
    const name = derived.nextWaveName ? ` — ${derived.nextWaveName}` : '';
    return {
      mode: 'intermission', title: `Next: Wave ${nextWave}${name}`, subtitle: `Starting in ${Math.ceil(derived.countdownSeconds)}s · Enemy HP ×${derived.hpMultNext.toFixed(1)}`, buttonLabel: 'Start now', canStart: true,
      progress: clamp01(1 - derived.countdownSeconds / config.waves.intermissionSeconds),
    };
  }
  return { mode: 'prep', title: `Wave ${nextWave} ready`, subtitle: `Place towers, then start (Enter) · Enemy HP ×${derived.hpMultNext.toFixed(1)}`, buttonLabel: `Start Wave ${nextWave}`, canStart: true, progress: null };
}
