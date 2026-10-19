import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coreIntegrity } from '../src/ui/coreIntegrity.js';
import { config } from '../src/data/config.js';

const fx = config.fx;

test('lives 0..20 of 20 are monotone in fraction and segments', () => {
  let prevSeg = -1;
  let prevFrac = -1;
  for (let lives = 0; lives <= 20; lives++) {
    const c = coreIntegrity(lives, 20, fx);
    assert.ok(c.segments >= prevSeg && c.fraction >= prevFrac, `lives ${lives}`);
    assert.ok(c.segments >= 0 && c.segments <= fx.coreSegments);
    prevSeg = c.segments; prevFrac = c.fraction;
  }
  assert.equal(coreIntegrity(20, 20, fx).segments, fx.coreSegments);
  assert.equal(coreIntegrity(0, 20, fx).segments, 0);
});

test('one life is never zero segments', () => {
  for (const max of [1, 5, 20, 100, 1000]) assert.ok(coreIntegrity(1, max, fx).segments >= 1, `max ${max}`);
});

test('state boundaries on both thresholds', () => {
  const st = (lives, max) => coreIntegrity(lives, max, fx).state;
  assert.equal(st(0, 20), 'destroyed');
  assert.equal(st(20, 20), 'healthy');
  // damaged below 0.67: 13.4 lives of 20
  assert.equal(st(14, 20), 'healthy');
  assert.equal(st(13, 20), 'damaged');
  // critical below 0.34: 6.8 lives of 20
  assert.equal(st(7, 20), 'damaged');
  assert.equal(st(6, 20), 'critical');
  assert.equal(st(1, 20), 'critical');
  // exactly on a threshold is not below it
  assert.equal(coreIntegrity(67, 100, fx).state, 'healthy');
  assert.equal(coreIntegrity(34, 100, fx).state, 'damaged');
  assert.equal(coreIntegrity(33, 100, fx).state, 'critical');
});

test('lives above max are clamped; invalid input throws', () => {
  assert.equal(coreIntegrity(25, 20, fx).fraction, 1);
  for (const [l, m] of [[NaN, 20], [-1, 20], [5, 0], [5, -3], [5, NaN], ['5', 20], [Infinity, 20]]) assert.throws(() => coreIntegrity(l, m, fx), RangeError, `${l}/${m}`);
});
