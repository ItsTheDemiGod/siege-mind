import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_ORDER } from '../src/data/enemies.js';
import { PROTOCOL } from '../experiments/protocol.js';
import { contrastPerSeed, contrastSummary, pairedContrastDifference, buildContrastReport, contrastToMarkdown, contrastToText } from '../experiments/contrast.js';
import { LEGACY_FOCUS_PREDICTIONS } from '../experiments/legacyPredictions.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const predictions = { A: ['swarmling'], B: ['fastRunner'], C: ['swarmling', 'fastRunner'] };
const styles = ['A', 'B', 'C'];

function row(style, seed, tilts, { mode = 'adaptive', observed = 1 } = {}) {
  const r = { style, mode, seed, tiltObserved: observed };
  for (const t of ENEMY_ORDER) r[`tilt_${t}`] = tilts[t] ?? 1;
  return r;
}
const data = () => [
  row('A', 1, { swarmling: 2 }), row('B', 1, { fastRunner: 1.5 }), row('C', 1, {}),
  row('A', 2, { swarmling: 3 }), row('B', 2, { fastRunner: 2 }), row('C', 2, {}),
  row('A', 3, { swarmling: 1.5 }), row('B', 3, { fastRunner: 9 }, { observed: 0 }), row('C', 3, {}),
];

test('hand-computed pair values, seed values and per-pair means', () => {
  const r = contrastPerSeed(data(), { mode: 'adaptive', styles, predictions });
  assert.deepEqual(r.seeds, [1, 2, 3]);
  [0.1875, 0.375, 0].forEach((v, i) => near(r.values[i], v));
  assert.deepEqual(r.perPair.map((p) => `${p.style}:${p.type}:${p.n}`), ['A:swarmling:3', 'B:fastRunner:2', 'C:fastRunner:3', 'C:swarmling:3']);
  const mean = Object.fromEntries(r.perPair.map((p) => [`${p.style}:${p.type}`, p.mean]));
  near(mean['A:swarmling'], (1 + 2 + 0.5) / 3);
  near(mean['B:fastRunner'], 0.75);
  near(mean['C:fastRunner'], -0.25);
  near(mean['C:swarmling'], -2 / 3);
  assert.deepEqual([r.used, r.excluded, r.droppedSeeds], [8, 1, []]);
});

test('rows with tiltObserved 0 are excluded and no longer serve as references', () => {
  const r = contrastPerSeed(data(), { mode: 'adaptive', styles, predictions });
  // seed 3: B is excluded (its huge tilt 9 never enters), A and C use each other as the only reference
  near(r.values[2], 0);
  const withB = data().map((x) => (x.style === 'B' && x.seed === 3 ? { ...x, tiltObserved: 1 } : x));
  assert.ok(Math.abs(contrastPerSeed(withB, { mode: 'adaptive', styles, predictions }).values[2]) > 0.1);
});

test('a pair without reference rows is unusable and a seed without usable pairs is dropped', () => {
  const only = contrastPerSeed(data(), { mode: 'adaptive', styles: ['A'], predictions });
  assert.deepEqual([only.seeds, only.values, only.droppedSeeds], [[], [], [1, 2, 3]]);
  const strict = contrastPerSeed(data(), { mode: 'adaptive', styles, predictions, minReference: 2 });
  assert.deepEqual(strict.droppedSeeds, [3]); // seed 3 has only two eligible styles, so no style has two references
  assert.deepEqual(strict.seeds, [1, 2]);
  const unpredicted = contrastPerSeed(data(), { mode: 'adaptive', styles, predictions: { A: null, B: [], C: ['swarmling'] } });
  assert.deepEqual(unpredicted.droppedSeeds, [1, 2, 3], 'styles without predictions are not in S, so a single predicted style has no reference');
});

test('a style with several predicted types gives one pair per type; other modes are ignored', () => {
  const r = contrastPerSeed([...data(), row('A', 1, { swarmling: 100 }, { mode: 'random' })], { mode: 'adaptive', styles, predictions });
  assert.equal(r.perPair.filter((p) => p.style === 'C').length, 2);
  assert.equal(r.used, 8);
  assert.deepEqual(contrastPerSeed(data(), { mode: 'static', styles, predictions }).seeds, []);
});

test('a duplicate (style, mode, seed) row throws', () => {
  assert.throws(() => contrastPerSeed([...data(), row('A', 1, {})], { mode: 'adaptive', styles, predictions }), /duplicate row A\/adaptive\/seed 1/);
});

test('contrastSummary on constant values and pairedContrastDifference with unequal seed sets', () => {
  const s = contrastSummary([2, 2, 2, 2], { stats: PROTOCOL.stats });
  assert.deepEqual([s.n, s.mean, s.ci95, s.pRaw], [4, 2, [2, 2], 0.125]);
  const d = pairedContrastDifference({ seeds: [1, 2, 3, 5], values: [1, 2, 3, 5] }, { seeds: [2, 3, 4, 5], values: [0.5, 1, 9, 2] });
  assert.deepEqual(d, { seeds: [2, 3, 5], diffs: [1.5, 2, 3] });
  assert.deepEqual(pairedContrastDifference({ seeds: [1], values: [1] }, { seeds: [2], values: [1] }), { seeds: [], diffs: [] });
});

test('the report builder, text and markdown are deterministic and carry the exploratory sentence', () => {
  const rows = [...data(), ...data().map((r) => ({ ...r, mode: 'random' }))];
  const a = buildContrastReport(rows, { styles, predictions, stats: { ...PROTOCOL.stats, bootstrapResamples: 200 } });
  assert.deepEqual(buildContrastReport(rows, { styles, predictions, stats: { ...PROTOCOL.stats, bootstrapResamples: 200 } }), a);
  assert.equal(a.modes.adaptive.n, 3);
  assert.deepEqual([a.difference.n, a.difference.mean], [3, 0]);
  const md = contrastToMarkdown(a);
  assert.ok(md.includes('Exploratory and post-hoc: this statistic was designed after seeing these data; it is a sanity check of the statistic on archived data, not a result.'));
  assert.equal(md, contrastToMarkdown(a));
  assert.equal(contrastToText(a), contrastToText(a));
  assert.ok(contrastToText(a).includes('adaptive minus random'));
});

test('the legacy predictions are frozen and match protocol version 2', () => {
  assert.ok(Object.isFrozen(LEGACY_FOCUS_PREDICTIONS));
  assert.deepEqual(Object.keys(LEGACY_FOCUS_PREDICTIONS), ['balancedR', 'lanceHeavy', 'mortarHeavy', 'poisonHeavy', 'sniperHeavy']);
  assert.deepEqual([...LEGACY_FOCUS_PREDICTIONS.poisonHeavy], ['fastRunner', 'shieldedBruiser']);
});
