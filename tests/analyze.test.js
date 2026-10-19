import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { PROTOCOL } from '../experiments/protocol.js';
import { analyze, formatAnalysis, analysisToMarkdown, NOTES } from '../experiments/analyze.js';
import { holmAdjust } from '../experiments/stats.js';
import { parseAnalyzeArgs } from '../experiments/analyzeCli.js';

// a reduced protocol: three styles (two with predictions), light resampling
const protocol = {
  ...PROTOCOL,
  styles: ['balancedR', 'lanceHeavy', 'mortarHeavy'],
  tiltPredictions: { balancedR: null, lanceHeavy: ['swarmling'], mortarHeavy: ['fastRunner'] },
  stats: { ...PROTOCOL.stats, bootstrapResamples: 400, signFlipResamples: 2000 },
};
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Synthetic rows with known effects: adaptive costs 3 + (seed mod 3) extra lives, random 1 extra; wins and final wave never change. */
function makeRows() {
  const rows = [];
  for (const seed of SEEDS) {
    for (const [si, style] of protocol.styles.entries()) {
      for (const mode of protocol.modes) {
        const extra = mode === 'adaptive' ? 3 + (seed % 3) : mode === 'random' ? 1 : 0;
        const predicted = protocol.tiltPredictions[style];
        const aligned = predicted === null || mode === 'static' ? null : mode === 'adaptive' ? (seed <= 9 ? 1 : 0) : (seed <= 3 ? 1 : 0);
        const row = {
          style, mode, seed, tiltObserved: mode === 'static' ? 0 : 1, won: 1, finalWave: 15, livesLost: 2 + si + extra, leakFraction: 0.05 + 0.01 * extra, penetration: 0.3 + 0.02 * extra, minutes: 18, towersBuilt: 20, tiltAligned: aligned,
        };
        for (const t of ENEMY_ORDER) row[`tilt_${t}`] = mode === 'adaptive' ? 1.2 : 1;
        rows.push(row);
      }
    }
  }
  return rows;
}
const rows = makeRows();
const result = analyze(rows, protocol, { set: 'synthetic' });
const hyp = (id) => result.hypotheses.find((h) => h.id === id);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('counts and completeness', () => {
  assert.deepEqual(result.n, { seeds: 12, styles: 3, modes: 3, rows: 108 });
  assert.equal(result.completeness.complete, true);
  assert.equal(result.completeness.expected, 108);
  assert.deepEqual(result.notes, [...NOTES]);
  assert.equal(result.set, 'synthetic');
});

test('exact mean differences, directions and the exact permutation p-value', () => {
  near(hyp('P1').meanDiff, 4); // mean of 3 + (seed mod 3) over seeds 1..12
  near(hyp('P2').meanDiff, 3);
  near(hyp('C1').meanDiff, 1);
  assert.equal(hyp('P1').supportsDirection, true);
  assert.equal(hyp('P1').pMethod, 'exact');
  near(hyp('P1').pRaw, 2 / 4096, 1e-6);
  near(hyp('S3').meanDiff, 0.01 * 4);
  near(hyp('S5').meanDiff, 0.02 * 4);
  for (const id of ['S1', 'S2', 'S7', 'S8']) { assert.equal(hyp(id).meanDiff, 0, id); assert.equal(hyp(id).supportsDirection, false, id); assert.equal(hyp(id).pRaw, 1); }
  near(hyp('T1').meanDiff, 0.5); // adaptive aligned in 9 of 12 seeds, random in 3 of 12
  assert.equal(hyp('T1').supportsDirection, true);
  const lo = hyp('P1').ci95[0];
  assert.ok(lo > 3 && hyp('P1').ci95[1] <= 5 && lo <= 4 && 4 <= hyp('P1').ci95[1]);
  assert.deepEqual(Object.keys(hyp('P1').perStyle), protocol.styles);
  near(hyp('P1').perStyle.lanceHeavy.meanDiff, 4);
  assert.ok(hyp('P1').dz > 0);
});

test('Holm is applied inside each family only', () => {
  const primary = result.hypotheses.filter((h) => h.family === 'primary');
  holmAdjust(primary.map((h) => h.pRaw)).forEach((p, i) => near(primary[i].pHolm, p));
  const secondary = result.hypotheses.filter((h) => h.family === 'secondary');
  holmAdjust(secondary.map((h) => h.pRaw)).forEach((p, i) => near(secondary[i].pHolm, p));
  assert.equal(hyp('C1').pHolm, null);
  assert.ok(secondary.some((h) => h.pHolm > h.pRaw), 'adjustment makes at least one secondary p larger');
  near(hyp('P1').pHolm, Math.min(1, 2 * Math.min(hyp('P1').pRaw, hyp('P2').pRaw)));
});

test('tilt alignment rates, pooled result, tilts and the static guard', () => {
  const a = result.tiltAlignment;
  assert.deepEqual(Object.keys(a.perStyle), ['lanceHeavy', 'mortarHeavy']);
  near(a.perStyle.lanceHeavy.adaptive.rate, 0.75);
  near(a.perStyle.lanceHeavy.random.rate, 0.25);
  assert.ok(a.perStyle.lanceHeavy.adaptive.wilson[0] < 0.75 && 0.75 < a.perStyle.lanceHeavy.adaptive.wilson[1]);
  assert.equal(a.pooled.id, 'T1');
  near(a.tilts.lanceHeavy.swarmling.mean, 1.2);
  assert.deepEqual(a.tilts.lanceHeavy.swarmling.ci95, [1.2, 1.2]);
  assert.deepEqual(result.staticWinRateGuard, { perStyle: { balancedR: 1, lanceHeavy: 1, mortarHeavy: 1 }, mean: 1 });
  near(result.power.P1.observedEffect, 4);
  assert.ok(result.power.P1.nForObservedEffect >= 1);
  assert.equal(result.power.P1.nForHalfEffect >= result.power.P1.nForObservedEffect, true);
});

test('A1: rows with tiltObserved 0 are excluded from tilt statistics only', () => {
  const altered = rows.map((r) => (r.mode === 'adaptive' && r.style === 'lanceHeavy' && r.seed <= 2 ? { ...r, tiltObserved: 0, tiltAligned: null, tilt_swarmling: 9 } : r));
  const r = analyze(altered, protocol, { set: 'x' });
  assert.equal(r.tiltAlignment.rowsExcluded.adaptive, 2);
  assert.equal(r.tiltAlignment.rowsUsed.adaptive, 36 - 2);
  assert.equal(r.tiltAlignment.rowsExcluded.random, 0);
  near(r.tiltAlignment.tilts.lanceHeavy.swarmling.mean, 1.2); // the 9s were not used
  assert.equal(r.tiltAlignment.perStyle.lanceHeavy.adaptive.n, 10);
  assert.equal(r.descriptive.livesLost.byMode.adaptive.n, 36); // every other statistic still uses all rows
  assert.equal(r.descriptive.livesLost.byStyleMode.lanceHeavy.adaptive.n, 12);
  near(r.hypotheses.find((h) => h.id === 'P1').meanDiff, 4);
  assert.ok(formatAnalysis(r).includes('2 excluded'));
});

test('descriptive tables', () => {
  const d = result.descriptive;
  assert.deepEqual(Object.keys(d), ['livesLost', 'won', 'finalWave', 'leakFraction', 'penetration', 'minutes', 'towersBuilt']);
  near(d.livesLost.byMode.static.mean, 3); // 2 + mean(si) = 3
  near(d.livesLost.byStyleMode.lanceHeavy.adaptive.mean, 2 + 1 + 4);
  assert.equal(d.livesLost.byMode.static.n, 36);
  assert.equal(d.won.byMode.adaptive.mean, 1);
  assert.deepEqual(Object.keys(d.won.byMode.adaptive.wilson), ['0', '1']);
  assert.ok(d.won.byStyleMode.balancedR.static.wilson[0] > 0.7);
});

test('incomplete data is detected and reported instead of analyzed', () => {
  const missing = rows.filter((r) => !(r.seed === 5 && r.style === 'lanceHeavy' && r.mode === 'random'));
  const r = analyze(missing, protocol, { set: 'x' });
  assert.equal(r.completeness.complete, false);
  assert.deepEqual(r.completeness.missing, ['lanceHeavy/random/5']);
  assert.deepEqual(r.hypotheses, []);
  assert.match(formatAnalysis(r), /INCOMPLETE/);
  const dup = analyze([...rows, rows[0]], protocol, { set: 'x' });
  assert.equal(dup.completeness.complete, false);
  assert.equal(dup.completeness.duplicates.length, 1);
  assert.equal(analyze(rows.filter((r) => r.mode !== 'random'), protocol, {}).completeness.complete, false);
});

test('deterministic, and both formatters contain every hypothesis id and every note', () => {
  assert.deepEqual(analyze(rows, protocol, { set: 'synthetic' }), result);
  const text = formatAnalysis(result);
  const md = analysisToMarkdown(result);
  assert.equal(text, formatAnalysis(analyze(rows, protocol, { set: 'synthetic' })));
  assert.equal(md, analysisToMarkdown(result));
  for (const h of protocol.hypotheses) for (const doc of [text, md]) assert.ok(doc.includes(h.id), h.id);
  for (const n of NOTES) for (const doc of [text, md]) assert.ok(doc.includes(n), n);
  assert.ok(md.includes('## How to read this'));
  assert.ok(md.includes('| id | hypothesis |'));
  assert.ok(text.includes('Primary hypotheses') && text.includes('Tilt alignment') && text.includes('Power'));
  assert.match(text, /Completeness: every style x mode x seed present exactly once \(108 of 108\)/);
  assert.ok(!/NaN|undefined/.test(text + md));
});

test('parseAnalyzeArgs', () => {
  assert.deepEqual(parseAnalyzeArgs(['--in=a.json', '--out=b']), { in: 'a.json', out: 'b', allowHashMismatch: false });
  assert.equal(parseAnalyzeArgs(['--in=a.json', '--allow-hash-mismatch']).allowHashMismatch, true);
  assert.throws(() => parseAnalyzeArgs([]), /--in/);
  assert.throws(() => parseAnalyzeArgs(['--in=a', '--bogus']), /unknown argument/);
});
