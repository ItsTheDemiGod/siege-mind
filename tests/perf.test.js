import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateMeter, createFrameStats } from '../src/render/perf.js';

const feed = (m, hz, seconds, startAt = 0) => {
  const n = Math.round(hz * seconds);
  for (let i = 1; i <= n; i++) m.tick(startAt + i / hz, 1);
  return startAt + n / hz;
};

test('60 events/s at 60 Hz for 5 s reads 59-61', () => {
  const m = createRateMeter();
  feed(m, 60, 5);
  assert.ok(m.rate >= 59 && m.rate <= 61, `rate ${m.rate}`);
});

test('30 Hz reads 29-31', () => {
  const m = createRateMeter();
  feed(m, 30, 5);
  assert.ok(m.rate >= 29 && m.rate <= 31, `rate ${m.rate}`);
});

test('gap then reset then 60 Hz for 1.5 s reads about 60', () => {
  const m = createRateMeter();
  const t = feed(m, 60, 2);
  m.reset();
  feed(m, 60, 1.5, t + 3);
  assert.ok(m.rate >= 58 && m.rate <= 62, `rate ${m.rate}`);
});

test('paused time inside the window lowers the rate, which is why main.js resets on resume', () => {
  const m = createRateMeter();
  const t = feed(m, 60, 2);
  m.tick(t + 0.5, 0); // half a second of nothing
  assert.ok(m.rate < 50);
});

test('a long gap with zero-count ticks decays to 0', () => {
  const m = createRateMeter();
  const t = feed(m, 60, 2);
  m.tick(t + 3, 0);
  assert.equal(m.rate, 0);
});

test('fractional dt works', () => {
  const m = createRateMeter();
  let t = 0;
  for (let i = 0; i < 400; i++) { t += 0.0125; m.tick(t, 1); } // 80 Hz
  assert.ok(Math.abs(m.rate - 80) <= 2, `rate ${m.rate}`);
});

test('empty meter reads 0', () => {
  assert.equal(createRateMeter().rate, 0);
});

test('frame stats: constant 16.67 ms', () => {
  const s = createFrameStats();
  for (let i = 0; i < 300; i++) s.push(1000 / 60);
  s.refresh();
  assert.ok(Math.abs(s.fps - 60) < 0.1);
  assert.ok(Math.abs(s.p95Ms - 16.67) < 0.05);
  assert.ok(Math.abs(s.avgMs - 16.67) < 0.05);
});

test('frame stats: spikes show in max and p95', () => {
  const s = createFrameStats();
  for (let i = 0; i < 270; i++) s.push(16);
  for (let i = 0; i < 30; i++) s.push(100);
  s.refresh();
  assert.equal(s.maxMs, 100);
  assert.equal(s.p95Ms, 100); // 10% of frames are slow, so the 95th percentile is a spike
  const t = createFrameStats();
  for (let i = 0; i < 299; i++) t.push(16);
  t.push(100);
  t.refresh();
  assert.equal(t.maxMs, 100);
  assert.equal(t.p95Ms, 16); // a single spike is not p95
});

test('frame stats: ring forgets old frames; empty stats are 0 not NaN', () => {
  const e = createFrameStats();
  assert.deepEqual([e.avgMs, e.p95Ms, e.maxMs, e.fps], [0, 0, 0, 0]);
  const s = createFrameStats({ capacity: 10 });
  for (let i = 0; i < 10; i++) s.push(100);
  for (let i = 0; i < 10; i++) s.push(10);
  assert.ok(Math.abs(s.avgMs - 10) < 1e-4);
  assert.equal(s.maxMs, 10);
});
