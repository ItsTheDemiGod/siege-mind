import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPauseState } from '../src/ui/pauseState.js';

test('starts running; the user flag toggles and sets', () => {
  const p = createPauseState();
  assert.equal(p.paused(), false);
  p.toggleUser();
  assert.equal(p.paused(), true);
  p.toggleUser();
  assert.equal(p.paused(), false);
  p.setUser(true);
  assert.equal(p.user, true);
  p.setUser(false);
  assert.equal(p.paused(), false);
});

test('locks stack and can be released in any order', () => {
  const p = createPauseState();
  p.lock('menu'); p.lock('settings'); p.lock('howto');
  assert.equal(p.lockCount, 3);
  p.unlock('menu');
  assert.equal(p.paused(), true);
  p.unlock('howto');
  assert.equal(p.paused(), true);
  p.unlock('settings');
  assert.equal(p.paused(), false);
  assert.equal(p.lockCount, 0);
});

test('the user flag is independent of locks: a user pause survives opening and closing settings', () => {
  const p = createPauseState();
  p.toggleUser();
  p.lock('settings');
  p.unlock('settings');
  assert.equal(p.paused(), true);
  p.toggleUser();
  assert.equal(p.paused(), false);
});

test('lock and unlock are idempotent; unknown reasons are ignored', () => {
  const p = createPauseState();
  p.lock('menu'); p.lock('menu');
  assert.equal(p.lockCount, 1);
  p.unlock('menu'); p.unlock('menu'); p.unlock('never-locked');
  assert.equal(p.paused(), false);
  assert.equal(p.hasLock('menu'), false);
  p.lock('x');
  assert.equal(p.hasLock('x'), true);
});

test('invalid reasons throw TypeError', () => {
  const p = createPauseState();
  for (const bad of ['', null, undefined, 5, {}]) {
    assert.throws(() => p.lock(bad), TypeError);
    assert.throws(() => p.unlock(bad), TypeError);
  }
});
