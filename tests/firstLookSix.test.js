// Six-mode first look (Phase 9A-2b-1): attribution chain, fixed-wave zero checks, matched sets, tilt agreement, coverage and the chosen wave.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { PROTOCOL } from '../experiments/protocol.js';
import { firstLook, formatFirstLook, firstLookToMarkdown, NOTES } from '../experiments/firstLook.js';

const protocol = {
  ...PROTOCOL,
  styles: ['noLance', 'noMortar'],
  tiltPredictions: { noLance: ['armoredGrunt'], noMortar: ['swarmling'] },
  stats: { ...PROTOCOL.stats, bootstrapResamples: 300, signFlipResamples: 2000 },
};
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const tilt = (o = {}) => ({ ...Object.fromEntries(ENEMY_ORDER.map((t) => [t, 1])), ...o });
const MODES = ['static', 'random', 'prior', 'adaptive', 'adaptive2', 'counter'];

// 2 styles x 4 seeds x 6 modes; noMortar/4 is lost at wave 3 in every mode (outside the population: 7 of 8 units remain).
const early = (style, seed) => style === 'noMortar' && seed === 4;
const STATIC = (style, seed) => (style === 'noLance' ? seed : 2 * seed);
const PRIOR_EXTRA = { noLance: 2, noMortar: 0 };
const ADAPTIVE_EXTRA = (style, seed) => (seed % 2 === 1 ? (style === 'noLance' ? 1 : 2) : 0);
function lives(mode, style, seed) {
  if (early(style, seed)) return 20;
  const rnd = STATIC(style, seed) + 1;
  const prior = rnd + PRIOR_EXTRA[style];
  return { static: STATIC(style, seed), random: rnd, prior, adaptive: prior + ADAPTIVE_EXTRA(style, seed), adaptive2: prior + 1, counter: STATIC(style, seed) + 3 }[mode];
}
const SPEC = {
  adaptive: { noLance: { armoredGrunt: 1.5 }, noMortar: { swarmling: 1.2 } }, adaptive2: { noLance: { armoredGrunt: 1.2 }, noMortar: { swarmling: 1.1 } },
  counter: { noLance: { armoredGrunt: 1.8 }, noMortar: { swarmling: 1.6 } },
  prior: { noLance: { armoredGrunt: 0.8, regenerator: 1.4 }, noMortar: { armoredGrunt: 0.8, regenerator: 1.4 } },
  random: { noLance: { armoredGrunt: 1.3, swarmling: 1.1 }, noMortar: { armoredGrunt: 1.3, swarmling: 1.1 } },
};
function tiltByWave(mode, style, seed) {
  const a = Array(15).fill(null);
  if (!SPEC[mode]) return a;
  const t = tilt(SPEC[mode][style]);
  const miss7 = (mode === 'adaptive2' && style === 'noMortar' && seed === 2) || (mode === 'counter' && style === 'noMortar' && seed === 1);
  if (!miss7) a[6] = t;
  a[8] = t;
  return a;
}
function makeRows(patch = (r) => r) {
  const rows = [];
  for (const seed of [1, 2, 3, 4]) for (const style of protocol.styles) for (const mode of MODES) {
    rows.push(patch({ style, mode, seed, livesLost: lives(mode, style, seed), won: early(style, seed) ? 0 : 1, finalWave: early(style, seed) ? 3 : 15, leakFraction: 0.1, penetration: 0.5, tiltByWave: tiltByWave(mode, style, seed) }));
  }
  return rows;
}
const result = firstLook(makeRows(), protocol);

test('population and the six modes', () => {
  assert.deepEqual(result.modes, ['static', 'adaptive', 'random', 'adaptive2', 'counter', 'prior']); // the canonical ALL_MODES order, whatever order the rows come in
  assert.deepEqual(result.population, { units: 7, excluded: 1, totalUnits: 8, seeds: 4, allSeeds: 4, minWave: 5 });
});

test('attribution: exact differences, the identity holds, and every part has the hand-computed value', () => {
  const at = (a, b, metric = 'livesLost') => result.attribution.pairs.find((x) => x.a === a && x.b === b && x.metric === metric);
  near(at('random', 'static').meanDiff, 1);
  near(at('prior', 'random').meanDiff, 1.25); // seeds 1-3: mean(2, 0) = 1; seed 4 has noLance only: 2
  near(at('adaptive', 'prior').meanDiff, 0.75); // 1.5, 0, 1.5, 0
  near(at('adaptive', 'static').meanDiff, 3);
  near(at('adaptive2', 'prior').meanDiff, 1);
  near(at('counter', 'static').meanDiff, 3);
  near(at('counter', 'prior').meanDiff, 0.75);
  near(at('adaptive', 'static').meanDiff, at('random', 'static').meanDiff + at('prior', 'random').meanDiff + at('adaptive', 'prior').meanDiff);
  assert.deepEqual(result.attribution.identity.checked, true);
  assert.equal(result.attribution.identity.ok, true);
  assert.ok(result.attribution.identity.maxError < 1e-9);
  assert.equal(result.attribution.identity.seeds, 4);
  assert.equal(result.attribution.pairs.length, 8 * 5);
  assert.equal(at('random', 'static', 'won').meanDiff, 0);
  assert.equal(at('adaptive', 'static').n, 4);
  const text = formatFirstLook(result);
  assert.match(text, /Identity check \(livesLost, 4 seeds\).*holds\./);
  assert.doesNotMatch(text, /IDENTITY FAILED/);
  const broken = { ...result, attribution: { ...result.attribution, identity: { checked: true, ok: false, maxError: 0.5, seeds: 4 } } };
  assert.match(formatFirstLook(broken), /ERROR: THE ATTRIBUTION IDENTITY FAILED/);
  assert.match(firstLookToMarkdown(broken), /ERROR: THE ATTRIBUTION IDENTITY FAILED/);
});

test('fixed-wave contrast: random and prior are exactly 0, the learning arms are not, coverage below 1 where units are missing', () => {
  const c = (mode, W) => result.fixedWave.find((x) => x.mode === mode && x.wave === W);
  for (const mode of ['random', 'prior']) for (const W of [7, 9]) assert.deepEqual([c(mode, W).mean, c(mode, W).pRaw], [0, 1], `${mode} ${W}`);
  assert.deepEqual(result.zeroCheck, { ok: true, violations: [] });
  near(c('adaptive', 9).mean, 0.35); // seeds 1-3: noLance 1.5 - 1, noMortar 1.2 - 1; seed 4 has no reference style
  assert.equal(c('adaptive', 9).seeds, 3);
  near(c('adaptive', 7).mean, 0.35);
  near(c('adaptive2', 7).mean, 0.15); // seeds 1 and 3 only (noMortar/2 is missing)
  assert.deepEqual([c('adaptive2', 7).observedUnits, c('adaptive2', 7).popUnits, c('adaptive2', 7).coverage], [6, 7, 0.857143]);
  near(c('counter', 9).mean, 0.7); // 0.8 and 0.6
  assert.equal(c('adaptive', 15).mean, null);
  const bad = firstLook(makeRows((r) => (r.mode === 'prior' && r.style === 'noLance' ? { ...r, tiltByWave: r.tiltByWave.map((t) => (t ? { ...t, armoredGrunt: 0.9 } : t)) } : r)), protocol);
  assert.equal(bad.zeroCheck.ok, false);
  assert.ok(bad.zeroCheck.violations.some((v) => v.startsWith('prior wave 9')));
  assert.match(formatFirstLook(bad), /WARNING: THE FIXED-WAVE CONTRAST OF A MODE THAT CANNOT DEPEND ON THE DEFENSE IS NOT 0/);
});

test('matched-set sensitivity restricts to units observed at W in adaptive, adaptive2 and counter', () => {
  const m = (mode, W) => result.matched.find((x) => x.mode === mode && x.wave === W);
  assert.equal(m('adaptive', 7).matchedUnits, 5); // 7 minus noMortar/2 (adaptive2) and noMortar/1 (counter)
  assert.equal(m('adaptive', 9).matchedUnits, 7);
  assert.equal(m('adaptive', 7).seeds, 1); // only seed 3 keeps both styles
  near(m('adaptive', 7).mean, 0.35);
  assert.equal(result.matched.length, 8 * 3);
  assert.equal(m('adaptive', 15).matchedUnits, 0);
});

test('coverage table and the chosen wave (counts only)', () => {
  const r = result.fixedWaveRule;
  assert.deepEqual(r.candidates, [9, 11, 12, 13, 14, 15]);
  assert.equal(r.chosen, 9);
  assert.equal(r.metRule, true);
  assert.equal(r.minCoverageByWave[9], 1);
  assert.equal(r.minCoverageByWave[11], 0);
  assert.deepEqual(r.coverage[7].adaptive2, { observed: 6, populationUnits: 7, coverage: 6 / 7 });
  assert.match(r.rule, /smallest eligible wave >= 9/);
  const none = firstLook(makeRows((x) => ({ ...x, tiltByWave: x.tiltByWave.map((t, i) => (i === 8 && x.seed > 1 ? null : t)) })), protocol).fixedWaveRule;
  assert.equal(none.metRule, false);
  assert.equal(none.chosen, 9, 'the candidate with the largest minimum coverage');
  assert.match(formatFirstLook(result), /Fixed wave chosen by the rule.*wave 9\./);
});

test('tilt agreement and mean tilts have hand-computed values', () => {
  const ag = (a, b) => result.tiltAgreement.find((x) => x.a === a && x.b === b);
  const w9 = ag('adaptive', 'prior').perWave.find((w) => w.wave === 9);
  // noLance units: |1.5 - 0.8| + |1 - 1| + |1 - 1| + |1 - 1.4| + 0 = 1.1 / 5 = 0.22; noMortar units: 0.2 + 0.2 + 0 + 0.4 + 0 = 0.8 / 5 = 0.16
  assert.equal(w9.n, 7);
  near(w9.mean, (4 * 0.22 + 3 * 0.16) / 7);
  near(ag('random', 'prior').perWave.find((w) => w.wave === 9).mean, (0.5 + 0.1 + 0.4) / 5); // 1.3 vs 0.8, 1.1 vs 1, 1 vs 1.4
  assert.equal(ag('adaptive', 'adaptive2').perWave.find((w) => w.wave === 7).n, 6);
  assert.equal(ag('adaptive', 'prior').pooled.n, 14);
  assert.equal(result.tiltAgreement.length, 4);
  const mt = (mode, W) => result.meanTilts.find((x) => x.mode === mode && x.wave === W);
  near(mt('adaptive', 9).tilt.armoredGrunt, (4 * 1.5 + 3 * 1) / 7);
  assert.equal(mt('adaptive', 9).n, 7);
  assert.equal(mt('prior', 9).tilt.regenerator, 1.4);
  assert.equal(mt('adaptive', 15), undefined);
  assert.equal(result.meanTilts.some((x) => x.mode === 'random'), false);
});

test('early-ends warning, determinism, formatters and notes', () => {
  assert.equal(result.earlyEnds.identical, true);
  assert.doesNotMatch(formatFirstLook(result), /INVARIANT IS VIOLATED/);
  const broken = firstLook(makeRows((r) => (r.mode === 'prior' && r.style === 'noLance' && r.seed === 2 ? { ...r, finalWave: 3 } : r)), protocol);
  assert.equal(broken.earlyEnds.identical, false);
  assert.match(formatFirstLook(broken), /WARNING: AN INVARIANT IS VIOLATED/);
  assert.deepEqual(firstLook(makeRows(), protocol), result);
  const text = formatFirstLook(result);
  const md = firstLookToMarkdown(result);
  assert.equal(text, formatFirstLook(firstLook(makeRows(), protocol)));
  for (const title of ['Attribution of livesLost', 'Fixed-wave coverage', 'Tilt agreement', 'Mean applied tilt', 'Matched-set sensitivity', 'Zero check']) assert.ok(text.includes(title) && md.includes(title), title);
  for (const n of NOTES) assert.ok(text.includes(n) && md.includes(n), n);
  assert.ok(!/NaN|undefined|Infinity/.test(text + md));
});
