import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTutorial, OVERLAY_OPENED } from '../src/ui/tutorialState.js';
import { HINTS, HINT_GEOMETRY as G } from '../src/ui/tutorialText.js';
import { EVENT_TYPES as E } from '../src/sim/events.js';

function make({ step = 0, enabled = true, debug = false, mode = 'static' } = {}) {
  const store = { step, enabled };
  const t = createTutorial({ getStep: () => store.step, setStep: (n) => { store.step = n; }, enabled: () => store.enabled, setEnabled: (on) => { store.enabled = on; }, debug, mode });
  return { t, store };
}
const START = { phase: 'prep', towers: 0, nextWave: 1 };
const show = (t) => t.tick(G.delaySeconds + 0.01);

test('the build hint appears after the delay once a fresh game is in prep with no towers and wave 1 next', () => {
  const { t } = make();
  t.onEvent(E.GAME_STARTED, START);
  assert.equal(t.current(), null);
  t.tick(G.delaySeconds - 0.01);
  assert.equal(t.current(), null);
  t.tick(0.02);
  assert.equal(t.current(), 'build');
  for (const bad of [{ ...START, phase: 'running' }, { ...START, towers: 1 }, { ...START, nextWave: 2 }]) {
    const x = make();
    x.t.onEvent(E.GAME_STARTED, bad);
    show(x.t);
    assert.equal(x.t.current(), null);
  }
});

test('the hints go in strict order: build, start, upgrade, director, each persisted through the step', () => {
  const { t, store } = make({ mode: 'adaptive' });
  t.onEvent(E.GAME_STARTED, START);
  show(t);
  assert.equal(t.current(), 'build');
  t.onEvent(E.TOWER_PLACED, {});
  assert.deepEqual([t.current(), store.step], [null, 1]);
  show(t);
  assert.equal(t.current(), 'start');
  t.onEvent(E.WAVE_STARTED, { director: null });
  assert.deepEqual([t.current(), store.step], [null, 2]);
  t.onEvent(E.WAVE_ENDED, {});
  show(t);
  assert.equal(t.current(), 'upgrade');
  t.onEvent(E.TOWER_UPGRADED, {});
  assert.deepEqual([t.current(), store.step], [null, 3]);
  t.onEvent(E.WAVE_STARTED, { director: { reason: 'adapted' } });
  show(t);
  assert.equal(t.current(), 'director');
  t.onEvent(OVERLAY_OPENED, {});
  assert.deepEqual([t.current(), store.step], [null, 4]);
  t.onEvent(E.WAVE_ENDED, {});
  show(t);
  assert.equal(t.current(), null);
  assert.deepEqual(HINTS.map((h) => h.id), ['build', 'start', 'upgrade', 'director']);
});

test('a hint never jumps the queue: later triggers do nothing while an earlier hint is still pending', () => {
  const { t, store } = make({ step: 0 });
  t.onEvent(E.WAVE_ENDED, {});
  t.onEvent(E.WAVE_STARTED, { director: { reason: 'adapted' } });
  show(t);
  assert.deepEqual([t.current(), store.step], [null, 0]);
  const two = make({ step: 2 });
  two.t.onEvent(E.GAME_STARTED, START);
  two.t.onEvent(E.TOWER_PLACED, {});
  show(two.t);
  assert.equal(two.t.current(), null);
});

test('a tower placed before the build hint appears completes it silently and starts the next one', () => {
  const { t, store } = make();
  t.onEvent(E.GAME_STARTED, START);
  t.tick(0.1);
  t.onEvent(E.TOWER_PLACED, {});
  assert.equal(store.step, 1);
  show(t);
  assert.equal(t.current(), 'start');
});

test('starting a wave completes the start hint even when it was never shown', () => {
  const { t, store } = make({ step: 1 });
  t.onEvent(E.WAVE_STARTED, { director: null });
  assert.equal(store.step, 2);
  show(t);
  assert.equal(t.current(), null);
});

test('the upgrade hint hides on an upgrade, on the next wave start, after the auto-hide time and on dismiss', () => {
  const fresh = () => { const x = make({ step: 2 }); x.t.onEvent(E.WAVE_ENDED, {}); show(x.t); assert.equal(x.t.current(), 'upgrade'); return x; };
  let x = fresh(); x.t.onEvent(E.TOWER_UPGRADED, {}); assert.deepEqual([x.t.current(), x.store.step], [null, 3]);
  x = fresh(); x.t.onEvent(E.WAVE_STARTED, { director: null }); assert.deepEqual([x.t.current(), x.store.step], [null, 3]);
  x = fresh(); x.t.tick(G.autoHideSeconds - 0.5); assert.equal(x.t.current(), 'upgrade'); x.t.tick(0.6); assert.deepEqual([x.t.current(), x.store.step], [null, 3]);
  x = fresh(); x.t.dismiss(); assert.deepEqual([x.t.current(), x.store.step], [null, 3]);
});

test('build and start have no auto-hide: they stay until the player acts', () => {
  const { t } = make();
  t.onEvent(E.GAME_STARTED, START);
  show(t);
  t.tick(G.autoHideSeconds * 5);
  assert.equal(t.current(), 'build');
});

test('the director hint needs step 3, a Director mode (adaptive or adaptive2) and the reason adapted', () => {
  const run = (mode, reason, step = 3) => { const x = make({ step, mode }); x.t.onEvent(E.WAVE_STARTED, { director: reason ? { reason } : null }); show(x.t); return x.t.current(); };
  assert.equal(run('adaptive', 'adapted'), 'director');
  assert.equal(run('adaptive2', 'adapted'), 'director');
  for (const mode of ['static', 'random', 'prior', 'counter']) assert.equal(run(mode, 'adapted'), null, mode);
  for (const reason of ['cold-start', 'random', 'fixed', null]) assert.equal(run('adaptive', reason), null, String(reason));
  assert.equal(run('adaptive', 'adapted', 2), null);
  const x = make({ step: 3, mode: 'adaptive' });
  x.t.onEvent(E.WAVE_STARTED, { director: { reason: 'adapted' } });
  show(x.t);
  x.t.tick(G.autoHideSeconds + 0.1);
  assert.deepEqual([x.t.current(), x.store.step], [null, 4]);
});

test('a dismissed hint counts as seen', () => {
  const { t, store } = make();
  t.onEvent(E.GAME_STARTED, START);
  show(t);
  t.dismiss();
  assert.deepEqual([t.current(), store.step], [null, 1]);
  t.onEvent(E.TOWER_PLACED, {});
  show(t);
  assert.equal(t.current(), 'start');
  t.dismiss();
  t.dismiss();
  assert.equal(store.step, 2);
});

test('skipAll jumps to the end and switches the hints off; reset starts again', () => {
  const { t, store } = make();
  t.onEvent(E.GAME_STARTED, START);
  show(t);
  t.skipAll();
  assert.deepEqual([t.current(), store.step, store.enabled], [null, HINTS.length, false]);
  t.reset();
  assert.deepEqual([store.step, store.enabled, t.current()], [0, true, null]);
  t.onEvent(E.GAME_STARTED, START);
  show(t);
  assert.equal(t.current(), 'build');
});

test('nothing is shown when the hints are off, in debug games, or when the stored step is past the last hint', () => {
  for (const opts of [{ enabled: false }, { debug: true }, { step: HINTS.length }, { step: 99 }]) {
    const { t, store } = make(opts);
    const before = store.step;
    t.onEvent(E.GAME_STARTED, START);
    t.onEvent(E.TOWER_PLACED, {});
    t.onEvent(E.WAVE_ENDED, {});
    show(t);
    assert.equal(t.current(), null, JSON.stringify(opts));
    assert.equal(store.step, before);
  }
  const { t, store } = make();
  t.onEvent(E.GAME_STARTED, START);
  show(t);
  store.enabled = false; // switched off while a hint is up
  assert.equal(t.current(), null);
});

test('time advances only through tick: events alone never show a hint', () => {
  const { t } = make();
  t.onEvent(E.GAME_STARTED, START);
  assert.equal(t.current(), null);
  t.tick(0);
  assert.equal(t.current(), null);
});
