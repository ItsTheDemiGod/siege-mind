// Shared synthetic inputs for the figure tests (not a test file: the test glob only matches *.test.js).
import { ENEMY_ORDER, ENEMIES } from '../src/data/enemies.js';
import { PROTOCOL } from '../experiments/protocol.js';
import { analyze } from '../experiments/analyze.js';
import { diagnose } from '../experiments/diagnose.js';

const protocol = { ...PROTOCOL, stats: { ...PROTOCOL.stats, bootstrapResamples: 200, signFlipResamples: 500 } };

export function syntheticRows() {
  const rows = [];
  for (let seed = 1; seed <= 12; seed++) {
    for (const [si, style] of protocol.styles.entries()) {
      for (const mode of protocol.modes) {
        const extra = mode === 'adaptive' ? 3 + (seed % 3) : mode === 'random' ? 1 : 0;
        const pred = protocol.tiltPredictions[style];
        const observed = mode !== 'static' ? 1 : 0;
        const row = {
          style, mode, seed, tiltObserved: observed, won: seed % 4 === 0 && mode === 'adaptive' ? 0 : 1, finalWave: 15, livesLost: 2 + si + extra,
          leakFraction: 0.05 + 0.01 * extra, penetration: 0.3 + 0.02 * extra, minutes: 18, towersBuilt: 20,
          tiltAligned: observed && pred ? (mode === 'adaptive' ? (seed <= 4 ? 1 : 0) : (seed <= 9 ? 1 : 0)) : null,
        };
        ENEMY_ORDER.forEach((t, k) => { row[`tilt_${t}`] = mode === 'adaptive' ? [0.6, 0.85, 0.5, 1.3, 1.2][k] : 1; });
        rows.push(row);
      }
    }
  }
  return rows;
}

export const syntheticAnalysis = () => analyze(syntheticRows(), protocol, { set: 'synthetic' });

export function syntheticDiagnostics() {
  const obs = [];
  for (const style of ['A', 'B']) for (const wave of [5, 6]) for (const seed of [1, 2]) {
    for (const [k, t] of ENEMY_ORDER.entries()) {
      const units = 10;
      obs.push({ seed, style, wave, type: t, units, killed: units, leaked: 0, progressSum: units * (0.2 + 0.1 * k + (style === 'A' ? 0 : 0.05) + 0.02 * seed), threatCost: ENEMIES[t].threatCost, leakDamage: ENEMIES[t].leakDamage });
    }
  }
  return diagnose(obs);
}
