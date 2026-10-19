import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calibrationGrid, chooseKnobs, runCalibration, CONSTRAINTS } from '../experiments/calibrate.js';
import { PROTOCOL } from '../experiments/protocol.js';

const styleRates = (v) => Object.fromEntries(PROTOCOL.styles.map((s) => [s, v]));
const res = (tilePool, focusWeight, upgradeAfter, mean, perStyle = null) => ({ knobs: { tilePool, focusWeight, upgradeAfter }, perStyleWinRate: perStyle ?? styleRates(mean), meanWinRate: mean });

test('grid sizes and contents', () => {
  const g1 = calibrationGrid(1);
  const g2 = calibrationGrid(2);
  assert.equal(g1.length, 9);
  assert.equal(g2.length, 18);
  assert.ok(g1.every((k) => k.upgradeAfter === 6));
  assert.deepEqual([...new Set(g1.map((k) => k.tilePool))], [1, 3, 6]);
  assert.deepEqual([...new Set(g1.map((k) => k.focusWeight))], [0.3, 0.4, 0.5]);
  assert.deepEqual([...new Set(g2.map((k) => k.upgradeAfter))], [4, 8]);
  const keys = [...g1, ...g2].map((k) => JSON.stringify(k));
  assert.equal(new Set(keys).size, 27);
  assert.throws(() => calibrationGrid(3), RangeError);
});

test('chooseKnobs: qualifying, none qualifying, closest to the target', () => {
  const c = CONSTRAINTS;
  const a = res(3, 0.4, 6, 0.6);
  const b = res(3, 0.3, 6, 0.72);
  const far = res(1, 0.5, 6, 0.95);
  assert.equal(chooseKnobs([a, b, far], c), b);
  assert.equal(chooseKnobs([far, res(6, 0.3, 6, 0.3)], c), null);
  assert.equal(chooseKnobs([], c), null);
  const weakStyle = res(6, 0.3, 6, 0.7, { ...styleRates(0.8), lanceHeavy: 0.1 });
  assert.equal(chooseKnobs([weakStyle], c), null);
  assert.equal(chooseKnobs([weakStyle, a], c), a);
});

test('chooseKnobs boundaries are inclusive', () => {
  const c = CONSTRAINTS;
  assert.ok(chooseKnobs([res(3, 0.4, 6, c.meanMin)], c));
  assert.ok(chooseKnobs([res(3, 0.4, 6, c.meanMax)], c));
  assert.equal(chooseKnobs([res(3, 0.4, 6, c.meanMin - 0.001)], c), null);
  assert.equal(chooseKnobs([res(3, 0.4, 6, c.meanMax + 0.001)], c), null);
  const edge = res(3, 0.4, 6, 0.7, { ...styleRates(0.7), sniperHeavy: c.perStyleMin });
  assert.ok(chooseKnobs([edge], c));
  assert.equal(chooseKnobs([res(3, 0.4, 6, 0.7, { ...styleRates(0.7), sniperHeavy: c.perStyleMin - 0.01 })], c), null);
});

test('chooseKnobs tie-breaks: larger tilePool, then smaller focusWeight, then smaller upgradeAfter', () => {
  const c = CONSTRAINTS;
  const m = 0.6; // the same distance from the target for all of them
  assert.deepEqual(chooseKnobs([res(1, 0.3, 6, m), res(6, 0.5, 8, m), res(3, 0.3, 4, m)], c).knobs, { tilePool: 6, focusWeight: 0.5, upgradeAfter: 8 });
  assert.deepEqual(chooseKnobs([res(3, 0.5, 6, m), res(3, 0.3, 8, m), res(3, 0.4, 4, m)], c).knobs, { tilePool: 3, focusWeight: 0.3, upgradeAfter: 8 });
  assert.deepEqual(chooseKnobs([res(3, 0.3, 8, m), res(3, 0.3, 4, m), res(3, 0.3, 6, m)], c).knobs, { tilePool: 3, focusWeight: 0.3, upgradeAfter: 4 });
  // symmetric distance: 0.6 and 0.8 are both 0.1 from 0.7
  assert.equal(chooseKnobs([res(3, 0.4, 6, 0.8), res(6, 0.4, 6, 0.6)], c).knobs.tilePool, 6);
});

test('chooseKnobs does not mutate its inputs', () => {
  const list = [res(3, 0.4, 6, 0.6), res(6, 0.3, 6, 0.7)];
  const before = JSON.stringify(list);
  chooseKnobs(list, CONSTRAINTS);
  assert.equal(JSON.stringify(list), before);
  const c = { ...CONSTRAINTS };
  chooseKnobs(list, c);
  assert.deepEqual(c, { ...CONSTRAINTS });
});

test('runCalibration plays static mode only', () => {
  const modes = [];
  const out = runCalibration({
    combos: [{ tilePool: 3, focusWeight: 0.4, upgradeAfter: 6 }],
    playGameFn: (o) => { modes.push(o.mode); return { result: o.seed % 2 ? 'won' : 'lost', lives: 10 }; },
  });
  assert.equal(modes.length, 10 * 5);
  assert.ok(modes.every((m) => m === 'static'));
  assert.equal(out[0].meanWinRate, 0.5);
  assert.equal(out[0].meanLivesLost, 10);
});
