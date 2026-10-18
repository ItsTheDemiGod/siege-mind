import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../src/render/tween.js';

const EASINGS = ['linear', 'easeInQuad', 'easeOutQuad', 'easeInOutQuad', 'easeOutCubic', 'easeInOutCubic', 'easeOutBack', 'easeOutExpo'];

test('each easing maps 0 to 0 and 1 to 1 and clamps out-of-range t', () => {
  for (const name of EASINGS) {
    const f = T[name];
    assert.ok(Math.abs(f(0)) < 1e-12, `${name}(0)`);
    assert.ok(Math.abs(f(1) - 1) < 1e-12, `${name}(1)`);
    assert.equal(f(-5), f(0));
    assert.equal(f(7), f(1));
  }
});

test('monotonic easings never decrease', () => {
  for (const name of EASINGS.filter((n) => n !== 'easeOutBack')) {
    let prev = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const v = T[name](i / 100);
      assert.ok(v >= prev - 1e-12, `${name} at ${i}`);
      prev = v;
    }
  }
});

test('easeOutBack overshoots then settles on 1', () => {
  assert.ok(T.easeOutBack(0.7) > 1);
  assert.equal(T.easeOutBack(1), 1);
});

test('lerp, clamp01, smoothstep', () => {
  assert.equal(T.lerp(10, 20, 0.5), 15);
  assert.equal(T.clamp01(2), 1);
  assert.equal(T.smoothstep(0, 1, -1), 0);
  assert.equal(T.smoothstep(0, 1, 2), 1);
  assert.equal(T.smoothstep(0, 1, 0.5), 0.5);
});

test('tweens reach the target exactly and stop', () => {
  const tw = T.createTweens(4);
  const o = { x: 0 };
  tw.start(o, 'x', 10, 1);
  tw.update(0.5);
  assert.ok(o.x > 0 && o.x < 10);
  tw.update(0.6);
  assert.equal(o.x, 10);
  assert.equal(tw.activeCount, 0);
  tw.update(1);
  assert.equal(o.x, 10);
});

test('delay is honored', () => {
  const tw = T.createTweens(4);
  const o = { x: 0 };
  tw.start(o, 'x', 10, 1, T.linear, 0.5);
  tw.update(0.4);
  assert.equal(o.x, 0);
  tw.update(0.6); // 0.5 s past the delay
  assert.ok(Math.abs(o.x - 5) < 1e-9, `x ${o.x}`);
});

test('cancel stops a target', () => {
  const tw = T.createTweens(4);
  const o = { x: 0 };
  tw.start(o, 'x', 10, 1);
  tw.cancel(o);
  tw.update(2);
  assert.equal(o.x, 0);
  assert.equal(tw.activeCount, 0);
});

test('full pool returns -1 and slots are reused afterwards', () => {
  const tw = T.createTweens(2);
  const a = { v: 0 }, b = { v: 0 }, c = { v: 0 };
  assert.ok(tw.start(a, 'v', 1, 1) >= 0);
  assert.ok(tw.start(b, 'v', 1, 1) >= 0);
  assert.equal(tw.start(c, 'v', 1, 1), -1);
  tw.update(2);
  assert.ok(tw.start(c, 'v', 1, 1) >= 0);
  assert.equal(tw.activeCount, 1);
});

test('dt = 0 changes nothing; onDone fires once', () => {
  const tw = T.createTweens(2);
  const o = { x: 0 };
  let done = 0;
  tw.start(o, 'x', 5, 1, T.linear, 0, () => done++);
  tw.update(0);
  assert.equal(o.x, 0);
  tw.update(1);
  tw.update(1);
  assert.equal(done, 1);
});
