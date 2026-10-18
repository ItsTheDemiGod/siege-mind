import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFit } from '../src/render/fit.js';

const fit = (w, h, dpr = 1, max = 2) => computeFit(w, h, 1280, 720, dpr, max);

test('wide window is limited by height (pillarbox)', () => {
  const f = fit(2000, 720);
  assert.equal(f.cssHeight, 720);
  assert.equal(f.cssWidth, 1280);
});

test('tall window is limited by width (letterbox)', () => {
  const f = fit(640, 2000);
  assert.equal(f.cssWidth, 640);
  assert.equal(f.cssHeight, 360);
});

test('exact 16:9 window fills it', () => {
  const f = fit(1920, 1080);
  assert.equal(f.cssWidth, 1920);
  assert.equal(f.cssHeight, 1080);
  assert.equal(f.scale, 1.5);
});

test('dpr is clamped to maxDpr and to a minimum of 1', () => {
  assert.equal(fit(1280, 720, 3).dpr, 2);
  assert.equal(fit(1280, 720, 0.5).dpr, 1);
  assert.equal(fit(1280, 720, 1.5).dpr, 1.5);
});

test('backing size is round(css * dpr) and aspect is preserved', () => {
  const f = fit(1001, 777, 1.25);
  assert.equal(f.backingWidth, Math.round(f.cssWidth * 1.25));
  assert.equal(f.backingHeight, Math.round(f.cssHeight * 1.25));
  assert.ok(Math.abs(f.backingWidth / f.backingHeight - 16 / 9) < 0.01);
  assert.ok(Math.abs(f.cssWidth / f.cssHeight - 16 / 9) < 1e-9);
});

test('pixel budget reduces dpr for huge windows but never below 1', () => {
  const budget = 3686400;
  const big = computeFit(1920, 1080, 1280, 720, 2, 2, budget);
  assert.ok(big.dpr < 2 && big.dpr >= 1);
  assert.ok(big.cssWidth * big.cssHeight * big.dpr * big.dpr <= budget * 1.0001);
  const normal = computeFit(1280, 720, 1280, 720, 2, 2, budget);
  assert.equal(normal.dpr, 2);
  const tiny = computeFit(7680, 4320, 1280, 720, 1, 2, budget);
  assert.equal(tiny.dpr, 1);
});

test('cssScale is the CSS-only scale', () => {
  const f = computeFit(1920, 1080, 1280, 720, 2, 2);
  assert.equal(f.cssScale, 1.5);
  assert.equal(f.scale, 3);
});
