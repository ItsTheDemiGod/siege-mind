import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSettings } from '../src/ui/settings.js';

const fakeStorage = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), data };
};

test('defaults', () => {
  assert.deepEqual(createSettings().getAll(), {
    quality: 'high', autoQuality: true, screenShake: true, reducedMotion: false, particleDensity: 1, damageNumbers: false,
    muted: false, masterVolume: 0.6, sfxVolume: 0.8, tutorialHints: true, tutorialStep: 0,
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

test('damageNumbers: default false, boolean-validated, persisted', () => {
  const st = fakeStorage();
  const a = createSettings({ storage: st });
  assert.equal(a.get('damageNumbers'), false);
  a.set('damageNumbers', 'yes');
  assert.equal(a.get('damageNumbers'), false);
  a.set('damageNumbers', true);
  assert.equal(createSettings({ storage: st }).get('damageNumbers'), true);
});

test('audio and hint settings: defaults fill in for old stored settings, values are clamped, corrupt values fall back', () => {
  const st = fakeStorage();
  st.setItem('siegeMind.settings.v1', JSON.stringify({ quality: 'low', screenShake: false })); // an old save without the new keys
  const s = createSettings({ storage: st });
  assert.equal(s.get('quality'), 'low');
  assert.deepEqual([s.get('muted'), s.get('masterVolume'), s.get('sfxVolume'), s.get('tutorialHints'), s.get('tutorialStep')], [false, 0.6, 0.8, true, 0]);
  s.set('masterVolume', 3);
  s.set('sfxVolume', -1);
  assert.deepEqual([s.get('masterVolume'), s.get('sfxVolume')], [1, 0]);
  s.set('masterVolume', NaN);
  s.set('muted', 'yes');
  s.set('tutorialStep', 2.5);
  s.set('tutorialStep', 500);
  assert.equal(s.get('masterVolume'), 1);
  assert.equal(s.get('muted'), false);
  assert.equal(s.get('tutorialStep'), 99);
  s.set('tutorialHints', false);
  s.set('muted', true);
  const again = createSettings({ storage: st });
  assert.deepEqual([again.get('tutorialHints'), again.get('muted'), again.get('masterVolume')], [false, true, 1]);
  const bad = fakeStorage();
  bad.setItem('siegeMind.settings.v1', JSON.stringify({ masterVolume: 'loud', sfxVolume: null, tutorialStep: 'x', muted: 1, tutorialHints: 'no' }));
  const c = createSettings({ storage: bad });
  assert.deepEqual([c.get('masterVolume'), c.get('sfxVolume'), c.get('tutorialStep'), c.get('muted'), c.get('tutorialHints')], [0.6, 0.8, 0, false, true]);
});
