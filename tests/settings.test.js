import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSettings } from '../src/ui/settings.js';

const fakeStorage = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), data };
};

test('defaults', () => {
  assert.deepEqual(createSettings().getAll(), {
    quality: 'high', autoQuality: true, screenShake: true, reducedMotion: false, particleDensity: 1,
  });
});

test('set/get and clamping of particleDensity', () => {
  const s = createSettings({ storage: fakeStorage() });
  s.set('quality', 'low');
  assert.equal(s.get('quality'), 'low');
  s.set('particleDensity', 5);
  assert.equal(s.get('particleDensity'), 1);
  s.set('particleDensity', 0);
  assert.equal(s.get('particleDensity'), 0.25);
  s.set('particleDensity', 0.6);
  assert.equal(s.get('particleDensity'), 0.6);
});

test('invalid values and unknown keys are ignored', () => {
  const s = createSettings();
  s.set('quality', 'ultra');
  s.set('screenShake', 'yes');
  s.set('particleDensity', NaN);
  s.set('nope', 1);
  assert.equal(s.get('quality'), 'high');
  assert.equal(s.get('screenShake'), true);
  assert.equal(s.get('particleDensity'), 1);
  assert.equal(s.get('nope'), undefined);
});

test('persistence round trip across two instances', () => {
  const st = fakeStorage();
  const a = createSettings({ storage: st });
  a.set('quality', 'medium');
  a.set('screenShake', false);
  assert.ok(st.data.has('siegeMind.settings.v1'));
  const b = createSettings({ storage: st });
  assert.equal(b.get('quality'), 'medium');
  assert.equal(b.get('screenShake'), false);
});

test('corrupt JSON and throwing storage fall back to defaults', () => {
  const st = fakeStorage();
  st.data.set('siegeMind.settings.v1', '{not json');
  assert.equal(createSettings({ storage: st }).get('quality'), 'high');
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const s = createSettings({ storage: bad });
  assert.equal(s.get('quality'), 'high');
  assert.doesNotThrow(() => s.set('quality', 'low'));
  assert.equal(s.get('quality'), 'low');
});

test('saved garbage values are discarded per key', () => {
  const st = fakeStorage();
  st.data.set('siegeMind.settings.v1', JSON.stringify({ quality: 'ultra', screenShake: false, particleDensity: 'x' }));
  const s = createSettings({ storage: st });
  assert.equal(s.get('quality'), 'high');
  assert.equal(s.get('screenShake'), false);
  assert.equal(s.get('particleDensity'), 1);
});

test('subscribers fire once per change, not on no-op sets', () => {
  const s = createSettings();
  const seen = [];
  const off = s.subscribe((k, v) => seen.push([k, v]));
  s.set('quality', 'low');
  s.set('quality', 'low');
  s.set('quality', 'bogus');
  off();
  s.set('quality', 'medium');
  assert.deepEqual(seen, [['quality', 'low']]);
});

test('reducedMotion default follows the injected preference; reset restores defaults', () => {
  const s = createSettings({ prefersReducedMotion: true });
  assert.equal(s.get('reducedMotion'), true);
  s.set('reducedMotion', false);
  s.set('quality', 'low');
  s.reset();
  assert.equal(s.get('reducedMotion'), true);
  assert.equal(s.get('quality'), 'high');
});
