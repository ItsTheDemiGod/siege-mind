import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calibrationGrid, chooseKnobs, chooseWithDrop, selectKnobs, qualifyingStages, runCalibration, CONSTRAINTS, DROP_RULE } from '../experiments/calibrate.js';
import { PROTOCOL } from '../experiments/protocol.js';

const styleRates = (v) => Object.fromEntries(PROTOCOL.styles.map((s) => [s, v]));
const res = (tilePool, upgradeAfter, mean, perStyle = null) => ({ knobs: { tilePool, focusWeight: PROTOCOL.botKnobs.focusWeight, upgradeAfter }, perStyleWinRate: perStyle ?? styleRates(mean), meanWinRate: mean });
const some = PROTOCOL.styles[1]; // any non-balancedR style
const mean = (o) => Object.values(o).reduce((a, b) => a + b, 0) / Object.values(o).length;

test('grid: nine combinations, tilePool {1,3,6} x upgradeAfter {4,6,8}, fixed focusWeight, stable order', () => {
  const g = calibrationGrid();
  assert.equal(g.length, 9);
  assert.deepEqual(g.map((k) => [k.tilePool, k.upgradeAfter]), [[1, 4], [1, 6], [1, 8], [3, 4], [3, 6], [3, 8], [6, 4], [6, 6], [6, 8]]);
  assert.ok(g.every((k) => k.focusWeight === PROTOCOL.botKnobs.focusWeight));
  assert.deepEqual(calibrationGrid(), g);
});

test('chooseKnobs: qualifying, none qualifying, closest to the target', () => {
  const c = CONSTRAINTS;
  const a = res(3, 6, 0.6);
  const b = res(3, 4, 0.72);
  const far = res(1, 6, 0.95);
  assert.equal(chooseKnobs([a, b, far], c), b);
  assert.equal(chooseKnobs([far, res(6, 6, 0.3)], c), null);
  assert.equal(chooseKnobs([], c), null);
  const weakStyle = res(6, 6, 0.7, { ...styleRates(0.8), [some]: 0.1 });
  assert.equal(chooseKnobs([weakStyle], c), null);
  assert.equal(chooseKnobs([weakStyle, a], c), a);
});

test('chooseKnobs boundaries are inclusive (meanMin, meanMax, perStyleMin)', () => {
  const c = CONSTRAINTS;
  assert.ok(chooseKnobs([res(3, 6, c.meanMin)], c));
  assert.ok(chooseKnobs([res(3, 6, c.meanMax)], c));
  assert.equal(chooseKnobs([res(3, 6, c.meanMin - 0.001)], c), null);
  assert.equal(chooseKnobs([res(3, 6, c.meanMax + 0.001)], c), null);
  assert.ok(chooseKnobs([res(3, 6, 0.7, { ...styleRates(0.7), [some]: c.perStyleMin })], c));
  assert.equal(chooseKnobs([res(3, 6, 0.7, { ...styleRates(0.7), [some]: c.perStyleMin - 0.01 })], c), null);
});

test('chooseKnobs tie-breaks, in both input orders: larger tilePool, then smaller upgradeAfter', () => {
  const c = CONSTRAINTS;
  const m = 0.6;
  for (const list of [[res(1, 6, m), res(6, 8, m), res(3, 4, m)], [res(3, 4, m), res(6, 8, m), res(1, 6, m)]]) assert.equal(chooseKnobs(list, c).knobs.tilePool, 6);
  for (const list of [[res(3, 8, m), res(3, 4, m), res(3, 6, m)], [res(3, 6, m), res(3, 4, m), res(3, 8, m)]]) assert.equal(chooseKnobs(list, c).knobs.upgradeAfter, 4);
  assert.equal(chooseKnobs([res(3, 6, 0.8), res(6, 6, 0.6)], c).knobs.tilePool, 6, 'symmetric distance from the target');
});

test('chooseWithDrop: drops weak styles, recomputes the mean, never drops balancedR, needs minStyles', () => {
  const c = CONSTRAINTS;
  const rates = (o) => ({ ...styleRates(0.7), ...o });
  const dropOne = rates({ [PROTOCOL.styles[2]]: 0 });
  const r = res(6, 4, mean(dropOne), dropOne);
  assert.equal(chooseKnobs([r], c), null, 'stage 1 rejects it');
  const out = chooseWithDrop([r], c, DROP_RULE);
  assert.deepEqual(out.droppedStyles, [PROTOCOL.styles[2]]);
  assert.equal(out.keptStyles.length, PROTOCOL.styles.length - 1);
  assert.ok(Math.abs(out.meanWinRate - 0.7) < 1e-12, 'mean over the kept styles');
  assert.equal(r.meanWinRate, mean(dropOne), 'input untouched');
  assert.equal(chooseWithDrop([res(6, 4, 0.7, rates({ balancedR: 0.05 }))], c, DROP_RULE), null, 'balancedR cannot be dropped');
  const manyDropped = rates({ [PROTOCOL.styles[1]]: 0, [PROTOCOL.styles[2]]: 0, [PROTOCOL.styles[3]]: 0 });
  assert.equal(chooseWithDrop([res(6, 4, 0.7, manyDropped)], c, DROP_RULE), null, 'fewer than minStyles remain');
  const lowAfter = rates({ [PROTOCOL.styles[2]]: 0, [PROTOCOL.styles[1]]: 0.3, [PROTOCOL.styles[3]]: 0.3, balancedR: 0.3, [PROTOCOL.styles[4]]: 0.3 });
  assert.equal(chooseWithDrop([res(6, 4, 0.3, lowAfter)], c, DROP_RULE), null, 'recomputed mean below meanMin');
  const m = rates({ [PROTOCOL.styles[2]]: 0 });
  const both = [res(1, 6, 0.7, m), res(6, 8, 0.7, m), res(6, 4, 0.7, m)];
  for (const list of [both, [...both].reverse()]) assert.deepEqual(chooseWithDrop(list, c, DROP_RULE).knobs, { tilePool: 6, focusWeight: PROTOCOL.botKnobs.focusWeight, upgradeAfter: 4 });
  assert.equal(chooseWithDrop([res(6, 4, 0.7, rates({ [some]: 0.1 }))], c, DROP_RULE).droppedStyles.length, 0, 'exactly dropBelow is kept');
});

test('selectKnobs: stage 1, then 2, then 3, otherwise null; qualifyingStages agrees', () => {
  const rates = (o) => ({ ...styleRates(0.7), ...o });
  const s1 = res(3, 6, 0.7);
  const s2 = res(3, 4, 0.7, rates({ [some]: 0.1 }));
  const s3 = res(6, 4, 0.7, rates({ [PROTOCOL.styles[2]]: 0 }));
  assert.equal(selectKnobs([s3, s2, s1]).stage, 1);
  assert.equal(selectKnobs([s3, s2]).stage, 2);
  const three = selectKnobs([s3]);
  assert.deepEqual([three.stage, three.droppedStyles], [3, [PROTOCOL.styles[2]]]);
  assert.deepEqual(selectKnobs([res(1, 4, 0.2)]), { stage: null, chosen: null, droppedStyles: [] });
  assert.deepEqual([qualifyingStages(s1), qualifyingStages(s2), qualifyingStages(s3)], [[1, 2, 3], [2, 3], [3]]);
});

test('selection functions do not mutate their inputs', () => {
  const list = [res(3, 6, 0.6), res(6, 4, 0.7, { ...styleRates(0.7), [some]: 0 })];
  const before = JSON.stringify(list);
  const c = { ...CONSTRAINTS };
  chooseKnobs(list, c);
  chooseWithDrop(list, c, DROP_RULE);
  selectKnobs(list);
  qualifyingStages(list[0]);
  assert.equal(JSON.stringify(list), before);
  assert.deepEqual(c, { ...CONSTRAINTS });
});

test('runCalibration plays static mode only', () => {
  const modes = [];
  const out = runCalibration({
    combos: [{ tilePool: 3, focusWeight: 0.4, upgradeAfter: 6 }],
    playGameFn: (o) => { modes.push(o.mode); return { result: o.seed % 2 ? 'won' : 'lost', lives: 10 }; },
  });
  assert.equal(modes.length, 10 * PROTOCOL.styles.length);
  assert.ok(modes.every((m) => m === 'static'));
  assert.equal(out[0].meanWinRate, 0.5);
  assert.equal(out[0].meanLivesLost, 10);
});
