import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { PROTOCOL } from '../experiments/protocol.js';
import { buildAmendmentReport, amendmentToMarkdown } from '../experiments/amendmentReport.js';

const protocol = { ...PROTOCOL, styles: ['balancedR', 'lanceHeavy'], tiltPredictions: { balancedR: null, lanceHeavy: ['swarmling'] }, stats: { ...PROTOCOL.stats, bootstrapResamples: 300 } };
const SEEDS = [1, 2, 3, 4];

function rows(version) {
  const out = [];
  for (const seed of SEEDS) {
    for (const style of protocol.styles) {
      for (const mode of protocol.modes) {
        const row = { style, mode, seed };
        const dyn = mode !== 'static';
        // legacy random rows 1 and 2 have an unobserved (all 1.0) tilt; under A1 they carry the earlier eligible tilt 1.4
        const unobservedLegacy = mode === 'random' && seed <= 2;
        const swarm = mode === 'adaptive' ? 1.0 : mode === 'random' ? (version === 'legacy' && unobservedLegacy ? 1 : 1.4) : 1;
        for (const t of ENEMY_ORDER) row[`tilt_${t}`] = t === 'swarmling' ? swarm : 1;
        const hasPrediction = style === 'lanceHeavy';
        if (version === 'a1') {
          row.tiltObserved = dyn && !(mode === 'adaptive' && seed === 4) ? 1 : 0;
          if (row.tiltObserved === 0 && dyn) row.tilt_swarmling = 1;
          row.tiltAligned = row.tiltObserved === 1 && hasPrediction ? (swarm >= 1.15 ? 1 : 0) : null;
        } else {
          row.tiltAligned = dyn && hasPrediction ? (swarm >= 1.15 ? 1 : 0) : null;
        }
        out.push(row);
      }
    }
  }
  return out;
}
const legacy = rows('legacy');
const a1 = rows('a1');
const report = buildAmendmentReport(legacy, a1, protocol);

test('the artifact count: legacy random rows with all five tilts exactly 1.0, per style', () => {
  assert.deepEqual(report.randomRowsAllTiltsOne, { total: 4, perStyle: { balancedR: 2, lanceHeavy: 2 }, randomRows: 8 });
});

test('the side-by-side T1 rates under both definitions, with Wilson intervals', () => {
  const x = report.t1PerStyle.lanceHeavy;
  assert.deepEqual(x.predictedTypes, ['swarmling']);
  assert.deepEqual([x.legacy.adaptive.rate, x.legacy.adaptive.n, x.legacy.random.rate, x.legacy.random.n], [0, 4, 0.5, 4]); // legacy: seeds 1-2 read tilt 1 (artifact)
  assert.deepEqual([x.a1.adaptive.rate, x.a1.adaptive.n, x.a1.random.rate, x.a1.random.n], [0, 3, 1, 4]); // A1: adaptive seed 4 unobserved and excluded
  assert.ok(x.legacy.random.wilson[0] < 0.5 && 0.5 < x.legacy.random.wilson[1]);
  assert.ok(!('balancedR' in report.t1PerStyle), 'styles without a prediction have no T1 row');
});

test('pooled T1 for both definitions', () => {
  assert.equal(report.t1Pooled.legacy.meanDiff, -0.5); // adaptive 0, random 1 in seeds 3-4 and 0 in seeds 1-2
  assert.equal(report.t1Pooled.a1.meanDiff, -1);
  assert.equal(report.t1Pooled.legacy.seeds, 4);
  assert.equal(report.t1Pooled.a1.seeds, 3); // seed 4 has an unobserved adaptive row for the only style with a prediction
  assert.ok(report.t1Pooled.a1.ci95[0] <= -1 && -1 <= report.t1Pooled.a1.ci95[1]);
});

test('rows without an observed tilt, and mean final weights side by side', () => {
  assert.deepEqual(report.tiltObservedZeroRows, { static: 8, adaptive: 2, random: 0 });
  assert.deepEqual(report.meanFinalWeights.lanceHeavy.swarmling, { legacy: 1, a1: 1 });
  assert.deepEqual(Object.keys(report.meanFinalWeights.balancedR), [...ENEMY_ORDER]);
});

test('deterministic report and markdown that names every section', () => {
  assert.deepEqual(buildAmendmentReport(legacy, a1, protocol), report);
  const md = amendmentToMarkdown(report);
  assert.equal(md, amendmentToMarkdown(report));
  for (const s of ['(a)', '(b)', '(c)', '(d)', 'after the tuning results had been seen', 'Pooled T1']) assert.ok(md.includes(s), s);
  assert.ok(!/NaN|undefined/.test(md));
});
