// The pre-registered fixed-wave rule (pure). It uses coverage COUNTS only, never outcome values, so choosing the wave cannot be steered by results.
import { isAdaptiveEligible } from '../src/data/waves.js';

export const FIXED_WAVE_RULE = 'smallest eligible wave >= 9 whose minimum coverage over adaptive, adaptive2, counter, prior and random is at least 0.75; otherwise the wave with the largest minimum coverage';
export const FIXED_WAVE_MIN_COVERAGE = 0.75;
/** The eligible waves in [9, 15] (isAdaptiveEligible with firstAdaptiveWave 5): 9, 11, 12, 13, 14, 15. */
export const FIXED_WAVE_CANDIDATES = Object.freeze(Array.from({ length: 7 }, (_, i) => 9 + i).filter((w) => isAdaptiveEligible(w, { firstAdaptiveWave: 5 })));

/**
 * @param {{mode: string, style: string, seed: number, tiltByWave: (object|null)[]}[]} rows result rows
 * @param {{modes: string[], waves: number[], population: Iterable<string>}} o population is a set of "style|seed" unit keys
 * @returns {Record<number, Record<string, {observed: number, populationUnits: number, coverage: number}>>} coverage[W][mode]
 */
export function coverageTable(rows, { modes, waves, population }) {
  const pop = new Set(population);
  const out = {};
  for (const W of waves) {
    out[W] = {};
    for (const mode of modes) {
      const observed = rows.filter((r) => r.mode === mode && pop.has(`${r.style}|${r.seed}`) && Array.isArray(r.tiltByWave) && r.tiltByWave[W - 1]).length;
      out[W][mode] = { observed, populationUnits: pop.size, coverage: pop.size > 0 ? observed / pop.size : 0 };
    }
  }
  return out;
}

/**
 * @param {ReturnType<typeof coverageTable>} table @param {{candidates?: number[], modes: string[], minCoverage?: number}} o
 * @returns {{chosen: number, minCoverageByWave: Record<number, number>, rule: string, metRule: boolean}}
 */
export function chooseFixedWave(table, { candidates = FIXED_WAVE_CANDIDATES, modes, minCoverage = FIXED_WAVE_MIN_COVERAGE }) {
  const minCoverageByWave = {};
  for (const W of candidates) minCoverageByWave[W] = Math.min(...modes.map((m) => table[W][m].coverage));
  const ok = candidates.find((W) => minCoverageByWave[W] >= minCoverage);
  if (ok !== undefined) return { chosen: ok, minCoverageByWave, rule: FIXED_WAVE_RULE, metRule: true };
  const chosen = candidates.reduce((best, W) => (minCoverageByWave[W] > minCoverageByWave[best] ? W : best), candidates[0]);
  return { chosen, minCoverageByWave, rule: FIXED_WAVE_RULE, metRule: false };
}
