// The confirmatory analysis on small synthetic data with an injected protocol (3 styles with predictions, 8 seeds, all six modes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { PROTOCOL } from '../experiments/protocol.js';
import { requiredN, mean, sd } from '../experiments/stats.js';
import { analyzeConfirmatory, formatConfirmatory, confirmatoryToMarkdown, NOTES } from '../experiments/confirmatory.js';

const P = {
  ...PROTOCOL,
  styles: ['sA', 'sB', 'sC'],
  tiltPredictions: { sA: ['armoredGrunt'], sB: ['swarmling'], sC: ['regenerator'] },
  stats: { ...PROTOCOL.stats, bootstrapResamples: 300, signFlipResamples: 2000 },
};
const MODES = [...PROTOCOL.confirmatory.modes];
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const tilt = (o = {}) => ({ ...Object.fromEntries(ENEMY_ORDER.map((t) => [t, 1])), ...o });

// seed 8 is lost before wave 5 for every style; (sC, seed 7) too: both are outside the population in every mode
const early = (style, seed) => seed === 8 || (style === 'sC' && seed === 7);
const OWN = { adaptive: { sA: { armoredGrunt: 1.5 }, sB: { swarmling: 1.3 }, sC: { regenerator: 1.2 } }, adaptive2: { sA: {}, sB: {}, sC: {} }, counter: { sA: { armoredGrunt: 1.8 }, sB: { swarmling: 1.6 }, sC: { regenerator: 1.4 } } };
const SHARED = { prior: tilt({ armoredGrunt: 0.8, regenerator: 1.4 }), random: tilt({ armoredGrunt: 1.3, swarmling: 1.1 }) };
function lives(mode, style, seed) {
  if (early(style, seed)) return 20;
  const st = 2 + P.styles.indexOf(style) + (seed % 3);
  const rnd = st + seed;
  return { static: st, random: rnd, prior: rnd + 1, adaptive: rnd + 2, adaptive2: rnd + 1, counter: st + 2 }[mode];
}
function tbw(mode, style, seed) {
  const a = Array(15).fill(null);
  if (mode === 'static') return a;
  const t = SHARED[mode] ? SHARED[mode] : tilt(OWN[mode][style]);
  a[4] = t;
  a[8] = t;
  a[12] = t;
  return a;
}
function makeRows(patch = (r) => r) {
  const rows = [];
  for (const seed of SEEDS) for (const style of P.styles) for (const mode of MODES) {
    rows.push(patch({ style, mode, seed, livesLost: lives(mode, style, seed), won: early(style, seed) ? 0 : 1, finalWave: early(style, seed) ? 3 : 15, leakFraction: 0.1, penetration: 0.5, tiltByWave: tbw(mode, style, seed) }));
  }
  return rows;
}
const run = (rows) => analyzeConfirmatory(rows, { protocol: P, label: 'EXPLORATORY DRY RUN' });
const result = run(makeRows());
const k = (id) => result.confirmatory.find((x) => x.id === id);

test('header, population and counts', () => {
  assert.equal(result.label, 'EXPLORATORY DRY RUN');
  assert.equal(result.protocolVersion, 4);
  assert.match(result.protocolHash, /^[0-9a-f]{64}$/);
  assert.deepEqual(result.n, { seeds: 8, styles: 3, modes: 6, rows: 144, populationUnits: 20, excludedUnits: 4 });
  assert.equal(result.completeness.complete, true);
  assert.deepEqual(result.population, { rule: 'static-reached', units: 20, excluded: 4 });
});

test('K1: exact estimate on the population, seeds without a population unit are dropped and listed, Holm over exactly three p-values', () => {
  assert.deepEqual(result.confirmatory.map((x) => x.id), ['K1', 'K2', 'K3']);
  near(k('K1').estimate, 4); // seed values 1..7 (random - static = seed), seed 8 has no population unit
  assert.equal(k('K1').n, 7);
  assert.deepEqual(k('K1').droppedSeeds, [8]);
  near(k('K1').pRaw, 2 / 128);
  assert.ok(k('K1').ci95[0] > 1 && k('K1').ci95[1] < 7);
  near(k('K2').pRaw, 2 / 128);
  assert.equal(k('K3').pRaw, 1);
  // Holm over [2/128, 2/128, 1]: 3 * 2/128 for the two smallest, 1 for the third
  near(k('K1').pHolm, 3 * (2 / 128));
  near(k('K2').pHolm, 3 * (2 / 128));
  assert.equal(k('K3').pHolm, 1);
});

test('K2 and K3: the fixed-wave contrast with known tilts at wave 9', () => {
  // seeds 1-6 have all three styles: (0.5 + 0.3 + 0.2) / 3; seed 7 has sA and sB only: (0.5 + 0.3) / 2
  near(k('K2').estimate, (6 / 3 + 0.4) / 7);
  assert.equal(k('K2').n, 7);
  assert.deepEqual(k('K2').droppedSeeds, [8]);
  assert.equal(k('K3').estimate, 0);
  assert.equal(k('K3').supported, false);
  assert.deepEqual([k('K1').supported, k('K2').supported], [true, true]); // Holm p 0.046875 < 0.05
});

test('the supported rule: the predicted sign AND Holm p below 0.05', () => {
  // right sign but a spread of seed values: the p-value is not small, so NOT supported
  const noisy = run(makeRows((r) => (r.mode === 'adaptive' ? { ...r, tiltByWave: r.tiltByWave.map((t) => (t ? { ...t, armoredGrunt: 1 + (r.seed % 2 ? 0.6 : -0.9) * (r.style === 'sA' ? 1 : 0) } : t)) } : r)));
  const n2 = noisy.confirmatory.find((x) => x.id === 'K2');
  assert.ok(n2.estimate > 0 && n2.pHolm >= 0.05, `${n2.estimate} ${n2.pHolm}`);
  assert.equal(n2.supported, false);
  // wrong sign with a tiny p: NOT supported
  const wrong = run(makeRows((r) => (r.mode === 'adaptive' ? { ...r, tiltByWave: r.tiltByWave.map((t) => (t ? tilt({ sA: { armoredGrunt: 0.5 }, sB: { swarmling: 0.7 }, sC: { regenerator: 0.8 } }[r.style]) : t)) } : r)));
  const w2 = wrong.confirmatory.find((x) => x.id === 'K2');
  assert.ok(w2.estimate < 0 && w2.pHolm < 0.05);
  assert.equal(w2.supported, false);
  assert.equal(wrong.power.hypotheses.find((p) => p.id === 'K2').seedsNeeded, null, 'a wrong-sign estimate has no power figure');
});

test('estimands carry estimates and intervals but no p-values anywhere', () => {
  assert.equal(result.estimands.length, 8 * 5);
  for (const e of result.estimands) assert.deepEqual(Object.keys(e), ['pair', 'a', 'b', 'metric', 'n', 'estimate', 'ci95']);
  const at = (pair, metric = 'livesLost') => result.estimands.find((e) => e.pair === pair && e.metric === metric);
  near(at('random-static').estimate, 4);
  near(at('prior-random').estimate, 1);
  near(at('adaptive-prior').estimate, 1);
  near(at('adaptive2-prior').estimate, 0);
  near(at('adaptive-static').estimate, 6);
  near(at('counter-static').estimate, 2);
  for (const c of result.contrasts) assert.ok(!Object.keys(c).some((x) => /^p(Raw|Holm|Value)$/.test(x)), 'no p fields in the contrast block');
  assert.ok(!/"p(Raw|Holm|Value)?"/.test(JSON.stringify({ estimands: result.estimands, contrasts: result.contrasts })));
});

test('contrasts: unlocked-only pairs at wave 5, coverage below 1, zero checks for random and prior', () => {
  const c = (mode, wave) => result.contrasts.find((x) => x.mode === mode && x.wave === wave);
  assert.equal(c('adaptive', 5).usedPairs.includes('sC->regenerator'), false, 'the regenerator is locked at wave 5');
  assert.deepEqual(c('adaptive', 5).usedPairs, ['sA->armoredGrunt', 'sB->swarmling']);
  near(c('adaptive', 5).estimate, 0.4);
  assert.equal(c('adaptive', 9).usedPairs.length, 3);
  assert.deepEqual([c('adaptive', 9).unitsObserved, c('adaptive', 9).populationUnits, c('adaptive', 9).coverage], [20, 20, 1]);
  for (const mode of ['random', 'prior']) for (const wave of [5, 9, 13]) assert.deepEqual([c(mode, wave).estimate, c(mode, wave).zeroCheck], [0, true]);
  assert.equal(c('adaptive', 9).zeroCheck, undefined);
  const partial = run(makeRows((r) => (r.mode === 'adaptive' && r.style === 'sB' && r.seed === 3 ? { ...r, tiltByWave: r.tiltByWave.map((t, i) => (i === 8 ? null : t)) } : r)));
  const p9 = partial.contrasts.find((x) => x.mode === 'adaptive' && x.wave === 9);
  assert.deepEqual([p9.unitsObserved, p9.coverage], [19, 0.95]);
  assert.equal(partial.coverageAtPrimary.perMode.adaptive.observed, 19);
  assert.equal(partial.coverageAtPrimary.minCoverage, 0.95);
  assert.equal(partial.coverageAtPrimary.metRule, true);
  const bad = run(makeRows((r) => (r.mode === 'prior' && r.style === 'sA' ? { ...r, tiltByWave: r.tiltByWave.map((t) => (t ? { ...t, armoredGrunt: 0.9 } : t)) } : r)));
  assert.equal(bad.contrasts.find((x) => x.mode === 'prior' && x.wave === 9).zeroCheck, false);
  assert.match(formatConfirmatory(bad), /WARNING: THE CONTRAST OF A MODE THAT CANNOT DEPEND ON THE DEFENSE IS NOT 0/);
  assert.doesNotMatch(formatConfirmatory(result), /WARNING/);
});

test('wave 13 is a descriptive contrast wave in the same format, with coverage, unlocked pairs and a matched-set version; K2 and K3 stay at wave 9', () => {
  const c = (mode, wave) => result.contrasts.find((x) => x.mode === mode && x.wave === wave);
  assert.equal(result.contrasts.length, 3 * 5);
  assert.deepEqual(Object.keys(c('adaptive', 13)), Object.keys(c('adaptive', 9)));
  assert.deepEqual([c('adaptive', 13).usedPairs.length, c('adaptive', 13).coverage, c('adaptive', 13).unitsObserved], [3, 1, 20]);
  near(c('adaptive', 13).estimate, c('adaptive', 9).estimate);
  assert.deepEqual([c('adaptive', 13).matched.units, c('adaptive', 13).matched.n], [20, 7]);
  near(c('adaptive', 13).matched.estimate, c('adaptive', 13).estimate);
  assert.equal(c('random', 13).matched, undefined, 'the matched-set version exists for adaptive, adaptive2 and counter only');
  assert.deepEqual(result.confirmatory.map((k) => k.id), ['K1', 'K2', 'K3']);
  near(k('K2').estimate, c('adaptive', 9).estimate);
  const partial = run(makeRows((r) => (r.mode === 'counter' && r.style === 'sA' && r.seed === 2 ? { ...r, tiltByWave: r.tiltByWave.map((t, i) => (i === 12 ? null : t)) } : r)));
  const p13 = partial.contrasts.find((x) => x.mode === 'adaptive' && x.wave === 13);
  assert.equal(p13.matched.units, 19, 'one counter unit missing at wave 13 shrinks the matched set');
  assert.equal(p13.coverage, 1, 'the plain coverage of adaptive is unchanged');
  assert.match(formatConfirmatory(result), /Fixed-wave style contrast on the matched set/);
});

test('coverage rule block: computed from counts, with the registered values next to it', () => {
  const cv = result.coverageAtPrimary;
  assert.deepEqual([cv.wave, cv.minCoverage, cv.metRule], [9, 1, true]);
  assert.match(cv.rule, /smallest eligible wave >= 9/);
  assert.deepEqual(cv.registered, { coverageRuleMet: false, trainingCoverageAtPrimary: 0.7 });
  assert.equal(cv.ruleChoice.chosen, 9);
});

test('sensitivity: K1 on all units, the matched set, leave-one-style-out with min, max and sign stability', () => {
  const s = result.sensitivity;
  near(s.k1AllUnits.estimate, (21 + 14 / 3) / 8); // seeds 1-6: seed; seed 7: (7 + 7 + 0) / 3; seed 8: 0
  assert.equal(s.k1AllUnits.n, 8);
  assert.equal(s.k1AllUnits.units, 24);
  const matched = run(makeRows((r) => (r.style === 'sA' && r.seed === 1 && r.mode === 'adaptive2' ? { ...r, tiltByWave: r.tiltByWave.map((t, i) => (i === 8 ? null : t)) } : (r.style === 'sB' && r.seed === 2 && r.mode === 'counter' ? { ...r, tiltByWave: r.tiltByWave.map((t, i) => (i === 8 ? null : t)) } : r)))).sensitivity;
  assert.equal(matched.matchedSet.units, 18);
  assert.equal(matched.matchedSet.K2.n, 7);
  const l = Object.fromEntries(s.leaveOneStyleOut.map((x) => [x.id, x]));
  for (const style of P.styles) near(l.K1.byStyleRemoved[style], 4);
  assert.equal(l.K1.signStable, true);
  near(l.K2.byStyleRemoved.sA, 0.25);
  near(l.K2.byStyleRemoved.sB, 0.35);
  near(l.K2.byStyleRemoved.sC, 0.4);
  assert.deepEqual([l.K2.min, l.K2.max, l.K2.signStable], [0.25, 0.4, true]);
  assert.equal(l.K3.signStable, false, 'a zero estimate has no predicted sign');
});

test('power is descriptive and post hoc; K3 with a zero estimate has no figure', () => {
  const sdK1 = sd([1, 2, 3, 4, 5, 6, 7]);
  assert.match(result.power.label, /post hoc/);
  assert.equal(result.power.alpha, 0.016667);
  assert.equal(result.power.hypotheses.find((p) => p.id === 'K1').seedsNeeded, requiredN({ sd: Number(sdK1.toFixed(6)), effect: 4, alpha: 0.016667 }));
  assert.equal(result.power.hypotheses.find((p) => p.id === 'K3').seedsNeeded, null);
  assert.ok(mean([1, 2]) > 0);
});

test('incomplete data: no statistics are computed', () => {
  for (const rows of [makeRows().slice(1), [...makeRows(), makeRows()[0]], makeRows().filter((r) => r.mode !== 'prior'), []]) {
    const r = run(rows);
    assert.equal(r.completeness.complete, false);
    assert.equal(r.confirmatory, undefined);
    assert.equal(r.estimands, undefined);
    assert.match(formatConfirmatory(r), /INCOMPLETE.*No statistic was computed/);
    assert.match(confirmatoryToMarkdown(r), /INCOMPLETE/);
  }
  assert.deepEqual(run(makeRows().slice(1)).completeness.missing, ['sA/static/1']);
  assert.equal(run([...makeRows(), makeRows()[0]]).completeness.duplicates.length, 1);
  assert.throws(() => analyzeConfirmatory(makeRows(), { protocol: P, label: 'maybe' }), RangeError);
});

test('deterministic; banners for both labels; both formatters contain every section and the notes', () => {
  assert.deepEqual(run(makeRows()), result);
  const confirm = analyzeConfirmatory(makeRows(), { protocol: P, label: 'CONFIRMATORY' });
  const text = formatConfirmatory(result);
  const md = confirmatoryToMarkdown(result);
  assert.equal(text.split('\n')[0], 'EXPLORATORY DRY RUN ON TRAINING DATA: NOT CONFIRMATORY');
  assert.equal(md.split('\n')[0], '# EXPLORATORY DRY RUN ON TRAINING DATA: NOT CONFIRMATORY');
  assert.equal(formatConfirmatory(confirm).split('\n')[0], 'CONFIRMATORY ANALYSIS OF THE HELD-OUT RUN (amendment A3)');
  assert.ok(md.includes('## How to read this'));
  assert.equal(text, formatConfirmatory(run(makeRows())));
  for (const title of ['Confirmatory family K1-K3', 'Estimand livesLost', 'Fixed-wave style contrast', 'Coverage at the primary wave 9', 'Sensitivity: K1 on all units', 'leave-one-style-out', 'Power', 'Coverage rule']) assert.ok(text.includes(title) && md.includes(title), title);
  for (const n of NOTES) assert.ok(text.includes(n) && md.includes(n), n);
  assert.ok(!/NaN|undefined|Infinity/.test(text + md));
});
