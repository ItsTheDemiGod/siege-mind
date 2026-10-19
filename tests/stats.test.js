import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mean, sd, median, quantile, seedLevelDiffs, signFlipTest, bootstrapCI, cohensDz, holmAdjust, wilson, requiredN } from '../experiments/stats.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('mean, sd, median and quantile by hand', () => {
  assert.equal(mean([1, 2, 3, 4]), 2.5);
  assert.equal(mean([]), 0);
  near(sd([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7));
  assert.equal(sd([5]), 0);
  assert.equal(sd([]), 0);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  const s = [10, 20, 30, 40, 50];
  assert.equal(quantile(s, 0), 10);
  assert.equal(quantile(s, 1), 50);
  assert.equal(quantile(s, 0.5), 30);
  near(quantile(s, 0.25), 20);
  near(quantile(s, 0.9), 46);
  assert.equal(quantile([7], 0.3), 7);
});

const row = (style, mode, seed, v) => ({ style, mode, seed, livesLost: v, tiltAligned: v });

test('seedLevelDiffs: exact values, per-style detail, null skipping', () => {
  const rows = [];
  const base = { a: { 1: [10, 6], 2: [8, 8] }, b: { 1: [4, 2], 2: [6, 2] } };
  for (const style of ['a', 'b']) for (const seed of [1, 2]) { rows.push(row(style, 'adaptive', seed, base[style][seed][0])); rows.push(row(style, 'static', seed, base[style][seed][1])); }
  rows.push(row('a', 'random', 1, 99)); // other modes are ignored
  const r = seedLevelDiffs(rows, { metric: 'livesLost', modeA: 'adaptive', modeB: 'static', styles: ['a', 'b'] });
  assert.deepEqual(r.seeds, [1, 2]);
  assert.deepEqual(r.diffs, [(4 + 2) / 2, (0 + 4) / 2]);
  assert.deepEqual(r.perStyle.a, { seeds: [1, 2], diffs: [4, 0] });
  assert.deepEqual(r.perStyle.b, { seeds: [1, 2], diffs: [2, 4] });
  assert.deepEqual(r.dropped, []);
  // null metric for one style: that style is skipped, a seed with no usable style is dropped
  const withNull = rows.map((x) => (x.style === 'b' ? { ...x, tiltAligned: null } : x));
  const t = seedLevelDiffs(withNull, { metric: 'tiltAligned', modeA: 'adaptive', modeB: 'static', styles: ['a', 'b'] });
  assert.deepEqual(t.diffs, [4, 0]);
  assert.deepEqual(t.perStyle.b, { seeds: [], diffs: [] });
  const allNull = seedLevelDiffs(withNull, { metric: 'tiltAligned', modeA: 'adaptive', modeB: 'static', styles: ['b'] });
  assert.deepEqual([allNull.seeds, allNull.dropped], [[], [1, 2]]);
});

test('seedLevelDiffs throws for missing and duplicated units', () => {
  const rows = [row('a', 'adaptive', 1, 1), row('a', 'static', 1, 1), row('a', 'adaptive', 2, 1)];
  assert.throws(() => seedLevelDiffs(rows, { metric: 'livesLost', modeA: 'adaptive', modeB: 'static', styles: ['a'] }), /missing unit a\/static\/seed 2/);
  const dup = [...rows.slice(0, 2), row('a', 'static', 1, 5)];
  assert.throws(() => seedLevelDiffs(dup, { metric: 'livesLost', modeA: 'adaptive', modeB: 'static', styles: ['a'] }), /duplicate unit a\/static\/seed 1/);
});

const opts = { resamples: 20000, exactMaxN: 16, seed: 7 };

test('signFlipTest exact cases', () => {
  assert.equal(signFlipTest([1, 2, 3], opts).p, 0.25);
  assert.equal(signFlipTest([1, -1], opts).p, 1);
  assert.equal(signFlipTest([0, 0, 0], opts).p, 1);
  assert.equal(signFlipTest([], opts).p, 1);
  assert.equal(signFlipTest([2, 2, 2, 2], opts).p, 2 / 16);
  const d = [1.5, -0.5, 2, 3.25, 0.5, -1, 2.5];
  assert.equal(signFlipTest(d, opts).p, signFlipTest(d.map((x) => -x), opts).p, 'symmetric under negation');
  assert.equal(signFlipTest([1, 2, 3], opts).exact, true);
});

/** Independent exact p-value by recursion over the sign choices. */
function exactP(diffs) {
  const obs = Math.abs(diffs.reduce((a, b) => a + b, 0));
  let count = 0;
  let total = 0;
  const go = (i, sum) => {
    if (i === diffs.length) { total++; if (Math.abs(sum) >= obs - 1e-9) count++; return; }
    go(i + 1, sum + diffs[i]);
    go(i + 1, sum - diffs[i]);
  };
  go(0, 0);
  return count / total;
}

test('signFlipTest Monte Carlo agrees with the exact value, is deterministic and depends on the seed', () => {
  const d = [1.2, -0.4, 2.1, 0.8, -0.3, 1.7, 0.9, 1.1, -0.6, 1.9, 0.2, 1.4];
  const exact = exactP(d);
  assert.equal(signFlipTest(d, opts).p, exact);
  const mc = signFlipTest(d, { resamples: 50000, exactMaxN: 4, seed: 11 });
  assert.equal(mc.exact, false);
  assert.ok(Math.abs(mc.p - exact) < 0.02, `${mc.p} vs ${exact}`);
  assert.deepEqual(signFlipTest(d, { resamples: 5000, exactMaxN: 4, seed: 11 }), signFlipTest(d, { resamples: 5000, exactMaxN: 4, seed: 11 }));
  assert.notEqual(signFlipTest(d, { resamples: 5000, exactMaxN: 4, seed: 11 }).p, signFlipTest(d, { resamples: 5000, exactMaxN: 4, seed: 12 }).p);
  const twenty = Array.from({ length: 20 }, (_, i) => (i % 3 === 0 ? -0.5 : 1 + i / 20));
  const big = signFlipTest(twenty, { resamples: 4000, exactMaxN: 4, seed: 3 });
  assert.ok(big.p > 0 && big.p <= 1 && big.exact === false);
});

test('bootstrapCI: constants, containment, determinism and ordering', () => {
  assert.deepEqual(bootstrapCI([2, 2, 2, 2], { resamples: 500, alpha: 0.05, seed: 1 }), [2, 2]);
  const d = [0.5, 1.2, -0.3, 0.9, 1.8, 0.1, 0.7, 1.1, 0.4, 0.6];
  const ci = bootstrapCI(d, { resamples: 4000, alpha: 0.05, seed: 5 });
  assert.ok(ci[0] <= mean(d) && mean(d) <= ci[1]);
  assert.ok(ci[0] <= ci[1]);
  assert.deepEqual(ci, bootstrapCI(d, { resamples: 4000, alpha: 0.05, seed: 5 }));
  assert.notDeepEqual(ci, bootstrapCI(d, { resamples: 4000, alpha: 0.05, seed: 6 }));
  const wide = bootstrapCI(d, { resamples: 4000, alpha: 0.01, seed: 5 });
  assert.ok(wide[0] <= ci[0] && wide[1] >= ci[1]);
  assert.deepEqual(bootstrapCI([], { resamples: 10, alpha: 0.05, seed: 1 }), [0, 0]);
});

test('cohensDz', () => {
  near(cohensDz([1, 2, 3]), 2 / 1);
  assert.equal(cohensDz([4, 4, 4]), 0);
  assert.equal(cohensDz([]), 0);
  near(cohensDz([-1, -2, -3]), -2);
});

test('holmAdjust: example, single value, ties, cap and order', () => {
  const out = holmAdjust([0.01, 0.04, 0.03]);
  [0.03, 0.06, 0.06].forEach((v, i) => near(out[i], v));
  assert.deepEqual(holmAdjust([0.2]), [0.2]);
  assert.deepEqual(holmAdjust([]), []);
  const tie = holmAdjust([0.02, 0.02, 0.5]);
  near(tie[0], 0.06);
  near(tie[1], 0.06);
  near(tie[2], 0.5);
  assert.deepEqual(holmAdjust([0.6, 0.7]), [1, 1]);
  const mono = holmAdjust([0.5, 0.001, 0.2, 0.04]);
  assert.ok(mono.every((p) => p >= 0 && p <= 1));
});

test('wilson known values', () => {
  const [l0, u0] = wilson(0, 10);
  assert.equal(l0, 0);
  near(u0, 0.2775, 5e-4);
  const [l5, u5] = wilson(5, 10);
  near(l5, 0.2366, 5e-4);
  near(u5, 0.7634, 5e-4);
  const [l10, u10] = wilson(10, 10);
  near(l10, 0.7225, 5e-4);
  near(u10, 1, 1e-9);
  assert.deepEqual(wilson(0, 0), [0, 1]);
});

test('requiredN', () => {
  assert.equal(requiredN({ sd: 1, effect: 0.5 }), 32);
  assert.equal(requiredN({ sd: 1, effect: 0.5, power: 0.9 }), 43);
  assert.equal(requiredN({ sd: 2, effect: 1 }), 32);
  assert.throws(() => requiredN({ sd: 1, effect: 0 }), RangeError);
  assert.throws(() => requiredN({ sd: 1, effect: -1 }), RangeError);
  assert.throws(() => requiredN({ sd: 1, effect: 1, alpha: 0.01 }), RangeError);
  assert.throws(() => requiredN({ sd: 1, effect: 1, power: 0.85 }), RangeError);
});
