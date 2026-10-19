// Parts of the pre-registered analysis added by amendment A2 (pure): contrast hypotheses (T2, T0), the early-ends check and the reached-wave-5 sensitivity.
import { roundTo } from '../src/sim/telemetrySchema.js';
import { contrastPerSeed, contrastSummary, pairedContrastDifference } from './contrast.js';
import { earlyLossReport } from './earlyLosses.js';
import { mean, sd, signFlipTest, bootstrapCI, cohensDz } from './stats.js';

const r6 = (x) => roundTo(x, 6);
const rCI = (ci) => [r6(ci[0]), r6(ci[1])];
export const REACHED_WAVE = 5; // pre-treatment: waves 1-4 are identical in every mode
export const SENSITIVITY_IDS = ['P1', 'P2', 'C1'];

/** A 'contrast' hypothesis: per-seed style contrast of modeA minus that of modeB (modeB null = 0 for every seed). Same output shape as a metric hypothesis. */
export function testContrastHypothesis(rows, h, protocol) {
  const st = protocol.stats;
  const opts = { styles: protocol.styles, predictions: protocol.tiltPredictions };
  const a = contrastPerSeed(rows, { mode: h.modeA, ...opts });
  const d = h.modeB === null ? { seeds: a.seeds, diffs: a.values } : pairedContrastDifference(a, contrastPerSeed(rows, { mode: h.modeB, ...opts }));
  const m = mean(d.diffs);
  const test = signFlipTest(d.diffs, { resamples: st.signFlipResamples, exactMaxN: st.exactMaxN, seed: st.seed });
  return {
    id: h.id, family: h.family, kind: 'contrast', label: h.label, metric: h.metric, modeA: h.modeA, modeB: h.modeB, direction: h.direction,
    n: d.seeds.length, droppedSeeds: a.droppedSeeds, meanDiff: r6(m), sdDiffs: r6(sd(d.diffs)),
    ci95: rCI(bootstrapCI(d.diffs, { resamples: st.bootstrapResamples, alpha: st.alpha, seed: st.seed })), dz: r6(cohensDz(d.diffs)),
    pRaw: r6(test.p), pMethod: test.exact ? 'exact' : 'monte-carlo', pHolm: null,
    supportsDirection: h.direction === 'twosided' ? null : (h.direction === 'greater' ? m > 0 : m < 0), perStyle: {},
  };
}

/** Per-mode contrast block (adaptive and random): summary, per-pair means, rows used and excluded. */
export function contrastBlock(rows, protocol) {
  const out = {};
  for (const mode of ['adaptive', 'random']) {
    const c = contrastPerSeed(rows, { mode, styles: protocol.styles, predictions: protocol.tiltPredictions });
    out[mode] = { ...contrastSummary(c.values, { stats: protocol.stats }), perPair: c.perPair.map((p) => ({ ...p, mean: r6(p.mean) })), used: c.used, excluded: c.excluded, droppedSeeds: c.droppedSeeds };
  }
  return out;
}

/** The early-ends invariant (same units end before wave 5 in every mode). */
export const earlyEnds = (rows) => earlyLossReport(rows, { threshold: REACHED_WAVE });

/**
 * Sensitivity analysis: metric hypotheses `ids` recomputed on the units (style, seed) whose STATIC row reached wave >= REACHED_WAVE.
 * Per seed: mean of the unit differences; seeds without a qualifying unit are dropped. No Holm adjustment.
 */
export function sensitivityReached(rows, hypotheses, protocol) {
  const st = protocol.stats;
  const staticRow = new Map(rows.filter((r) => r.mode === 'static').map((r) => [`${r.style}|${r.seed}`, r]));
  const get = new Map(rows.map((r) => [`${r.style}|${r.seed}|${r.mode}`, r]));
  return hypotheses.filter((h) => SENSITIVITY_IDS.includes(h.id) && h.kind === 'metric').map((h) => {
    const bySeed = new Map();
    let units = 0;
    for (const [key, s] of staticRow) {
      if (s.finalWave < REACHED_WAVE) continue;
      const a = get.get(`${key.split('|')[0]}|${s.seed}|${h.modeA}`);
      const b = get.get(`${key.split('|')[0]}|${s.seed}|${h.modeB}`);
      if (!a || !b) continue;
      units++;
      bySeed.set(s.seed, [...(bySeed.get(s.seed) ?? []), a[h.metric] - b[h.metric]]);
    }
    const seeds = [...bySeed.keys()].sort((x, y) => x - y);
    const diffs = seeds.map((s) => mean(bySeed.get(s)));
    const total = staticRow.size;
    return {
      id: h.id, label: h.label, metric: h.metric, modeA: h.modeA, modeB: h.modeB, direction: h.direction, unitsUsed: units, unitsExcluded: total - units, n: seeds.length,
      meanDiff: r6(mean(diffs)), ci95: rCI(bootstrapCI(diffs, { resamples: st.bootstrapResamples, alpha: st.alpha, seed: st.seed })),
      pRaw: r6(signFlipTest(diffs, { resamples: st.signFlipResamples, exactMaxN: st.exactMaxN, seed: st.seed }).p),
    };
  });
}
