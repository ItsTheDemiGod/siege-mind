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
  styles: ['balancedR', 'noLance', 'noMortar'],
  tiltPredictions: { balancedR: null, noLance: ['armoredGrunt'], noMortar: ['swarmling'] },
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
        // adaptive leans 1.5 on the predicted type and 1.2 elsewhere (a contrast of exactly 0.3); random and static stay at 1
        for (const t of ENEMY_ORDER) row[`tilt_${t}`] = mode === 'adaptive' ? (predicted?.includes(t) ? 1.5 : 1.2) : 1;
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
  const lo = hyp('P1').ci95[0];
  assert.ok(lo > 3 && hyp('P1').ci95[1] <= 5 && lo <= 4 && 4 <= hyp('P1').ci95[1]);
  assert.deepEqual(Object.keys(hyp('P1').perStyle), protocol.styles);
  near(hyp('P1').perStyle.noLance.meanDiff, 4);
  assert.ok(hyp('P1').dz > 0);
});

test('Holm is applied inside each family only', () => {
  const primary = result.hypotheses.filter((h) => h.family === 'primary');
  holmAdjust(primary.map((h) => h.pRaw)).forEach((p, i) => near(primary[i].pHolm, p));
  const secondary = result.hypotheses.filter((h) => h.family === 'secondary');
  holmAdjust(secondary.map((h) => h.pRaw)).forEach((p, i) => near(secondary[i].pHolm, p));
  assert.equal(hyp('C1').pHolm, null);
  assert.equal(hyp('T0').pHolm, null, 'T0 is descriptive and untouched');
  assert.ok(secondary.some((h) => h.id === 'T2'), 'T2 is inside the secondary family');
  assert.ok(secondary.some((h) => h.pHolm > h.pRaw), 'adjustment makes at least one secondary p larger');
  near(hyp('P1').pHolm, Math.min(1, 2 * Math.min(hyp('P1').pRaw, hyp('P2').pRaw)));
});

test('tilt alignment rates, pooled result, tilts and the static guard', () => {
  const a = result.tiltAlignment;
  assert.deepEqual(Object.keys(a.perStyle), ['noLance', 'noMortar']);
  near(a.perStyle.noLance.adaptive.rate, 0.75);
  near(a.perStyle.noLance.random.rate, 0.25);
  assert.ok(a.perStyle.noLance.adaptive.wilson[0] < 0.75 && 0.75 < a.perStyle.noLance.adaptive.wilson[1]);
  assert.ok(a.note.includes('biased in favor of the random control'));
  assert.equal(result.hypotheses.some((h) => h.id === 'T1'), false);
  near(a.tilts.noLance.swarmling.mean, 1.2);
  assert.deepEqual(a.tilts.noLance.swarmling.ci95, [1.2, 1.2]);
  assert.deepEqual(result.staticWinRateGuard, { perStyle: { balancedR: 1, noLance: 1, noMortar: 1 }, mean: 1 });
  near(result.power.P1.observedEffect, 4);
  assert.ok(result.power.P1.nForObservedEffect >= 1);
  assert.equal(result.power.P1.nForHalfEffect >= result.power.P1.nForObservedEffect, true);
});

test('A2: contrast hypotheses T2 and T0 have exact values and T0 is two-sided', () => {
  near(hyp('T2').meanDiff, 0.3);
  assert.equal(hyp('T2').n, 12);
  assert.equal(hyp('T2').supportsDirection, true);
  near(hyp('T2').pRaw, 2 / 4096);
  assert.deepEqual(hyp('T2').ci95, [0.3, 0.3]);
  near(hyp('T0').meanDiff, 0);
  assert.equal(hyp('T0').supportsDirection, null);
  assert.equal(hyp('T0').pRaw, 1);
  assert.equal(hyp('T0').direction, 'twosided');
  near(result.contrast.adaptive.mean, 0.3);
  near(result.contrast.random.mean, 0);
  assert.deepEqual(result.contrast.adaptive.perPair.map((p) => [p.style, p.type, p.n]), [['noLance', 'armoredGrunt', 12], ['noMortar', 'swarmling', 12]]);
  assert.equal(result.contrast.adaptive.used, 36); // every eligible row of the mode, balancedR included
  assert.equal(result.contrast.adaptive.excluded, 0);
});

test('A2: the early-ends block reports whether the same units end early in every mode', () => {
  assert.equal(result.earlyEnds.identical, true);
  assert.equal(result.earlyEnds.byMode.adaptive.endedEarly, 0);
  const bad = analyze(rows.map((r) => (r.mode === 'adaptive' && r.style === 'noLance' && r.seed === 4 ? { ...r, finalWave: 3, won: 0 } : r)), protocol, { set: 'x' });
  assert.equal(bad.earlyEnds.identical, false);
  assert.deepEqual(bad.earlyEnds.mismatches, [{ unit: 'noLance/4', modes: ['adaptive'] }]);
  assert.match(formatAnalysis(bad), /WARNING: AN INVARIANT IS VIOLATED/);
  assert.doesNotMatch(formatAnalysis(result), /INVARIANT IS VIOLATED/);
});

test('A2: the reached-wave-5 sensitivity drops units whose static game ended early (their differences are 0 here)', () => {
  assert.deepEqual(result.sensitivityReached.map((x) => x.id), ['P1', 'P2', 'C1']);
  const all = result.sensitivityReached.find((x) => x.id === 'P1');
  assert.equal(all.unitsUsed, 36);
  near(all.meanDiff, 4);
  // seed 1 of noLance ends at wave 3 in the static game: the unit is excluded; its adaptive-random-static diff is set to 0 in the original data of the other modes
  const early = rows.map((r) => (r.style === 'noLance' && r.seed === 1 ? { ...r, finalWave: 3, livesLost: 2 + 1 } : r));
  const sens = analyze(early, protocol, { set: 'x' }).sensitivityReached.find((x) => x.id === 'P1');
  assert.equal(sens.unitsUsed, 35);
  assert.equal(sens.unitsExcluded, 1);
  assert.equal(sens.n, 12);
  assert.equal(sens.pRaw >= 0 && sens.pRaw <= 1, true);
  const gone = analyze(rows.map((r) => (r.seed === 1 && r.mode === 'static' ? { ...r, finalWave: 2 } : r)), protocol, { set: 'x' }).sensitivityReached.find((x) => x.id === 'P1');
  assert.equal(gone.n, 11, 'a seed with no qualifying unit is dropped');
});

test('A1: rows with tiltObserved 0 are excluded from tilt statistics only', () => {
  const altered = rows.map((r) => (r.mode === 'adaptive' && r.style === 'noLance' && r.seed <= 2 ? { ...r, tiltObserved: 0, tiltAligned: null, tilt_swarmling: 9 } : r));
  const r = analyze(altered, protocol, { set: 'x' });
  assert.equal(r.tiltAlignment.rowsExcluded.adaptive, 2);
  assert.equal(r.tiltAlignment.rowsUsed.adaptive, 36 - 2);
  assert.equal(r.tiltAlignment.rowsExcluded.random, 0);
  near(r.tiltAlignment.tilts.noLance.swarmling.mean, 1.2); // the 9s were not used
  assert.equal(r.tiltAlignment.perStyle.noLance.adaptive.n, 10);
  assert.equal(r.descriptive.livesLost.byMode.adaptive.n, 36); // every other statistic still uses all rows
  assert.equal(r.descriptive.livesLost.byStyleMode.noLance.adaptive.n, 12);
  near(r.hypotheses.find((h) => h.id === 'P1').meanDiff, 4);
  assert.ok(formatAnalysis(r).includes('2 excluded'));
});

test('descriptive tables', () => {
  const d = result.descriptive;
  assert.deepEqual(Object.keys(d), ['livesLost', 'won', 'finalWave', 'leakFraction', 'penetration', 'minutes', 'towersBuilt']);
  near(d.livesLost.byMode.static.mean, 3); // 2 + mean(si) = 3
  near(d.livesLost.byStyleMode.noLance.adaptive.mean, 2 + 1 + 4);
  assert.equal(d.livesLost.byMode.static.n, 36);
  assert.equal(d.won.byMode.adaptive.mean, 1);
  assert.deepEqual(Object.keys(d.won.byMode.adaptive.wilson), ['0', '1']);
  assert.ok(d.won.byStyleMode.balancedR.static.wilson[0] > 0.7);
});

test('incomplete data is detected and reported instead of analyzed', () => {
  const missing = rows.filter((r) => !(r.seed === 5 && r.style === 'noLance' && r.mode === 'random'));
  const r = analyze(missing, protocol, { set: 'x' });
  assert.equal(r.completeness.complete, false);
  assert.deepEqual(r.completeness.missing, ['noLance/random/5']);
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
  for (const title of ['Style contrast', 'Early ends', 'Sensitivity analysis']) for (const doc of [text, md]) assert.ok(doc.includes(title), title);
  assert.ok(text.includes('T2') && text.includes('T0') && text.includes('n/a (two-sided)'));
  assert.match(text, /Completeness: every style x mode x seed present exactly once \(108 of 108\)/);
  assert.ok(!/NaN|undefined/.test(text + md));
});

test('parseAnalyzeArgs', () => {
  assert.deepEqual(parseAnalyzeArgs(['--in=a.json', '--out=b']), { in: 'a.json', out: 'b', allowHashMismatch: false });
  assert.equal(parseAnalyzeArgs(['--in=a.json', '--allow-hash-mismatch']).allowHashMismatch, true);
  assert.throws(() => parseAnalyzeArgs([]), /--in/);
  assert.throws(() => parseAnalyzeArgs(['--in=a', '--bogus']), /unknown argument/);
});
