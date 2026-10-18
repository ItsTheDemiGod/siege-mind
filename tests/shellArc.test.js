import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shellArc } from '../src/render/shellArc.js';
import { config } from '../src/data/config.js';

const o = () => ({ lift: 0, scale: 0, shadowScale: 0 });
const near = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('endpoints are on the ground at normal size', () => {
  for (const p of [0, 1]) {
    const r = shellArc(p, 56, o());
    near(r.lift, 0); near(r.scale, 1); near(r.shadowScale, 1);
  }
});

test('peak at 0.5 equals the arc height; scale grows and shadow shrinks by the configured amounts', () => {
  const r = shellArc(0.5, 56, o());
  near(r.lift, 56);
  near(r.scale, 1 + config.fx.shellScaleGain);
  near(r.shadowScale, 1 - config.fx.shellShadowShrink);
});

test('symmetric about 0.5', () => {
  for (const p of [0.1, 0.25, 0.4]) {
    const a = shellArc(p, 56, o());
    const b = shellArc(1 - p, 56, o());
    near(a.lift, b.lift); near(a.scale, b.scale); near(a.shadowScale, b.shadowScale);
  }
});

test('progress is clamped and out is reused', () => {
  assert.deepEqual(shellArc(-3, 56, o()), shellArc(0, 56, o()));
  assert.deepEqual(shellArc(7, 56, o()), shellArc(1, 56, o()));
  const out = o();
  assert.equal(shellArc(0.3, 10, out), out);
});
