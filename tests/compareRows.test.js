import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffColumns, summarizeDiff } from '../experiments/compareRows.js';

const row = (style, mode, seed, extra = {}) => ({ style, mode, seed, livesLost: 5, won: 1, livesLostByWave: [0, 1, null], tilt_swarmling: 1, ...extra });
const set = () => [row('a', 'static', 1), row('a', 'adaptive', 1), row('b', 'static', 2)];

test('identical rows have no differences', () => {
  assert.deepEqual(diffColumns(set(), set()), []);
  assert.deepEqual(summarizeDiff([]), { count: 0, units: 0, byColumn: {} });
});

test('a single differing cell is reported with both values', () => {
  const b = set();
  b[1] = { ...b[1], livesLost: 9 };
  assert.deepEqual(diffColumns(set(), b), [{ unit: 'a/adaptive/1', column: 'livesLost', a: 5, b: 9 }]);
});

test('arrays are compared by value and extra columns count as differences', () => {
  const b = set();
  b[0] = { ...b[0], livesLostByWave: [0, 1, null] };
  assert.deepEqual(diffColumns(set(), b), []);
  b[0] = { ...b[0], livesLostByWave: [0, 2, null] };
  assert.equal(diffColumns(set(), b)[0].column, 'livesLostByWave');
  const c = set();
  c[2] = { ...c[2], tiltObserved: 1 };
  assert.deepEqual(diffColumns(set(), c).map((d) => [d.column, d.a, d.b]), [['tiltObserved', undefined, 1]]);
});

test('the ignore list removes columns from the comparison', () => {
  const b = set().map((r) => ({ ...r, tilt_swarmling: 2, tiltObserved: 1 }));
  assert.equal(diffColumns(set(), b, { ignore: ['tilt_swarmling', 'tiltObserved'] }).length, 0);
  const s = summarizeDiff(diffColumns(set(), b));
  assert.deepEqual([s.count, s.units, s.byColumn], [6, 3, { tilt_swarmling: 3, tiltObserved: 3 }]);
});

test('row order does not matter; missing and duplicate units throw', () => {
  assert.deepEqual(diffColumns(set(), [...set()].reverse()), []);
  assert.throws(() => diffColumns(set(), set().slice(0, 2)), /unit b\/static\/2 is missing in B/);
  assert.throws(() => diffColumns(set().slice(0, 2), set()), /missing in A/);
  assert.throws(() => diffColumns([...set(), row('a', 'static', 1)], set()), /duplicate unit a\/static\/1 in A/);
  assert.throws(() => diffColumns(set(), [...set(), row('b', 'static', 2)]), /duplicate unit b\/static\/2 in B/);
});
