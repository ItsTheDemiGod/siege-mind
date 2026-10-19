import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSamples, soundVerdict, DEFAULT_LIMITS } from '../src/audio/analysis.js';

const RATE = 1000;
const sine = (amp, n = 1000, freq = 10) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin(2 * Math.PI * freq * i / RATE));
const close = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('a sine of known peak has rms peak/sqrt(2), no clipping, no DC and a short lead-in', () => {
  const a = analyzeSamples(sine(0.5), RATE);
  close(a.peak, 0.5);
  close(a.rms, 0.5 / Math.SQRT2);
  close(a.dcOffset, 0, 1e-6);
  assert.equal(a.clippedSamples, 0);
  assert.equal(a.durationMs, 1000);
  assert.ok(a.leadingSilenceMs <= 10);
  assert.deepEqual(soundVerdict(a), { ok: true, problems: [] });
});

test('a clipped square wave has peak 1, rms 1 and every sample clipped', () => {
  const sq = Float32Array.from({ length: 100 }, (_, i) => (i % 2 ? 1 : -1));
  const a = analyzeSamples(sq, RATE);
  assert.equal(a.peak, 1);
  assert.equal(a.rms, 1);
  assert.equal(a.clippedSamples, 100);
  assert.deepEqual(soundVerdict(a).problems, ['peak too high']);
});

test('silence is flagged as too quiet and as all leading silence', () => {
  const a = analyzeSamples(new Float32Array(500), RATE);
  assert.equal(a.peak, 0);
  assert.equal(a.rms, 0);
  assert.equal(a.leadingSilenceMs, 500);
  assert.deepEqual(soundVerdict(a).problems, ['too quiet', 'leading silence']);
  assert.equal(analyzeSamples([], RATE).rms, 0);
});

test('a DC offset is the mean and is flagged above the limit', () => {
  const dc = Float32Array.from({ length: 200 }, () => 0.25);
  const a = analyzeSamples(dc, RATE);
  close(a.dcOffset, 0.25);
  close(a.rms, 0.25);
  assert.deepEqual(soundVerdict(a).problems, ['DC offset']);
  assert.equal(soundVerdict(a, { ...DEFAULT_LIMITS, maxDc: 0.3 }).ok, true);
});

test('leading silence is the time before the first sample above the silence level', () => {
  const s = new Float32Array(300);
  for (let i = 100; i < 300; i++) s[i] = 0.4 * Math.sin(i);
  const a = analyzeSamples(s, RATE);
  assert.ok(a.leadingSilenceMs >= 100 && a.leadingSilenceMs <= 102);
  assert.ok(soundVerdict(a).problems.includes('leading silence'));
  assert.equal(soundVerdict(a, { ...DEFAULT_LIMITS, maxLeadingSilenceMs: 150 }).ok, true);
});
