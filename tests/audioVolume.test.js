import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveGain, gainsFor, clampVolume } from '../src/audio/volume.js';
import { audioConfig as cfg } from '../src/audio/audioConfig.js';

test('muted gives 0 and the taper is master^2 * sfx^2 * masterGain', () => {
  assert.equal(effectiveGain({ muted: true, masterVolume: 1, sfxVolume: 1 }), 0);
  assert.deepEqual(gainsFor({ muted: true, masterVolume: 1, sfxVolume: 1 }), { master: 0, sfx: 0 });
  assert.ok(Math.abs(effectiveGain({ muted: false, masterVolume: 0.5, sfxVolume: 0.5 }) - cfg.masterGain * 0.25 * 0.25) < 1e-12);
  assert.ok(Math.abs(effectiveGain({ muted: false, masterVolume: 1, sfxVolume: 1 }) - cfg.masterGain) < 1e-12);
  assert.equal(effectiveGain({ muted: false, masterVolume: 0, sfxVolume: 1 }), 0);
  const g = gainsFor({ muted: false, masterVolume: 0.6, sfxVolume: 0.8 });
  assert.ok(Math.abs(g.master - cfg.masterGain * 0.36) < 1e-12 && Math.abs(g.sfx - 0.64) < 1e-12);
});

test('the taper is monotonic in both sliders', () => {
  let prev = -1;
  for (let i = 0; i <= 20; i++) {
    const v = effectiveGain({ muted: false, masterVolume: i / 20, sfxVolume: 0.8 });
    assert.ok(v >= prev);
    prev = v;
  }
  prev = -1;
  for (let i = 0; i <= 20; i++) { const v = effectiveGain({ muted: false, masterVolume: 0.6, sfxVolume: i / 20 }); assert.ok(v >= prev); prev = v; }
});

test('inputs are clamped and NaN falls back to the default', () => {
  assert.equal(clampVolume(2), 1);
  assert.equal(clampVolume(-3), 0);
  assert.equal(clampVolume(0.25), 0.25);
  assert.equal(clampVolume(NaN, 0.5), 0.5);
  assert.equal(clampVolume('x', 0.7), 0.7);
  assert.equal(clampVolume(undefined), 0);
  assert.equal(effectiveGain({ muted: false, masterVolume: 5, sfxVolume: 5 }), cfg.masterGain);
  const def = effectiveGain({ muted: false, masterVolume: cfg.defaults.masterVolume, sfxVolume: cfg.defaults.sfxVolume });
  assert.equal(effectiveGain({ muted: false, masterVolume: NaN, sfxVolume: NaN }), def);
  assert.equal(effectiveGain({}), def);
  assert.equal(effectiveGain(null), def);
});
