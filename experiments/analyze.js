// The pre-registered analysis (pure, deterministic): seeds are the unit of analysis; every hypothesis is a paired seed-level difference
// (mode A minus mode B, averaged over styles), with a cluster-bootstrap CI, a sign-flip permutation p-value and Holm adjustment per family.
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { roundTo } from '../src/sim/telemetrySchema.js';
import { PROTOCOL } from './protocol.js';
import { mean, sd, median, seedLevelDiffs, signFlipTest, bootstrapCI, cohensDz, holmAdjust, wilson, requiredN } from './stats.js';

export { formatAnalysis, analysisToMarkdown } from './analyzeFormat.js';

const DESCRIPTIVE_METRICS = ['livesLost', 'won', 'finalWave', 'leakFraction', 'penetration', 'minutes', 'towersBuilt'];
export const NOTES = Object.freeze([
  'Results on the tuning seed set are exploratory: they may guide tuning, they are not the confirmatory evaluation.',
  'Seeds are the unit of analysis: all numbers are seed-level paired differences averaged over the styles, not game-level counts.',
  'The bots are scripted players with fixed tower mixes, not humans.',
  'The Director may be reacting to tankiness (tanky enemy types tend to score higher against most defenses): compare with the random control.',
]);

const r6 = (x) => roundTo(x, 6);
const rCI = (ci) => [r6(ci[0]), r6(ci[1])];

function describe(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { n: values.length, mean: r6(mean(values)), sd: r6(sd(values)), median: r6(median(values)), min: r6(sorted[0] ?? 0), max: r6(sorted.at(-1) ?? 0) };
}

function checkCompleteness(rows, styles, modes) {
  const seeds = [...new Set(rows.map((r) => r.seed))].sort((a, b) => a - b);
  const counts = new Map();
  for (const r of rows) { const k = `${r.seed}|${r.style}|${r.mode}`; counts.set(k, (counts.get(k) ?? 0) + 1); }
  const missing = [];
  const duplicates = [];
  for (const seed of seeds) for (const style of styles) for (const mode of modes) {
    const c = counts.get(`${seed}|${style}|${mode}`) ?? 0;
    if (c === 0) missing.push(`${style}/${mode}/${seed}`);
    else if (c > 1) duplicates.push(`${style}/${mode}/${seed}`);
  }
  const unknown = rows.filter((r) => !styles.includes(r.style) || !modes.includes(r.mode)).length;
  const expected = seeds.length * styles.length * modes.length;
  return { complete: missing.length === 0 && duplicates.length === 0 && unknown === 0, expected, actual: rows.length, missing: missing.slice(0, 20), duplicates: duplicates.slice(0, 20), unknownRows: unknown, seeds };
}

function descriptive(rows, styles, modes) {
  const out = {};
  for (const metric of DESCRIPTIVE_METRICS) {
    const byMode = {};
    const byStyleMode = Object.fromEntries(styles.map((s) => [s, {}]));
    for (const mode of modes) {
      const vals = rows.filter((r) => r.mode === mode).map((r) => r[metric]);
      byMode[mode] = describe(vals);
      if (metric === 'won') byMode[mode].wilson = rCI(wilson(vals.reduce((a, b) => a + b, 0), vals.length));
      for (const style of styles) {
        const v = rows.filter((r) => r.mode === mode && r.style === style).map((r) => r[metric]);
        byStyleMode[style][mode] = describe(v);
        if (metric === 'won') byStyleMode[style][mode].wilson = rCI(wilson(v.reduce((a, b) => a + b, 0), v.length));
      }
    }
    out[metric] = { byMode, byStyleMode };
  }
  return out;
}

function testHypothesis(rows, h, protocol) {
  const st = protocol.stats;
  const { seeds, diffs, dropped, perStyle } = seedLevelDiffs(rows, { metric: h.metric, modeA: h.modeA, modeB: h.modeB, styles: protocol.styles });
  const m = mean(diffs);
  const test = signFlipTest(diffs, { resamples: st.signFlipResamples, exactMaxN: st.exactMaxN, seed: st.seed });
  const per = {};
  for (const style of protocol.styles) {
    const d = perStyle[style].diffs;
    per[style] = d.length ? { n: d.length, meanDiff: r6(mean(d)), ci95: rCI(bootstrapCI(d, { resamples: st.bootstrapResamples, alpha: st.alpha, seed: st.seed })) } : null;
  }
  return {
    id: h.id, family: h.family, label: h.label, metric: h.metric, modeA: h.modeA, modeB: h.modeB, direction: h.direction,
    n: seeds.length, droppedSeeds: dropped, meanDiff: r6(m), sdDiffs: r6(sd(diffs)),
    ci95: rCI(bootstrapCI(diffs, { resamples: st.bootstrapResamples, alpha: st.alpha, seed: st.seed })), dz: r6(cohensDz(diffs)),
    pRaw: r6(test.p), pMethod: test.exact ? 'exact' : 'monte-carlo', pHolm: null,
    supportsDirection: h.direction === 'greater' ? m > 0 : m < 0, perStyle: per,
  };
}

function applyHolm(results) {
  for (const family of ['primary', 'secondary']) {
    const group = results.filter((r) => r.family === family);
    holmAdjust(group.map((r) => r.pRaw)).forEach((p, i) => { group[i].pHolm = r6(p); });
  }
}

function tiltSection(rows, protocol, hypotheses) {
  const st = protocol.stats;
  const alignment = {};
  for (const [style, predicted] of Object.entries(protocol.tiltPredictions)) {
    if (!predicted) continue;
    const rate = (mode) => {
      const v = rows.filter((r) => r.style === style && r.mode === mode).map((r) => r.tiltAligned);
      const k = v.reduce((a, b) => a + b, 0);
      return { rate: r6(mean(v)), wilson: rCI(wilson(k, v.length)), n: v.length };
    };
    alignment[style] = { predictedTypes: [...predicted], adaptive: rate('adaptive'), random: rate('random') };
  }
  const tilts = {};
  for (const style of protocol.styles) {
    tilts[style] = {};
    for (const t of ENEMY_ORDER) {
      const v = rows.filter((r) => r.style === style && r.mode === 'adaptive').map((r) => r[`tilt_${t}`]);
      tilts[style][t] = { mean: r6(mean(v)), ci95: rCI(bootstrapCI(v, { resamples: st.bootstrapResamples, alpha: st.alpha, seed: st.seed })) };
    }
  }
  return { threshold: st.alignmentThreshold, perStyle: alignment, pooled: hypotheses.find((h) => h.id === 'T1') ?? null, tilts };
}

/**
 * @param {object[]} rows result rows @param {typeof PROTOCOL} [protocol] @param {{set?: string}} [o]
 * @returns {object} plain JSON-serializable analysis; when the rows are incomplete only `completeness` (complete: false) and the counts are filled
 */
export function analyze(rows, protocol = PROTOCOL, { set = 'unspecified' } = {}) {
  const styles = [...protocol.styles];
  const modes = [...protocol.modes];
  const completeness = checkCompleteness(rows, styles, modes);
  const result = { set, n: { seeds: completeness.seeds.length, styles: styles.length, modes: modes.length, rows: rows.length }, completeness, notes: [...NOTES] };
  if (!completeness.complete) return { ...result, descriptive: null, hypotheses: [], tiltAlignment: null, staticWinRateGuard: null, power: null };
  const hypotheses = protocol.hypotheses.map((h) => testHypothesis(rows, h, protocol));
  applyHolm(hypotheses);
  const stat = Object.fromEntries(styles.map((s) => [s, r6(mean(rows.filter((r) => r.style === s && r.mode === 'static').map((r) => r.won)))]));
  const power = {};
  for (const id of ['P1', 'P2']) {
    const h = hypotheses.find((x) => x.id === id);
    const eff = Math.abs(h.meanDiff);
    power[id] = { sdSeedDiffs: h.sdDiffs, observedEffect: h.meanDiff, nForObservedEffect: eff > 0 ? requiredN({ sd: h.sdDiffs, effect: eff }) : null, nForHalfEffect: eff > 0 ? requiredN({ sd: h.sdDiffs, effect: eff / 2 }) : null };
  }
  return {
    ...result, descriptive: descriptive(rows, styles, modes), hypotheses, tiltAlignment: tiltSection(rows, protocol, hypotheses),
    staticWinRateGuard: { perStyle: stat, mean: r6(mean(Object.values(stat))) }, power,
  };
}
