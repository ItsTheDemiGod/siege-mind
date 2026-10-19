// Amendment A1 report (pure builder + CLI): compares the Phase 8A (legacy) final-tilt definition with the A1 definition on the same games.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { roundTo } from '../src/sim/telemetrySchema.js';
import { PROTOCOL } from './protocol.js';
import { mean, seedLevelDiffs, bootstrapCI, wilson } from './stats.js';

const r6 = (x) => roundTo(x, 6);
const rCI = (c) => [r6(c[0]), r6(c[1])];

/** Alignment rate with a Wilson interval over rows that have a 0/1 value. */
function rate(rows) {
  const v = rows.map((r) => r.tiltAligned).filter((x) => x === 0 || x === 1);
  const k = v.reduce((a, b) => a + b, 0);
  return { n: v.length, rate: r6(v.length ? k / v.length : 0), wilson: rCI(wilson(k, v.length)) };
}

function pooled(rows, protocol) {
  const { seeds, diffs } = seedLevelDiffs(rows, { metric: 'tiltAligned', modeA: 'adaptive', modeB: 'random', styles: protocol.styles });
  const st = protocol.stats;
  return { seeds: seeds.length, meanDiff: r6(mean(diffs)), ci95: rCI(bootstrapCI(diffs, { resamples: st.bootstrapResamples, alpha: st.alpha, seed: st.seed })) };
}

const allOnes = (r) => ENEMY_ORDER.every((t) => r[`tilt_${t}`] === 1);

/**
 * @param {object[]} legacyRows Phase 8A rows (no tiltObserved) @param {object[]} newRows rows under A1 @param {typeof PROTOCOL} [protocol]
 * @returns {object} plain JSON-serializable report
 */
export function buildAmendmentReport(legacyRows, newRows, protocol = PROTOCOL) {
  const styles = protocol.styles;
  const predicted = styles.filter((s) => protocol.tiltPredictions[s]);
  const pick = (rows, style, mode) => rows.filter((r) => r.style === style && r.mode === mode);
  const artifact = Object.fromEntries(styles.map((s) => [s, pick(legacyRows, s, 'random').filter(allOnes).length]));
  const t1 = Object.fromEntries(predicted.map((s) => [s, {
    predictedTypes: [...protocol.tiltPredictions[s]],
    legacy: { adaptive: rate(pick(legacyRows, s, 'adaptive')), random: rate(pick(legacyRows, s, 'random')) },
    a1: { adaptive: rate(pick(newRows, s, 'adaptive').filter((r) => r.tiltObserved === 1)), random: rate(pick(newRows, s, 'random').filter((r) => r.tiltObserved === 1)) },
  }]));
  const weights = Object.fromEntries(styles.map((s) => [s, Object.fromEntries(ENEMY_ORDER.map((t) => [t, {
    legacy: r6(mean(pick(legacyRows, s, 'adaptive').map((r) => r[`tilt_${t}`]))),
    a1: r6(mean(pick(newRows, s, 'adaptive').filter((r) => r.tiltObserved === 1).map((r) => r[`tilt_${t}`]))),
  }]))]));
  const unobserved = Object.fromEntries(protocol.modes.map((m) => [m, newRows.filter((r) => r.mode === m && r.tiltObserved === 0).length]));
  return {
    randomRowsAllTiltsOne: { total: Object.values(artifact).reduce((a, b) => a + b, 0), perStyle: artifact, randomRows: newRows.filter((r) => r.mode === 'random').length },
    t1PerStyle: t1, t1Pooled: { legacy: pooled(legacyRows, protocol), a1: pooled(newRows, protocol) }, tiltObservedZeroRows: unobserved, meanFinalWeights: weights,
  };
}

const f = (x, d = 3) => x.toFixed(d);
const ci = (c) => `[${f(c[0])}, ${f(c[1])}]`;
const pct = (x) => `${(100 * x).toFixed(0)}%`;

/** @param {object} r buildAmendmentReport result @returns {string} markdown */
export function amendmentToMarkdown(r) {
  const L = ['# Amendment A1: final tilt measured at the last eligible wave', '',
    'Phase 8A measured the final tilt at the last wave record (random: its applied tilt; adaptive: the held weights). A1 uses the applied tilt of the last ELIGIBLE record for both modes. The amendment was made after the tuning results had been seen and before any held-out run.', '',
    '## (a) The artifact in the legacy definition', '',
    `Legacy random rows whose five tilts are all exactly 1.0 (the last record was not eligible): ${r.randomRowsAllTiltsOne.total} of ${r.randomRowsAllTiltsOne.randomRows}.`, '',
    '| style | legacy random rows with all tilts 1.0 |', '| --- | --- |', ...Object.entries(r.randomRowsAllTiltsOne.perStyle).map(([s, n]) => `| ${s} | ${n} |`), '',
    '## (b) T1 under both definitions (tilt alignment, final weight at least the threshold on a predicted type)', '',
    '| style | predicted | legacy adaptive | legacy random | A1 adaptive | A1 random |', '| --- | --- | --- | --- | --- | --- |',
    ...Object.entries(r.t1PerStyle).map(([s, x]) => `| ${s} | ${x.predictedTypes.join('+')} | ${pct(x.legacy.adaptive.rate)} ${ci(x.legacy.adaptive.wilson)} (n ${x.legacy.adaptive.n}) | ${pct(x.legacy.random.rate)} ${ci(x.legacy.random.wilson)} (n ${x.legacy.random.n}) | ${pct(x.a1.adaptive.rate)} ${ci(x.a1.adaptive.wilson)} (n ${x.a1.adaptive.n}) | ${pct(x.a1.random.rate)} ${ci(x.a1.random.wilson)} (n ${x.a1.random.n}) |`), '',
    `Pooled T1 (adaptive minus random, mean over seeds): legacy ${f(r.t1Pooled.legacy.meanDiff)} ${ci(r.t1Pooled.legacy.ci95)} (${r.t1Pooled.legacy.seeds} seeds); A1 ${f(r.t1Pooled.a1.meanDiff)} ${ci(r.t1Pooled.a1.ci95)} (${r.t1Pooled.a1.seeds} seeds).`, '',
    '## (c) Rows without an observed tilt under A1 (tiltObserved 0)', '', '| mode | rows |', '| --- | --- |', ...Object.entries(r.tiltObservedZeroRows).map(([m, n]) => `| ${m} | ${n} |`), '',
    '## (d) Mean final weight per style, adaptive mode (legacy / A1)', '', `| style | ${ENEMY_ORDER.join(' | ')} |`, `| ${['---', ...ENEMY_ORDER.map(() => '---')].join(' | ')} |`,
    ...Object.entries(r.meanFinalWeights).map(([s, w]) => `| ${s} | ${ENEMY_ORDER.map((t) => `${f(w[t].legacy, 2)} / ${f(w[t].a1, 2)}`).join(' | ')} |`), ''];
  return L.join('\n');
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/results');
  const read = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8')).rows;
  let legacy;
  let current;
  try { legacy = read('archive/tuning-v1.rows.json'); current = read('tuning.rows.json'); } catch (e) { console.error(`cannot read the rows files: ${e.message}`); return 1; }
  const report = buildAmendmentReport(legacy, current);
  mkdirSync(root, { recursive: true });
  writeFileSync(resolve(root, 'amendment-A1.json'), `${JSON.stringify(report, null, 1)}\n`);
  writeFileSync(resolve(root, 'amendment-A1.md'), amendmentToMarkdown(report));
  console.log(amendmentToMarkdown(report));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
