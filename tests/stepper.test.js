import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStepper } from '../src/sim/stepper.js';
import { config } from '../src/data/config.js';

const DT = 1 / 60;

test('1/60 s frame at speed 1 gives exactly 1 step; 1/30 s gives 2', () => {
  assert.equal(createStepper().advance(DT, 1, false), 1);
  assert.equal(createStepper().advance(1 / 30, 1, false), 2);
});

test('speeds 1, 2, 3 give 60, 120, 180 steps over one second of 1/60 s frames', () => {
  for (const speed of config.sim.speeds) {
    const s = createStepper();
    let total = 0;
    for (let i = 0; i < 60; i++) total += s.advance(DT, speed, false);
    assert.equal(total, 60 * speed, `speed ${speed}`);
  }
});

test('irregular frame times accumulate without drift', () => {
  const s = createStepper();
  const pattern = [0.007, 0.016, 0.021, 0.0125, 0.0333, 0.009];
  let t = 0;
  let steps = 0;
  for (let i = 0; t < 10; i++) {
    const dt = pattern[i % pattern.length];
    t += dt;
    steps += s.advance(dt, 1, false);
  }
  assert.ok(Math.abs(steps - t * 60) <= 1, `steps ${steps} vs ${t * 60}`);
});

test('a huge dt is clamped to maxFrameSeconds', () => {
  const s = createStepper({ maxStepsPerFrame: 1000 });
  assert.equal(s.advance(100, 1, false), Math.round(config.sim.maxFrameSeconds * 60));
});

test('maxStepsPerFrame caps steps and discards the leftover', () => {
  const s = createStepper({ maxStepsPerFrame: 5 });
  assert.equal(s.advance(0.25, 1, false), 5);
  assert.equal(s.advance(0, 1, false), 0); // leftover was dropped
  assert.equal(s.alpha, 0);
});

test('paused returns 0 and keeps alpha frozen', () => {
  const s = createStepper();
  s.advance(DT * 1.5, 1, false);
  const a = s.alpha;
  assert.ok(a > 0);
  assert.equal(s.advance(1, 1, true), 0);
  assert.equal(s.alpha, a);
  // paused time must not be banked
  assert.equal(s.advance(0, 1, false), 0);
});

test('requestSingleStep gives 1 step with alpha 1 while paused, ignored when running', () => {
  const s = createStepper();
  s.requestSingleStep();
  assert.equal(s.advance(DT, 1, true), 1);
  assert.equal(s.alpha, 1);
  assert.equal(s.advance(DT, 1, true), 0);

  const r = createStepper();
  r.requestSingleStep();
  assert.equal(r.advance(0, 1, false), 0);
  assert.equal(r.advance(0, 1, true), 0); // the stale request was discarded
});

test('alpha is always in [0,1) during normal running', () => {
  const s = createStepper();
  for (let i = 0; i < 5000; i++) {
    s.advance(0.001 + (i % 17) * 0.0023, 1 + (i % 3), false);
    assert.ok(s.alpha >= 0 && s.alpha < 1, `alpha ${s.alpha}`);
  }
});

test('reset clears state', () => {
  const s = createStepper();
  s.advance(DT * 1.5, 1, false);
  s.reset();
  assert.equal(s.alpha, 0);
});
